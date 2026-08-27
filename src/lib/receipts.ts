import "server-only";
import { Prisma, type StaffRole } from "@prisma/client";
import { parseMoneyToMinor } from "./accounting";
import { db } from "./db";

type Actor = { tenantId: string; userId: string; firmId: string; role: StaffRole | null };
type ReceiptLineInput = { accountId: string; description: string; quantity: string; unitPrice: string };
type DirectReceiptInput = {
  actor: Actor;
  bankAccountId: string;
  customerId?: string;
  payerType: "CUSTOMER" | "OTHER";
  payerName?: string;
  reference: string;
  receiptDate: Date;
  description: string;
  currency: string;
  lines: ReceiptLineInput[];
};

const zero = new Prisma.Decimal(0);
const money = (value: string) => new Prisma.Decimal(parseMoneyToMinor(value).toString()).div(100);

function calculateLines(lines: ReceiptLineInput[]) {
  if (lines.length < 1 || lines.length > 100) throw new Error("A receipt requires between 1 and 100 lines.");
  return lines.map((line) => {
    const quantity = new Prisma.Decimal(line.quantity);
    if (!quantity.isFinite() || quantity.lte(0) || quantity.decimalPlaces() > 4) throw new Error("Receipt quantities must be positive with no more than four decimal places.");
    const unitPrice = money(line.unitPrice);
    if (unitPrice.lte(0)) throw new Error("Every receipt line must have a positive unit price.");
    const description = line.description.trim();
    if (!description) throw new Error("Every receipt line needs a description.");
    return { accountId: line.accountId, description, quantity, unitPrice, foreignAmount: quantity.mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) };
  });
}

export async function postDirectReceipt(input: DirectReceiptInput) {
  if (!input.actor.role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(input.actor.role)) throw new Error("Your role cannot post receipts.");
  const lines = calculateLines(input.lines);
  return db.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: input.actor.tenantId } });
    const period = await tx.accountingPeriod.findFirst({ where: { tenantId: tenant.id, status: "OPEN", startsOn: { lte: input.receiptDate }, endsOn: { gte: input.receiptDate } }, orderBy: { startsOn: "desc" } });
    if (!period) throw new Error("No open accounting period contains the receipt date. Open the required period and try again.");
    const bank = await tx.account.findFirst({ where: { id: input.bankAccountId, tenantId: tenant.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" } });
    if (!bank) throw new Error("Select an active cash or bank account.");

    if (input.payerType === "CUSTOMER" && !input.customerId) throw new Error("Select a customer.");
    const customer = input.payerType === "CUSTOMER" ? await tx.customer.findFirst({ where: { id: input.customerId!, tenantId: tenant.id, isActive: true } }) : null;
    if (input.payerType === "CUSTOMER" && !customer) throw new Error("The selected customer is invalid or inactive.");
    const payerName = input.payerType === "CUSTOMER" ? customer?.name : input.payerName?.trim();
    if (!payerName) throw new Error("Enter the name of the person or business paying.");

    const accountIds = [...new Set(lines.map((line) => line.accountId))];
    if (accountIds.includes(bank.id)) throw new Error("A receipt line cannot use the same cash or bank account selected under Received in.");
    const accounts = await tx.account.findMany({ where: { tenantId: tenant.id, id: { in: accountIds }, isActive: true, isControlAccount: false } });
    if (accounts.length !== accountIds.length) throw new Error("Every receipt line must use an active non-control ledger account.");

    const currency = input.currency.trim().toUpperCase();
    const enabledCurrency = currency === tenant.defaultCurrency || await tx.tenantCurrency.findFirst({ where: { tenantId: tenant.id, code: currency, isActive: true } });
    if (!enabledCurrency) throw new Error("Select an enabled receipt currency.");
    let exchangeRate = new Prisma.Decimal(1);
    if (currency !== tenant.defaultCurrency) {
      const rate = await tx.exchangeRate.findFirst({ where: { tenantId: tenant.id, currencyCode: currency, effectiveOn: { lte: input.receiptDate } }, orderBy: { effectiveOn: "desc" } });
      if (!rate) throw new Error(`No ${currency} exchange rate exists on or before the receipt date.`);
      exchangeRate = rate.rateToBase;
    }
    const prepared = lines.map((line) => ({ ...line, baseAmount: line.foreignAmount.mul(exchangeRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) }));
    const foreignAmount = prepared.reduce((sum, line) => sum.add(line.foreignAmount), zero);
    const baseAmount = prepared.reduce((sum, line) => sum.add(line.baseAmount), zero);
    const receipt = await tx.customerReceipt.create({ data: {
      tenantId: tenant.id, customerId: customer?.id ?? null, periodId: period.id, bankAccountId: bank.id,
      reference: input.reference.trim(), receiptDate: input.receiptDate, payerType: input.payerType, payerName: payerName!,
      description: input.description.trim() || null, currency, exchangeRate, foreignAmount, baseAmount,
      createdById: input.actor.userId,
      lines: { create: prepared.map((line) => ({ accountId: line.accountId, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, foreignAmount: line.foreignAmount, baseAmount: line.baseAmount })) },
    } });
    const journal = await tx.journal.create({ data: {
      tenantId: tenant.id, periodId: period.id, reference: receipt.reference,
      description: input.description.trim() || `Receipt from ${payerName}`, accountingDate: input.receiptDate,
      status: "POSTED", source: "CUSTOMER_RECEIPT", sourceId: receipt.id, createdById: input.actor.userId,
      approvedById: input.actor.userId, postedById: input.actor.userId, postedAt: new Date(),
      lines: { create: [
        { accountId: bank.id, debit: baseAmount, credit: zero, description: `Received from ${payerName}`, currencyCode: currency, exchangeRate, foreignDebit: foreignAmount, foreignCredit: zero },
        ...prepared.map((line) => ({ accountId: line.accountId, debit: zero, credit: line.baseAmount, description: line.description, currencyCode: currency, exchangeRate, foreignDebit: zero, foreignCredit: line.foreignAmount })),
      ] },
    } });
    await tx.customerReceipt.update({ where: { id: receipt.id }, data: { journalId: journal.id } });
    await tx.auditEvent.create({ data: { firmId: input.actor.firmId, tenantId: tenant.id, actorId: input.actor.userId, actorKind: "STAFF", action: "CUSTOMER_RECEIPT_POSTED", entityType: "CustomerReceipt", entityId: receipt.id, newValues: { reference: receipt.reference, payerType: input.payerType, payerName, currency, foreignAmount: foreignAmount.toString(), baseAmount: baseAmount.toString(), lineCount: prepared.length, journalId: journal.id } } });
    return receipt;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
