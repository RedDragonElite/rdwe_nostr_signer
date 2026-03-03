/**
 * ◢ RDWE ◣ Nostr Signer — Crypto Library
 * Complete secp256k1 · BIP-340 Schnorr · NIP-04 · NIP-44 · Bech32
 * Zero external dependencies. Pure JS + Web Crypto API.
 */

'use strict';

// ══════════════════════════════════════════════════════════════
// secp256k1 Curve Constants
// ══════════════════════════════════════════════════════════════
const P  = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
const N  = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
const Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;

// ══════════════════════════════════════════════════════════════
// Field Math
// ══════════════════════════════════════════════════════════════
function mod(a, m = P) { return ((a % m) + m) % m; }

function modpow(base, exp, m) {
  let r = 1n;
  base = mod(base, m);
  while (exp > 0n) {
    if (exp & 1n) r = r * base % m;
    exp >>= 1n;
    base = base * base % m;
  }
  return r;
}

function modinv(a, m = P) { return modpow(a, m - 2n, m); }
function modSqrt(n) { return modpow(n, (P + 1n) / 4n, P); }

// ══════════════════════════════════════════════════════════════
// secp256k1 Point Arithmetic
// ══════════════════════════════════════════════════════════════
class Point {
  constructor(x, y) { this.x = x; this.y = y; }

  static get ZERO() { return new Point(0n, 0n); }
  static get G()    { return new Point(Gx, Gy); }

  isZero() { return this.x === 0n && this.y === 0n; }

  add(other) {
    if (this.isZero()) return other;
    if (other.isZero()) return this;
    if (this.x === other.x && this.y !== other.y) return Point.ZERO;

    const lambda = this.x === other.x
      ? mod(3n * this.x * this.x * modinv(2n * this.y))
      : mod((other.y - this.y) * modinv(other.x - this.x));

    const x3 = mod(lambda * lambda - this.x - other.x);
    const y3 = mod(lambda * (this.x - x3) - this.y);
    return new Point(x3, y3);
  }

  mul(scalar) {
    scalar = mod(scalar, N);
    let result = Point.ZERO;
    let addend = new Point(this.x, this.y);
    while (scalar > 0n) {
      if (scalar & 1n) result = result.add(addend);
      addend = addend.add(addend);
      scalar >>= 1n;
    }
    return result;
  }

  /** 32-byte x-only public key (BIP-340 style) */
  toXOnly() { return bigintToBytes32(this.x); }

  /** Recover point from 32-byte x-only bytes (assumes even y) */
  static fromXOnly(xBytes) {
    const x = bytesToBigint(xBytes);
    const y2 = mod(x * x * x + 7n);
    let y = modSqrt(y2);
    if (y % 2n !== 0n) y = mod(-y);
    return new Point(x, y);
  }

  /** Recover point from 33-byte compressed public key */
  static fromCompressed(bytes) {
    const prefix = bytes[0];
    const x = bytesToBigint(bytes.slice(1));
    const y2 = mod(x * x * x + 7n);
    let y = modSqrt(y2);
    if ((y % 2n === 0n) !== (prefix === 0x02)) y = mod(-y);
    return new Point(x, y);
  }
}

// ══════════════════════════════════════════════════════════════
// Byte / Hex Utilities
// ══════════════════════════════════════════════════════════════
function hexToBytes(hex) {
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2)
    arr[i >> 1] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function bigintToBytes32(n) {
  return hexToBytes(n.toString(16).padStart(64, '0'));
}

function bytesToBigint(bytes) {
  return BigInt('0x' + bytesToHex(bytes));
}

function concatBytes(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

// ══════════════════════════════════════════════════════════════
// Hash Primitives (Web Crypto API)
// ══════════════════════════════════════════════════════════════
async function sha256(...parts) {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', concatBytes(...parts))
  );
}

async function hmacSha256(key, data) {
  const k = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** BIP-340 tagged hash */
async function taggedHash(tag, ...msgs) {
  const tagBytes = new TextEncoder().encode(tag);
  const tagHash  = new Uint8Array(await crypto.subtle.digest('SHA-256', tagBytes));
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', concatBytes(tagHash, tagHash, ...msgs))
  );
}

