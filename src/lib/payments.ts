import "server-only";
import { Prisma, type StaffRole } from "@prisma/client";
import { db } from "./db";
import { receiveInventory } from "./inventory-ledger";
import { calculatePaymentLines, type PaymentLineInput } from "./payment-calculations";
import { ensureUniqueChequeNumber, validateChequeDetails, type ChequeDetails } from "./bank-cheques";

type Actor = { tenantId: string; userId: string; firmId: string; role: StaffRole | null };
type PaymentInput = { actor: Actor; bankAccountId: string; reference: string; paymentDate: Date; payee: string; description: string; currency: string; lines: PaymentLineInput[] } & ChequeDetails;
const zero = new Prisma.Decimal(0);

export async function postDirectPayment(input: PaymentInput) {
  if (!input.actor.role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(input.actor.role)) throw new Error("Your role cannot post payments.");
  const lines = calculatePaymentLines(input.lines);
  return db.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: input.actor.tenantId } });
    const period = await tx.accountingPeriod.findFirst({ where: { tenantId: tenant.id, status: "OPEN", startsOn: { lte: input.paymentDate }, endsOn: { gte: input.paymentDate } }, orderBy: { startsOn: "desc" } });
    if (!period) throw new Error("No open accounting period contains the payment date. Open the required period and try again.");
    const bank = await tx.account.findFirst({ where: { id: input.bankAccountId, tenantId: tenant.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" } });
    if (!bank) throw new Error("Select an active cash or bank account.");
    const cheque = validateChequeDetails(input);
    if (cheque.paymentMethod === "BANK_CHEQUE" && /cash on hand|petty cash/i.test(bank.name)) throw new Error("A bank cheque must be issued from a bank account, not a cash account.");
    await ensureUniqueChequeNumber(tx, input.actor.tenantId, bank.id, cheque.chequeNumber);
    const accountIds = [...new Set(lines.map((line) => line.accountId))];
    if (accountIds.includes(bank.id)) throw new Error("Use an inter-account transfer instead of paying the selected cash or bank account to itself.");
    const accounts = await tx.account.findMany({ where: { tenantId: tenant.id, id: { in: accountIds }, isActive: true, isControlAccount: false } });
    if (accounts.length !== accountIds.length) throw new Error("Every payment line must use an active non-control ledger account.");
    const inventoryLines=lines.filter(line=>line.inventoryItemId||line.inventoryLocationId),itemIds=[...new Set(inventoryLines.map(line=>line.inventoryItemId).filter((id):id is string=>Boolean(id)))],locationIds=[...new Set(inventoryLines.map(line=>line.inventoryLocationId).filter((id):id is string=>Boolean(id)))];
    if(inventoryLines.some(line=>!line.inventoryItemId||!line.inventoryLocationId))throw new Error("Every inventory payment line requires both an item and stock location.");
    const[items,locations]=await Promise.all([tx.inventoryItem.findMany({where:{tenantId:tenant.id,id:{in:itemIds},isActive:true}}),tx.inventoryLocation.findMany({where:{tenantId:tenant.id,id:{in:locationIds},isActive:true}})]);
    if(items.length!==itemIds.length||locations.length!==locationIds.length)throw new Error("An inventory item or stock location is invalid or inactive.");
    const itemMap=new Map(items.map(item=>[item.id,item]));
    if(inventoryLines.some(line=>itemMap.get(line.inventoryItemId!)?.inventoryAccountId!==line.accountId))throw new Error("Inventory payment lines must use the inventory asset account mapped to the item.");
    const currency = input.currency.trim().toUpperCase();
    const enabledCurrency = currency === tenant.defaultCurrency || await tx.tenantCurrency.findFirst({ where: { tenantId: tenant.id, code: currency, isActive: true } });
    if (!enabledCurrency) throw new Error("Select an enabled payment currency.");
    let exchangeRate = new Prisma.Decimal(1);
    if (currency !== tenant.defaultCurrency) {
      const rate = await tx.exchangeRate.findFirst({ where: { tenantId: tenant.id, currencyCode: currency, effectiveOn: { lte: input.paymentDate } }, orderBy: { effectiveOn: "desc" } });
      if (!rate) throw new Error(`No ${currency} exchange rate exists on or before the payment date.`);
      exchangeRate = rate.rateToBase;
    }
    const prepared = lines.map((line) => ({ ...line, baseAmount: line.foreignAmount.mul(exchangeRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) }));
    const foreignAmount = prepared.reduce((sum, line) => sum.add(line.foreignAmount), zero);
    const baseAmount = prepared.reduce((sum, line) => sum.add(line.baseAmount), zero);
    const payment = await tx.payment.create({ data: { tenantId: tenant.id, periodId: period.id, bankAccountId: bank.id, reference: input.reference.trim(), paymentDate: input.paymentDate, payee: input.payee.trim(), description: input.description.trim() || null, currency, exchangeRate, foreignAmount, baseAmount, createdById: input.actor.userId, ...cheque, lines: { create: prepared.map((line) => ({ accountId: line.accountId, inventoryItemId:line.inventoryItemId,inventoryLocationId:line.inventoryLocationId,description: line.description, quantity: line.quantity, unitPrice: line.unitPrice,discountPercent:line.discountPercent,discountAmount:line.discountAmount, foreignAmount: line.foreignAmount, baseAmount: line.baseAmount })) } } });
    for(const line of prepared.filter(line=>line.inventoryItemId&&line.inventoryLocationId)){const receipt=await receiveInventory(tx,{tenantId:tenant.id,costingMethod:tenant.inventoryCostingMethod,itemId:line.inventoryItemId!,locationId:line.inventoryLocationId!,receivedOn:input.paymentDate,quantity:line.quantity,totalValue:line.baseAmount,sourceType:"Payment",sourceId:payment.id});await tx.inventoryMovement.create({data:{tenantId:tenant.id,itemId:line.inventoryItemId!,locationId:line.inventoryLocationId!,type:"PURCHASE",movementDate:input.paymentDate,quantity:line.quantity,unitCost:receipt.receiptUnitCost,totalCost:line.baseAmount,reference:input.reference.trim(),sourceType:"Payment",sourceId:payment.id,notes:line.description,createdById:input.actor.userId}})}
    const journal = await tx.journal.create({ data: { tenantId: tenant.id, periodId: period.id, reference: input.reference.trim(), description: input.description.trim() || `Payment to ${input.payee.trim()}`, accountingDate: input.paymentDate, status: "POSTED", source: "PAYMENT", sourceId: payment.id, createdById: input.actor.userId, approvedById: input.actor.userId, postedById: input.actor.userId, postedAt: new Date(), lines: { create: [...prepared.map((line) => ({ accountId: line.accountId, debit: line.baseAmount, credit: zero, description: line.description, currencyCode: currency, exchangeRate, foreignDebit: line.foreignAmount, foreignCredit: zero })), { accountId: bank.id, debit: zero, credit: baseAmount, description: `Payment to ${input.payee.trim()}`, currencyCode: currency, exchangeRate, foreignDebit: zero, foreignCredit: foreignAmount }] } } });
    await tx.payment.update({ where: { id: payment.id }, data: { journalId: journal.id } });
    await tx.auditEvent.create({ data: { firmId: input.actor.firmId, tenantId: tenant.id, actorId: input.actor.userId, actorKind: "STAFF", action: "PAYMENT_POSTED", entityType: "Payment", entityId: payment.id, newValues: { reference: payment.reference, payee: payment.payee, currency, foreignAmount: foreignAmount.toString(), baseAmount: baseAmount.toString(), lineCount: prepared.length, journalId: journal.id } } });
    return payment;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
