"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

const schema = z.object({
  code: z.string().trim().min(1, "Enter a contact code.").max(20),
  name: z.string().trim().min(2, "Enter a contact name.").max(120),
  email: z.union([z.string().email("Enter a valid email address."), z.literal("")]),
  phone: z.string().trim().max(40), address: z.string().trim().max(300),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
});

export type ContactCreateState = { error?: string };
type ContactKind = "customer" | "supplier";

function authorize(role: string | null | undefined) { if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(role)) throw new Error("Your role cannot manage contacts."); }
function label(kind: ContactKind) { return kind === "customer" ? "Customer" : "Supplier"; }
function createError(error: unknown, kind: ContactKind, code: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the contact details.";
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return `${label(kind)} code ${code || "entered"} already exists in this company.`;
  return error instanceof Error ? error.message : `The ${kind} could not be created.`;
}

async function create(kind: ContactKind, _state: ContactCreateState, formData: FormData): Promise<ContactCreateState> {
  let submittedCode = "";
  try {
    const { user, active } = await requireActiveTenant(); authorize(user.staffRole);
    const input = schema.parse(Object.fromEntries(formData)); submittedCode = input.code;
    const where = { tenantId: active.id, OR: [{ code: { equals: input.code, mode: "insensitive" as const } }, { name: { equals: input.name, mode: "insensitive" as const } }] };
    const existing = kind === "customer" ? await db.customer.findFirst({ where }) : await db.supplier.findFirst({ where });
    if (existing) return { error: existing.code.toLocaleLowerCase() === input.code.toLocaleLowerCase() ? `${label(kind)} code ${input.code} already exists.` : `${label(kind)} name “${input.name}” already exists.` };
    const data = { tenantId: active.id, ...input, email: input.email || null, phone: input.phone || null, address: input.address || null };
    const record = kind === "customer" ? await db.customer.create({ data }) : await db.supplier.create({ data });
    await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: `${kind.toUpperCase()}_CREATED`, entityType: kind, entityId: record.id, newValues: { code: record.code, name: record.name } } });
  } catch (error) { return { error: createError(error, kind, submittedCode) }; }
  revalidatePath(`/${kind}s`); redirect(`/${kind}s`);
}

export async function createCustomer(state: ContactCreateState, formData: FormData) { return create("customer", state, formData); }
export async function createSupplier(state: ContactCreateState, formData: FormData) { return create("supplier", state, formData); }

async function update(kind: ContactKind, formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole);
  const id = z.string().min(1).parse(formData.get("id")), input = schema.extend({ isActive: z.coerce.boolean().default(false), reason: z.string().trim().min(5).max(240) }).parse(Object.fromEntries(formData));
  const previous = kind === "customer" ? await db.customer.findFirst({ where: { id, tenantId: active.id } }) : await db.supplier.findFirst({ where: { id, tenantId: active.id } });
  if (!previous) throw new Error(`${kind} not found.`);
  const data = { code: input.code, name: input.name, email: input.email || null, phone: input.phone || null, address: input.address || null, paymentTermsDays: input.paymentTermsDays, isActive: input.isActive };
  const record = kind === "customer" ? await db.customer.update({ where: { id }, data }) : await db.supplier.update({ where: { id }, data });
  await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: `${kind.toUpperCase()}_UPDATED`, entityType: kind, entityId: id, previousValues: { code: previous.code, name: previous.name, email: previous.email, isActive: previous.isActive }, newValues: { code: record.code, name: record.name, email: record.email, isActive: record.isActive }, reason: input.reason } });
  revalidatePath(`/${kind}s`); redirect(`/${kind}s`);
}
export async function updateCustomer(formData: FormData) { return update("customer", formData); }
export async function updateSupplier(formData: FormData) { return update("supplier", formData); }

async function remove(kind: ContactKind, formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole);
  const id = z.string().min(1).parse(formData.get("id")), confirmation = z.string().trim().parse(formData.get("confirmation")), reason = z.string().trim().min(5).max(240).parse(formData.get("reason"));
  await db.$transaction(async (tx) => {
    const record = kind === "customer" ? await tx.customer.findFirst({ where: { id, tenantId: active.id }, include: { _count: { select: { invoices: true, receipts: true, creditNotes: true } } } }) : await tx.supplier.findFirst({ where: { id, tenantId: active.id }, include: { _count: { select: { bills: true, payments: true, creditNotes: true } } } });
    if (!record) throw new Error(`${kind} not found.`); if (confirmation !== record.code) throw new Error(`Type ${record.code} exactly to confirm deletion.`);
    const connected = Object.values(record._count).reduce((sum, count) => sum + count, 0); if (connected) throw new Error(`This ${kind} has ${connected} connected accounting transaction${connected === 1 ? "" : "s"}. Delete those transactions first, or mark the contact inactive.`);
    if (kind === "customer") await tx.customer.delete({ where: { id } }); else await tx.supplier.delete({ where: { id } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: `${kind.toUpperCase()}_DELETED`, entityType: kind, entityId: id, previousValues: { code: record.code, name: record.name }, reason } });
  });
  revalidatePath(`/${kind}s`); redirect(`/${kind}s`);
}
export async function deleteCustomer(formData: FormData) { return remove("customer", formData); }
export async function deleteSupplier(formData: FormData) { return remove("supplier", formData); }
