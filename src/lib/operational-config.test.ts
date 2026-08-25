import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateOperationalConfig } from "./operational-config";

const strong = "a-secure-random-value-that-is-longer-than-thirty-two-characters";
const validProduction = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:password@db.internal:5432/ordinora",
  SESSION_SECRET: strong,
  MFA_ENCRYPTION_KEY: `${strong}-mfa`,
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  HEALTH_CHECK_TOKEN: `${strong}-health`,
  APP_URL: "https://accounts.example.com",
  DOCUMENT_MALWARE_SCAN_MODE: "clamav",
  CLAMAV_HOST: "clamav",
  DOCUMENT_STORAGE_PROVIDER: "azure",
  AZURE_BLOB_CONTAINER_URL: "https://ordinora.blob.core.windows.net/accounting-documents",
  AZURE_BLOB_SAS_TOKEN: `${strong}-azure-sas`,
};

describe("production operational configuration", () => {
  it("accepts separated strong secrets and private external storage", () => {
    expect(validateOperationalConfig(validProduction, "C:\\app", true).errors).toEqual([]);
  });

  it("rejects development scanning, weak secrets, HTTP, and workspace storage", () => {
    const result = validateOperationalConfig({ ...validProduction, SESSION_SECRET: "change-me", MFA_ENCRYPTION_KEY: "change-me", APP_URL: "http://localhost:3000", DOCUMENT_MALWARE_SCAN_MODE: "basic", DOCUMENT_STORAGE_PROVIDER: "local", DOCUMENT_STORAGE_ROOT: path.join("C:\\app", "storage") }, "C:\\app", true);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("SESSION_SECRET"), expect.stringContaining("HTTPS"), expect.stringContaining("clamav"), expect.stringContaining("DOCUMENT_STORAGE_PROVIDER=azure"), expect.stringContaining("outside the application workspace")]));
  });

  it("allows durable local document storage only for an explicit staging deployment", () => {
    const result = validateOperationalConfig({
      ...validProduction,
      DEPLOYMENT_ENV: "staging",
      ALLOW_STAGING_LOCAL_STORAGE: "true",
      DOCUMENT_STORAGE_PROVIDER: "local",
      DOCUMENT_STORAGE_ROOT: "D:\\ordinora-staging\\documents",
      AZURE_BLOB_CONTAINER_URL: "",
      AZURE_BLOB_SAS_TOKEN: "",
    }, "C:\\app", true);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("local block storage"),
    ]));
  });

  it("reports missing development values as warnings instead of startup errors", () => {
    const result = validateOperationalConfig({ NODE_ENV: "development", APP_URL: "http://localhost:3000", DOCUMENT_MALWARE_SCAN_MODE: "basic" }, process.cwd(), false);
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
