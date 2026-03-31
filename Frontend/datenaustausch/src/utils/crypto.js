// Krypto-Funktionen für SecureShare
// AES-256-GCM   → Dateien verschlüsseln
// RSA-2048-OAEP → AES-Schlüssel asymmetrisch verschlüsseln
// PBKDF2        → Private Key lokal mit Passwort absichern

// ── AES ──────────────────────────────────────────────────────

// Neuen zufälligen AES-256-Schlüssel generieren (einer pro Dateifreigabe)
export async function generateAESKey() {
  return window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// Daten mit AES-GCM verschlüsseln, gibt IV + Ciphertext zurück
export async function encryptData(key, data) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12-Byte IV
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return { iv, ciphertext };
}

// AES-GCM entschlüsseln – schlägt fehl wenn Key/IV nicht passen (Integritätsprüfung)
export async function decryptData(key, iv, ciphertext) {
  return window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
}

// AES-Key als rohe Bytes exportieren (32 Bytes), damit er mit RSA verschlüsselt werden kann
export async function exportAESKey(key) {
  const raw = await window.crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

// Rohe Bytes wieder als AES CryptoKey importieren (nach RSA-Entschlüsselung)
export async function importAESKey(rawKey) {
  return window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

// ── RSA ──────────────────────────────────────────────────────

// AES-Key mit dem RSA Public Key des Empfängers verschlüsseln
// Nur der Empfänger kann das Ergebnis mit seinem Private Key entschlüsseln
export async function encryptAESKeyWithPublicKey(aesKeyBytes, publicKeyBytes) {
  // Public Key aus SPKI-Format importieren (kommt so vom Smart Contract)
  const importedKey = await window.crypto.subtle.importKey(
    "spki",
    publicKeyBytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    importedKey,
    aesKeyBytes
  );
  return new Uint8Array(encrypted); // 256 Bytes (RSA-2048)
}

// Verschlüsselten AES-Key mit eigenem Private Key entschlüsseln
export async function decryptAESKeyWithPrivateKey(encryptedKeyBytes, privateKey) {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedKeyBytes
  );
  return new Uint8Array(decrypted); // 32 Bytes AES-Key
}

// ── Packen/Entpacken ─────────────────────────────────────────

// IV + Ciphertext zusammenpacken → wird als ein Blob zu IPFS hochgeladen
// Format: [12 Bytes IV][Rest = Ciphertext]
export function packEncryptedBlob(iv, ciphertext) {
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return combined;
}

// Umkehrung von packEncryptedBlob
export function unpackEncryptedBlob(blob) {
  return {
    iv:         blob.slice(0, 12),
    ciphertext: blob.slice(12),
  };
}

// Dateiname vor die Datei-Bytes packen, damit man beim Entschlüsseln
// den originalen Namen wiederherstellen kann
// Format: [4 Bytes Namenslänge (Big-Endian)][Name als UTF-8][Datei-Bytes]
export function packFileWithName(filename, fileBuffer) {
  const enc       = new TextEncoder();
  const nameBytes = enc.encode(filename);
  const result    = new Uint8Array(4 + nameBytes.length + fileBuffer.byteLength);
  const view      = new DataView(result.buffer);
  view.setUint32(0, nameBytes.length, false);
  result.set(nameBytes, 4);
  result.set(new Uint8Array(fileBuffer), 4 + nameBytes.length);
  return result;
}

// Dateiname + Datei-Bytes aus entschlüsseltem Buffer extrahieren
export function unpackFileWithName(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4) throw new Error("Ungültiges Format: Buffer zu kurz.");

  const view       = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nameLength = view.getUint32(0, false);

  // Plausibilitätsprüfung – Dateinamen über 512 Zeichen sind unrealistisch
  if (nameLength > bytes.length - 4 || nameLength > 512) {
    throw new Error("Ungültiges Format: Dateiname-Länge nicht plausibel.");
  }

  const dec        = new TextDecoder();
  const filename   = dec.decode(bytes.slice(4, 4 + nameLength));
  const fileBuffer = bytes.slice(4 + nameLength).buffer;
  return { filename, fileBuffer };
}

// ── Hex-Konvertierung ────────────────────────────────────────

// Hex-String → Bytes (für verschlüsselten Key aus dem Contract)
export function hexToBuffer(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Bytes → Hex-String (ohne 0x-Prefix)
export function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── PBKDF2 – Private Key lokal speichern ─────────────────────
// Der RSA Private Key wird mit einem Passwort-basierten AES-Key
// verschlüsselt im localStorage abgelegt. Ohne Passwort → kein Zugriff.
// Storage-Key: "secureshare_key_{adresse}"

const PBKDF2_ITERATIONS  = 250000;             // Hohe Zahl → Brute-Force wird teuer
const STORAGE_KEY_PREFIX = "secureshare_key_";

// AES-Key aus Passwort + Wallet-Adresse ableiten
// Gleiche Eingabe → immer gleicher Key (deterministisch)
export async function deriveAESKeyFromPassword(password, address) {
  const enc = new TextEncoder();

  // Passwort als Basis-Material für PBKDF2
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // AES-256 Key ableiten – Adresse als Salt (verhindert Rainbow Tables)
  return window.crypto.subtle.deriveKey(
    {
      name:       "PBKDF2",
      salt:       enc.encode(address.toLowerCase()),
      iterations: PBKDF2_ITERATIONS,
      hash:       "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Private Key verschlüsseln und in localStorage ablegen
export async function encryptAndStorePrivateKey(privateKey, aesKey, address) {
  const pkcs8 = await window.crypto.subtle.exportKey("pkcs8", privateKey);

  // Mit AES-GCM verschlüsseln
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    pkcs8
  );

  // Base64-kodiert speichern: IV + Ciphertext
  const combined = packEncryptedBlob(iv, new Uint8Array(ciphertext));
  localStorage.setItem(
    STORAGE_KEY_PREFIX + address.toLowerCase(),
    btoa(String.fromCharCode(...combined))
  );
}

// Gespeicherten Private Key laden und mit Passwort entschlüsseln
export async function loadAndDecryptPrivateKey(aesKey, address) {
  const stored = localStorage.getItem(STORAGE_KEY_PREFIX + address.toLowerCase());
  if (!stored) throw new Error("Kein gespeicherter Schlüssel für diese Adresse gefunden.");

  // Base64 → Bytes → IV + Ciphertext trennen
  const combined   = new Uint8Array(atob(stored).split("").map(c => c.charCodeAt(0)));
  const iv         = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Entschlüsseln – falsches Passwort → AES-GCM Integritätsfehler
  let pkcs8;
  try {
    pkcs8 = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      ciphertext
    );
  } catch {
    throw new Error("Falsches Passwort oder beschädigter Schlüssel.");
  }

  // PKCS8 als RSA Private Key importieren
  return window.crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// Prüfen ob ein gespeicherter Key vorhanden ist
export function hasStoredPrivateKey(address) {
  return !!localStorage.getItem(STORAGE_KEY_PREFIX + address.toLowerCase());
}

// Gespeicherten Key aus localStorage löschen
export function deleteStoredPrivateKey(address) {
  localStorage.removeItem(STORAGE_KEY_PREFIX + address.toLowerCase());
}
