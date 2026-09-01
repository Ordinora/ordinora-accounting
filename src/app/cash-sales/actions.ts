"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { postDailySale, updateDailySale } from "@/lib/daily-sales";
import { requireActiveTenant } from "@/lib/session";
import { resolveReference } from "@/lib/reference-numbers";
import { withTransactionNotice } from "@/lib/transaction-notice";

const header = z.object({ reference: z.string().trim().max(40).default(""), autoReference:z.string().optional(), registerDate: z.coerce.date(), branchLabel: z.string().trim().min(1).max(80), registerLabel: z.string().trim().max(80) });

export type DailySaleActionState = { error?: string; redirectTo?: string };

function postingError(error: unknown): DailySaleActionState {
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Review the required Daily Sale fields." };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { error: "That Daily Sale reference is already in use." };
    if (error.code === "P2028") return { error: "The inventory posting took too long to complete. No transaction was posted; please try again." };
    return { error: "The database could not post this Daily Sale. No transaction was posted; please try again or contact the system administrator." };
  }
  return { error: error instanceof Error ? error.message : "The Daily Sale could not be posted. Please try again." };
}

function saleValues(formData: FormData) {
  const h = header.parse(Object.fromEntries(formData));
  const descriptions = formData.getAll("lineDescription").map(String), accounts = formData.getAll("lineAccountId").map(String), items = formData.getAll("lineItemId").map(String), locations = formData.getAll("lineLocationId").map(String), quantities = formData.getAll("lineQuantity").map(String), prices = formData.getAll("lineUnitPrice").map(String), discountTypes = formData.getAll("lineDiscountType").map(String), discountValues = formData.getAll("lineDiscountValue").map(String);
  if (![accounts.length, items.length, locations.length, quantities.length, prices.length, discountTypes.length, discountValues.length].every((length) => length === descriptions.length)) throw new Error("Daily sales lines are incomplete.");
  const lines = descriptions.map((description, index) => ({ description, accountId: accounts[index], inventoryItemId: items[index] || undefined, inventoryLocationId: locations[index] || undefined, quantity: quantities[index], unitPrice: prices[index], discountType: z.enum(["NONE", "PERCENT", "AMOUNT"]).parse(discountTypes[index]), discountValue: discountValues[index] || "0" }));
  const types = formData.getAll("tenderType").map(String), tenderAccounts = formData.getAll("tenderAccountId").map(String), amounts = formData.getAll("tenderAmount").map(String), references = formData.getAll("tenderReference").map(String);
  if (![tenderAccounts.length, amounts.length, references.length].every((length) => length === types.length)) throw new Error("Payment tender lines are incomplete.");
  const tenders = types.map((type, index) => ({ type: z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"]).parse(type), accountId: tenderAccounts[index], amount: amounts[index], reference: references[index] }));
  return { ...h, lines, tenders };
}

export async function postCashSales(_state: DailySaleActionState, formData: FormData): Promise<DailySaleActionState> {
  try {
    const { user, active } = await requireActiveTenant();
    const values=saleValues(formData),reference=await resolveReference({tenantId:active.id,kind:"DAILY_SALE",date:values.registerDate,supplied:values.reference,auto:values.autoReference==="true"});
    await postDailySale({ actor: { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole }, reference,registerDate:values.registerDate,branchLabel:values.branchLabel,registerLabel:values.registerLabel,lines:values.lines,tenders:values.tenders });
    return { redirectTo: withTransactionNotice("/cash-sales", "cash-sale") };
  } catch (error) { return postingError(error); }
}

export async function updateCashSales(_state: DailySaleActionState, formData: FormData): Promise<DailySaleActionState> {
  try {
    const { user, active } = await requireActiveTenant();
    if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot update daily sales.");
    const { id, reason } = z.object({ id: z.string().min(1), reason: z.string().trim().min(5).max(240) }).parse(Object.fromEntries(formData));
    await updateDailySale({ actor: { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole }, id, reason, ...saleValues(formData) });
    revalidatePath("/cash-sales"); revalidatePath("/journals"); revalidatePath("/reports"); revalidatePath("/inventory");
    return { redirectTo: "/cash-sales" };
  } catch (error) { return postingError(error); }
}
