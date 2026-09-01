"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { postCommercialDocument } from "@/lib/commercial";
import { updateCommercialDocument } from "@/lib/commercial-update";
import { resolveReference } from "@/lib/reference-numbers";
import { requireActiveTenant } from "@/lib/session";

const header = z.object({ partyId: z.string().min(1), reference: z.string().trim().max(40).default(""), autoReference: z.string().optional(), documentDate: z.coerce.date(), dueDate: z.coerce.date(), description: z.string().trim().min(2).max(240), discountType: z.enum(["NONE", "PERCENT", "AMOUNT"]).default("NONE"), discountValue: z.string().trim().default("0") });
const line = z.object({ description: z.string().trim().min(1).max(240), accountId: z.string().min(1), quantity: z.string().regex(/^\d+(\.\d{1,4})?$/), unitPrice: z.string().min(1) });
const updateSchema = z.object({ id: z.string().min(1), reference: z.string().trim().min(1).max(40), dueDate: z.coerce.date(), description: z.string().trim().min(2).max(240), reason: z.string().trim().min(5).max(240), discountType: z.enum(["NONE", "PERCENT", "AMOUNT"]).default("NONE"), discountValue: z.string().trim().default("0") });

export type CommercialActionState = { error?: string; redirectTo?: string };

function postingError(error: unknown, kind: "SALE" | "PURCHASE"): CommercialActionState {
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Review the required document fields." };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { error: "That reference is already in use. Choose another reference or use automatic reference." };
    return { error: `The database could not save this ${kind === "SALE" ? "sales invoice" : "supplier bill"}. Please try again or contact the system administrator.` };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: `The ${kind === "SALE" ? "sales invoice" : "supplier bill"} could not be saved. Please try again.` };
}

function parseLines(formData: FormData) {
  const descriptions = formData.getAll("lineDescription").map(String);
  const accounts = formData.getAll("lineAccountId").map(String);
  const quantities = formData.getAll("lineQuantity").map(String);
  const prices = formData.getAll("lineUnitPrice").map(String);
  const discounts = formData.getAll("lineDiscountPercent").map(String);
  const items = formData.getAll("lineItemId").map(String);
  const locations = formData.getAll("lineLocationId").map(String);
  if (!descriptions.length || ![accounts.length, quantities.length, prices.length, discounts.length, items.length, locations.length].every((count) => count === descriptions.length)) throw new Error("Commercial document lines are incomplete.");
  return descriptions.map((description, index) => ({ ...line.parse({ description, accountId: accounts[index] || "inventory-mapped", quantity: quantities[index], unitPrice: prices[index] }), discountPercent: discounts[index], itemId: items[index] || undefined, locationId: locations[index] || undefined }));
}

async function post(kind: "SALE" | "PURCHASE", _state: CommercialActionState, formData: FormData): Promise<CommercialActionState> {
  try {
    const { user, active } = await requireActiveTenant();
    const input = header.parse(Object.fromEntries(formData));
    const reference = await resolveReference({ tenantId: active.id, kind: kind === "SALE" ? "SALES_INVOICE" : "SUPPLIER_BILL", date: input.documentDate, supplied: input.reference, auto: input.autoReference === "true" });
    await postCommercialDocument({ kind, actor: { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole }, partyId: input.partyId, reference, documentDate: input.documentDate, dueDate: input.dueDate, description: input.description, discountType: input.discountType, discountValue: input.discountValue, lines: parseLines(formData) });
    return { redirectTo: kind === "SALE" ? "/sales" : "/purchases" };
  } catch (error) { return postingError(error, kind); }
}

async function update(kind: "SALE" | "PURCHASE", _state: CommercialActionState, formData: FormData): Promise<CommercialActionState> {
  try {
    const { user, active } = await requireActiveTenant();
    const input = updateSchema.parse(Object.fromEntries(formData));
    await updateCommercialDocument({ kind, actor: { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole }, ...input, lines: parseLines(formData) });
    const path = kind === "SALE" ? "/sales" : "/purchases";
    revalidatePath(path); revalidatePath("/journals"); revalidatePath("/reports"); revalidatePath("/inventory");
    return { redirectTo: path };
  } catch (error) { return postingError(error, kind); }
}

export async function postSale(state: CommercialActionState, formData: FormData) { return post("SALE", state, formData); }
export async function postPurchase(state: CommercialActionState, formData: FormData) { return post("PURCHASE", state, formData); }
export async function updateSale(state: CommercialActionState, formData: FormData) { return update("SALE", state, formData); }
export async function updatePurchase(state: CommercialActionState, formData: FormData) { return update("PURCHASE", state, formData); }