// ══════════════════════════════════════════════════════════════
// HKDF (RFC 5869, SHA-256)
// ══════════════════════════════════════════════════════════════
async function hkdfExtract(ikm, salt) {
  return await hmacSha256(salt, ikm);
}

async function hkdfExpand(prk, info, length) {
  const output = new Uint8Array(length);
  let T = new Uint8Array(0);
  let offset = 0;
  for (let i = 1; offset < length; i++) {
    T = await hmacSha256(prk, concatBytes(T, info, new Uint8Array([i])));
    const take = Math.min(T.length, length - offset);
    output.set(T.slice(0, take), offset);
    offset += take;
  }
  return output;
}

// ══════════════════════════════════════════════════════════════
// BIP-340 Schnorr Signature
// ══════════════════════════════════════════════════════════════
async function schnorrSign(msgBytes, privKeyBytes) {
  const d_raw = bytesToBigint(privKeyBytes);
  if (d_raw === 0n || d_raw >= N) throw new Error('Invalid private key');

  const P_pt = Point.G.mul(d_raw);
  const d    = P_pt.y % 2n !== 0n ? N - d_raw : d_raw;

  // RFC-6979-style deterministic nonce with random aux (BIP-340 §default signing)
  const aux     = randomBytes(32);
  const auxHash = await taggedHash('BIP0340/aux', aux);
  const t       = bigintToBytes32(d ^ bytesToBigint(auxHash));
  const kRand   = await taggedHash('BIP0340/nonce', t, P_pt.toXOnly(), msgBytes);

  const k_ = mod(bytesToBigint(kRand), N);
  if (k_ === 0n) throw new Error('Nonce is zero — retry');

  const R  = Point.G.mul(k_);
  const k  = R.y % 2n !== 0n ? N - k_ : k_;
  const rx = R.toXOnly();
  const px = P_pt.toXOnly();

  const eHash = await taggedHash('BIP0340/challenge', rx, px, msgBytes);
  const e     = mod(bytesToBigint(eHash), N);
  const s     = mod(k + e * d, N);

  return concatBytes(rx, bigintToBytes32(s));
}

// ══════════════════════════════════════════════════════════════
// Nostr Event Utilities
// ══════════════════════════════════════════════════════════════
async function getEventHash(event) {
  const serialized = JSON.stringify([
    0, event.pubkey, event.created_at, event.kind, event.tags, event.content
  ]);
  return await sha256(new TextEncoder().encode(serialized));
}

function getPublicKey(privKeyHex) {
  const privKey = BigInt('0x' + privKeyHex);
  return bytesToHex(Point.G.mul(privKey).toXOnly());
}

// ══════════════════════════════════════════════════════════════
// Bech32 (BIP-173)
// ══════════════════════════════════════════════════════════════
const B32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const B32_GEN     = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function b32Polymod(values) {
  let chk = 1;
  for (const v of values) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= B32_GEN[i];
  }
  return chk;
}

function b32HrpExpand(hrp) {
  return [
    ...Array.from(hrp, c => c.charCodeAt(0) >>> 5), 0,
    ...Array.from(hrp, c => c.charCodeAt(0) & 31)
  ];
}

