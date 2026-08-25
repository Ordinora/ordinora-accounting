import path from "node:path";

type Environment = Record<string, string | undefined>;
export type OperationalConfigResult = { errors: string[]; warnings: string[] };

const placeholder = /(replace|change[-_ ]?me|example|development|demo[-_ ]?only)/i;

function strongSecret(value: string | undefined) {
  return Boolean(value && value.length >= 32 && !placeholder.test(value));
}

function validActionKey(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try { return Buffer.from(value, "base64").byteLength === 32; } catch { return false; }
}

export function validateOperationalConfig(env: Environment, cwd = process.cwd(), production = env.NODE_ENV === "production"): OperationalConfigResult {
  const errors: string[] = [], warnings: string[] = [];
  const requireValue = (condition: boolean, message: string) => {
    if (!condition) (production ? errors : warnings).push(message);
  };
  requireValue(Boolean(env.DATABASE_URL?.startsWith("postgres")), "DATABASE_URL must be a PostgreSQL connection URL.");
  requireValue(strongSecret(env.SESSION_SECRET), "SESSION_SECRET must be a non-placeholder secret of at least 32 characters.");
  requireValue(strongSecret(env.MFA_ENCRYPTION_KEY), "MFA_ENCRYPTION_KEY must be a separate non-placeholder secret of at least 32 characters.");
  if (env.MFA_ENCRYPTION_KEY && env.MFA_ENCRYPTION_KEY === env.SESSION_SECRET) (production ? errors : warnings).push("MFA_ENCRYPTION_KEY must differ from SESSION_SECRET.");
  if (env.MFA_ENCRYPTION_KEY_PREVIOUS && (!strongSecret(env.MFA_ENCRYPTION_KEY_PREVIOUS) || env.MFA_ENCRYPTION_KEY_PREVIOUS === env.MFA_ENCRYPTION_KEY)) errors.push("MFA_ENCRYPTION_KEY_PREVIOUS must be strong and differ from the active MFA key.");
  requireValue(validActionKey(env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY), "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  requireValue(strongSecret(env.HEALTH_CHECK_TOKEN), "HEALTH_CHECK_TOKEN must be a non-placeholder secret of at least 32 characters.");

  try {
    const url = new URL(env.APP_URL || "");
    requireValue(url.protocol === "https:", "APP_URL must use HTTPS in production.");
  } catch { requireValue(false, "APP_URL must be a valid absolute URL."); }

  const scanMode = (env.DOCUMENT_MALWARE_SCAN_MODE || "basic").toLowerCase();
  if (!['basic', 'clamav'].includes(scanMode)) errors.push("DOCUMENT_MALWARE_SCAN_MODE must be basic or clamav.");
  else if (production && scanMode !== "clamav") errors.push("Production requires DOCUMENT_MALWARE_SCAN_MODE=clamav.");
  if (production && scanMode === "clamav" && !env.CLAMAV_HOST) errors.push("Production requires CLAMAV_HOST for the isolated malware-scanning service.");

  const provider = (env.DOCUMENT_STORAGE_PROVIDER || "local").toLowerCase();
  if (!['local', 'azure'].includes(provider)) errors.push("DOCUMENT_STORAGE_PROVIDER must be local or azure.");
  const stagingLocal = env.DEPLOYMENT_ENV === "staging" && env.ALLOW_STAGING_LOCAL_STORAGE === "true";
  if (production && provider !== "azure" && !stagingLocal) errors.push("Production requires DOCUMENT_STORAGE_PROVIDER=azure unless explicit staging-only local storage is enabled.");
  if (production && provider === "local" && stagingLocal) warnings.push("Staging uses local block storage; verify off-host backups and migrate documents before production.");
  if (provider === "azure") {
    try {
      const container = new URL(env.AZURE_BLOB_CONTAINER_URL || "");
      if (container.protocol !== "https:" || container.search || container.hash) errors.push("AZURE_BLOB_CONTAINER_URL must be an HTTPS container URL without a query string.");
    } catch { errors.push("AZURE_BLOB_CONTAINER_URL must be a valid absolute URL."); }
    requireValue(strongSecret(env.AZURE_BLOB_SAS_TOKEN), "AZURE_BLOB_SAS_TOKEN must be a strong non-placeholder secret.");
  }

  const storage = env.DOCUMENT_STORAGE_ROOT;
  if (provider === "local" && !storage) requireValue(false, "DOCUMENT_STORAGE_ROOT must identify private durable storage.");
  else if (provider === "local" && storage) {
    const resolved = path.resolve(storage), publicRoot = path.resolve(cwd, "public"), workspace = path.resolve(cwd);
    if (production && !path.isAbsolute(storage)) errors.push("DOCUMENT_STORAGE_ROOT must be absolute in production.");
    if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) errors.push("DOCUMENT_STORAGE_ROOT cannot be inside public.");
    if (production && (resolved === workspace || resolved.startsWith(`${workspace}${path.sep}`))) errors.push("Production document storage must be outside the application workspace.");
  }
  return { errors, warnings };
}

export function assertOperationalConfig(env: Environment = process.env) {
  const result = validateOperationalConfig(env);
  if (result.errors.length) throw new Error(`Production configuration is unsafe: ${result.errors.join(" ")}`);
  return result;
}
