# ◢ RDWE Nostr Signer ◣

**Red Dragon Web Engine — NIP-07 Chrome Extension**

A secure, self-contained Nostr signer for Chrome/Chromium browsers.  
Zero external dependencies. Every line of code is yours to read and understand.

---

## What It Does

RDWE Nostr Signer implements [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) — the standard browser extension protocol for Nostr.

It injects a `window.nostr` object into every webpage. When a Nostr client (like Primal, Iris, Snort, etc.) wants to sign an event or encrypt a message, it calls `window.nostr` instead of asking you to paste your private key. Your **nsec never leaves the extension**.

---

## How It Works (Architecture)

```
┌─────────────────────────────────────────────────────────┐
│  WEB PAGE                                               │
│  window.nostr.signEvent(event)  ←── inject.js (MAIN)    │
│         │ postMessage                                   │
└─────────┼───────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────┐
│  content_script.js (ISOLATED)                           │
│  Bridges page ↔ background via chrome.runtime           │
└─────────┼───────────────────────────────────────────────┘
          │ chrome.runtime.sendMessage
┌─────────▼───────────────────────────────────────────────┐
│  background.js (SERVICE WORKER)                         │
│  ✔ Validates permissions                                │
│  ✔ Opens approval popup if needed                       │
│  ✔ Signs / encrypts / decrypts                          │
│  ✔ Returns result (never the private key)               │
└─────────────────────────────────────────────────────────┘
```

Your **private key** is stored in `chrome.storage.local` — accessible only to this extension, never to web pages.

---

## Installation

1. Download or clone this folder
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (top right toggle)
4. Click **"Load unpacked"**
5. Select the `rdwe-nostr-signer/` folder
6. Click the extension icon in the toolbar
7. Import your `nsec1…` key or generate a new one

---

## User Guide

### Importing Your Key

1. Click the RDWE icon in your Chrome toolbar
2. Paste your `nsec1…` key in the input field
3. Click **Import nsec**
4. Your key is stored locally — it never leaves your browser

### Generating a New Key

1. Click **Generate New Key**
2. Immediately click **Show nsec** and copy your nsec somewhere safe
3. Your npub (public key) is shown at the top

### Using on Nostr Clients

When you visit a NIP-07 compatible site (Primal, Iris, Snort, etc.):

- The site will automatically detect `window.nostr`
- For **reading your public key** — auto-approved, no popup
- For **signing events** — RDWE shows an approval dialog
- Check **"Always allow"** to skip future prompts for trusted sites

### Managing Permissions

- Click the **Perms** tab in the popup
- See which sites have "Always allow" saved
- Click **✖** next to any site to revoke its permissions

### Relay Management

- Click the **Relays** tab
- Add/remove relay URLs
- Toggle **R** (read) and **W** (write) per relay
- Click **Save**
- These relays are returned to clients that call `window.nostr.getRelays()`

---

## Web Developer Integration Guide

### Checking for NIP-07

```javascript
if (typeof window.nostr === 'undefined') {
  alert('Please install a Nostr signer extension (RDWE Nostr Signer)');
  return;
}
```

### Get User's Public Key

```javascript
const pubkey = await window.nostr.getPublicKey();
// Returns: 64-char hex string (x-only secp256k1 pubkey)
// Example: "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e"
```

### Sign a Nostr Event

```javascript
const event = {
  kind: 1,              // 1 = short text note
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'Hello Nostr!'
  // pubkey, id, sig are added automatically by the signer
};

const signedEvent = await window.nostr.signEvent(event);
// Returns the full event with pubkey, id, and sig set
console.log(signedEvent.id);  // event hash (hex)
console.log(signedEvent.sig); // Schnorr signature (hex)
```

### NIP-04 Direct Messages (Legacy Encryption)

> ⚠️ NIP-04 uses AES-CBC. It's widely supported but prefer NIP-44 for new apps.

```javascript
// Encrypt a message TO someone
const recipientPubkey = '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e';
const ciphertext = await window.nostr.nip04.encrypt(recipientPubkey, 'Hello!');
// Returns: "base64ciphertext?iv=base64iv"

// Decrypt a message FROM someone
const plaintext = await window.nostr.nip04.decrypt(senderPubkey, ciphertext);
// Returns: "Hello!"
```

### NIP-44 Direct Messages (Modern Encryption)

> ✅ NIP-44 uses ChaCha20 + HMAC-SHA256. Recommended for new apps.

```javascript
// Encrypt
const ciphertext = await window.nostr.nip44.encrypt(recipientPubkey, 'Hello!');
// Returns: base64 string (version byte + nonce + ciphertext + mac)

// Decrypt
const plaintext = await window.nostr.nip44.decrypt(senderPubkey, ciphertext);
```

### Get Relays

```javascript
const relays = await window.nostr.getRelays();
// Returns: { "wss://relay.damus.io": { read: true, write: true }, ... }
```

