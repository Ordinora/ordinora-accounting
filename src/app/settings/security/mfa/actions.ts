"use server";
import { redirect } from "next/navigation";import type { MfaEnrollmentState } from "@/lib/mfa-enrollment";import { finishMfaEnrollment,startMfaEnrollment } from "@/lib/mfa-enrollment";import { requireStaff } from "@/lib/session";
export async function startStaffMfa(){const user=await requireStaff();await startMfaEnrollment(user);redirect("/settings/security/mfa")}
export async function verifyStaffEnrollment(_state:MfaEnrollmentState,formData:FormData){const user=await requireStaff();return finishMfaEnrollment(user,String(formData.get("code")??""))}