function b32CreateChecksum(hrp, data) {
  const pm = b32Polymod([...b32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  return Array.from({ length: 6 }, (_, i) => (pm >>> (5 * (5 - i))) & 31);
}

function convertbits(data, frombits, tobits, pad = true) {
  let acc = 0, bits = 0;
  const result = [];
  const maxv = (1 << tobits) - 1;
  for (const value of data) {
    acc = (acc << frombits) | value;
    bits += frombits;
    while (bits >= tobits) {
      bits -= tobits;
      result.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) result.push((acc << (tobits - bits)) & maxv);
  return result;
}

function bech32Decode(str) {
  str = str.toLowerCase();
  const pos = str.lastIndexOf('1');
  if (pos < 1 || pos + 7 > str.length) throw new Error('Invalid bech32 string');
  const hrp  = str.slice(0, pos);
  const data = [];
  for (let i = pos + 1; i < str.length; i++) {
    const idx = B32_CHARSET.indexOf(str[i]);
    if (idx < 0) throw new Error(`Invalid bech32 char: ${str[i]}`);
    data.push(idx);
  }
  if (b32Polymod([...b32HrpExpand(hrp), ...data]) !== 1)
    throw new Error('Invalid bech32 checksum');
  return { hrp, data: data.slice(0, -6) };
}

function bech32Encode(hrp, data) {
  const combined = [...data, ...b32CreateChecksum(hrp, data)];
  return hrp + '1' + combined.map(d => B32_CHARSET[d]).join('');
}

function nsecToHex(nsec) {
  const { hrp, data } = bech32Decode(nsec.trim());
  if (hrp !== 'nsec') throw new Error('Not an nsec key (wrong prefix)');
  return bytesToHex(new Uint8Array(convertbits(data, 5, 8, false)));
}

function hexToNsec(hex) {
  const bits = convertbits(Array.from(hexToBytes(hex)), 8, 5);
  return bech32Encode('nsec', bits);
}

function hexToNpub(hex) {
  const bits = convertbits(Array.from(hexToBytes(hex)), 8, 5);
  return bech32Encode('npub', bits);
}

function npubToHex(npub) {
  const { hrp, data } = bech32Decode(npub.trim());
  if (hrp !== 'npub') throw new Error('Not an npub key');
  return bytesToHex(new Uint8Array(convertbits(data, 5, 8, false)));
}

/** Generate a new random private key */
function generatePrivKey() {
  while (true) {
    const bytes = randomBytes(32);
    const n = bytesToBigint(bytes);
    if (n > 0n && n < N) return bytesToHex(bytes);
  }
}

// ══════════════════════════════════════════════════════════════
// NIP-04: AES-256-CBC + ECDH
// ══════════════════════════════════════════════════════════════

/** Raw ECDH shared secret (x-coordinate) */
function ecdhSharedX(privKeyHex, pubKeyHex) {
  const priv     = BigInt('0x' + privKeyHex);
  // pubKeyHex may be x-only (64 chars) or compressed (66 chars)
  const pubPoint = pubKeyHex.length === 64
    ? Point.fromXOnly(hexToBytes(pubKeyHex))
    : Point.fromCompressed(hexToBytes(pubKeyHex));
  return bigintToBytes32(pubPoint.mul(priv).x);
}

async function nip04Encrypt(privKeyHex, pubKeyHex, plaintext) {
  const sharedX = ecdhSharedX(privKeyHex, pubKeyHex);
  const key = await crypto.subtle.importKey(
    'raw', sharedX, { name: 'AES-CBC' }, false, ['encrypt']
  );
  const iv         = randomBytes(16);
  const encoded    = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, encoded);

  return `${btoa(String.fromCharCode(...new Uint8Array(ciphertext)))}?iv=${btoa(String.fromCharCode(...iv))}`;
}

async function nip04Decrypt(privKeyHex, pubKeyHex, encryptedStr) {
  const [ctB64, ivPart] = encryptedStr.split('?iv=');
  if (!ivPart) throw new Error('Invalid NIP-04 ciphertext (missing ?iv=)');

  const sharedX = ecdhSharedX(privKeyHex, pubKeyHex);
  const key = await crypto.subtle.importKey(
    'raw', sharedX, { name: 'AES-CBC' }, false, ['decrypt']
  );
  const iv = Uint8Array.from(atob(ivPart), c => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64),  c => c.charCodeAt(0));

  const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ct);
  return new TextDecoder().decode(plain);
}

