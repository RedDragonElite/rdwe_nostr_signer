# 🐉 RDWE Nostr Signer

[![Version](https://img.shields.io/badge/version-1.5.0-red?style=for-the-badge)](https://github.com/RedDragonElite/rdwe-nostr-signer)
[![License](https://img.shields.io/badge/license-RDE%20Black%20Flag-black?style=for-the-badge)](LICENSE)
[![Manifest](https://img.shields.io/badge/Manifest-V3-blue?style=for-the-badge)](https://developer.chrome.com/docs/extensions/mv3/)
[![Nostr](https://img.shields.io/badge/Nostr-NIP--07-purple?style=for-the-badge)](https://github.com/nostr-protocol/nips/blob/master/07.md)
[![Browser](https://img.shields.io/badge/Brave%20%2F%20Chrome-Compatible-orange?style=for-the-badge)](https://brave.com)
[![Zero Deps](https://img.shields.io/badge/dependencies-ZERO-green?style=for-the-badge)](#)

**The most secure NIP-07 Nostr Signer extension — built by Red Dragon Elite.**

*Your nsec never leaves your machine in plain text. Not to Discord. Not to servers. Not to anyone. Ever.*

*Built by [Red Dragon Elite](https://rd-elite.com) | Free Forever | Encrypted by Design*

[📖 Installation](#-installation) • [🔐 Security Model](#-security-model) • [🚀 Quick Start](#-quick-start) • [🌐 Website](https://rd-elite.com) • [🔭 Terminal](https://rd-elite.com/Files/NOSTR/Terminal/)

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
- ⚡ **Seamless Unlock Flow** — sites never error out; unlock popup appears when needed
- 📋 **Smart Request Queue** — multiple sign requests batched in ONE window
- 🌐 **Full NIP-07 Support** — `getPublicKey`, `signEvent`, `getRelays`, NIP-04, NIP-44
- 🔑 **getPublicKey Always Works** — even when locked (pubkey is public — duh)
- 🛡️ **Per-Origin Permissions** — "Always allow" per site per method, fully revocable
- 🐉 **RDE Terminal Aesthetic** — because ugly tools deserve to die
- 📡 **Relay Management** — configure read/write relays right in the popup
- 📋 **Activity Log** — full history of every signing request
- 🔑 **Key Generation** — generate a fresh keypair or import your existing nsec
- ⚙️ **Zero Dependencies** — pure JavaScript, no npm, no node_modules, no supply chain BS

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
You click icon → Enter master password
    ↓
Password → PBKDF2 → AES key → Decrypt blob → nsec in RAM
    ↓
Session UNLOCKED (15 min idle timeout)
    ↓
After 15 min inactivity → nsec wiped from memory
    ↓
Session LOCKED again
```

- nsec lives **only in the service worker's RAM** during an unlocked session
- If Chrome crashes, restarts, or the SW is killed → nsec is gone from memory
- Next time you need to sign → enter password again

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

### Cryptographic Stack

| Operation | Algorithm | Parameters |
|---|---|---|
| Key derivation | PBKDF2-SHA256 | 310,000 iterations · 256-bit salt |
| Storage encryption | AES-256-GCM | 96-bit IV · authenticated |
| Event signing | BIP-340 Schnorr | secp256k1 |
| Legacy DM encryption | NIP-04 AES-CBC | ECDH shared secret |
| Modern DM encryption | NIP-44 ChaCha20 | HMAC-SHA256 · HKDF |
| Event hashing | SHA-256 | via Web Crypto API |

**All cryptography uses the browser's native Web Crypto API. Zero custom crypto primitives.**

### Threat Model

| Threat | Status |
|---|---|
| Malware reads `chrome.storage.local` | ✅ Protected — only encrypted blob present |
| Website reads `window.nostr` private state | ✅ Protected — API is frozen, no private access |
| Content script is compromised | ✅ Protected — only bridges postMessage, no key access |
| Browser profile theft | ✅ Protected — blob is useless without your password |
| Session is left unlocked | ⚠️ Auto-locks after 15 min idle |
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
├── prompt.html            ← Permission approval dialog
├── prompt.js              ← Prompt logic — queue, unlock-and-approve
├── lib/
│   └── crypto.js          ← Complete crypto library (zero dependencies)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
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
- **"Always allow"** checkbox — skips future prompts for this site+method

---

## 🌐 NIP-07 API Reference

The extension provides a fully NIP-07 compliant `window.nostr` object:

### `getPublicKey()`

```javascript
const pubkey = await window.nostr.getPublicKey();
// Returns: hex-encoded 32-byte public key
// Works even when session is locked — pubkey is stored plaintext
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

// Get public key (auto-prompts unlock if locked)
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

### Login fails / site shows "no extension found"

**Cause:** Session is locked AND the site checks `getPublicKey()` immediately.

**Note:** `getPublicKey()` always works even when locked. If you see this error, the site may be using a non-standard check.

**Fix:**
1. Click the RDWE icon → enter password → Unlock
2. Reload the page
3. Try logging in again

### Multiple approval windows open at once

**Cause:** You're using an older version (< v1.4).

**Fix:** Update to v1.5+ — the queue system opens exactly ONE window for all pending requests.

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

### CSP error: `Executing inline script violates Content Security Policy`

**Cause:** You have an old version with inline `<script>` in prompt.html.

**Fix:** Update to v1.5+ — all scripts are in external `.js` files, fully MV3/CSP compliant.

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
| Unlock prompt on sign | ❌ | ✅ | ❓ | ✅ |
| Request queue (1 window) | ❌ | ❓ | ❓ | ✅ |
| Zero dependencies | ✅ | ❌ | ❓ | ✅ |
| NIP-44 support | ❌ | ✅ | ❓ | ✅ |
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
[![Terminal](https://img.shields.io/badge/Terminal-Live-green?style=for-the-badge&logo=gnome-terminal)](https://rd-elite.com/Files/NOSTR/Terminal/)
