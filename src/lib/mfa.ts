import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const issuer = "Ordinora";

function encryptionKey(secret = process.env.MFA_ENCRYPTION_KEY || process.env.SESSION_SECRET) {
  if (!secret || secret.length < 32) throw new Error("MFA encryption requires MFA_ENCRYPTION_KEY or a SESSION_SECRET of at least 32 characters.");
  return createHash("sha256").update(`ordinora:mfa:${secret}`).digest();
}

export function encodeBase32(bytes: Uint8Array) {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i < bits.length; i += 5) output += alphabet[Number.parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return output;
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function generateMfaSecret() {
  return encodeBase32(randomBytes(20));
}

export function encryptMfaSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptMfaSecret(payload: string) {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted MFA secret.");
  const candidates = [process.env.MFA_ENCRYPTION_KEY || process.env.SESSION_SECRET, process.env.MFA_ENCRYPTION_KEY_PREVIOUS].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey(candidate), Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
    } catch { /* Try the temporary previous key during a controlled rotation. */ }
  }
  throw new Error("The MFA secret cannot be decrypted with the configured key set.");
}

export function totpCode(secret: string, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, timestamp = Date.now()) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  return [-30_000, 0, 30_000].some((offset) => timingSafeEqual(Buffer.from(totpCode(secret, timestamp + offset)), Buffer.from(normalized)));
}

export function recoveryCodeHash(code: string) {
  return createHash("sha256").update(`ordinora:recovery:${code.toUpperCase().replace(/[^A-Z0-9]/g, "")}`).digest("hex");
}

export function generateRecoveryCodes() {
  return Array.from({ length: 8 }, () => randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"));
}

export function authenticatorUri(email: string, secret: string) {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
