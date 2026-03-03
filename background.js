/**
 * ◢ RDWE Nostr Signer ◣ — Background Service Worker v1.4
 * Fix: All pending approval requests go to ONE queue window, not N windows.
 */

import {
  hexToBytes, bytesToHex,
  getPublicKey, generatePrivKey, schnorrSign, getEventHash,
  hexToNsec,
  nip04Encrypt, nip04Decrypt,
  nip44Encrypt, nip44Decrypt,
  encryptPrivKey, decryptPrivKey
} from './lib/crypto.js';

// ── Session ──────────────────────────────────────────────────────
let _priv = null, _lockTimer = null;
const SESSION_TIMEOUT = 15 * 60 * 1000;
function resetLock() { clearTimeout(_lockTimer); _lockTimer = setTimeout(() => { _priv = null; }, SESSION_TIMEOUT); }

// ── Storage ──────────────────────────────────────────────────────
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

// ── storage.session polyfill ─────────────────────────────────────
if (!chrome.storage.session) {
  const _m = {};
  chrome.storage.session = {
    get:    k => Promise.resolve(typeof k==='string' ? {[k]:_m[k]} : Object.fromEntries((Array.isArray(k)?k:Object.keys(k)).map(x=>[x,_m[x]]))),
    set:    o => { Object.assign(_m,o); return Promise.resolve(); },
    remove: k => { (Array.isArray(k)?k:[k]).forEach(x=>delete _m[x]); return Promise.resolve(); }
  };
}

// ── Activity log ─────────────────────────────────────────────────
const actLog = [];
function logEv(origin, method, status) {
  actLog.unshift({ ts: Date.now(), origin, method, status });
  if (actLog.length > 200) actLog.pop();
}

// ══════════════════════════════════════════════════════════════════
// APPROVAL QUEUE — ONE window for ALL pending requests
// ══════════════════════════════════════════════════════════════════
const queue    = [];   // { id, origin, method, params, resolve, reject }
let   qWinId   = null; // currently open prompt window ID
let   openingWin = false;

async function openQueueWindow() {
  if (openingWin || qWinId !== null) return;
  openingWin = true;
  try {
    const win = await chrome.windows.create({
      url: 'prompt.html', type: 'popup', width: 520, height: 460, focused: true
    });
    qWinId = win.id;
  } finally {
    openingWin = false;
  }
}

// Called by prompt window to get the next pending request
function getNextRequest() {
  return queue.find(r => r.status === 'pending') || null;
}

async function enqueue(origin, method, params) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    queue.push({ id, origin, method, params, resolve, reject, status: 'pending' });
    openQueueWindow();
  });
}

// Window closed by user without answering → reject all pending
chrome.windows.onRemoved.addListener((winId) => {
  if (winId !== qWinId) return;
  qWinId = null;
  const leftovers = queue.filter(r => r.status === 'pending');
  leftovers.forEach(r => { r.status = 'done'; r.reject(new Error('User closed the prompt')); });
  queue.splice(0); // clear
});

// ── Core handler ─────────────────────────────────────────────────
async function handle({ method, params, origin }) {

  if (method === 'getPublicKey') {
    const pub = _priv ? getPublicKey(_priv) : await getPubKey();
    if (!pub) throw new Error('No key configured — open RDWE Nostr Signer to set up your key.');
    logEv(origin, 'getPublicKey', 'ok');
    return pub;
  }

  if (method === 'getRelays') {
    return (await ls.get('relays')).relays || {};
  }

  if (!_priv) throw new Error('RDWE Nostr Signer is locked — click the extension icon and unlock it first.');
  resetLock();

  const needsApproval = ['signEvent','nip04_encrypt','nip04_decrypt','nip44_encrypt','nip44_decrypt'];
  if (needsApproval.includes(method) && !(await checkPerm(origin, method))) {
    try {
      const { remember } = await enqueue(origin, method, params);
      if (remember) await grantPerm(origin, method);
    } catch (e) {
      logEv(origin, method, 'denied');
      throw e;
    }
  }

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
    case 'nip04_encrypt': { const r = await nip04Encrypt(_priv, params.pubkey, params.plaintext);  logEv(origin,'nip04.enc','ok'); return r; }
    case 'nip04_decrypt': { const r = await nip04Decrypt(_priv, params.pubkey, params.ciphertext); logEv(origin,'nip04.dec','ok'); return r; }
    case 'nip44_encrypt': { const r = await nip44Encrypt(_priv, params.pubkey, params.plaintext);  logEv(origin,'nip44.enc','ok'); return r; }
    case 'nip44_decrypt': { const r = await nip44Decrypt(_priv, params.pubkey, params.ciphertext); logEv(origin,'nip44.dec','ok'); return r; }
    default: throw new Error(`Unknown method: ${method}`);
  }
}