### Complete Example: Post a Note

```javascript
async function postNote(content) {
  if (!window.nostr) throw new Error('No Nostr signer found');

  // Get public key
  const pubkey = await window.nostr.getPublicKey();

  // Build unsigned event
  const event = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content
  };

  // Sign it (RDWE handles id + sig + pubkey)
  const signed = await window.nostr.signEvent(event);

  // Get relays and publish
  const relays = await window.nostr.getRelays();
  for (const [url, policy] of Object.entries(relays)) {
    if (!policy.write) continue;
    const ws = new WebSocket(url);
    ws.onopen = () => {
      ws.send(JSON.stringify(['EVENT', signed]));
      setTimeout(() => ws.close(), 2000);
    };
  }
}
```

### Complete Example: Encrypted DM (NIP-04)

```javascript
async function sendDM(recipientPubkey, message) {
  const pubkey     = await window.nostr.getPublicKey();
  const ciphertext = await window.nostr.nip04.encrypt(recipientPubkey, message);

  const event = {
    kind: 4,  // Direct Message
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', recipientPubkey]],
    content: ciphertext
  };

  return await window.nostr.signEvent(event);
}
```

### Error Handling

```javascript
try {
  const signed = await window.nostr.signEvent(event);
} catch (err) {
  if (err.message.includes('User rejected')) {
    console.log('User denied the request');
  } else if (err.message.includes('No key configured')) {
    console.log('User has not set up the signer yet');
  } else {
    console.error('Unexpected error:', err);
  }
}
```

---

## Crypto Implementation

All cryptography is implemented in `lib/crypto.js` with zero dependencies:

| Primitive           | Implementation           | Used For              |
|---------------------|--------------------------|-----------------------|
| secp256k1           | Pure BigInt JS           | Key derivation, ECDH  |
| BIP-340 Schnorr     | RFC-compliant            | Event signing         |
| Bech32              | BIP-173                  | nsec/npub encode/decode|
| SHA-256             | Web Crypto API           | Hashing               |
| HMAC-SHA256         | Web Crypto API           | NIP-44 MAC            |
| HKDF                | Web Crypto API + custom  | NIP-44 key derivation |
| AES-256-CBC         | Web Crypto API           | NIP-04 encryption     |
| ChaCha20            | Pure JS (RFC 7539)       | NIP-44 encryption     |

---

## Security Model

- ✅ Private key never sent to any server or web page
- ✅ All crypto runs in the background service worker (isolated)
- ✅ Content scripts only relay messages — they never see the key
- ✅ `window.nostr` object is frozen to prevent tampering
- ✅ Per-site permission system — approve once or every time
- ✅ Constant-time MAC verification in NIP-44 (prevents timing attacks)
- ⚠️ Key stored as plain hex in `chrome.storage.local` — protected by Chrome's sandbox
- ⚠️ For maximum security, consider using a hardware key (like YubiKey) via a native app

---

## File Structure

```
rdwe-nostr-signer/
├── manifest.json        Chrome Extension Manifest V3
├── background.js        Service worker — all crypto & key management
├── content_script.js    Page ↔ background message bridge
├── inject.js            window.nostr provider (page MAIN world)
├── popup.html           Extension popup UI
├── popup.js             Popup logic
├── prompt.html          Permission approval dialog
├── lib/
│   └── crypto.js        Complete crypto implementation
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            This file
```

---

## NIP-07 API Reference

| Method | Auto-Approved | Description |
|--------|--------------|-------------|
| `window.nostr.getPublicKey()` | ✅ Always | Returns hex public key |
| `window.nostr.signEvent(event)` | ❌ Prompts | Signs event, returns completed event |
| `window.nostr.getRelays()` | ✅ Always | Returns relay map |
| `window.nostr.nip04.encrypt(pubkey, text)` | ❌ Prompts | AES-CBC ECDH encrypt |
| `window.nostr.nip04.decrypt(pubkey, ct)` | ❌ Prompts | AES-CBC ECDH decrypt |
| `window.nostr.nip44.encrypt(pubkey, text)` | ❌ Prompts | ChaCha20 encrypt |
| `window.nostr.nip44.decrypt(pubkey, ct)` | ❌ Prompts | ChaCha20 decrypt |

---

## Compatible Nostr Clients

Any site implementing NIP-07 will work automatically:

- [Primal](https://primal.net)
- [Iris](https://iris.to)
- [Snort](https://snort.social)
- [Coracle](https://coracle.social)
- [Nostrudel](https://nostrudel.ninja)
- [Zap.stream](https://zap.stream)
- And any other NIP-07 compatible client

---

## Built By

**◢ RD-ELITE ◣** · Red Dragon Web Engine  
Crafted with 🔥 by 🌊 for the RDWE project  
License: BFS 6.66
