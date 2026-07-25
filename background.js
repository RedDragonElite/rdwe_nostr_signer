/**
 * ◢ RDWE Nostr Signer ◣ — Background Service Worker v1.6.1
 *
 * SECURITY MODEL:
 *   - nsec stored AES-256-GCM encrypted (PBKDF2 310k iterations)
 *   - pubkey stored plaintext → getPublicKey() always works
 *   - Decrypted privkey in memory only during unlocked session
 *   - Session auto-locks after 15min idle
 *   - When locked + site requests signing → unlock popup appears
 *     user enters password, unlocks, request proceeds seamlessly
 *
 * v1.6 HARDENING:
 *   - Crypto self-tests run on init; all nostr ops refuse if any vector fails
 *   - NIP-44 conversation-key LRU cache (in-memory, cleared on lock)
 */

import {
  hexToBytes, bytesToHex,
  getPublicKey, generatePrivKey, schnorrSign, getEventHash,
  hexToNsec,
  nip04Encrypt, nip04Decrypt,
  nip44Encrypt, nip44Decrypt,
  nip44GetConversationKey, nip44EncryptWithConvKey, nip44DecryptWithConvKey,
  encryptPrivKey, decryptPrivKey
} from './lib/crypto.js';
import { runSelfTests } from './lib/test_vectors.js';

// ── Crypto integrity gate ─────────────────────────────────
// Runs once at SW load. If any KAT fails, we refuse all nostr operations.
// This catches: silent JS engine corruption, modified extension files,
// and any future regression in crypto.js.
let _cryptoBroken    = false;
let _cryptoBrokenMsg = '';
const _cryptoReady   = (async () => {
  try {
    const r = await runSelfTests();
    if (!r.ok) {
      _cryptoBroken    = true;
      _cryptoBrokenMsg = `Crypto integrity check failed: ${r.fail}/${r.total} vectors failed. ${r.errors.join(' | ')}`;
      console.error('[RDWE]', _cryptoBrokenMsg);
    } else {
      console.log(`[RDWE] Crypto self-tests: ${r.pass}/${r.total} passed.`);
    }
  } catch (e) {
    _cryptoBroken    = true;
    _cryptoBrokenMsg = `Crypto self-tests threw: ${e.message}`;
    console.error('[RDWE]', _cryptoBrokenMsg);
  }
})();

function assertCryptoOk() {
  if (_cryptoBroken) throw new Error(_cryptoBrokenMsg || 'Crypto unavailable');
}

// ── storage.session polyfill ──────────────────────────────
// Moved ahead of the Session block below (v1.6.1) — that code now relies
// on chrome.storage.session existing from the very first line it runs.
// Note: on a browser genuinely missing chrome.storage.session, this
// in-memory fallback can't survive SW restarts either (same limitation
// this whole patch exists to fix) — it exists only so we fail soft
// instead of throwing, not as a real substitute. Real Chrome has shipped
// storage.session natively since Chrome 102, so this path is effectively
// dead code for this extension's actual target, kept defensively.
if (!chrome.storage.session) {
  const _m = {};
  chrome.storage.session = {
    get:    k => Promise.resolve(typeof k==='string' ? {[k]:_m[k]} : Object.fromEntries((Array.isArray(k)?k:Object.keys(k)).map(x=>[x,_m[x]]))),
    set:    o => { Object.assign(_m,o); return Promise.resolve(); },
    remove: k => { (Array.isArray(k)?k:[k]).forEach(x=>delete _m[x]); return Promise.resolve(); }
  };
}

// ── Session ──────────────────────────────────────────────
// IMPORTANT (v1.6.1 fix): MV3 service workers are killed by Chrome after
// ~30s of inactivity and respawned fresh on the next message. Plain `let`
// variables like _priv do NOT survive that — they silently reset to their
// initial value, which used to make "remembered" per-origin permissions
// look broken: the permission itself (chrome.storage.local) was fine, but
// `if (!_priv || !hasPerm)` still tripped because _priv kept dying between
// requests, even seconds apart, e.g. across a normal page reload.
//
// Fix: persist the unlocked key + a last-activity timestamp to
// chrome.storage.session — Chrome's storage area built specifically for
// this problem (survives SW restarts, stays memory-only, auto-clears on
// browser close, never touches disk). Security properties are unchanged
// from before; this only fixes *where* the same in-memory-only secret
// lives so it survives the SW's own restarts, not new persistence.
let _priv      = null;
let _lockTimer = null;
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 min

