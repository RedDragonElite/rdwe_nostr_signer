/**
 * ◢ RDWE Nostr Signer ◣ — Page Injector
 * PLAIN script (no ES module) — injected synchronously into MAIN world.
 * Must be self-contained. No imports.
 */
(function () {
  'use strict';

  if (typeof window.nostr !== 'undefined') return;

  const EXT = 'rdwe_ns';
  let _id = 0;
  const _cb = new Map();

  window.addEventListener('message', (evt) => {
    if (evt.source !== window) return;
    const d = evt.data;
    if (!d || d._rdwe !== EXT || d._dir !== 'res') return;
    const p = _cb.get(d._id);
    if (!p) return;
    _cb.delete(d._id);
    if (d.err) p.reject(new Error(d.err));
    else p.resolve(d.res);
  });

  function call(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++_id;
      _cb.set(id, { resolve, reject });
      window.postMessage({ _rdwe: EXT, _dir: 'req', _id: id, method, params: params || {} }, '*');
    });
  }

  const nostr = {
    getPublicKey: function ()              { return call('getPublicKey'); },
    signEvent:    function (event)         { return call('signEvent',     { event: event }); },
    getRelays:    function ()              { return call('getRelays'); },
    nip04: {
      encrypt: function (pk, pt)           { return call('nip04_encrypt', { pubkey: pk, plaintext: pt }); },
      decrypt: function (pk, ct)           { return call('nip04_decrypt', { pubkey: pk, ciphertext: ct }); }
    },
    nip44: {
      encrypt: function (pk, pt)           { return call('nip44_encrypt', { pubkey: pk, plaintext: pt }); },
      decrypt: function (pk, ct)           { return call('nip44_decrypt', { pubkey: pk, ciphertext: ct }); }
    }
  };

  Object.freeze(nostr.nip04);
  Object.freeze(nostr.nip44);
  Object.defineProperty(window, 'nostr', {
    value: Object.freeze(nostr),
    writable: false,
    configurable: false
  });
})();