// ══════════════════════════════════════════════════════════════
// ChaCha20 Stream Cipher (RFC 7539)
// ══════════════════════════════════════════════════════════════
function chacha20Block(key, counter, nonce12) {
  const state = new Uint32Array(16);
  // Constants
  state[0] = 0x61707865; state[1] = 0x3320646e;
  state[2] = 0x79622d32; state[3] = 0x6b206574;
  // Key (32 bytes)
  const kv = new DataView(key.buffer, key.byteOffset);
  for (let i = 0; i < 8; i++) state[4 + i] = kv.getUint32(i * 4, true);
  // Counter + nonce
  state[12] = counter >>> 0;
  const nv = new DataView(nonce12.buffer, nonce12.byteOffset);
  state[13] = nv.getUint32(0, true);
  state[14] = nv.getUint32(4, true);
  state[15] = nv.getUint32(8, true);

  const w = new Uint32Array(state);

  function qr(a, b, c, d) {
    w[a] = (w[a] + w[b]) >>> 0; w[d] ^= w[a]; w[d] = (w[d] << 16 | w[d] >>> 16) >>> 0;
    w[c] = (w[c] + w[d]) >>> 0; w[b] ^= w[c]; w[b] = (w[b] << 12 | w[b] >>> 20) >>> 0;
    w[a] = (w[a] + w[b]) >>> 0; w[d] ^= w[a]; w[d] = (w[d] <<  8 | w[d] >>> 24) >>> 0;
    w[c] = (w[c] + w[d]) >>> 0; w[b] ^= w[c]; w[b] = (w[b] <<  7 | w[b] >>> 25) >>> 0;
  }

  for (let i = 0; i < 10; i++) {
    qr(0,4,8,12); qr(1,5,9,13); qr(2,6,10,14); qr(3,7,11,15);
    qr(0,5,10,15); qr(1,6,11,12); qr(2,7,8,13); qr(3,4,9,14);
  }

  const out = new Uint8Array(64);
  const ov  = new DataView(out.buffer);
  for (let i = 0; i < 16; i++) ov.setUint32(i * 4, (w[i] + state[i]) >>> 0, true);
  return out;
}

function chacha20(key, nonce12, counter, data) {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 64) {
    const block = chacha20Block(key, counter + (i / 64 | 0), nonce12);
    const len   = Math.min(64, data.length - i);
    for (let j = 0; j < len; j++) out[i + j] = data[i + j] ^ block[j];
  }
  return out;
}

// ══════════════════════════════════════════════════════════════
// NIP-44 v2: ECDH + HKDF + ChaCha20 + HMAC-SHA256
// ══════════════════════════════════════════════════════════════
async function nip44GetConversationKey(privKeyHex, pubKeyHex) {
  const sharedX = ecdhSharedX(privKeyHex, pubKeyHex);
  const salt    = new TextEncoder().encode('nip44-v2');
  return await hkdfExtract(sharedX, salt);
}

async function nip44GetMessageKeys(conversationKey, nonce32) {
  const keys = await hkdfExpand(conversationKey, nonce32, 76);
  return {
    chachaKey:   keys.slice(0, 32),  // 32 bytes
    chachaNonce: keys.slice(32, 44), // 12 bytes
    hmacKey:     keys.slice(44, 76)  // 32 bytes
  };
}

/** NIP-44 v2 padding: [uint16_be(len)] + plaintext + zero_padding */
function nip44Pad(content) {
  const plainBytes  = new TextEncoder().encode(content);
  const len         = plainBytes.length;
  if (len < 1 || len > 65535) throw new Error(`NIP-44: plaintext length out of range (${len})`);

  // Next power-of-2 >= len, minimum 32
  let paddedLen = 32;
  while (paddedLen < len) paddedLen <<= 1;

  const out = new Uint8Array(2 + paddedLen);
  out[0] = (len >> 8) & 0xff;
  out[1] = len & 0xff;
  out.set(plainBytes, 2);
  return out;
}

function nip44Unpad(data) {
  const len = (data[0] << 8) | data[1];
  if (len === 0 || len > data.length - 2) throw new Error('NIP-44: invalid padding length');
  return new TextDecoder().decode(data.slice(2, 2 + len));
}

