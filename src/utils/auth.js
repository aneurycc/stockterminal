// A1: la contraseña ya no se compara en texto plano contra el código fuente.
// Se compara un hash PBKDF2-SHA256 (con sal e iteraciones) calculado a partir de lo que el
// usuario escribe. Usa crypto.subtle cuando está disponible (HTTPS o localhost) y cae a una
// implementación en JS puro cuando no (por ejemplo, abriendo la app por IP/LAN en HTTP).
//
// Nota: las credenciales se mantienen por decisión del autor de la app; esta mitigación evita
// que la contraseña quede legible en el código fuente/bundle. No es seguridad real: sin servidor,
// una contraseña débil se puede adivinar a partir del hash. Usa una contraseña larga y única.

const USERS = {
  gerente: {
    salt: 'a3f9c1e7b6d2485a9e0c7f21b5d8a6f4',
    iterations: 100000,
    hash: '14bcfde21d38f4c3fb7fef18aebd37b6eaf5057a7256c61f8532187358c0bdb6'
  }
};

const hexToBytes = (hex) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
};

const bytesToHex = (bytes) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

// ---- Implementación en JS puro (fallback), solo para contextos sin crypto.subtle ----

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256(bytes) {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const bitLen = bytes.length * 8;
  const withOne = bytes.length + 1;
  const padded = new Uint8Array(Math.ceil((withOne + 8) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
  return out;
}

function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

function hmacSha256(keyBytes, msgBytes) {
  const blockSize = 64;
  let key = keyBytes.length > blockSize ? sha256(keyBytes) : keyBytes;
  const keyPadded = new Uint8Array(blockSize);
  keyPadded.set(key);
  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = keyPadded[i] ^ 0x5c;
    iKeyPad[i] = keyPadded[i] ^ 0x36;
  }
  const inner = sha256(concatBytes(iKeyPad, msgBytes));
  return sha256(concatBytes(oKeyPad, inner));
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a); out.set(b, a.length);
  return out;
}

function pbkdf2Sha256Fallback(passwordBytes, saltBytes, iterations, keylenBytes) {
  const hLen = 32;
  const blocks = Math.ceil(keylenBytes / hLen);
  const out = new Uint8Array(blocks * hLen);
  for (let i = 1; i <= blocks; i++) {
    const intBlock = new Uint8Array(4);
    new DataView(intBlock.buffer).setUint32(0, i, false);
    let u = hmacSha256(passwordBytes, concatBytes(saltBytes, intBlock));
    let t = u;
    for (let c = 1; c < iterations; c++) {
      u = hmacSha256(passwordBytes, u);
      const next = new Uint8Array(hLen);
      for (let k = 0; k < hLen; k++) next[k] = t[k] ^ u[k];
      t = next;
    }
    out.set(t, (i - 1) * hLen);
  }
  return out.slice(0, keylenBytes);
}

// ---- API pública ----

async function derivePbkdf2(password, saltHex, iterations, keylenBytes) {
  const passwordBytes = new TextEncoder().encode(password);
  const saltBytes = hexToBytes(saltHex);

  if (globalThis.crypto?.subtle) {
    try {
      const key = await crypto.subtle.importKey('raw', passwordBytes, { name: 'PBKDF2' }, false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
        key,
        keylenBytes * 8
      );
      return bytesToHex(new Uint8Array(bits));
    } catch {
      // Contexto sin soporte real (algunos navegadores en HTTP exponen el objeto pero fallan al usarlo).
    }
  }
  return bytesToHex(pbkdf2Sha256Fallback(passwordBytes, saltBytes, iterations, keylenBytes));
}

// Compara usuario/contraseña contra el hash almacenado. Nunca compara texto plano.
export async function verifyCredentials(username, password) {
  const user = USERS[username];
  if (!user) return false;
  const computed = await derivePbkdf2(password, user.salt, user.iterations, 32);
  return computed === user.hash;
}
