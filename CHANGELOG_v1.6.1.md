# RDWE Nostr Signer — v1.6.1 Changelog

Released: July 2026
Author audit + patches by: Claude (Sonnet 5)

## Summary

One real bug fixed — the one causing "it asks every single page reload,
remembered permissions don't stick." Root cause confirmed by simulation
(shared mock `chrome.storage.session` backend across two separately
booted module instances, modeling exactly what a real MV3 service-worker
restart does) before and after the patch. Zero new dependencies.

---

## 🔴 Bug Fix — remembered permissions didn't survive service-worker restarts

**File:** `background.js`

### Symptom
User grants a site permanent permission ("remember this site" checked
in the approval prompt) for `signEvent`/`nip04_*`/`nip44_*`. The
permission is correctly written to `chrome.storage.local`. Reloading
the page — or sometimes just waiting a short while between requests —
triggers the exact same approval prompt again, as if nothing was ever
remembered.

### Root cause
Manifest V3 service workers are terminated by Chrome after roughly 30
seconds of inactivity and respawned fresh on the next incoming message.
Every plain module-level variable resets on that respawn — including
`_priv`, the decrypted private key that represents "this session is
unlocked." The approval gate was:

```js
if (!_priv || !hasPerm) { /* show prompt */ }
```

`hasPerm` (the actual remembered permission) was being read correctly
from persistent storage and was almost always `true` as expected — but
`_priv` had usually already reset to `null` again by the time the next
request arrived, since SW restarts happen far more often than most
people expect, easily within the gap of a single page reload. The `||`
meant the prompt fired anyway, every time, regardless of `hasPerm`.

A `chrome.storage.session` polyfill already existed in the file
(defensive fallback for older/other browsers) but was never actually
used to persist anything — the session-survival half of the fix was
missing entirely.

### Fix
- Persist the unlocked key + a last-activity timestamp to
  `chrome.storage.session` (Chrome's storage area purpose-built for
  exactly this: survives SW restarts, stays memory-only, never touches
  disk, auto-clears on browser close — same security properties as the
  in-memory variable it replaces, just able to survive the SW's own
  restarts).
- On every SW wake-up, before handling any request, attempt to restore
  `_priv` from that persisted session — but only if it's still within
  the existing 15-minute idle timeout (`SESSION_TIMEOUT`). An expired
  session is discarded, not silently resurrected — the auto-lock
  behavior is unchanged, it now just survives correctly across restarts
  instead of accidentally resetting the moment the SW gets recycled.
- Moved the `chrome.storage.session` polyfill earlier in the file so
  the new restore logic can rely on it unconditionally.
- Every code path that sets `_priv` (approval-flow unlock, popup
  unlock, save key, generate key) now also persists it. Every code path
  that reads `_priv` to decide "is this locked" (the main request
  handler, the prompt queue, `session_status` for the popup UI,
  `export_nsec`) now awaits the restore gate first.

### Verification
Simulated two separately-booted module instances sharing one mock
`chrome.storage.session` backend — modeling exactly what survives vs.
resets across a real SW restart:

```
SW#1 (fresh): needs prompt before unlock: true
SW#1: user unlocks → needs prompt after unlock: false
--- simulated SW kill + respawn (fresh module scope, same storage) ---
SW#2 (respawned): needs prompt after SW restart: false   ✓ fixed
--- 20 minutes of simulated idle time ---
SW#3 (respawned): needs prompt after 20min idle: true     ✓ still auto-locks correctly
```

### Note on `getPublicKey`
Separately confirmed (not a bug): `getPublicKey` was already, by design,
excluded from the approval queue entirely — it always resolves
immediately, locked or unlocked, with no prompt. That's a deliberate,
fairly common NIP-07 signer convention (the pubkey isn't secret; many
clients call it just to detect "is a signer present"). If a site's own
"connect" button visibly does nothing on the signer's side, that's why
— `getPublicKey` alone was never going to show any UI. Flagging this in
case a future version wants a lighter one-time "a site wants to know
your identity" confirmation for that call specifically — that would be
a deliberate UX/security tradeoff to decide on, not something this
patch changed.
