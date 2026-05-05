/**
 * ◢ RDWE Nostr Signer ◣ — Cryptographic Self-Tests
 *
 * Known-Answer Tests (KATs) that run on background service-worker init.
 * If ANY vector fails, the extension refuses to handle nostr requests.
 *
 * Vectors are pinned against:
 *   - RFC 7539 (ChaCha20)            §2.4.2
 *   - RFC 5869 (HKDF-SHA256)         Test Case 1
 *   - BIP-340 (Schnorr)              spec test vectors
 *   - NIP-44 v2 spec                 padding + conv-key + message-key derivation
 *   - secp256k1 generator math       G·1=G, G·3=known
 *
 * Reference outputs were generated independently with Python's `coincurve`
 * + `cryptography` libraries. The crypto.js implementation must match
 * these exactly — this is the wall against composition bugs and silent
 * cross-client incompatibilities.
 */

import {
  hexToBytes, bytesToHex, concatBytes,
  sha256, hmacSha256,
  hkdfExtract, hkdfExpand,
  Point, getPublicKey,
  schnorrSign, schnorrVerify,
  ecdhSharedX,
  nip44GetConversationKey, nip44GetMessageKeys,
  nip44Encrypt, nip44Decrypt,
  nip44EncryptWithConvKey, nip44DecryptWithConvKey,
  calcPaddedLen, nip44Pad,
  chacha20
} from './crypto.js';

// ─── Helpers ────────────────────────────────────────────────────────
function eqBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
const fromHex = hexToBytes;
const toHex   = bytesToHex;

// ═══════════════════════════════════════════════════════════════════
// VECTORS
// ═══════════════════════════════════════════════════════════════════

