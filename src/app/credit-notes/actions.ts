"use server";
import { revalidatePath } from "next/cache";import { redirect } from "next/navigation";import { Prisma } from "@prisma/client";import { db } from "@/lib/db";
import { z } from "zod";
import { requireActiveTenant } from "@/lib/session";
import { postCreditNote } from "@/lib/credit-notes";
import { resolveReference } from "@/lib/reference-numbers";

const header=z.object({documentId:z.string().min(1),reference:z.string().trim().max(40).default(""),autoReference:z.string().optional(),creditDate:z.coerce.date(),description:z.string().trim().min(2).max(240)});
const line=z.object({originalLineId:z.string().min(1),description:z.string().trim().min(1).max(240),accountId:z.string().min(1),quantity:z.string().regex(/^\d+(\.\d{1,4})?$/),unitPrice:z.string().min(1)});

async function post(kind:"SALE"|"PURCHASE",formData:FormData){
  const{user,active}=await requireActiveTenant();const h=header.parse(Object.fromEntries(formData));const reference=await resolveReference({tenantId:active.id,kind:kind==="SALE"?"SALES_CREDIT_NOTE":"SUPPLIER_CREDIT_NOTE",date:h.creditDate,supplied:h.reference,auto:h.autoReference==="true"});
  const originals=formData.getAll("originalLineId").map(String),descriptions=formData.getAll("lineDescription").map(String),accounts=formData.getAll("lineAccountId").map(String),quantities=formData.getAll("lineQuantity").map(String),prices=formData.getAll("lineUnitPrice").map(String);
  if(![descriptions.length,accounts.length,quantities.length,prices.length].every(n=>n===originals.length))throw new Error("Credit-note lines are incomplete.");
  const lines=originals.map((originalLineId,i)=>({originalLineId,description:descriptions[i],accountId:accounts[i],quantity:quantities[i],unitPrice:prices[i]})).filter(item=>Number(item.quantity)>0).map(item=>line.parse(item));
  await postCreditNote({kind,actor:{tenantId:active.id,userId:user.id,firmId:user.firmId,role:user.staffRole},documentId:h.documentId,reference,creditDate:h.creditDate,description:h.description,lines});redirect(kind==="SALE"?"/sales/credit-notes":"/purchases/credit-notes");
}
export async function postSalesCreditNote(formData:FormData){return post("SALE",formData)}
export async function postSupplierCreditNote(formData:FormData){return post("PURCHASE",formData)}
async function updateNote(kind:"SALE"|"PURCHASE",formData:FormData){const{user,active}=await requireActiveTenant();if(!user.staffRole||!["SYSTEM_ADMIN","FIRM_ADMIN","ACCOUNTANT"].includes(user.staffRole))throw new Error("Your role cannot update credit notes.");const input=z.object({id:z.string().min(1),reference:z.string().trim().min(1).max(40),description:z.string().trim().min(2).max(240),reason:z.string().trim().min(5).max(240)}).parse(Object.fromEntries(formData));await db.$transaction(async tx=>{const note=kind==="SALE"?await tx.salesCreditNote.findFirst({where:{id:input.id,tenantId:active.id}}):await tx.supplierCreditNote.findFirst({where:{id:input.id,tenantId:active.id}});if(!note)throw new Error("Credit note not found.");if(kind==="SALE")await tx.salesCreditNote.update({where:{id:note.id},data:{reference:input.reference,description:input.description}});else await tx.supplierCreditNote.update({where:{id:note.id},data:{reference:input.reference,description:input.description}});if(note.journalId)await tx.journal.update({where:{id:note.journalId},data:{reference:input.reference,description:input.description}});await tx.auditEvent.create({data:{firmId:user.firmId,tenantId:active.id,actorId:user.id,actorKind:"STAFF",action:kind==="SALE"?"SALES_CREDIT_NOTE_UPDATED":"SUPPLIER_CREDIT_NOTE_UPDATED",entityType:kind==="SALE"?"SalesCreditNote":"SupplierCreditNote",entityId:note.id,previousValues:{reference:note.reference,description:note.description},newValues:{reference:input.reference,description:input.description},reason:input.reason}})},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});const path=kind==="SALE"?"/sales/credit-notes":"/purchases/credit-notes";revalidatePath(path);revalidatePath("/journals");revalidatePath("/reports");redirect(path)}
export async function updateSalesCreditNote(formData:FormData){return updateNote("SALE",formData)}export async function updateSupplierCreditNote(formData:FormData){return updateNote("PURCHASE",formData)}

