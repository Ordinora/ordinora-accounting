import "server-only";

import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

const allowed = new Map([
  ["application/pdf", [".pdf"]],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
]);

function hasValidSignature(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  return false;
}

function hasValidEnding(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "application/pdf") return Buffer.from(bytes.slice(-2048)).includes(Buffer.from("%%EOF"));
  if (mimeType === "image/jpeg") return bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (mimeType === "image/png") return Buffer.from(bytes.slice(-32)).includes(Buffer.from("IEND"));
  return false;
}

export function validateAccountingFile(input: { name: string; type: string; size: number; bytes: Uint8Array }) {
  const maxBytes = Number(process.env.UPLOAD_MAX_BYTES || 10 * 1024 * 1024);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("The upload size limit is invalid.");
  if (input.size !== input.bytes.byteLength) throw new Error("The received file size is inconsistent.");
  if (input.size < 1 || input.size > maxBytes) throw new Error(`Upload a non-empty file smaller than ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  const extension = path.extname(input.name).toLowerCase();
  const extensions = allowed.get(input.type);
  if (!extensions?.includes(extension)) throw new Error("Only PDF, JPG, JPEG, and PNG accounting documents are supported.");
  if (!hasValidSignature(input.type, input.bytes) || !hasValidEnding(input.type, input.bytes)) throw new Error("The file structure does not match the selected file type.");
  return {
    extension,
    checksum: createHash("sha256").update(input.bytes).digest("hex"),
    storageName: `${randomUUID()}${extension}`,
  };
}

function storageRoot() {
  return path.resolve(/* turbopackIgnore: true */ process.env.DOCUMENT_STORAGE_ROOT || path.join(process.cwd(), "storage", "accounting-documents"));
}

export function documentStoragePath(tenantId: string, storageNameOrKey: string, area?: "quarantine" | "accepted") {
  const root = storageRoot();
  const safeTenant = path.basename(tenantId);
  if (safeTenant !== tenantId) throw new Error("Invalid tenant storage identifier.");
  const relative = area ? path.join(safeTenant, area, path.basename(storageNameOrKey)) : storageNameOrKey.replaceAll("/", path.sep);
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid document storage path.");
  const storageKey = path.relative(root, target).split(path.sep).join("/");
  if (!storageKey.startsWith(`${safeTenant}/`)) throw new Error("Document storage does not belong to this company.");
  return { root, directory: path.dirname(target), target, storageKey };
}
