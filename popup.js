/**
 * ◢ RDWE Nostr Signer ◣ — Popup Script v1.1
 * Screens: setup → lock → main (unlocked)
 */
'use strict';

const $ = id => document.getElementById(id);
const bg = (type, extra = {}) => chrome.runtime.sendMessage({ type, ...extra });

let _pubKeyHex = null;

// ── Toast ────────────────────────────────────────────────────────
function showToast(msg, isErr = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `msg ${isErr ? 'msg-err' : 'msg-ok'}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2000);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('⎘ Copied!')).catch(() => {});
}

function truncate(s, n = 18) {
  if (!s || s.length <= n * 2 + 3) return s || '—';
  return s.slice(0, n) + '…' + s.slice(-n);
}

function showMsg(id, text, type = 'ok') {
  const el = $(id);
  if (el) el.innerHTML = `<div class="msg msg-${type} mt4">${text}</div>`;
}

function fmtTs(ts) {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

// ── Screen switcher ──────────────────────────────────────────────
function showScreen(name) {
  ['setup', 'lock', 'main'].forEach(s =>
    $(`screen-${s}`)?.classList.toggle('hidden', s !== name)
  );
}

// ── Boot ─────────────────────────────────────────────────────────
async function init() {
  const s = await bg('session_status');

  if (!s.hasKey) {
    showScreen('setup');
    setupSetupHandlers();
    $('key-dot').className = 'dot dot-red';
    $('key-status').textContent = 'NO KEY';
    $('lock-badge').textContent = '🔒 SETUP';
    $('lock-badge').className = 'lock-state locked';
    return;
  }

  if (!s.unlocked) {
    showScreen('lock');
    setupLockHandlers();
    $('key-dot').className = 'dot dot-yellow';
    $('key-status').textContent = 'KEY LOCKED';
    $('lock-badge').textContent = '🔒 LOCKED';
    $('lock-badge').className = 'lock-state locked';
    return;
  }

  // Unlocked
  await loadMainScreen(s.pubkey);
}

// ── Setup screen ─────────────────────────────────────────────────
function setupSetupHandlers() {
  // Password strength indicator
  $('setup-pw1').addEventListener('input', () => {
    const pw = $('setup-pw1').value;
    const score = pwScore(pw);
    const bar = $('pw-bar');
    const hint = $('pw-hint');
    const colors = ['#ff2255', '#ff6600', '#ffd700', '#00c96a', '#00ff88'];
    const labels = ['Very weak', 'Weak', 'Fair', 'Strong', '💪 Very strong'];
    bar.style.width = `${(score / 4) * 100}%`;
    bar.style.background = colors[score];
    hint.textContent = pw.length ? labels[score] : '';
  });

  $('setup-import-btn').addEventListener('click', async () => {
    await doSetup(false);
  });

  $('setup-gen-btn').addEventListener('click', async () => {
    await doSetup(true);
  });
}

async function doSetup(generate) {
  const pw1  = $('setup-pw1').value;
  const pw2  = $('setup-pw2').value;
  const nsec = $('setup-nsec').value.trim();

  if (pw1.length < 8) return showMsg('setup-msg', 'Password must be at least 8 characters', 'err');
  if (pw1 !== pw2)    return showMsg('setup-msg', 'Passwords do not match', 'err');

  if (generate) {
    showMsg('setup-msg', '⏳ Generating key and encrypting…', 'warn');
    const res = await bg('generate_key', { password: pw1 });
    if (res.err) return showMsg('setup-msg', res.err, 'err');
    showToast('⚡ Key generated!');
    showMsg('setup-msg', `✔ Key generated. npub: ${truncate(npubFromHex(res.pubKeyHex))}`, 'ok');
    setTimeout(() => init(), 800);
    return;
  }

  if (!nsec) return showMsg('setup-msg', 'Paste your nsec or click Generate New', 'err');

  let privKeyHex;
  try { privKeyHex = nsecToHex(nsec); }
  catch (e) { return showMsg('setup-msg', `Invalid nsec: ${e.message}`, 'err'); }

  showMsg('setup-msg', '⏳ Encrypting key…', 'warn');
  const res = await bg('save_key', { privKeyHex, password: pw1 });
  if (res.err) return showMsg('setup-msg', res.err, 'err');
  showToast('✔ Key saved!');
  setTimeout(() => init(), 800);
}

// ── Lock screen ──────────────────────────────────────────────────
function setupLockHandlers() {
  const doUnlock = async () => {
    const pw = $('unlock-pw').value;
    if (!pw) return showMsg('unlock-msg', 'Enter your password', 'err');

    showMsg('unlock-msg', '⏳ Decrypting…', 'warn');
    const res = await bg('unlock', { password: pw });

    if (res.err) {
      showMsg('unlock-msg', `✖ ${res.err}`, 'err');
      $('unlock-pw').value = '';
      $('unlock-pw').focus();
      return;
    }

    showToast('🔓 Unlocked!');
    await loadMainScreen(res.pubKeyHex);
  };

  $('unlock-btn').addEventListener('click', doUnlock);
  $('unlock-pw').addEventListener('keydown', e => { if (e.key === 'Enter') doUnlock(); });

  $('wipe-btn').addEventListener('click', async () => {
    if (!confirm('⚠ WIPE everything?\n\nThis deletes your encrypted key and all permissions.\nYou will need your nsec to restore access.')) return;
    await bg('delete_key');
    showToast('Wiped.');
    setTimeout(() => location.reload(), 500);
  });
}

// ── Main (unlocked) screen ───────────────────────────────────────
async function loadMainScreen(pubKeyHex) {
  _pubKeyHex = pubKeyHex;
  showScreen('main');

  $('key-dot').className  = 'dot dot-green';
  $('key-status').textContent = 'UNLOCKED';
  $('lock-badge').textContent = '🔓 UNLOCKED';
  $('lock-badge').className   = 'lock-state unlocked';
  $('lock-btn').classList.remove('hidden');

  // Keys display
  const npub = npubFromHex(pubKeyHex);
  $('npub-val').textContent   = truncate(npub, 22);
  $('pubhex-val').textContent = truncate(pubKeyHex, 20);
  $('npub-box').addEventListener('click', () => copyText(npub));
  $('pubhex-box').addEventListener('click', () => copyText(pubKeyHex));

  // Update activity count
  const logRes = await bg('get_log');
  updateActCount(logRes?.log?.length || 0);

  setupMainHandlers();
  setupTabHandlers();
}

function updateActCount(n) {
  $('act-dot').className   = n ? 'dot dot-green' : 'dot dot-dim';
  $('act-count').textContent = `${n} EVENTS`;
  $('log-count').textContent = `(${n})`;
}

function setupMainHandlers() {
  // Lock button
  $('lock-btn').addEventListener('click', async () => {
    await bg('lock');
    showToast('🔒 Locked');
    setTimeout(() => location.reload(), 400);
  });

  // Show nsec
  $('show-nsec-btn').addEventListener('click', async () => {
    const res = await bg('export_nsec');
    if (res.err) return showToast(res.err, true);
    $('nsec-val').textContent = res.nsec;
    $('nsec-shown').classList.remove('hidden');
    $('show-nsec-btn').classList.add('hidden');
    $('nsec-box').addEventListener('click', () => copyText(res.nsec), { once: true });

    // Auto-hide after 30 seconds
    setTimeout(() => {
      $('nsec-shown').classList.add('hidden');
      $('show-nsec-btn').classList.remove('hidden');
      $('nsec-val').textContent = '—';
    }, 30_000);
  });

  $('hide-nsec-btn').addEventListener('click', () => {
    $('nsec-shown').classList.add('hidden');
    $('show-nsec-btn').classList.remove('hidden');
    $('nsec-val').textContent = '—';
  });

  // Replace key
  $('replace-btn').addEventListener('click', async () => {
    const nsec = $('replace-nsec').value.trim();
    const pw   = $('replace-pw').value;
    if (!nsec) return showMsg('replace-msg', 'Paste your nsec', 'err');
    if (!pw)   return showMsg('replace-msg', 'Enter your master password', 'err');

    let privKeyHex;
    try { privKeyHex = nsecToHex(nsec); }
    catch (e) { return showMsg('replace-msg', `Invalid nsec: ${e.message}`, 'err'); }

    showMsg('replace-msg', '⏳ Encrypting…', 'warn');
    const res = await bg('save_key', { privKeyHex, password: pw });
    if (res.err) return showMsg('replace-msg', res.err, 'err');
    showToast('✔ Key replaced!');
    setTimeout(() => location.reload(), 700);
  });

  // Generate new key
  $('newkey-btn').addEventListener('click', async () => {
    const pw = $('replace-pw').value;
    if (!pw) return showMsg('replace-msg', 'Enter your master password first', 'err');
    if (!confirm('Generate a new key? Your current key will be REPLACED.')) return;
    showMsg('replace-msg', '⏳ Generating…', 'warn');
    const res = await bg('generate_key', { password: pw });
    if (res.err) return showMsg('replace-msg', res.err, 'err');
    showToast('⚡ New key generated!');
    setTimeout(() => location.reload(), 700);
  });

  // Delete everything
  $('delete-btn').addEventListener('click', async () => {
    if (!confirm('⚠ DELETE your key and ALL permissions?\n\nThis cannot be undone!')) return;
    await bg('delete_key');
    showToast('Deleted.');
    setTimeout(() => location.reload(), 500);
  });

  // Perms
  $('revoke-all-btn').addEventListener('click', async () => {
    if (!confirm('Revoke ALL site permissions?')) return;
    await chrome.storage.local.set({ permissions: {} });
    loadPerms();
  });
  $('refresh-perms-btn').addEventListener('click', loadPerms);

  // Relays
  $('add-relay-btn').addEventListener('click', () => addRelayRow());
  $('save-relays-btn').addEventListener('click', saveRelays);

  // Log
  $('refresh-log-btn').addEventListener('click', loadLog);
}

function setupTabHandlers() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab)?.classList.add('active');
      if (tab.dataset.tab === 'log')    loadLog();
      if (tab.dataset.tab === 'perms')  loadPerms();
      if (tab.dataset.tab === 'relays') loadRelays();
    });
  });
}

// ── Log ──────────────────────────────────────────────────────────
async function loadLog() {
  const res = await bg('get_log');
  const log = res?.log || [];
  const area = $('log-area');
  updateActCount(log.length);

  if (!log.length) {
    area.innerHTML = '<div class="log-empty">> NO EVENTS LOGGED YET</div>';
    return;
  }

  area.innerHTML = log.map(e => `
    <div class="log-entry">
      <span class="log-ts">${fmtTs(e.ts)}</span>
      <span class="log-origin" title="${e.origin}">${e.origin.replace(/https?:\/\//, '')}</span>
      <span class="log-method">${e.method}</span>
      <span class="log-status-${e.status === 'ok' ? 'ok' : 'err'}">${e.status === 'ok' ? '✔' : '✖'}</span>
    </div>
  `).join('');
}

// ── Permissions ──────────────────────────────────────────────────
async function loadPerms() {
  const res = await bg('get_permissions');
  const perms = res?.permissions || {};
  const list = $('perms-list');
  const origins = Object.keys(perms);

  if (!origins.length) {
    list.innerHTML = '<div class="log-empty">> NO PERMISSIONS GRANTED</div>';
    return;
  }

  list.innerHTML = origins.map(origin => {
    const methods = Object.keys(perms[origin]).join(', ');
    return `
      <div class="perm-row">
        <div>
          <div class="perm-origin" title="${origin}">${origin.replace('https://', '')}</div>
          <div class="perm-methods">${methods}</div>
        </div>
        <button class="btn-small btn-danger" data-origin="${origin}">✖</button>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-origin]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Revoke permissions for ${btn.dataset.origin}?`)) return;
      await bg('revoke_origin', { origin: btn.dataset.origin });
      loadPerms();
    });
  });
}

// ── Relays ───────────────────────────────────────────────────────
const DEFAULT_RELAYS = {
  'wss://relay.damus.io':     { read: true,  write: true  },
  'wss://relay.nostr.band':   { read: true,  write: true  },
  'wss://nos.lol':            { read: true,  write: true  },
  'wss://relay.snort.social': { read: true,  write: false },
  'wss://nostr.wine':         { read: true,  write: false }
};

async function loadRelays() {
  const res = await bg('get_relays');
  const relays = Object.keys(res.relays || {}).length ? res.relays : DEFAULT_RELAYS;
  $('relay-list').innerHTML = '';
  for (const [url, p] of Object.entries(relays)) addRelayRow(url, p.read, p.write);
}

function addRelayRow(url = '', read = true, write = true) {
  const row = document.createElement('div');
  row.className = 'relay-row';
  row.innerHTML = `
    <input type="text" class="relay-url" value="${url}" placeholder="wss://relay.example.com">
    <div class="relay-rw">
      <label><input type="checkbox" class="relay-read" ${read ? 'checked' : ''}> R</label>
      <label><input type="checkbox" class="relay-write" ${write ? 'checked' : ''}> W</label>
    </div>
    <button class="btn-small btn-danger relay-del">✖</button>`;
  row.querySelector('.relay-del').addEventListener('click', () => row.remove());
  $('relay-list').appendChild(row);
}

async function saveRelays() {
  const relays = {};
  for (const row of $('relay-list').querySelectorAll('.relay-row')) {
    const url = row.querySelector('.relay-url').value.trim();
    if (!url) continue;
    if (!url.startsWith('wss://') && !url.startsWith('ws://'))
      return showMsg('relay-msg', `Invalid URL: ${url}`, 'err');
    relays[url] = {
      read:  row.querySelector('.relay-read').checked,
      write: row.querySelector('.relay-write').checked
    };
  }
  await bg('save_relays', { relays });
  showMsg('relay-msg', `✔ ${Object.keys(relays).length} relays saved.`, 'ok');
}

// ── Password strength ─────────────────────────────────────────────
function pwScore(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score);
}

// ── Bech32 helpers (inline, no import needed) ────────────────────
const B32_CS = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const B32_GN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
function b32pm(v){let c=1;for(const x of v){const b=c>>>25;c=((c&0x1ffffff)<<5)^x;for(let i=0;i<5;i++)if((b>>>i)&1)c^=B32_GN[i];}return c;}
function b32hrp(h){return[...Array.from(h,c=>c.charCodeAt(0)>>>5),0,...Array.from(h,c=>c.charCodeAt(0)&31)];}
function b32chk(h,d){const p=b32pm([...b32hrp(h),...d,0,0,0,0,0,0])^1;return Array.from({length:6},(_,i)=>(p>>>(5*(5-i)))&31);}
function cvb(d,fb,tb,pad=true){let a=0,b=0;const r=[],m=(1<<tb)-1;for(const v of d){a=(a<<fb)|v;b+=fb;while(b>=tb){b-=tb;r.push((a>>b)&m);}}if(pad&&b>0)r.push((a<<(tb-b))&m);return r;}

function nsecToHex(nsec) {
  nsec = nsec.trim().toLowerCase();
  const pos = nsec.lastIndexOf('1');
  if (pos < 1) throw new Error('Invalid format');
  const hrp = nsec.slice(0, pos);
  if (hrp !== 'nsec') throw new Error('Must start with nsec1');
  const data = [];
  for (let i = pos + 1; i < nsec.length; i++) {
    const idx = B32_CS.indexOf(nsec[i]);
    if (idx < 0) throw new Error(`Bad char: ${nsec[i]}`);
    data.push(idx);
  }
  if (b32pm([...b32hrp(hrp), ...data]) !== 1) throw new Error('Invalid checksum');
  const bytes = new Uint8Array(cvb(data.slice(0,-6), 5, 8, false));
  if (bytes.length !== 32) throw new Error('Invalid key length');
  return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
}

function npubFromHex(hex) {
  const bytes = hex.match(/.{2}/g).map(b => parseInt(b,16));
  const data  = cvb(bytes, 8, 5);
  return 'npub1' + [...data, ...b32chk('npub', data)].map(d => B32_CS[d]).join('');
}

// ── Boot ──────────────────────────────────────────────────────────
init();
