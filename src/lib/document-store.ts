import "server-only";

import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { documentStoragePath } from "@/lib/document-file";

export type DocumentStorageProvider = "local" | "azure";

export function documentStorageProvider(): DocumentStorageProvider {
  const provider = (process.env.DOCUMENT_STORAGE_PROVIDER || "local").toLowerCase();
  if (provider !== "local" && provider !== "azure") throw new Error("DOCUMENT_STORAGE_PROVIDER must be local or azure.");
  return provider;
}

function validateStorageKey(storageKey: string) {
  if (!/^[A-Za-z0-9_-]+\/(?:quarantine|accepted)\/[A-Za-z0-9._-]+$/.test(storageKey)) throw new Error("Invalid document storage key.");
  return storageKey;
}

function azureObjectUrl(storageKey?: string) {
  const container = process.env.AZURE_BLOB_CONTAINER_URL;
  const sas = process.env.AZURE_BLOB_SAS_TOKEN;
  if (!container || !sas) throw new Error("Azure Blob document storage is not configured.");
  const base = new URL(container);
  if (base.protocol !== "https:" || base.search || base.hash) throw new Error("AZURE_BLOB_CONTAINER_URL must be an HTTPS container URL without a query string.");
  const objectPath = storageKey ? `/${validateStorageKey(storageKey).split("/").map(encodeURIComponent).join("/")}` : "";
  const token = sas.startsWith("?") ? sas.slice(1) : sas;
  return new URL(`${base.toString().replace(/\/$/, "")}${objectPath}?${token}`);
}

async function azureRequest(storageKey: string | undefined, init: RequestInit) {
  const response = await fetch(azureObjectUrl(storageKey), { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Private object storage request failed with status ${response.status}.`);
  return response;
}

export async function writeDocument(storageKey: string, bytes: Uint8Array, contentType: string) {
  validateStorageKey(storageKey);
  if (documentStorageProvider() === "azure") {
    await azureRequest(storageKey, { method: "PUT", headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": contentType, "Content-Length": String(bytes.byteLength) }, body: Buffer.from(bytes) });
    return;
  }
  const storage = documentStoragePath(storageKey.split("/")[0], storageKey);
  await mkdir(storage.directory, { recursive: true });
  await writeFile(storage.target, bytes, { flag: "wx", mode: 0o600 });
}

export async function readDocument(storageKey: string) {
  validateStorageKey(storageKey);
  if (documentStorageProvider() === "azure") return new Uint8Array(await (await azureRequest(storageKey, { method: "GET" })).arrayBuffer());
  const storage = documentStoragePath(storageKey.split("/")[0], storageKey);
  return new Uint8Array(await readFile(storage.target));
}

export async function deleteDocument(storageKey: string) {
  validateStorageKey(storageKey);
  if (documentStorageProvider() === "azure") {
    const response = await fetch(azureObjectUrl(storageKey), { method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok && response.status !== 404) throw new Error(`Private object storage deletion failed with status ${response.status}.`);
    return;
  }
  const storage = documentStoragePath(storageKey.split("/")[0], storageKey);
  await rm(storage.target, { force: true });
}

export async function checkDocumentStorage() {
  if (documentStorageProvider() === "azure") {
    await azureRequest(undefined, { method: "HEAD", headers: { "x-ms-version": "2023-11-03" } });
    return;
  }
  const root = path.resolve(/* turbopackIgnore: true */ process.env.DOCUMENT_STORAGE_ROOT || path.join(process.cwd(), "storage", "accounting-documents"));
  await mkdir(root, { recursive: true });
  await access(root, constants.R_OK | constants.W_OK);
}
