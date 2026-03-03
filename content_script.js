/**
 * ◢ RDWE Nostr Signer ◣ — Content Script
 * Injects window.nostr SYNCHRONOUSLY via <script> tag (plain JS, not module).
 * Bridges postMessage ↔ chrome.runtime.
 */
(function () {
  'use strict';

  // ── Inject as plain <script> — SYNCHRONOUS, no async module delay ──
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('inject.js');
  // NOT type="module" — must be synchronous classic script
  (document.head || document.documentElement).insertBefore(s, null);

  const EXT = 'rdwe_ns';

  window.addEventListener('message', async (evt) => {
    if (evt.source !== window) return;
    const d = evt.data;
    if (!d || d._rdwe !== EXT || d._dir !== 'req') return;

    try {
      const resp = await chrome.runtime.sendMessage({
        type:     'nostr_req',
        method:   d.method,
        params:   d.params,
        origin:   window.location.origin,
        hostname: window.location.hostname
      });
      window.postMessage({ _rdwe: EXT, _dir: 'res', _id: d._id, res: resp?.res, err: resp?.err }, '*');
    } catch (e) {
      window.postMessage({ _rdwe: EXT, _dir: 'res', _id: d._id, err: String(e?.message || e) }, '*');
    }
  });
})();
