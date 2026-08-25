import "server-only";
import { Prisma, type StaffRole } from "@prisma/client";
import { db } from "./db";
import { calculateTransferValues } from "./transfer-calculations";

type Actor = { tenantId: string; userId: string; firmId: string; role: StaffRole | null };
type Input = { actor: Actor; reference: string; transferDate: Date; description: string; sourceAccountId: string; sourceCurrency: string; sourceAmount: string; destinationAccountId: string; destinationCurrency: string; destinationAmount: string };
const zero = new Prisma.Decimal(0);

export async function postInterAccountTransfer(input: Input) {
  if (!input.actor.role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(input.actor.role)) throw new Error("Your role cannot post inter-account transfers.");
  if (input.sourceAccountId === input.destinationAccountId) throw new Error("Paid from and received in must be different accounts.");
  return db.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: input.actor.tenantId } });
    const period = await tx.accountingPeriod.findFirst({ where: { tenantId: tenant.id, status: "OPEN", startsOn: { lte: input.transferDate }, endsOn: { gte: input.transferDate } }, orderBy: { startsOn: "desc" } });
    if (!period) throw new Error("The transfer date is not inside an open accounting period. Open that month under Administration → Accounting periods, or choose another date.");
    const accounts = await tx.account.findMany({ where: { tenantId: tenant.id, id: { in: [input.sourceAccountId, input.destinationAccountId] }, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" } });
    if (accounts.length !== 2) throw new Error("Both transfer accounts must be active bank or cash accounts belonging to this client.");
    const currencies = [input.sourceCurrency, input.destinationCurrency].map((value) => value.trim().toUpperCase());
    const configured = await tx.tenantCurrency.findMany({ where: { tenantId: tenant.id, code: { in: currencies }, isActive: true } });
    if (currencies.some((currency) => currency !== tenant.defaultCurrency && !configured.some((item) => item.code === currency))) throw new Error("Select enabled transfer currencies.");
    const rate = async (currency: string) => { if (currency === tenant.defaultCurrency) return new Prisma.Decimal(1); const found = await tx.exchangeRate.findFirst({ where: { tenantId: tenant.id, currencyCode: currency, effectiveOn: { lte: input.transferDate } }, orderBy: { effectiveOn: "desc" } }); if (!found) throw new Error(`No ${currency} exchange rate exists on or before the transfer date.`); return found.rateToBase; };
    const sourceRate = await rate(currencies[0]), destinationRate = await rate(currencies[1]);
    const values = calculateTransferValues({ sourceAmount: input.sourceAmount, sourceRate, destinationAmount: input.destinationAmount, destinationRate });
    const fx = await tx.account.findFirst({ where: { tenantId: tenant.id, code: "4310", isActive: true } });
    if (!fx && !values.realizedFxBase.eq(0)) throw new Error("Foreign exchange gains (losses) account 4310 is missing.");
    const transfer = await tx.interAccountTransfer.create({ data: { tenantId: tenant.id, periodId: period.id, sourceAccountId: input.sourceAccountId, destinationAccountId: input.destinationAccountId, reference: input.reference.trim(), transferDate: input.transferDate, description: input.description.trim() || null, sourceCurrency: currencies[0], sourceAmount: values.sourceAmount, sourceExchangeRate: values.sourceRate, sourceBaseAmount: values.sourceBaseAmount, destinationCurrency: currencies[1], destinationAmount: values.destinationAmount, destinationExchangeRate: values.destinationRate, destinationBaseAmount: values.destinationBaseAmount, realizedFxBase: values.realizedFxBase, createdById: input.actor.userId } });
    const journalLines = [{ accountId: input.destinationAccountId, debit: values.destinationBaseAmount, credit: zero, description: input.description.trim() || "Inter-account transfer received", currencyCode: currencies[1], exchangeRate: values.destinationRate, foreignDebit: values.destinationAmount, foreignCredit: zero }, { accountId: input.sourceAccountId, debit: zero, credit: values.sourceBaseAmount, description: input.description.trim() || "Inter-account transfer paid", currencyCode: currencies[0], exchangeRate: values.sourceRate, foreignDebit: zero, foreignCredit: values.sourceAmount }];
    if (values.realizedFxBase.gt(0)) journalLines.push({ accountId: fx!.id, debit: values.realizedFxBase, credit: zero, description: "Transfer exchange difference", currencyCode: tenant.defaultCurrency, exchangeRate: new Prisma.Decimal(1), foreignDebit: values.realizedFxBase, foreignCredit: zero });
    if (values.realizedFxBase.lt(0)) journalLines.push({ accountId: fx!.id, debit: zero, credit: values.realizedFxBase.abs(), description: "Transfer exchange difference", currencyCode: tenant.defaultCurrency, exchangeRate: new Prisma.Decimal(1), foreignDebit: zero, foreignCredit: values.realizedFxBase.abs() });
    const journal = await tx.journal.create({ data: { tenantId: tenant.id, periodId: period.id, reference: input.reference.trim(), description: input.description.trim() || "Inter-account transfer", accountingDate: input.transferDate, status: "POSTED", source: "INTER_ACCOUNT_TRANSFER", sourceId: transfer.id, createdById: input.actor.userId, approvedById: input.actor.userId, postedById: input.actor.userId, postedAt: new Date(), lines: { create: journalLines } } });
    await tx.interAccountTransfer.update({ where: { id: transfer.id }, data: { journalId: journal.id } });
    await tx.auditEvent.create({ data: { firmId: input.actor.firmId, tenantId: tenant.id, actorId: input.actor.userId, actorKind: "STAFF", action: "INTER_ACCOUNT_TRANSFER_POSTED", entityType: "InterAccountTransfer", entityId: transfer.id, newValues: { reference: transfer.reference, sourceAccountId: input.sourceAccountId, destinationAccountId: input.destinationAccountId, sourceAmount: values.sourceAmount.toString(), destinationAmount: values.destinationAmount.toString(), realizedFxBase: values.realizedFxBase.toString(), journalId: journal.id } } });
    return transfer;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