async function nip44Encrypt(privKeyHex, pubKeyHex, plaintext) {
  const convKey = await nip44GetConversationKey(privKeyHex, pubKeyHex);
  const nonce   = randomBytes(32);
  const { chachaKey, chachaNonce, hmacKey } = await nip44GetMessageKeys(convKey, nonce);

  const padded     = nip44Pad(plaintext);
  const ciphertext = chacha20(chachaKey, chachaNonce, 0, padded);
  const mac        = await hmacSha256(hmacKey, concatBytes(nonce, ciphertext));

  // version=2 | nonce(32) | ciphertext | mac(32)
  const payload = concatBytes(new Uint8Array([2]), nonce, ciphertext, mac);
  return btoa(String.fromCharCode(...payload));
}

async function nip44Decrypt(privKeyHex, pubKeyHex, encryptedB64) {
  const payload = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));

  const version = payload[0];
  if (version !== 2) throw new Error(`NIP-44: unknown version ${version}`);

  const nonce      = payload.slice(1, 33);
  const mac        = payload.slice(payload.length - 32);
  const ciphertext = payload.slice(33, payload.length - 32);

  const convKey = await nip44GetConversationKey(privKeyHex, pubKeyHex);
  const { chachaKey, chachaNonce, hmacKey } = await nip44GetMessageKeys(convKey, nonce);

  // Constant-time MAC verification
  const expectedMac = await hmacSha256(hmacKey, concatBytes(nonce, ciphertext));
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= expectedMac[i] ^ mac[i];
  if (diff !== 0) throw new Error('NIP-44: MAC verification failed — tampered message');

  const padded = chacha20(chachaKey, chachaNonce, 0, ciphertext);
  return nip44Unpad(padded);
}

// ══════════════════════════════════════════════════════════════
// Exports
// ══════════════════════════════════════════════════════════════
export {
  // Utils
  hexToBytes, bytesToHex, concatBytes, randomBytes,
  bigintToBytes32, bytesToBigint,
  // Hash
  sha256, hmacSha256, taggedHash,
  // Keys
  getPublicKey, generatePrivKey, schnorrSign, getEventHash,
  // Bech32
  nsecToHex, hexToNsec, hexToNpub, npubToHex, bech32Decode,
  // NIP-04
  nip04Encrypt, nip04Decrypt,
  // NIP-44
  nip44Encrypt, nip44Decrypt
};


// ══════════════════════════════════════════════════════════════
// Master Password — AES-256-GCM Key Encryption
// ══════════════════════════════════════════════════════════════

/**
 * Derives a 256-bit AES-GCM key from a password using PBKDF2.
 * 310,000 iterations — OWASP 2023 recommended minimum for PBKDF2-SHA256.
 */
async function deriveKeyFromPassword(password, salt) {
  const enc      = new TextEncoder();
  const keyMat   = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 310_000 },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a private key hex string with a master password.
 * Returns a storable object: { salt, iv, ct } — all base64.
 */
async function encryptPrivKey(privKeyHex, password) {
  const salt   = randomBytes(32);  // 256-bit salt
  const iv     = randomBytes(12);  // 96-bit GCM IV
  const aesKey = await deriveKeyFromPassword(password, salt);

  const enc       = new TextEncoder();
  const plaintext = enc.encode(privKeyHex);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);

  const b64 = (b) => btoa(String.fromCharCode(...b));
  return {
    v:    2,                          // version marker
    salt: b64(salt),
    iv:   b64(iv),
    ct:   b64(new Uint8Array(cipherBuf))
  };
}

/**
 * Decrypt a stored encrypted key blob with the master password.
 * Throws if the password is wrong (AES-GCM authentication fails).
 */
async function decryptPrivKey(encObj, password) {
  if (!encObj || encObj.v !== 2) throw new Error('Invalid key blob version');

  const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const salt    = fromB64(encObj.salt);
  const iv      = fromB64(encObj.iv);
  const ct      = fromB64(encObj.ct);

  const aesKey = await deriveKeyFromPassword(password, salt);

  let plainBuf;
  try {
    plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  } catch {
    throw new Error('Wrong password — decryption failed');
  }

  return new TextDecoder().decode(plainBuf);
}

export { encryptPrivKey, decryptPrivKey };
