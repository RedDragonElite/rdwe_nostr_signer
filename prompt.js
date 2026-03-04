/**
 * ◢ RDWE Nostr Signer ◣ — Prompt Script v1.5
 * Handles: Unlock (if locked) + Approve/Deny in one window.
 */
'use strict';

const METHOD_LABELS = {
  signEvent:    'Sign Event',
  nip04_encrypt:'NIP-04 Encrypt', nip04_decrypt:'NIP-04 Decrypt',
  nip44_encrypt:'NIP-44 Encrypt', nip44_decrypt:'NIP-44 Decrypt'
};
const METHOD_WARN = {
  signEvent:    'This site wants to sign a Nostr event with your private key.',
  nip04_encrypt:'Encrypt a direct message (NIP-04 AES-CBC) to a recipient.',
  nip04_decrypt:'Decrypt a direct message (NIP-04 AES-CBC) sent to you.',
  nip44_encrypt:'Encrypt a direct message (NIP-44 ChaCha20) to a recipient.',
  nip44_decrypt:'Decrypt a direct message (NIP-44 ChaCha20) sent to you.'
};

let currentId = null, currentOrigin = null, currentMethod = null, currentLocked = false;

function $(id) { return document.getElementById(id); }

async function loadNext() {
  const resp = await chrome.runtime.sendMessage({ type: 'prompt_get_next' });

  if (!resp?.item) {
    $('loading').style.display   = 'none';
    $('done-screen').style.display = 'block';
    setTimeout(() => window.close(), 1000);
    return;
  }

  const { id, origin, method, params, total, locked } = resp.item;
  currentId = id; currentOrigin = origin; currentMethod = method; currentLocked = locked;

  $('loading').style.display = 'none';
  $('content').style.display = 'block';

  // Queue counter
  $('queue-info').textContent = total > 1 ? `${total} PENDING` : '1 PENDING';

  // Method + origin
  $('alert-text').textContent     = `wants to ${(METHOD_LABELS[method]||method).toLowerCase()}`;
  $('req-origin').textContent     = origin;
  $('method-badge').textContent   = METHOD_LABELS[method] || method;
  $('warn-text').textContent      = METHOD_WARN[method] || '';
  $('remember-origin').textContent = origin.replace(/https?:\/\//, '');
  $('remember-method').textContent = METHOD_LABELS[method] || method;

  // Detail box
  const db = $('detail-box');
  if (method === 'signEvent' && params?.event) {
    const ev = params.event;
    const lines = [];
    if (ev.kind !== undefined) lines.push(`KIND: ${ev.kind}`);
    if (ev.content) lines.push(`CONTENT:\n${ev.content.slice(0,300)}${ev.content.length>300?'…':''}`);
    if (ev.tags?.length) lines.push(`TAGS: ${JSON.stringify(ev.tags).slice(0,200)}`);
    $('detail-label').textContent   = 'Event Preview';
    $('detail-content').textContent = lines.join('\n\n') || '(empty event)';
    db.style.display = 'block';
  } else if (method.includes('encrypt') && params?.pubkey) {
    $('detail-label').textContent   = 'Recipient';
    $('detail-content').textContent = params.pubkey;
    db.style.display = 'block';
  } else {
    db.style.display = 'none';
  }

  // Unlock section — show only if session is locked
  const unlockSection = $('unlock-section');
  if (locked) {
    unlockSection.style.display = 'block';
    $('pw-input').value = '';
    $('pw-input').focus();
    $('pw-error').style.display = 'none';
    $('unlock-note').style.display = 'flex';
    $('unlocked-note').style.display = 'none';
  } else {
    unlockSection.style.display = 'none';
    $('unlock-note').style.display = 'none';
    $('unlocked-note').style.display = 'flex';
  }

  // Multi buttons
  const isMulti = total > 1;
  $('multi-divider').style.display = isMulti ? 'block' : 'none';
  $('multi-btns').style.display    = isMulti ? 'grid'  : 'none';
}

async function respond(approved) {
  const pw = $('pw-input').value;

  // If locked, password is required to approve
  if (currentLocked && approved && !pw) {
    $('pw-error').textContent = 'Enter your master password to approve';
    $('pw-error').style.display = 'block';
    $('pw-input').focus();
    return;
  }

  const remember = $('remember-cb').checked;
  const msgData = { type: 'prompt_respond', id: currentId, approved, remember };
  if (pw) msgData.password = pw;

  const resp = await chrome.runtime.sendMessage(msgData);

  if (resp?.err) {
    $('pw-error').textContent = resp.err;
    $('pw-error').style.display = 'block';
    $('pw-input').value = '';
    $('pw-input').focus();
    return;
  }

  if (resp?.hasMore) {
    $('detail-box').style.display = 'none';
    $('remember-cb').checked = false;
    $('loading').style.display = 'block';
    $('content').style.display = 'none';
    setTimeout(loadNext, 120);
  } else {
    $('content').style.display     = 'none';
    $('done-screen').style.display = 'block';
    setTimeout(() => window.close(), 800);
  }
}

$('approve-btn').addEventListener('click', () => respond(true));
$('deny-btn').addEventListener('click',    () => respond(false));

// Enter key in password field = approve
$('pw-input').addEventListener('keydown', e => { if (e.key === 'Enter') respond(true); });

$('approve-all-btn').addEventListener('click', async () => {
  const pw = $('pw-input').value;
  if (currentLocked && !pw) {
    $('pw-error').textContent = 'Enter your master password first';
    $('pw-error').style.display = 'block';
    $('pw-input').focus();
    return;
  }
  const remember = $('remember-cb').checked;
  const msgData = { type: 'prompt_approve_all', remember, origin: currentOrigin, method: currentMethod };
  if (pw) msgData.password = pw;
  const resp = await chrome.runtime.sendMessage(msgData);
  if (resp?.err) {
    $('pw-error').textContent = resp.err;
    $('pw-error').style.display = 'block';
    $('pw-input').value = '';
    $('pw-input').focus();
    return;
  }
  $('content').style.display     = 'none';
  $('done-screen').style.display = 'block';
  setTimeout(() => window.close(), 800);
});

$('deny-all-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'prompt_deny_all' });
  window.close();
});

loadNext();