async function persistSessionKey() {
  try { await chrome.storage.session.set({ sess_priv: _priv, sess_activity: Date.now() }); } catch (_) {}
}
async function touchSessionActivity() {
  try { await chrome.storage.session.set({ sess_activity: Date.now() }); } catch (_) {}
}
async function clearPersistedSession() {
  try { await chrome.storage.session.remove(['sess_priv', 'sess_activity']); } catch (_) {}
}

// Runs once per SW wake-up, before any request is handled. If a still-valid
// (within SESSION_TIMEOUT) unlocked session was persisted from before this
// particular SW instance was killed, restore it — this is what makes
// "remember this site" actually behave like it sounds instead of
// re-prompting on almost every request.
const _sessionRestored = (async () => {
  try {
    const { sess_priv, sess_activity } = await chrome.storage.session.get(['sess_priv', 'sess_activity']);
    if (sess_priv && sess_activity && (Date.now() - sess_activity) < SESSION_TIMEOUT) {
      _priv = sess_priv;
      resetLock();
    } else if (sess_priv) {
      // Stale beyond the idle timeout — don't silently resurrect it.
      await clearPersistedSession();
    }
  } catch (_) {}
})();

function resetLock() {
  clearTimeout(_lockTimer);
  _lockTimer = setTimeout(() => { lockSession(); }, SESSION_TIMEOUT);
  touchSessionActivity();
}

function lockSession() {
  _priv = null;
  convKeyCache.clear();   // ← drop derived keys when we lock
  clearTimeout(_lockTimer);
  clearPersistedSession();
}

// ── NIP-44 Conversation-Key LRU Cache ─────────────────────
// Each NIP-44 op without cache costs: 1× ECDH point-mul (~slow BigInt) + HKDF-Extract.
// For an inbox of N DMs from the same peer: N× the same op. Cache flips it to 1.
//
// Stored only in memory; cleared on lock; never persisted.
// LRU via Map insertion order: re-set on hit moves to end.
const CONV_KEY_CACHE_MAX = 64;
const convKeyCache = new Map(); // pubkey_hex → Uint8Array(32)

async function getConvKey(privHex, pubHex) {
  const hit = convKeyCache.get(pubHex);
  if (hit) {
    // Refresh LRU position
    convKeyCache.delete(pubHex);
    convKeyCache.set(pubHex, hit);
    return hit;
  }
  const key = await nip44GetConversationKey(privHex, pubHex);
  if (convKeyCache.size >= CONV_KEY_CACHE_MAX) {
    // Evict oldest (first entry in insertion order)
    const oldest = convKeyCache.keys().next().value;
    convKeyCache.delete(oldest);
  }
  convKeyCache.set(pubHex, key);
  return key;
}

// ── Storage helpers ───────────────────────────────────────
const ls = chrome.storage.local;
async function getBlob()   { return (await ls.get('enc_key')).enc_key || null; }
async function getPubKey() { return (await ls.get('pubkey')).pubkey   || null; }
async function hasKey()    { return !!(await getBlob()); }
async function getPerms()  { return (await ls.get('permissions')).permissions || {}; }
async function setPerms(p) { await ls.set({ permissions: p }); }
async function checkPerm(origin, method) { return (await getPerms())?.[origin]?.[method] === 'always'; }
async function grantPerm(origin, method) {
  const p = await getPerms();
  if (!p[origin]) p[origin] = {};
  p[origin][method] = 'always';
  await setPerms(p);
}

// ── Activity log ──────────────────────────────────────────
const actLog = [];
function logEv(origin, method, status) {
  actLog.unshift({ ts: Date.now(), origin, method, status });
  if (actLog.length > 200) actLog.pop();
}

// ═══════════════════════════════════════════════════════════
// APPROVAL + UNLOCK QUEUE
// One popup window handles everything:
//   - Unlock (if locked) + Approve
//   - Just Approve (if already unlocked)
//   - Multiple queued requests shown one by one
// ═══════════════════════════════════════════════════════════
const queue    = [];   // { id, origin, method, params, resolve, reject, status }
let   qWinId   = null;
let   opening  = false;

async function openQueueWindow() {
  if (opening || qWinId !== null) return;
  opening = true;
  try {
    const win = await chrome.windows.create({
      url: 'prompt.html', type: 'popup', width: 520, height: 480, focused: true
    });
    qWinId = win.id;
  } finally { opening = false; }
}

chrome.windows.onRemoved.addListener(winId => {
  if (winId !== qWinId) return;
  qWinId = null;
  // Reject anything still pending
  queue.filter(r => r.status === 'pending').forEach(r => {
    r.status = 'done';
    r.reject(new Error('User closed the window'));
  });
  queue.splice(0);
});

