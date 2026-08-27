import { AccountControlRole, AccountType, Prisma } from "@prisma/client";

export const controlRoleForOpeningKind = {
  RECEIVABLE: AccountControlRole.TRADE_RECEIVABLES,
  PAYABLE: AccountControlRole.TRADE_PAYABLES,
} as const;

export function expectedTypeForControlRole(role: AccountControlRole): AccountType {
  return role === AccountControlRole.TRADE_RECEIVABLES ? AccountType.ASSET : AccountType.LIABILITY;
}

export function controlRoleForDefaultCode(code: string): AccountControlRole | null {
  if (code === "1200") return AccountControlRole.TRADE_RECEIVABLES;
  if (code === "2000") return AccountControlRole.TRADE_PAYABLES;
  return null;
}

export async function requireControlAccount(tx: Prisma.TransactionClient, tenantId: string, role: AccountControlRole) {
  let account = await tx.account.findUnique({ where: { tenantId_controlRole: { tenantId, controlRole: role } } });
  const label = role === AccountControlRole.TRADE_RECEIVABLES ? "trade receivables" : "trade payables";
  // Backward compatibility for tenants created before explicit control roles.
  // Once found, persist the role so future lookups use the configured mapping.
  if (!account) {
    const legacyCodes = role === AccountControlRole.TRADE_RECEIVABLES ? ["1200"] : ["2000", "2100"];
    const candidates = await tx.account.findMany({
      where: { tenantId, code: { in: legacyCodes }, type: expectedTypeForControlRole(role), isActive: true },
    });
    const legacy = legacyCodes.map((code) => candidates.find((candidate) => candidate.code === code)).find(Boolean);
    if (legacy) {
      account = await tx.account.update({
        where: { id: legacy.id },
        data: { controlRole: role, isControlAccount: true },
      });
    }
  }
  if (!account) throw new Error(`Required ${label} control account is not configured.`);
  if (!account.isActive) throw new Error(`Required ${label} control account is inactive.`);
  if (!account.isControlAccount || account.type !== expectedTypeForControlRole(role)) {
    throw new Error(`The configured ${label} control account has an invalid account type or control setting.`);
  }
  return account;
}

export async function requireTradeControlAccounts(tx: Prisma.TransactionClient, tenantId: string) {
  const [receivables, payables] = await Promise.all([
    requireControlAccount(tx, tenantId, AccountControlRole.TRADE_RECEIVABLES),
    requireControlAccount(tx, tenantId, AccountControlRole.TRADE_PAYABLES),
  ]);
  return { receivables, payables };
}
