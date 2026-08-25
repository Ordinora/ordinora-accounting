import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = resolve(".env.neon.local");
const outputPath = resolve(".env.netlify.local");

if (!existsSync(sourcePath)) throw new Error(".env.neon.local was not found.");
if (existsSync(outputPath)) throw new Error(".env.netlify.local already exists; remove it explicitly before generating a replacement.");

const source = Object.fromEntries(
  readFileSync(sourcePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(?:"(.*)"|'(.*)')$/, "$1$2")];
    }),
);

if (!source.DATABASE_URL?.startsWith("postgres")) throw new Error("A valid DATABASE_URL is required in .env.neon.local.");
if (!source.DIRECT_URL?.startsWith("postgres")) throw new Error("A valid DIRECT_URL is required in .env.neon.local.");

const quote = (value) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
const values = {
  DATABASE_URL: source.DATABASE_URL,
  DIRECT_URL: source.DIRECT_URL,
  APP_URL: "https://warm-youtiao-045cd1.netlify.app",
  DOCUMENT_UPLOADS_ENABLED: "false",
  SESSION_SECRET: randomBytes(48).toString("base64url"),
  MFA_ENCRYPTION_KEY: randomBytes(48).toString("base64url"),
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  HEALTH_CHECK_TOKEN: randomBytes(48).toString("base64url"),
};

writeFileSync(outputPath, `${Object.entries(values).map(([name, value]) => `${name}=${quote(value)}`).join("\n")}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
console.log("Created .env.netlify.local with production database settings and generated secrets.");