function enqueue(origin, method, params) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    queue.push({ id, origin, method, params, resolve, reject, status: 'pending' });
    openQueueWindow();
  });
}

// ── Core nostr handler ────────────────────────────────────
async function handle({ method, params, origin }) {

  // Crypto integrity gate — wait for self-tests, then refuse if any failed.
  await _cryptoReady;
  assertCryptoOk();

  // Session restore gate — if this SW instance just woke up fresh, this
  // is what re-populates _priv from a still-valid persisted session
  // before we check it below. Without this, "remember this site" looked
  // broken because _priv was almost always null by the time a request
  // arrived, even though the actual permission was saved correctly.
  await _sessionRestored;

  // getPublicKey — always works, no unlock needed
  if (method === 'getPublicKey') {
    const pub = _priv ? getPublicKey(_priv) : await getPubKey();
    if (!pub) throw new Error('No key configured — open RDWE Nostr Signer to set up.');
    logEv(origin, 'getPublicKey', 'ok');
    return pub;
  }

  if (method === 'getRelays') {
    return (await ls.get('relays')).relays || {};
  }

  // Everything else: check permission first
  const needsApproval = ['signEvent','nip04_encrypt','nip04_decrypt','nip44_encrypt','nip44_decrypt'];
  if (needsApproval.includes(method)) {
    const hasPerm = await checkPerm(origin, method);

    if (!_priv || !hasPerm) {
      // Open prompt — handles unlock + approval in one step
      try {
        const { remember } = await enqueue(origin, method, params);
        if (remember) await grantPerm(origin, method);
      } catch(e) {
        logEv(origin, method, 'denied');
        throw e;
      }
    }
  }

  // At this point session must be unlocked (prompt did it if needed)
  if (!_priv) throw new Error('Session could not be unlocked.');
  resetLock();

  const pub = getPublicKey(_priv);

  switch (method) {
    case 'signEvent': {
      const ev = {
        kind:       params.event.kind       ?? 1,
        tags:       params.event.tags       ?? [],
        content:    params.event.content    ?? '',
        created_at: params.event.created_at ?? Math.floor(Date.now()/1000),
        pubkey: pub
      };
      const hash = await getEventHash(ev);
      ev.id  = bytesToHex(hash);
      ev.sig = bytesToHex(await schnorrSign(hash, hexToBytes(_priv)));
      logEv(origin, 'signEvent', 'ok');
      return ev;
    }
    case 'nip04_encrypt': { const r=await nip04Encrypt(_priv,params.pubkey,params.plaintext);  logEv(origin,'nip04.enc','ok'); return r; }
    case 'nip04_decrypt': { const r=await nip04Decrypt(_priv,params.pubkey,params.ciphertext); logEv(origin,'nip04.dec','ok'); return r; }
    case 'nip44_encrypt': {
      const ck = await getConvKey(_priv, params.pubkey);
      const r  = await nip44EncryptWithConvKey(ck, params.plaintext);
      logEv(origin,'nip44.enc','ok');
      return r;
    }
    case 'nip44_decrypt': {
      const ck = await getConvKey(_priv, params.pubkey);
      const r  = await nip44DecryptWithConvKey(ck, params.ciphertext);
      logEv(origin,'nip44.dec','ok');
      return r;
    }
    default: throw new Error(`Unknown method: ${method}`);
  }
}

