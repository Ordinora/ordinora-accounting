import { validateOperationalConfig } from "../src/lib/operational-config";

const result = validateOperationalConfig(process.env, process.cwd(), true);
for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
if (result.errors.length) {
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Production configuration validation passed.");
}
