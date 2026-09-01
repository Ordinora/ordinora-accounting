"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { approvePayrollRun, postPayrollRun, preparePayrollRun } from "@/lib/payroll";
import { resolveReference } from "@/lib/reference-numbers";
import { withTransactionNotice } from "@/lib/transaction-notice";

function authorize(role: string | null) {
  if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT", "PAYROLL_OFFICER"].includes(role)) {
    throw new Error("Your role cannot manage payroll records.");
  }
}

const employeeSchema = z.object({
  employeeNumber: z.string().trim().min(1).max(30),
  fullName: z.string().trim().min(2).max(120),
  identityReference: z.string().trim().max(60),
  citizenship: z.string().trim().min(2).max(60),
  identityCardCategory: z.string().trim().min(1, "Select an identity-card category.").max(40),
  schemeEligible: z.enum(["yes", "no"]),
  payFrequency: z.enum(["MONTHLY", "HOURLY"]),
  basicSalary: z.coerce.number().min(0),
  hourlyRate: z.union([z.literal(""), z.coerce.number().min(0)]),
  department: z.string().trim().max(80),
  employmentStart: z.coerce.date(),
});

export async function createEmployee(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  authorize(user.staffRole);
  const data = employeeSchema.parse(Object.fromEntries(formData));

  await db.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        tenantId: active.id,
        employeeNumber: data.employeeNumber,
        fullName: data.fullName,
        identityReference: data.identityReference || null,
        citizenship: data.citizenship,
        identityCardCategory: data.identityCardCategory || null,
        schemeEligible: data.schemeEligible === "yes",
        payFrequency: data.payFrequency,
        basicSalary: data.basicSalary,
        hourlyRate: data.hourlyRate === "" ? null : data.hourlyRate,
        department: data.department || null,
        employmentStart: data.employmentStart,
      },
    });
    await tx.auditEvent.create({
      data: {
        firmId: user.firmId,
        tenantId: active.id,
        actorId: user.id,
        actorKind: "STAFF",
        action: "EMPLOYEE_CREATED",
        entityType: "Employee",
        entityId: employee.id,
        newValues: {
          employeeNumber: employee.employeeNumber,
          fullName: employee.fullName,
          payFrequency: employee.payFrequency,
          schemeEligible: employee.schemeEligible,
        },
      },
    });
  });

  revalidatePath("/payroll");
  revalidatePath("/payroll/employees");
  redirect("/payroll/employees");
}

const runSchema = z.object({
  reference: z.string().trim().max(40).default(""),
  autoReference: z.string().optional(),
  payDate: z.coerce.date(),
  employeeId: z.array(z.string().min(1)),
  basicPay: z.array(z.string()),
  overtime: z.array(z.string()),
  allowances: z.array(z.string()),
  bonuses: z.array(z.string()),
  otherDeductions: z.array(z.string()),
});

export type PayrollRunActionState = { error?: string };

export async function createPayrollRun(_state: PayrollRunActionState, formData: FormData): Promise<PayrollRunActionState> {
  let run;
  try {
    const { user, active } = await requireActiveTenant();
    const raw = {
      reference: formData.get("reference"),
      autoReference: formData.get("autoReference"),
      payDate: formData.get("payDate"),
      employeeId: formData.getAll("employeeId"),
      basicPay: formData.getAll("basicPay"),
      overtime: formData.getAll("overtime"),
      allowances: formData.getAll("allowances"),
      bonuses: formData.getAll("bonuses"),
      otherDeductions: formData.getAll("otherDeductions"),
    };
    const input = runSchema.parse(raw);
    input.reference = await resolveReference({ tenantId: active.id, kind: "PAYROLL", date: input.payDate, supplied: input.reference, auto: input.autoReference === "true" });
    const lengths = [input.basicPay, input.overtime, input.allowances, input.bonuses, input.otherDeductions];
    if (lengths.some((items) => items.length !== input.employeeId.length)) throw new Error("Payroll line values are incomplete.");
    run = await preparePayrollRun({
      actor: { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole },
      reference: input.reference,
      payDate: input.payDate,
      lines: input.employeeId.map((employeeId, index) => ({
        employeeId,
        basicPay: input.basicPay[index],
        overtime: input.overtime[index],
        allowances: input.allowances[index],
        bonuses: input.bonuses[index],
        otherDeductions: input.otherDeductions[index],
      })),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The payroll run could not be prepared." };
  }
  redirect(`/payroll/runs/${run.id}`);
}

async function actor() {
  const { user, active } = await requireActiveTenant();
  return { tenantId: active.id, userId: user.id, firmId: user.firmId, role: user.staffRole };
}

export async function approveRun(formData: FormData) {
  const id = z.string().min(1).parse(formData.get("runId"));
  await approvePayrollRun(await actor(), id);
  revalidatePath(`/payroll/runs/${id}`);
  revalidatePath("/payroll");
}

export async function postRun(formData: FormData) {
  const id = z.string().min(1).parse(formData.get("runId"));
  await postPayrollRun(await actor(), id);
  revalidatePath(`/payroll/runs/${id}`);
  revalidatePath("/payroll");
  revalidatePath("/journals");
  redirect(withTransactionNotice(`/payroll/runs/${id}`, "payroll-run"));
}

export async function lockPayrollRun(formData:FormData){const{user,active}=await requireActiveTenant();authorize(user.staffRole);const id=z.string().min(1).parse(formData.get("runId")),confirmation=z.literal("LOCK").parse(formData.get("confirmation"));await db.$transaction(async tx=>{const run=await tx.payrollRun.findFirst({where:{id,tenantId:active.id}});if(!run)throw new Error("Payroll run not found.");if(run.status!=="POSTED"||!run.journalId)throw new Error("Only a posted payroll run can be locked.");await tx.payrollRun.update({where:{id},data:{status:"LOCKED",lockedAt:new Date()}});await tx.auditEvent.create({data:{firmId:user.firmId,tenantId:active.id,actorId:user.id,actorKind:"STAFF",action:"PAYROLL_RUN_LOCKED",entityType:"PayrollRun",entityId:id,previousValues:{status:run.status},newValues:{status:"LOCKED",confirmation}}})});revalidatePath(`/payroll/runs/${id}`);revalidatePath("/payroll")}

export async function updatePayrollRun(formData:FormData){const{user,active}=await requireActiveTenant();authorize(user.staffRole);const input=z.object({id:z.string().min(1),reference:z.string().trim().min(1).max(40),reason:z.string().trim().min(5).max(240)}).parse(Object.fromEntries(formData));await db.$transaction(async tx=>{const run=await tx.payrollRun.findFirst({where:{id:input.id,tenantId:active.id}});if(!run)throw new Error("Payroll run not found.");if(run.status==="LOCKED"||run.lockedAt)throw new Error("A locked payroll run cannot be updated.");await tx.payrollRun.update({where:{id:run.id},data:{reference:input.reference}});if(run.journalId)await tx.journal.update({where:{id:run.journalId},data:{reference:input.reference}});await tx.auditEvent.create({data:{firmId:user.firmId,tenantId:active.id,actorId:user.id,actorKind:"STAFF",action:"PAYROLL_RUN_UPDATED",entityType:"PayrollRun",entityId:run.id,previousValues:{reference:run.reference},newValues:{reference:input.reference},reason:input.reason}})});revalidatePath("/payroll");revalidatePath(`/payroll/runs/${input.id}`);revalidatePath("/journals");redirect(`/payroll/runs/${input.id}`)}
