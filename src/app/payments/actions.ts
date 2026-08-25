"use server";
import { revalidatePath } from "next/cache";import { redirect } from "next/navigation";import { Prisma } from "@prisma/client";import { db } from "@/lib/db";
import { z } from "zod";
import { postDirectPayment } from "@/lib/payments";
import { requireActiveTenant } from "@/lib/session";
import { resolveReference } from "@/lib/reference-numbers";

const schema = z.object({ bankAccountId: z.string().min(1), reference: z.string().trim().max(40).default(""), autoReference:z.string().optional(), paymentDate: z.coerce.date(), payee: z.string().trim().min(1).max(160), description: z.string().trim().max(500), currency: z.string().trim().length(3) });

export async function createDirectPayment(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  const header = schema.parse(Object.fromEntries(formData));
  const reference=await resolveReference({tenantId:active.id,kind:"PAYMENT",date:header.paymentDate,supplied:header.reference,auto:header.autoReference==="true"});
  const accountIds = formData.getAll("lineAccountId").map(String), itemIds=formData.getAll("lineItemId").map(String), locationIds=formData.getAll("lineLocationId").map(String), descriptions = formData.getAll("lineDescription").map(String), quantities = formData.getAll("lineQuantity").map(String), unitPrices = formData.getAll("lineUnitPrice").map(String), discounts=formData.getAll("lineDiscountPercent").map(String);
  if (![itemIds.length,locationIds.length,descriptions.length, quantities.length, unitPrices.length,discounts.length].every((length) => length === accountIds.length)) throw new Error("Payment lines are incomplete.");
  await postDirectPayment({ actor: { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole }, bankAccountId:header.bankAccountId,reference,paymentDate:header.paymentDate,payee:header.payee,description:header.description,currency:header.currency, lines: accountIds.map((accountId, index) => ({ accountId,inventoryItemId:itemIds[index]||undefined,inventoryLocationId:locationIds[index]||undefined, description: descriptions[index], quantity: quantities[index], unitPrice: unitPrices[index],discountPercent:discounts[index] })) });
  redirect("/payments");
}
export async function updateDirectPayment(formData:FormData){const{user,active}=await requireActiveTenant();if(!user.staffRole||!["SYSTEM_ADMIN","FIRM_ADMIN","ACCOUNTANT"].includes(user.staffRole))throw new Error("Your role cannot update payments.");const input=z.object({id:z.string().min(1),reference:z.string().trim().min(1).max(40),payee:z.string().trim().min(1).max(160),description:z.string().trim().max(500),reason:z.string().trim().min(5).max(240)}).parse(Object.fromEntries(formData));await db.$transaction(async tx=>{const payment=await tx.payment.findFirst({where:{id:input.id,tenantId:active.id}});if(!payment)throw new Error("Payment not found.");await tx.payment.update({where:{id:payment.id},data:{reference:input.reference,payee:input.payee,description:input.description||null}});if(payment.journalId)await tx.journal.update({where:{id:payment.journalId},data:{reference:input.reference,description:input.description||`Payment to ${input.payee}`}});await tx.auditEvent.create({data:{firmId:user.firmId,tenantId:active.id,actorId:user.id,actorKind:"STAFF",action:"PAYMENT_UPDATED",entityType:"Payment",entityId:payment.id,previousValues:{reference:payment.reference,payee:payment.payee,description:payment.description},newValues:{reference:input.reference,payee:input.payee,description:input.description},reason:input.reason}})},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});revalidatePath("/payments");revalidatePath("/journals");revalidatePath("/reports");redirect("/payments")}