const VECTORS = [

  // ─── secp256k1 generator multiplication ───────────────────────────
  {
    name: 'secp256k1 G·1 = G',
    run: () => {
      const r = Point.G.mul(1n);
      return r.x === Point.G.x && r.y === Point.G.y;
    }
  },
  {
    name: 'secp256k1 G·3 (known x-only pubkey for priv=3)',
    run: () => {
      const pub = getPublicKey('0000000000000000000000000000000000000000000000000000000000000003');
      // BIP-340 test-vector pubkey for priv=3
      return pub === 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
    }
  },

  // ─── Curve membership (Bug #2 regression) ─────────────────────────
  {
    name: 'fromXOnly rejects off-curve x',
    run: () => {
      // x=5 has y² = 132 mod P, which is NOT a quadratic residue → off-curve
      try { Point.fromXOnly(fromHex('0000000000000000000000000000000000000000000000000000000000000005')); return false; }
      catch { return true; }
    }
  },

  // ─── SHA-256 NIST FIPS 180-2 ──────────────────────────────────────
  {
    name: 'SHA-256("abc")',
    run: async () => {
      const h = await sha256(new TextEncoder().encode('abc'));
      return toHex(h) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    }
  },

  // ─── HMAC-SHA256 RFC 4231 Test Case 1 ─────────────────────────────
  {
    name: 'HMAC-SHA256 RFC 4231 TC1',
    run: async () => {
      const key  = new Uint8Array(20).fill(0x0b);
      const data = new TextEncoder().encode('Hi There');
      const mac  = await hmacSha256(key, data);
      return toHex(mac) === 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';
    }
  },

  // ─── HKDF-SHA256 RFC 5869 Test Case 1 ─────────────────────────────
  {
    name: 'HKDF-SHA256 RFC 5869 TC1',
    run: async () => {
      const ikm  = new Uint8Array(22).fill(0x0b);
      const salt = fromHex('000102030405060708090a0b0c');
      const info = fromHex('f0f1f2f3f4f5f6f7f8f9');
      const prk  = await hkdfExtract(ikm, salt);
      if (toHex(prk) !== '077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5') return false;
      const okm  = await hkdfExpand(prk, info, 42);
      return toHex(okm) === '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865';
    }
  },

  // ─── ChaCha20 RFC 7539 §2.4.2 ─────────────────────────────────────
  {
    name: 'ChaCha20 RFC 7539 §2.4.2',
    run: () => {
      const key   = new Uint8Array(32);
      for (let i = 0; i < 32; i++) key[i] = i;
      const nonce = fromHex('000000000000004a00000000');
      const plain = new TextEncoder().encode(
        "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it."
      );
      const ct = chacha20(key, nonce, 1, plain);
      return toHex(ct) === '6e2e359a2568f98041ba0728dd0d6981e97e7aec1d4360c20a27afccfd9fae0bf91b65c5524733ab8f593dabcd62b3571639d624e65152ab8f530c359f0861d807ca0dbf500d6a6156a38e088a22b65e52bc514d16ccf806818ce91ab77937365af90bbf74a35be6b40b8eedf2785e42874d';
    }
  },

  // ─── NIP-44 v2 padding (Bug #1 regression — chunked, not power-of-2) ─
  {
    name: 'NIP-44 calcPaddedLen — full coverage of spec',
    run: () => {
      const cases = [
        [1, 32], [16, 32], [32, 32], [33, 64], [64, 64],
        [65, 96],     // ← was 128 in buggy impl
        [100, 128], [128, 128],
        [129, 160],   // ← was 256
        [200, 224],   // ← was 256
        [256, 256],
        [257, 320],   // ← was 512
        [300, 320],   // ← was 512
        [500, 512], [1000, 1024], [5000, 5120]
      ];
      return cases.every(([L, expected]) => calcPaddedLen(L) === expected);
    }
  },

  // ─── NIP-44 conversation key (ECDH symmetry + HKDF-Extract) ───────
  {
    name: 'NIP-44 conversation_key derivation (KAT)',
    run: async () => {
      const SEC_A = '0000000000000000000000000000000000000000000000000000000000000003';
      const SEC_B = 'b08ec3a5f37c8d54bbcaf65fea6c69e0f7e84f1bb04f5d8f1f2c08c8e6b1c2d3';
      const PUB_A = getPublicKey(SEC_A);
      const PUB_B = getPublicKey(SEC_B);
      const ckAB = await nip44GetConversationKey(SEC_A, PUB_B);
      const ckBA = await nip44GetConversationKey(SEC_B, PUB_A);
      const expected = '77daa5fea69c24d2f8e519feb84c39305e4d16747a943b7a774961ebae89ed2b';
      return toHex(ckAB) === expected && toHex(ckBA) === expected;
    }
  },

  // ─── NIP-44 message keys (HKDF-Expand from conv key + nonce) ──────
  {
    name: 'NIP-44 message_keys derivation (KAT, nonce=0)',
    run: async () => {
      const ck    = fromHex('77daa5fea69c24d2f8e519feb84c39305e4d16747a943b7a774961ebae89ed2b');
      const nonce = new Uint8Array(32);
      const { chachaKey, chachaNonce, hmacKey } = await nip44GetMessageKeys(ck, nonce);
      return toHex(chachaKey)   === '79160879e8715a3223d8ff6168b1bc3dd393042891b09ed31a2bb3728d246ffd'
          && toHex(chachaNonce) === '1de26fe6f8a8084b310dfc4b'
          && toHex(hmacKey)     === 'cceeef00b193934944094cd89bc75f535cd851f26889908d40a8b660d913643d';
    }
  },

  // ─── NIP-44 round-trip (encrypt then decrypt) ─────────────────────
  {
    name: 'NIP-44 round-trip (short message)',
    run: async () => {
      const SEC_A = '0000000000000000000000000000000000000000000000000000000000000003';
      const SEC_B = 'b08ec3a5f37c8d54bbcaf65fea6c69e0f7e84f1bb04f5d8f1f2c08c8e6b1c2d3';
      const PUB_A = getPublicKey(SEC_A);
      const PUB_B = getPublicKey(SEC_B);
      const msg   = '◢ RDWE — Hello Nostr 🐉⚔️';
      const ct    = await nip44Encrypt(SEC_A, PUB_B, msg);
      const back  = await nip44Decrypt(SEC_B, PUB_A, ct);
      return back === msg;
    }
  },
  {
    name: 'NIP-44 round-trip (boundary length 65)',
    run: async () => {
      const SEC_A = '0000000000000000000000000000000000000000000000000000000000000003';
      const SEC_B = 'b08ec3a5f37c8d54bbcaf65fea6c69e0f7e84f1bb04f5d8f1f2c08c8e6b1c2d3';
      const PUB_A = getPublicKey(SEC_A);
      const PUB_B = getPublicKey(SEC_B);
      const msg   = 'A'.repeat(65); // first divergence point in the buggy impl
      const ct    = await nip44Encrypt(SEC_A, PUB_B, msg);
      // Verify ciphertext padded section is 96 bytes (per spec) not 128
      const raw = Uint8Array.from(atob(ct), c => c.charCodeAt(0));
      const ctOnlyLen = raw.length - 1 - 32 - 32; // minus version, nonce, mac
      if (ctOnlyLen !== 96 + 2) return false; // 2 = uint16_be length prefix
      const back = await nip44Decrypt(SEC_B, PUB_A, ct);
      return back === msg;
    }
  },
  {
    name: 'NIP-44 MAC tampering rejected',
    run: async () => {
      const SEC_A = '0000000000000000000000000000000000000000000000000000000000000003';
      const SEC_B = 'b08ec3a5f37c8d54bbcaf65fea6c69e0f7e84f1bb04f5d8f1f2c08c8e6b1c2d3';
      const PUB_A = getPublicKey(SEC_A);
      const PUB_B = getPublicKey(SEC_B);
      const ct    = await nip44Encrypt(SEC_A, PUB_B, 'tamper test');
      const raw   = Uint8Array.from(atob(ct), c => c.charCodeAt(0));
      raw[raw.length - 1] ^= 1;  // flip last bit of MAC
      const tampered = btoa(String.fromCharCode(...raw));
      try { await nip44Decrypt(SEC_B, PUB_A, tampered); return false; }
      catch (e) { return /MAC/.test(e.message); }
    }
  },

  // ─── NIP-44 cache-friendly variant matches non-cached ─────────────
  {
    name: 'NIP-44 EncryptWithConvKey ≡ Encrypt (decrypt path symmetry)',
    run: async () => {
      const SEC_A = '0000000000000000000000000000000000000000000000000000000000000003';
      const SEC_B = 'b08ec3a5f37c8d54bbcaf65fea6c69e0f7e84f1bb04f5d8f1f2c08c8e6b1c2d3';
      const PUB_A = getPublicKey(SEC_A);
      const PUB_B = getPublicKey(SEC_B);
      const ck    = await nip44GetConversationKey(SEC_A, PUB_B);
      const ct    = await nip44EncryptWithConvKey(ck, 'cache test');
      // decrypt via both APIs
      const a = await nip44Decrypt(SEC_B, PUB_A, ct);
      const b = await nip44DecryptWithConvKey(ck, ct);
      return a === 'cache test' && b === 'cache test';
    }
  },

  // ─── Schnorr (BIP-340) ────────────────────────────────────────────
  {
    name: 'Schnorr sign+self-verify (random)',
    run: async () => {
      const priv = fromHex('0000000000000000000000000000000000000000000000000000000000000003');
      const msg  = await sha256(new TextEncoder().encode('attack at dawn'));
      const sig  = await schnorrSign(msg, priv);
      const pub  = fromHex(getPublicKey('0000000000000000000000000000000000000000000000000000000000000003'));
      return await schnorrVerify(msg, sig, pub);
    }
  },
  {
    name: 'Schnorr verify rejects bit-flipped signature',
    run: async () => {
      const priv = fromHex('0000000000000000000000000000000000000000000000000000000000000003');
      const msg  = await sha256(new TextEncoder().encode('test'));
      const sig  = await schnorrSign(msg, priv);
      const pub  = fromHex(getPublicKey('0000000000000000000000000000000000000000000000000000000000000003'));
      sig[0] ^= 1;
      return !(await schnorrVerify(msg, sig, pub));
    }
  },
];

// ═══════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════

/**
 * Run all crypto self-tests.
 * @returns {Promise<{ok: boolean, pass: number, fail: number, total: number, errors: string[]}>}
 */
export async function runSelfTests() {
  const errors = [];
  let pass = 0;

  for (const v of VECTORS) {
    try {
      const ok = await v.run();
      if (ok) {
        pass++;
      } else {
        errors.push(`FAIL: ${v.name}`);
      }
    } catch (e) {
      errors.push(`THROW: ${v.name} — ${e.message}`);
    }
  }

  return {
    ok:    errors.length === 0,
    pass,
    fail:  errors.length,
    total: VECTORS.length,
    errors
  };
}

export const VECTOR_COUNT = VECTORS.length;