// ── Message router ────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _s, reply) => {

  // ── Nostr API call from page ──
  if (msg.type === 'nostr_req') {
    handle(msg).then(res => reply({ res })).catch(e => reply({ err: e.message }));
    return true;
  }

  // ── Prompt: get next queued item ──
  if (msg.type === 'prompt_get_next') {
    (async () => {
      await _sessionRestored;
      const next = queue.find(r => r.status === 'pending');
      if (!next) { reply({ item: null }); return; }
      reply({
        item: {
          id:       next.id,
          origin:   next.origin,
          method:   next.method,
          params:   next.params,
          total:    queue.filter(r => r.status === 'pending').length,
          locked:   !_priv,     // ← tells prompt whether to show password field
        }
      });
    })();
    return true;
  }

  // ── Prompt: respond to one item (with optional unlock) ──
  if (msg.type === 'prompt_respond') {
    (async () => {
      await _sessionRestored;
      const item = queue.find(r => r.id === msg.id && r.status === 'pending');
      if (!item) { reply({ hasMore: false }); return; }

      // If locked and user provided password → unlock first
      if (msg.password && !_priv) {
        try {
          const blob = await getBlob();
          _priv = await decryptPrivKey(blob, msg.password);
          resetLock();
          await persistSessionKey();
        } catch(e) {
          reply({ err: 'Wrong password — decryption failed' });
          return;
        }
      }

      item.status = 'done';
      if (msg.approved) item.resolve({ remember: msg.remember });
      else              item.reject(new Error('User rejected'));

      const idx = queue.findIndex(r => r.id === msg.id);
      if (idx >= 0) queue.splice(idx, 1);

      const hasMore = queue.some(r => r.status === 'pending');
      reply({ hasMore });
    })();
    return true;
  }

  // ── Prompt: approve all ──
  if (msg.type === 'prompt_approve_all') {
    (async () => {
      await _sessionRestored;
      if (msg.password && !_priv) {
        try {
          const blob = await getBlob();
          _priv = await decryptPrivKey(blob, msg.password);
          resetLock();
          await persistSessionKey();
        } catch(e) { reply({ err: 'Wrong password' }); return; }
      }
      queue.filter(r => r.status === 'pending').forEach(r => {
        r.status = 'done';
        r.resolve({ remember: msg.remember });
        if (msg.remember) grantPerm(r.origin, r.method);
      });
      queue.splice(0);
      reply({ ok: true });
    })();
    return true;
  }

  // ── Prompt: deny all ──
  if (msg.type === 'prompt_deny_all') {
    queue.filter(r => r.status === 'pending').forEach(r => {
      r.status = 'done';
      r.reject(new Error('User rejected all'));
    });
    queue.splice(0);
    reply({ ok: true });
    return false;
  }

  // ── Popup: status ──
  if (msg.type === 'session_status') {
    (async () => {
      await _sessionRestored;
      const has = await hasKey();
      reply({ hasKey: has, unlocked: !!_priv, pubkey: _priv ? getPublicKey(_priv) : null });
    })();
    return true;
  }

  // ── Popup: unlock ──
  if (msg.type === 'unlock') {
    getBlob().then(async blob => {
      if (!blob) return reply({ err: 'No key stored' });
      try {
        _priv = await decryptPrivKey(blob, msg.password);
        resetLock();
        await persistSessionKey();
        reply({ ok: true, pubKeyHex: getPublicKey(_priv) });
      } catch(e) { reply({ err: e.message }); }
    });
    return true;
  }

  // ── Popup: lock ──
  if (msg.type === 'lock') {
    lockSession();
    reply({ ok: true }); return false;
  }

  // ── Popup: save key ──
  if (msg.type === 'save_key') {
    encryptPrivKey(msg.privKeyHex, msg.password).then(async blob => {
      const pub = getPublicKey(msg.privKeyHex);
      await ls.set({ enc_key: blob, pubkey: pub });
      _priv = msg.privKeyHex; resetLock();
      await persistSessionKey();
      reply({ ok: true, pubKeyHex: pub });
    }).catch(e => reply({ err: e.message }));
    return true;
  }

  // ── Popup: generate key ──
  if (msg.type === 'generate_key') {
    const priv = generatePrivKey();
    encryptPrivKey(priv, msg.password).then(async blob => {
      const pub = getPublicKey(priv);
      await ls.set({ enc_key: blob, pubkey: pub });
      _priv = priv; resetLock();
      await persistSessionKey();
      reply({ ok: true, privKeyHex: priv, pubKeyHex: pub });
    }).catch(e => reply({ err: e.message }));
    return true;
  }

  // ── Popup: export nsec ──
  if (msg.type === 'export_nsec') {
    (async () => {
      await _sessionRestored;
      if (!_priv) { reply({ err: 'Session locked' }); return; }
      reply({ nsec: hexToNsec(_priv) });
    })();
    return true;
  }

  // ── Popup: delete everything ──
  if (msg.type === 'delete_key') {
    lockSession();
    ls.remove(['enc_key','pubkey','permissions','relays']).then(() => reply({ ok: true }));
    return true;
  }

  if (msg.type === 'get_log')         { reply({ log: actLog }); return false; }
  if (msg.type === 'get_permissions') { getPerms().then(p => reply({ permissions: p })); return true; }
  if (msg.type === 'revoke_origin')   { getPerms().then(async p => { delete p[msg.origin]; await setPerms(p); reply({ ok: true }); }); return true; }
  if (msg.type === 'save_relays')     { ls.set({ relays: msg.relays }).then(() => reply({ ok: true })); return true; }
  if (msg.type === 'get_relays')      { ls.get('relays').then(d => reply({ relays: d.relays||{} })); return true; }
});
