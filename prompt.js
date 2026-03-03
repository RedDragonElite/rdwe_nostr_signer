'use strict';

const METHOD_LABELS = {
  signEvent:    'Sign Event',
  nip04_encrypt:'NIP-04 Encrypt', nip04_decrypt:'NIP-04 Decrypt',
  nip44_encrypt:'NIP-44 Encrypt', nip44_decrypt:'NIP-44 Decrypt'
};
const METHOD_WARN = {
  signEvent:    'This site wants to sign a Nostr event with your private key.',
  nip04_encrypt:'Encrypt a direct message (AES-CBC) to a recipient.',
  nip04_decrypt:'Decrypt a direct message (AES-CBC) sent to you.',
  nip44_encrypt:'Encrypt a direct message (ChaCha20) to a recipient.',
  nip44_decrypt:'Decrypt a direct message (ChaCha20) sent to you.'
};

let currentId = null, currentOrigin = null, currentMethod = null;

async function loadNext() {
  const resp = await chrome.runtime.sendMessage({ type: 'prompt_get_next' });
  if (!resp.item) {
    document.getElementById('loading').style.display   = 'none';
    document.getElementById('done-screen').style.display = 'block';
    setTimeout(() => window.close(), 1200);
    return;
  }

  const { id, origin, method, params, total } = resp.item;
  currentId = id; currentOrigin = origin; currentMethod = method;

  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
  document.getElementById('queue-info').textContent     = total > 1 ? `${total} PENDING` : '1 PENDING';
  document.getElementById('alert-text').textContent     = `wants to ${METHOD_LABELS[method]?.toLowerCase() || method}`;
  document.getElementById('req-origin').textContent     = origin;
  document.getElementById('method-badge').textContent   = METHOD_LABELS[method] || method;
  document.getElementById('warn-text').textContent      = METHOD_WARN[method] || '';
  document.getElementById('remember-origin').textContent = origin.replace(/https?:\/\//, '');
  document.getElementById('remember-method').textContent = METHOD_LABELS[method] || method;

  const db = document.getElementById('detail-box');
  if (method === 'signEvent' && params?.event) {
    const ev = params.event;
    const lines = [];
    if (ev.kind !== undefined) lines.push(`KIND: ${ev.kind}`);
    if (ev.content)            lines.push(`CONTENT:\n${ev.content.slice(0, 300)}${ev.content.length > 300 ? '…' : ''}`);
    if (ev.tags?.length)       lines.push(`TAGS: ${JSON.stringify(ev.tags).slice(0, 200)}`);
    document.getElementById('detail-label').textContent   = 'Event Preview';
    document.getElementById('detail-content').textContent = lines.join('\n\n') || '(empty event)';
    db.style.display = 'block';
  } else if (method.includes('encrypt') && params?.pubkey) {
    document.getElementById('detail-label').textContent   = 'Recipient';
    document.getElementById('detail-content').textContent = params.pubkey;
    db.style.display = 'block';
  } else {
    db.style.display = 'none';
  }

  const isMulti = total > 1;
  document.getElementById('multi-divider').style.display = isMulti ? 'block' : 'none';
  document.getElementById('multi-btns').style.display    = isMulti ? 'grid'  : 'none';
}

async function respond(approved) {
  const remember = document.getElementById('remember-cb').checked;
  const resp = await chrome.runtime.sendMessage({ type: 'prompt_respond', id: currentId, approved, remember });
  if (resp.hasMore) {
    document.getElementById('detail-box').style.display = 'none';
    document.getElementById('remember-cb').checked = false;
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    setTimeout(loadNext, 120);
  } else {
    document.getElementById('content').style.display     = 'none';
    document.getElementById('done-screen').style.display = 'block';
    setTimeout(() => window.close(), 900);
  }
}

document.getElementById('approve-btn').addEventListener('click', () => respond(true));
document.getElementById('deny-btn').addEventListener('click',    () => respond(false));

document.getElementById('approve-all-btn').addEventListener('click', async () => {
  const remember = document.getElementById('remember-cb').checked;
  await chrome.runtime.sendMessage({ type: 'prompt_approve_all', remember, origin: currentOrigin, method: currentMethod });
  document.getElementById('content').style.display     = 'none';
  document.getElementById('done-screen').style.display = 'block';
  setTimeout(() => window.close(), 900);
});

document.getElementById('deny-all-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'prompt_deny_all' });
  window.close();
});

loadNext();