// ── Message router ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _s, reply) => {

  if (msg.type === 'nostr_req') {
    handle(msg).then(res => reply({ res })).catch(e => reply({ err: e.message }));
    return true;
  }

  // Prompt window asks: what's next in queue?
  if (msg.type === 'prompt_get_next') {
    const next = getNextRequest();
    if (!next) { reply({ item: null }); return false; }
    reply({
      item: {
        id:     next.id,
        origin: next.origin,
        method: next.method,
        params: next.params,
        total:  queue.filter(r => r.status === 'pending').length
      }
    });
    return false;
  }

  // Prompt window resolves one request
  if (msg.type === 'prompt_respond') {
    const item = queue.find(r => r.id === msg.id && r.status === 'pending');
    if (item) {
      item.status = 'done';
      if (msg.approved) item.resolve({ remember: msg.remember });
      else              item.reject(new Error('User rejected'));
    }
    // Remove done items
    const idx = queue.findIndex(r => r.id === msg.id);
    if (idx >= 0) queue.splice(idx, 1);

    // Check if more pending
    const nextPending = queue.find(r => r.status === 'pending');
    reply({ hasMore: !!nextPending });
    return false;
  }

  // Prompt: approve ALL pending at once
  if (msg.type === 'prompt_approve_all') {
    queue.filter(r => r.status === 'pending').forEach(r => {
      r.status = 'done';
      r.resolve({ remember: msg.remember });
    });
    if (msg.remember && msg.origin) grantPerm(msg.origin, msg.method);
    queue.splice(0);
    reply({ ok: true });
    return false;
  }

  // Prompt: deny ALL
  if (msg.type === 'prompt_deny_all') {
    queue.filter(r => r.status === 'pending').forEach(r => {
      r.status = 'done';
      r.reject(new Error('User rejected all'));
    });
    queue.splice(0);
    reply({ ok: true });
    return false;
  }

  if (msg.type === 'session_status') {
    hasKey().then(has => reply({ hasKey: has, unlocked: !!_priv, pubkey: _priv ? getPublicKey(_priv) : null }));
    return true;
  }
  if (msg.type === 'unlock') {
    getBlob().then(async blob => {
      if (!blob) return reply({ err: 'No key stored' });
      try {
        _priv = await decryptPrivKey(blob, msg.password);
        resetLock();
        reply({ ok: true, pubKeyHex: getPublicKey(_priv) });
      } catch(e) { reply({ err: e.message }); }
    });
    return true;
  }
  if (msg.type === 'lock') {
    _priv = null; clearTimeout(_lockTimer);
    reply({ ok: true }); return false;
  }
  if (msg.type === 'save_key') {
    encryptPrivKey(msg.privKeyHex, msg.password).then(async blob => {
      const pub = getPublicKey(msg.privKeyHex);
      await ls.set({ enc_key: blob, pubkey: pub });
      _priv = msg.privKeyHex; resetLock();
      reply({ ok: true, pubKeyHex: pub });
    }).catch(e => reply({ err: e.message }));
    return true;
  }
  if (msg.type === 'generate_key') {
    const priv = generatePrivKey();
    encryptPrivKey(priv, msg.password).then(async blob => {
      const pub = getPublicKey(priv);
      await ls.set({ enc_key: blob, pubkey: pub });
      _priv = priv; resetLock();
      reply({ ok: true, privKeyHex: priv, pubKeyHex: pub });
    }).catch(e => reply({ err: e.message }));
    return true;
  }
  if (msg.type === 'export_nsec') {
    if (!_priv) return reply({ err: 'Session locked' });
    reply({ nsec: hexToNsec(_priv) }); return false;
  }
  if (msg.type === 'delete_key') {
    _priv = null; clearTimeout(_lockTimer);
    ls.remove(['enc_key','pubkey','permissions','relays']).then(() => reply({ ok: true }));
    return true;
  }
  if (msg.type === 'get_log')         { reply({ log: actLog }); return false; }
  if (msg.type === 'get_permissions') { getPerms().then(p => reply({ permissions: p })); return true; }
  if (msg.type === 'revoke_origin')   { getPerms().then(async p => { delete p[msg.origin]; await setPerms(p); reply({ ok: true }); }); return true; }
  if (msg.type === 'save_relays')     { ls.set({ relays: msg.relays }).then(() => reply({ ok: true })); return true; }
  if (msg.type === 'get_relays')      { ls.get('relays').then(d => reply({ relays: d.relays || {} })); return true; }
});
