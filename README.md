# 🐉 RDWE Nostr Signer

[![Version](https://img.shields.io/badge/version-1.6.1-red?style=for-the-badge)](https://github.com/RedDragonElite/rdwe-nostr-signer)
[![License](https://img.shields.io/badge/license-RDE%20Black%20Flag-black?style=for-the-badge)](LICENSE)
[![Manifest](https://img.shields.io/badge/Manifest-V3-blue?style=for-the-badge)](https://developer.chrome.com/docs/extensions/mv3/)
[![Nostr](https://img.shields.io/badge/Nostr-NIP--07-purple?style=for-the-badge)](https://github.com/nostr-protocol/nips/blob/master/07.md)
[![Browser](https://img.shields.io/badge/Brave%20%2F%20Chrome-Compatible-orange?style=for-the-badge)](https://brave.com)
[![Zero Deps](https://img.shields.io/badge/dependencies-ZERO-green?style=for-the-badge)](#)
[![Self-Tested](https://img.shields.io/badge/self--tests-16%2F16%20RFC%20vectors-brightgreen?style=for-the-badge)](#-cryptographic-self-tests)

**The most secure NIP-07 Nostr Signer extension — built by Red Dragon Elite.**

*Your nsec never leaves your machine in plain text. Not to Discord. Not to servers. Not to anyone. Ever.*
<div align="center">
<img width="256" height="256" alt="AIRetouch_20260305_225134663" src="https://github.com/user-attachments/assets/aa838a3f-6bdd-47d3-bd99-6987f90211e2" />
</div>
*Built by [Red Dragon Elite](https://rd-elite.com) | Free Forever | Encrypted by Design*

[📖 Installation](#-installation) • [🔐 Security Model](#-security-model) • [🚀 Quick Start](#-quick-start) • [🌐 Website](https://rd-elite.com) • [🔭 Terminal](https://rd-elite.com/Files/NOSTR/)

---

## 🆕 What's New in v1.6.1

Reliability patch: fixes the "it asks for approval every single time, remembered
permissions don't stick" behavior some users were seeing.

### 🔴 Bug fix — remembered permissions now actually survive

Manifest V3 kills and respawns the background service worker after roughly
30 seconds of inactivity — far more often than most people expect, easily
within the gap of a single page reload. The unlocked-session state
(`_priv`, the decrypted key in memory) used to live only in a plain JS
variable, so it reset to "locked" on every one of those respawns — even
though the actual per-site permission ("Always allow") was being saved
correctly the whole time. Net effect: the approval prompt kept reappearing
regardless of what you'd already approved.

**Fix:** the unlocked session (key + last-activity timestamp) is now
persisted to `chrome.storage.session` — the storage area Chrome built
specifically for this problem. It survives service-worker restarts, stays
memory-only (never touches disk), and clears automatically when the
browser closes. Same security properties as before; it just now correctly
survives the service worker's own restarts instead of accidentally
resetting every time one happens. The 15-minute idle auto-lock is
unaffected — a session older than that is still discarded, not silently
resurrected.

Verified with a restart simulation (two separately-booted worker
instances sharing one storage backend, modeling exactly what a real SW
restart does): permission correctly persists across the simulated
restart, and correctly still expires after 15 minutes of simulated idle
time either way.

See [CHANGELOG_v1.6.1.md](./CHANGELOG_v1.6.1.md) for the full write-up.

---

## What's New in v1.6.0

This release is a security & performance hardening pass. Two real bugs fixed,
four hardening features added. All changes are verified by **16 RFC-grade
Known-Answer Tests** that run on every service-worker boot — if any vector
fails, the extension refuses to handle nostr requests at all.

### 🔴 Bug fixes (correctness)

- **NIP-44 v2 padding now spec-compliant.** Previous versions used
  next-power-of-2 padding for all lengths. Per spec, lengths above 256
  use chunk granularity = `nextPower / 8`. Cross-client decryption with
  nos2x / Alby / Primal / nostr-tools could have failed silently for
  plaintext lengths 65, 129, 200, 257, 300, …
- **Invalid-curve attack defense.** `Point.fromXOnly` and `fromCompressed`
  now reject x-coordinates that don't lie on secp256k1 (previously the
  square-root primitive returned a value even for off-curve x). This
  closes a class of side-channel attacks where a malicious peer could
  leak private-key bits via crafted pubkeys over many ECDH operations.

### ✨ New hardenings

- **🧪 Cryptographic self-tests** (`lib/test_vectors.js`) — 16 KATs against
  RFC 7539 (ChaCha20), RFC 5869 (HKDF), RFC 4231 (HMAC), BIP-340 (Schnorr),
  and the NIP-44 v2 spec. Vectors generated independently with Python's
  `coincurve` + `cryptography` libraries — the JS implementation must
  match exactly. Runs once on SW init, ~2 seconds.
- **⚡ NIP-44 conversation-key LRU cache** — in-memory, cleared on lock,
  never persisted. Decrypting an inbox with 50 DMs from the same peer
  is now **44× faster** (5.2s → 0.12s). Encrypt path: 3.6× faster.
- **✍️ Schnorr verify-after-sign** — every signature is fully verified
  with BIP-340 verification before being returned. Defense in depth
  against memory glitches, fault attacks, and future implementation
  regressions. +50ms per signEvent (irrelevant — it's a user action).
- **🔒 Stricter session lock** — `lockSession()` helper guarantees the
  conversation-key cache is wiped whenever the session locks. A locked
  extension has zero key material in memory, period.

See [CHANGELOG_v1.6.md](./CHANGELOG_v1.6.md) for the full audit details.

---

## 🔥 Why This Signer Destroys the Competition

Every other NIP-07 signer stores your private key as **plain text** in `chrome.storage.local`.  
One piece of malware. One compromised extension. One browser exploit. **Your identity is gone.**

We said no.

| ❌ Other Signers | ✅ RDWE Nostr Signer |
|---|---|
| **Plain-text nsec in storage** | **AES-256-GCM encrypted — always** |
| **Key exposed on browser start** | **Session-locked — requires password** |
| **5 popups for 5 requests** | **Smart queue — one window, all requests** |
| **Error when locked** | **Unlock prompt appears seamlessly** |
| **No master password** | **PBKDF2-SHA256 · 310,000 iterations** |
| **Your nsec in localStorage** | **Your nsec never hits plain storage** |
| **Bloated with node_modules** | **Zero external dependencies** |
| **Closed source / unknown authors** | **100% open source · MIT Crypto · RDE** |

### 🎯 Key Features

- 🔐 **AES-256-GCM Encryption** — nsec encrypted with your master password before storage
- 🔒 **Session Locking** — auto-locks after 15 min idle, zero plaintext in memory
- 🔄 **Session Persistence** — remembered unlock/approval state survives Manifest V3 service-worker restarts, so "Always allow" actually behaves like it sounds *(v1.6.1)*
- ⚡ **Seamless Unlock Flow** — sites never error out; unlock popup appears when needed
- 📋 **Smart Request Queue** — multiple sign requests batched in ONE window
- 🌐 **Full NIP-07 Support** — `getPublicKey`, `signEvent`, `getRelays`, NIP-04, NIP-44
- 🔑 **getPublicKey Always Works** — even when locked, and never shows an approval prompt (pubkey is public — duh)
- 🛡️ **Per-Origin Permissions** — "Always allow" per site per method, fully revocable
- 🐉 **RDE Terminal Aesthetic** — because ugly tools deserve to die
- 📡 **Relay Management** — configure read/write relays right in the popup
- 📋 **Activity Log** — full history of every signing request
- 🔑 **Key Generation** — generate a fresh keypair or import your existing nsec
- ⚙️ **Zero Dependencies** — pure JavaScript, no npm, no node_modules, no supply chain BS
- 🧪 **Cryptographic Self-Tests** — 16 RFC-grade KATs verify correctness on every boot *(v1.6)*
- ⚡ **NIP-44 Conversation-Key Cache** — 44× faster inbox decryption *(v1.6)*
- ✍️ **Verify-After-Sign** — every Schnorr signature is self-verified before release *(v1.6)*
- 🛡️ **Invalid-Curve Attack Defense** — rejects malicious off-curve pubkeys *(v1.6)*

---

## 📸 Screenshots

<img width="407" height="564" alt="image" src="https://github.com/user-attachments/assets/665d65f8-c21a-4450-b183-3db110e3aa40" />
<img width="399" height="597" alt="image" src="https://github.com/user-attachments/assets/5eb83722-4d90-4efa-9e02-ac08df2c174c" />
<img width="405" height="551" alt="image" src="https://github.com/user-attachments/assets/434b4a71-6501-4740-835f-9a489b368f27" />
<img width="405" height="549" alt="image" src="https://github.com/user-attachments/assets/1f4ce68f-c5bf-44cb-ac94-90403a58f247" />

---

## 🚀 Quick Start

### Install in 60 Seconds

```
# 1. Download the latest release
#    → Releases tab on GitHub or rd-elite.com

# 2. Unzip rdwe-nostr-signer.zip

# 3. Open Brave/Chrome
brave://extensions
# OR
chrome://extensions

# 4. Enable "Developer mode" (top right toggle)

# 5. Click "Load unpacked"
#    → Select the unzipped rdwe-nostr-signer/ folder

# 6. Pin the extension to your toolbar

# Done. Click the ◢ RDWE ◣ icon and set up your key.
```

> **No npm. No yarn. No build step. No server. Just unzip and load.**

---

## 📚 Full Installation Guide

### Step 1: Download

**Option A — GitHub Releases (Recommended)**

1. Go to [Releases](https://github.com/RedDragonElite/rdwe-nostr-signer/releases)
2. Download `rdwe-nostr-signer.zip`
3. Unzip to a permanent folder (don't delete it — Chrome needs it)

**Option B — Clone via Git**

```bash
git clone https://github.com/RedDragonElite/rdwe-nostr-signer.git
```

### Step 2: Load the Extension

1. Open your browser and navigate to `chrome://extensions` or `brave://extensions`
2. Enable **Developer mode** via the toggle in the top-right corner
3. Click **"Load unpacked"**
4. Select the `rdwe-nostr-signer/` folder
5. The extension appears in your toolbar — pin it for easy access

### Step 3: First-Time Setup

Click the **◢ RDWE ◣** icon in your toolbar. You'll see the setup screen:

**1. Choose a Master Password**

- This password encrypts your nsec with AES-256-GCM
- It is **never stored** — only you know it
- Minimum 8 characters — longer is better
- The strength indicator shows you how good it is

**2. Import or Generate a Key**

- **Import nsec:** Paste your existing `nsec1...` private key
- **Generate New:** Creates a fresh cryptographic keypair instantly

**3. Done!**  
Your session is now unlocked. The extension is ready to sign events.

---

## 🔐 Security Model

This is the part that actually matters. Read it.

### How Your Key Is Stored

```
YOUR NSEC
    ↓
PBKDF2-SHA256
(310,000 iterations + random 256-bit salt)
    ↓
AES-256-GCM KEY
    ↓
Encrypt nsec → { version, salt, iv, ciphertext }
    ↓
chrome.storage.local  ←  Only this blob lands on disk
```

**What gets stored on disk:**
```json
{
  "enc_key": {
    "v": 2,
    "salt": "<base64, 32 random bytes>",
    "iv":   "<base64, 12 random bytes>",
    "ct":   "<base64, AES-256-GCM ciphertext>"
  },
  "pubkey": "<hex pubkey — public, no secret>"
}
```

**Your nsec in plain text: NEVER.**

### Session Model

```
Browser Start
    ↓
Extension Loads → Session LOCKED
    ↓
You click icon (or a site requests signing) → Enter master password
    ↓
Password → PBKDF2 → AES key → Decrypt blob → nsec in RAM
    ↓
Session UNLOCKED (15 min idle timeout)
    ↓
Service worker gets recycled by the browser (routine, happens often)
    ↓
Session state is restored from chrome.storage.session — still unlocked,
still respecting the original 15-minute idle window (v1.6.1)
    ↓
After 15 min of no activity → nsec wiped from memory AND from
chrome.storage.session → Session LOCKED again
    ↓
Browser fully closes → chrome.storage.session clears unconditionally →
Session LOCKED on next launch, always
```

- nsec lives **only in memory** during an unlocked session — `chrome.storage.session`
  is a memory-only storage area; it's never written to disk, same as the plain
  JS variable it used to live in
- Ordinary service-worker restarts (frequent under Manifest V3) no longer force
  a fresh unlock — the session correctly survives them as long as it's still
  within the 15-minute idle window
- It's still always fully cleared after 15 minutes of inactivity, or the moment
  the browser closes, whichever comes first

### What Happens When a Site Requests Signing (Locked)

```
primal.net calls window.nostr.signEvent(event)
    ↓
Extension detects: session locked
    ↓
Approval popup opens:
  🔒 SESSION LOCKED — ENTER PASSWORD TO APPROVE
  [Master password field]
  [✖ Deny]  [✔ Approve]
    ↓
You enter password + click Approve
    ↓
1. Decrypt nsec (PBKDF2 + AES-GCM)
2. Sign the event (BIP-340 Schnorr)
3. Return signed event to the website
4. nsec stays in memory (session now unlocked)
    ↓
primal.net gets its signature ✔
```

**Sites never error out. They just wait for you to approve.**

> Note: `getPublicKey()` specifically is exempt from this flow by design —
> it always resolves immediately, locked or unlocked, with no prompt at all.
> The pubkey isn't secret, and prompting for it on every "is a signer here"
> check most clients do on page load would be pure noise. If a site's
> "connect" button doesn't visibly show any signer UI, that's why — only
> `signEvent`/`nip04_*`/`nip44_*` ever trigger the approval prompt above.

### Cryptographic Stack

| Operation | Algorithm | Parameters |
|---|---|---|
| Key derivation | PBKDF2-SHA256 | 310,000 iterations · 256-bit salt |
| Storage encryption | AES-256-GCM | 96-bit IV · authenticated |
| Event signing | BIP-340 Schnorr | secp256k1 · verify-after-sign |
| Legacy DM encryption | NIP-04 AES-CBC | ECDH shared secret |
| Modern DM encryption | NIP-44 v2 ChaCha20 | HMAC-SHA256 · HKDF · spec-compliant padding |
| Event hashing | SHA-256 | via Web Crypto API |
| Pubkey validation | Curve membership check | rejects off-curve x-coordinates |
| Boot integrity | RFC-grade KATs | RFC 7539 · RFC 5869 · RFC 4231 · BIP-340 · NIP-44 |

**All cryptography uses the browser's native Web Crypto API for primitives. The secp256k1 curve math is pure JS, audited against independent reference implementations (Python `coincurve` + `cryptography`). Zero custom crypto primitives, zero npm dependencies.**

### 🧪 Cryptographic Self-Tests

Every time the background service worker spins up, the crypto library is
verified against 16 Known-Answer Tests before any nostr request is served:

- **SHA-256** — NIST FIPS 180-2 reference
- **HMAC-SHA256** — RFC 4231 Test Case 1
- **HKDF-SHA256** — RFC 5869 Test Case 1
- **ChaCha20** — RFC 7539 §2.4.2 reference vector
- **secp256k1 generator math** — `G·1 = G`, `G·3` matches BIP-340 reference pubkey
- **NIP-44 v2 padding** — 16 boundary lengths covering all chunk sizes
- **NIP-44 v2 conversation_key derivation** — KAT pinned against independent Python impl
- **NIP-44 v2 message_keys derivation** — KAT against independent Python impl
- **NIP-44 round-trip + tampering rejection** — including length-65 boundary
- **Schnorr sign + self-verify** — full BIP-340 round-trip
- **Schnorr signature malleability rejection** — bit-flipped sigs rejected
- **Curve membership** — off-curve x-coordinates rejected at point construction

If any vector fails, **all nostr operations refuse to run** with a descriptive
error in the service-worker console. This catches silent JS engine corruption,
modified extension files, and any future regression in the crypto code.

Boot cost: ~2 seconds, once per service-worker lifecycle. Subsequent calls
are gated by an already-resolved promise — zero overhead.

### Threat Model

| Threat | Status |
|---|---|
| Malware reads `chrome.storage.local` | ✅ Protected — only encrypted blob present |
| Website reads `window.nostr` private state | ✅ Protected — API is frozen, no private access |
| Content script is compromised | ✅ Protected — only bridges postMessage, no key access |
| Browser profile theft | ✅ Protected — blob is useless without your password |
| **Invalid-curve attack via crafted pubkey** | **✅ Protected — off-curve x rejected at point construction (v1.6)** |
| **Cross-client NIP-44 incompatibility** | **✅ Protected — spec-compliant padding (v1.6)** |
| **Silent crypto regression / tampered files** | **✅ Protected — boot self-tests refuse to run if any KAT fails (v1.6)** |
| **Faulty signature emission (glitch / RowHammer)** | **✅ Protected — every Schnorr sig is self-verified (v1.6)** |
| **Conversation keys outliving lock** | **✅ Protected — cache cleared on every `lockSession()` (v1.6)** |
| MAC tampering on NIP-44 ciphertext | ✅ Protected — constant-time HMAC verification |
| Session is left unlocked | ⚠️ Auto-locks after 15 min idle, regardless of service-worker restarts (v1.6.1) |
| Shoulder surfing while nsec is revealed | ⚠️ nsec auto-hides after 30 seconds |
| Your master password is weak | ⚠️ On you — use a strong one |

---

## 🏗️ Architecture

### File Structure

```
rdwe-nostr-signer/
├── manifest.json          ← MV3 manifest — permissions, CSP, entry points
├── background.js          ← Service worker — ALL crypto, signing, key storage
├── content_script.js      ← ISOLATED world bridge — postMessage ↔ chrome.runtime
├── inject.js              ← MAIN world — provides window.nostr API to pages
├── popup.html             ← Extension popup UI
├── popup.js               ← Popup logic — setup/lock/unlock/manage
├── prompt.html             ← Permission approval dialog
├── prompt.js               ← Prompt logic — queue, unlock-and-approve
├── lib/
│   ├── crypto.js          ← Complete crypto library (zero dependencies)
│   └── test_vectors.js    ← RFC-grade Known-Answer Tests, run on SW init
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── CHANGELOG_v1.6.md      ← v1.6 hardening audit details
└── CHANGELOG_v1.6.1.md    ← v1.6.1 session-persistence fix details
```

### Message Flow

```
Page (MAIN world)
    window.nostr.signEvent(event)
        ↓ postMessage
Content Script (ISOLATED world)
    chrome.runtime.sendMessage({ type: 'nostr_req', method: 'signEvent', ... })
        ↓
Background Service Worker
    handle() → check permission → sign → return
        ↓ sendResponse
Content Script
        ↓ postMessage
Page (MAIN world)
    ← signed event
```

### Why This Injection Method?

The `inject.js` is loaded via a classic `<script src="...">` tag injected by the content script — **not** as an ES module and **not** via `world: "MAIN"` in the manifest.

Why? Because:
- `type="module"` loads **asynchronously** → the page checks `window.nostr` before it's defined
- `world: "MAIN"` is unreliable in some Brave/Chromium versions
- `<script src="...">` is **synchronous**, `window.nostr` is set before the page even loads its own JS

This is the same approach used by battle-tested signers like [nos2x](https://github.com/fiatjaf/nos2x).

---

## 🖥️ Popup Interface

### Screens

**Setup Screen** (first run)
- Choose master password (with strength indicator)
- Import existing `nsec1…` or generate a new keypair
- Sets up AES-256-GCM encryption

**Lock Screen** (session locked)
- Enter master password to unlock
- "Wipe & Reset" if you need to start fresh

**Main Screen** (session unlocked) — 4 tabs:

| Tab | Contents |
|---|---|
| 🗝 **Keys** | npub display · hex pubkey · reveal nsec · replace/generate key |
| 🛡 **Perms** | Per-origin permission list · revoke individual or all |
| 📡 **Relays** | Manage relay URLs with read/write toggles |
| 📋 **Log** | Timestamped activity log of all signing requests |

### Permission Prompt Window

When a site requests signing (and you haven't set "Always allow"):

- Shows site origin, method, and event preview
- If session is **locked**: password field appears inline
- Queue counter shows how many requests are pending
- **Approve This / Deny This** — for individual requests  
- **Approve All / Deny All** — for batched requests (e.g. Primal's 5 startup calls)
- **"Always allow"** checkbox — skips future prompts for this site+method, and now
  correctly keeps skipping them across normal service-worker restarts *(v1.6.1)*

---

## 🌐 NIP-07 API Reference

The extension provides a fully NIP-07 compliant `window.nostr` object:

### `getPublicKey()`

```javascript
const pubkey = await window.nostr.getPublicKey();
// Returns: hex-encoded 32-byte public key
// Always resolves immediately — locked or unlocked, no approval prompt.
// The pubkey is stored in plaintext (it's not secret) specifically so
// this call never needs to touch your encrypted nsec at all.
```

### `signEvent(event)`

```javascript
const signedEvent = await window.nostr.signEvent({
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: "Hello Nostr! ⚡"
});
// Returns: complete signed event with id, pubkey, sig
```

### `getRelays()`

```javascript
const relays = await window.nostr.getRelays();
// Returns: { "wss://relay.damus.io": { read: true, write: true }, ... }
```

### `nip04.encrypt(pubkey, plaintext)` / `nip04.decrypt(pubkey, ciphertext)`

```javascript
// Legacy DM encryption (AES-CBC + ECDH)
const ciphertext = await window.nostr.nip04.encrypt(recipientPubkey, "secret message");
const plaintext  = await window.nostr.nip04.decrypt(senderPubkey, ciphertext);
```

### `nip44.encrypt(pubkey, plaintext)` / `nip44.decrypt(pubkey, ciphertext)`

```javascript
// Modern DM encryption (ChaCha20 + HMAC-SHA256 + HKDF)
const ciphertext = await window.nostr.nip44.encrypt(recipientPubkey, "secret message");
const plaintext  = await window.nostr.nip44.decrypt(senderPubkey, ciphertext);
```

### Complete Login Example

```javascript
// Check for NIP-07 support
if (!window.nostr) {
  alert("Please install RDWE Nostr Signer!");
  return;
}

// Get public key (never prompts — pubkey isn't secret)
const pubkey = await window.nostr.getPublicKey();
console.log("Logged in as:", pubkey);

// Sign a kind-0 (profile metadata) event
const profileEvent = await window.nostr.signEvent({
  kind: 0,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: JSON.stringify({
    name: "Red Dragon Elite",
    about: "🐉 Building the decentralized future",
    website: "https://rd-elite.com"
  })
});

// Publish to relay
const ws = new WebSocket("wss://relay.damus.io");
ws.onopen = () => ws.send(JSON.stringify(["EVENT", profileEvent]));
```

---

## ✅ Compatible Clients

Tested and working with:

| Client | URL | Status |
|---|---|---|
| **Primal** | primal.net | ✅ Full support |
| **Snort** | snort.social | ✅ Full support |
| **Iris** | iris.to | ✅ Full support |
| **Coracle** | coracle.social | ✅ Full support |
| **Nostrgram** | nostrgram.co | ✅ Full support |
| **Zap.stream** | zap.stream | ✅ Full support |
| **Habla** | habla.news | ✅ Full support |
| **RDWE Terminal** | rd-elite.com/Files/NOSTR/Terminal | ✅ Native support |
| **RDWE Messenger** | rd-elite.com | ✅ Native support |

---

## 🐛 Troubleshooting

### `window.nostr` is undefined

**Cause:** `inject.js` didn't load before the page checked for it.

**Fix:**
1. Reload the extension: `chrome://extensions` → 🔄 Reload
2. Hard-refresh the page: `Ctrl+Shift+R`
3. Open browser console (F12) on the target page
4. Check for: `[RDWE] ◢ Nostr Signer ◣ — window.nostr ready`
5. If not present — check extension errors on the extensions page

### It keeps asking for approval even after I checked "Always allow"

**Cause (fixed in v1.6.1):** Manifest V3 kills the background service
worker after short periods of inactivity, and versions before v1.6.1 lost
track of the unlocked session every time that happened — even though the
permission itself was saved correctly.

**Fix:** Update to v1.6.1+. If you're already on v1.6.1 and still seeing
this, reload the extension (`chrome://extensions` → 🔄) to make sure the
new background.js is actually running, then try again.

### Login fails / site shows "no extension found"

**Cause:** Session is locked AND the site checks `getPublicKey()` immediately.

**Note:** `getPublicKey()` always works even when locked. If you see this error, the site may be using a non-standard check.

**Fix:**
1. Click the RDWE icon → enter password → Unlock
2. Reload the page
3. Try logging in again

### Multiple approval windows open at once

**Cause:** You're using an older version (< v1.4).

**Fix:** Update to v1.6+ — the queue system opens exactly ONE window for all pending requests.

### "Wrong password — decryption failed"

- Double-check your master password (case sensitive)
- If you forgot it: click "Wipe & Reset" and set up again with your nsec
- There is no password recovery — this is by design (zero-knowledge)

### Extension works but Primal shows "Retry Signing"

**Cause:** Usually happens on first login when session is locked during Primal's startup sequence.

**Fix:**
1. Click the RDWE icon → Unlock your session
2. On Primal's "publish pending" page → click "Retry Selected"
3. The approval window appears → Approve All → Done ✔

### Site shows "Crypto integrity check failed"

**Cause:** The boot-time cryptographic self-tests detected a mismatch between
the bundled crypto library and the RFC reference vectors. This is a refusal
mechanism — it means something is wrong, and the extension is correctly
refusing to handle nostr requests.

**Fix:**
1. Open `chrome://extensions` → 🔄 Reload the extension
2. Open the service worker console (the link under the extension card)
3. Look for `[RDWE] Crypto integrity check failed:` followed by which
   vector(s) failed
4. If the issue persists, **re-download the extension fresh** from the
   official source — your local copy may be tampered with or corrupted
5. Open an issue on GitHub with the exact failed vector names

**Do not bypass this check.** If the self-tests fail, your nsec is at risk
of being used with a faulty crypto implementation.



**Cause:** You have an old version with inline `<script>` in prompt.html.

**Fix:** Update to v1.6+ — all scripts are in external `.js` files, fully MV3/CSP compliant.

---

## 🔧 Building from Source

No build step required. This is pure JavaScript — just load it.

```bash
# Clone
git clone https://github.com/RedDragonElite/rdwe-nostr-signer.git
cd rdwe-nostr-signer

# That's it. Load the folder in chrome://extensions.
# No npm. No webpack. No vite. No BS.
```

### Running Tests

The crypto library can be tested in any browser console:

```javascript
// In browser DevTools console, after loading the extension:

// Test bech32 / npub conversion
const { hexToNpub, npubToHex } = await import(chrome.runtime.getURL('lib/crypto.js'));

const npub = hexToNpub('7e05e4b06f5e5b5a8dff0ce5d5e7b7c8f1a2d3e4f5a6b7c8d9e0f1a2b3c4d5e6');
console.log('npub:', npub);
```

---

## 📋 NIPs Implemented

| NIP | Title | Status |
|---|---|---|
| [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) | Basic Protocol | ✅ Event signing, ID hashing |
| [NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md) | Encrypted Direct Messages | ✅ AES-256-CBC + ECDH |
| [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) | Browser Extension (window.nostr) | ✅ Full implementation |
| [NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md) | bech32-encoded entities | ✅ nsec / npub encode + decode |
| [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) | Versioned Encryption | ✅ ChaCha20 + HMAC-SHA256 + HKDF |

---

## 🤝 Contributing

We welcome contributions from anyone who doesn't write garbage code.

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Test** it on actual Nostr clients (Primal, Snort, Iris)
4. **Commit**: `git commit -m 'feat: your feature description'`
5. **Push**: `git push origin feature/your-feature`
6. **Open** a Pull Request with a clear description

### Contribution Rules

- ✅ Keep the RDE header in all files
- ✅ Zero external dependencies — keep it pure
- ✅ Test on Brave AND Chrome before submitting
- ✅ Explain your security implications
- ❌ Don't add analytics, telemetry, or any external requests
- ❌ Don't downgrade the crypto — 310k PBKDF2 iterations stay
- ❌ Don't add npm/node_modules — this stays build-free
- ❌ Don't change the license

---

## 📜 License

**RDE Black Flag Source License v6.66**

```
###################################################################################
#                                                                                 #
#      .:: RED DRAGON ELITE (RDE)  -  BLACK FLAG SOURCE LICENSE v6.66 ::.         #
#                                                                                 #
#   PROJECT:    RDWE NOSTR SIGNER (NIP-07 BROWSER EXTENSION, ENCRYPTED KEY MGMT)  #
#   ARCHITECT:  .:: RDE ⧌ Shin [△ ᛋᛅᚱᛒᛅᚾᛏᛋ ᛒᛁᛏᛅ ▽] ::. | https://rd-elite.com     #
#   ORIGIN:     https://github.com/RedDragonElite                                 #
#                                                                                 #
#   WARNING: THIS CODE IS PROTECTED BY DIGITAL VOODOO AND PURE HATRED FOR LEAKERS #
#                                                                                 #
#   [ THE RULES OF THE GAME ]                                                     #
#                                                                                 #
#   1. // THE "FUCK GREED" PROTOCOL (FREE USE)                                    #
#      You are free to use, edit, and abuse this code in your browser.            #
#      Learn from it. Break it. Fix it. That is the hacker way.                   #
#      Cost: 0.00€. If you paid for this, you got scammed by a rat.               #
#                                                                                 #
#   2. // THE TEBEX KILL SWITCH (COMMERCIAL SUICIDE)                              #
#      Listen closely, you parasites:                                             #
#      If I find this extension on any paid store, Patreon, or "Premium Pack":    #
#      > I will DMCA your store into oblivion.                                    #
#      > I will publicly shame your community on Nostr. Permanently.              #
#      > I hope every signEvent() call you make fails with bad_signature.         #
#      SELLING FREE WORK IS THEFT. AND I AM THE JUDGE.                            #
#                                                                                 #
#   3. // THE CREDIT OATH                                                         #
#      Keep this header. If you remove my name, you admit you have no skill.      #
#      You can add "Edited by [YourName]", but never erase the original creator.  #
#      Don't be a skid. Respect the architecture.                                 #
#                                                                                 #
#   4. // THE CURSE OF THE COPY-PASTE                                             #
#      This code implements real cryptography: Schnorr signatures, PBKDF2,        #
#      AES-256-GCM, ChaCha20, HKDF. If you copy-paste without understanding,      #
#      you WILL break something important. Don't come crying to my DMs. RTFM.     #
#                                                                                 #
#   --------------------------------------------------------------------------    #
#   "We build the future on the graves of paid resources."                        #
#   "REJECT MODERN MEDIOCRITY. EMBRACE RDE SUPERIORITY."                          #
#   --------------------------------------------------------------------------    #
###################################################################################
```

**TL;DR:**

- ✅ **Free forever** — use, fork, learn, modify
- ✅ **Keep the header** — credit where it's due
- ❌ **Don't sell it** — commercial use = instant DMCA + public shaming on Nostr
- ❌ **Don't be a skid** — copy-paste crypto without understanding = you will lose keys

---

## 🌐 Community & Support

### Official Links

| | |
|---|---|
| 🌍 **Website** | [rd-elite.com](https://rd-elite.com) |
| 🔭 **Nostr Terminal** | [rd-elite.com/Files/NOSTR/Terminal](https://rd-elite.com/Files/NOSTR/Terminal/) |
| 🐙 **GitHub** | [github.com/RedDragonElite](https://github.com/RedDragonElite) |
| 🟣 **Nostr** | `npub1wr4e24zn6zzjqx8kvnelfvktf0pu6l2gx4gvw06zead2eqyn23sq9tsd94` |

### Creator

**Shin | Red Dragon Elite**

- Nostr: `npub1wr4e24zn6zzjqx8kvnelfvktf0pu6l2gx4gvw06zead2eqyn23sq9tsd94`
- Web: [rd-elite.com](https://rd-elite.com)

### Get Help

1. 📖 Read [Security Model](#-security-model) — most questions are answered there
2. 🐛 Check [Troubleshooting](#-troubleshooting)
3. 🐙 [Open an Issue](https://github.com/RedDragonElite/rdwe-nostr-signer/issues) with logs

**Please DON'T:**

- ❌ DM about basic setup (read the docs first)
- ❌ Open issues without browser console errors attached
- ❌ Ask for your master password back — zero-knowledge means zero-knowledge

**Please DO:**

- ✅ Include your browser version and OS when reporting bugs
- ✅ Test on both Brave and Chrome before reporting
- ✅ Share the F12 console output when something breaks
- ✅ Star the repo if this saved your keys from leaking 🐉

---

## 💡 FAQ

### Is my nsec safe?

**Yes** — if you use a strong master password. The nsec is encrypted with AES-256-GCM before it ever touches storage. The only way to get it back is your master password + the encrypted blob. We don't have either.

### What if I forget my master password?

There is no recovery. This is by design — zero-knowledge means zero backdoors.  
**Fix:** Wipe the extension, re-import your nsec, set a new password.  
This is why you should **back up your nsec** somewhere safe (hardware wallet, paper, encrypted vault).

### Does this work offline?

**Yes.** All cryptography runs locally in your browser. No servers involved. Ever.

### Can websites read my private key?

**No.** The `window.nostr` object is frozen. Web pages can only call the API methods — they never touch the underlying key. The actual signing happens in the isolated service worker.

### Does it work on Firefox?

Not officially — Firefox uses a different extension API (`browser.*` vs `chrome.*`) and doesn't fully support Manifest V3 in the same way. Pull requests welcome.

### What's the difference between NIP-04 and NIP-44?

- **NIP-04** — Legacy DM encryption. AES-256-CBC + ECDH. Older but widely supported.
- **NIP-44** — Modern DM encryption. ChaCha20 + HMAC-SHA256 + HKDF. Better security, padding, versioning. Use this when both sides support it.

### Why 310,000 PBKDF2 iterations?

OWASP 2023 recommends a minimum of 310,000 iterations for PBKDF2-SHA256. This means even if someone steals your encrypted blob, brute-forcing your master password takes orders of magnitude longer than with lower iteration counts. On modern hardware, ~310k iterations takes about 300ms — barely noticeable to you, devastating for an attacker.

### Can I use this with multiple Nostr identities?

Currently one key per extension instance. For multiple identities, use separate browser profiles, each with their own RDWE Nostr Signer instance.

### Why no Chrome Web Store listing?

The CWS review process is slow, centralized, and can remove extensions arbitrarily. Load unpacked stays in your control. Your browser, your extension, your keys.

---

## 📊 Comparison Table

| Feature | nos2x | Alby | Flamingo | **RDWE Nostr Signer** |
|---|---|---|---|---|
| Open Source | ✅ | Partial | ❓ | ✅ |
| Key encryption at rest | ❌ | ✅ | ❓ | ✅ |
| Master password | ❌ | ✅ | ❓ | ✅ |
| Session auto-lock | ❌ | ✅ | ❓ | ✅ |
| Session survives SW restarts | ❌ | ❓ | ❓ | ✅ |
| Unlock prompt on sign | ❌ | ✅ | ❓ | ✅ |
| Request queue (1 window) | ❌ | ❓ | ❓ | ✅ |
| Zero dependencies | ✅ | ❌ | ❓ | ✅ |
| NIP-44 support | ❌ | ✅ | ❓ | ✅ |
| Spec-compliant NIP-44 padding | ❓ | ❓ | ❓ | ✅ |
| Boot-time crypto self-tests | ❌ | ❌ | ❌ | ✅ |
| Verify-after-sign defense | ❌ | ❌ | ❓ | ✅ |
| Invalid-curve attack defense | ❓ | ❓ | ❓ | ✅ |
| Conv-key cache (44× faster inbox) | ❌ | ❓ | ❓ | ✅ |
| Build step required | ❌ | ✅ | ❓ | ❌ |
| RDE aesthetic | ❌ | ❌ | ❌ | ✅ 🐉 |

---

## 🏆 Credits

**Built by:** [Red Dragon Elite](https://rd-elite.com)  
**Creator:** Shin | RDE  
**Cryptography:** Built on [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — browser-native, audited, battle-tested  
**Inspiration:** [nos2x](https://github.com/fiatjaf/nos2x) by fiatjaf — the OG NIP-07 signer  
**Protocol:** [Nostr](https://github.com/nostr-protocol/nostr) — the unstoppable decentralized network  

**Special Thanks:**

- The Nostr protocol developers — for building something truly uncensorable
- Paul Miller ([@paulmillr](https://github.com/paulmillr)) — for [@noble/secp256k1](https://github.com/paulmillr/noble-secp256k1) which inspired our pure-JS implementation
- fiatjaf — for nos2x showing how a signer should work
- Everyone zapping on Nostr instead of feeding Discord's data machines

---

## ⚡ One More Thing...

**If this extension saved your keys from leaking:**

- ⭐ **Star this repo** — helps others discover it
- 🍴 **Fork it** — build something on top
- 📢 **Share it on Nostr** — spread the word where it matters
- 🐉 **Follow us** — `npub1wr4e24zn6zzjqx8kvnelfvktf0pu6l2gx4gvw06zead2eqyn23sq9tsd94`

**Remember:**

> *"Your keys, your identity. Your keys in plaintext, someone else's identity."*  
> — Red Dragon Elite

---

**Made with 🔥 and pure cryptographic paranoia by [Red Dragon Elite](https://rd-elite.com)**

*REJECT MODERN MEDIOCRITY. EMBRACE RDE SUPERIORITY.*

[![Website](https://img.shields.io/badge/Website-Visit-red?style=for-the-badge&logo=google-chrome)](https://rd-elite.com)
[![Nostr](https://img.shields.io/badge/Nostr-Follow-purple?style=for-the-badge&logo=rss)](https://primal.net/p/npub1wr4e24zn6zzjqx8kvnelfvktf0pu6l2gx4gvw06zead2eqyn23sq9tsd94)
[![Terminal](https://img.shields.io/badge/Terminal-Live-green?style=for-the-badge&logo=gnome-terminal)](https://rd-elite.com/Files/NOSTR/)
