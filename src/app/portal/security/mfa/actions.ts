"use server";
import { redirect } from "next/navigation";import type { MfaEnrollmentState } from "@/lib/mfa-enrollment";import { finishMfaEnrollment,startMfaEnrollment } from "@/lib/mfa-enrollment";import { requireClient } from "@/lib/session";
export async function startClientMfa(){const user=await requireClient();await startMfaEnrollment(user);redirect("/portal/security/mfa")}
export async function verifyClientEnrollment(_state:MfaEnrollmentState,formData:FormData){const user=await requireClient();return finishMfaEnrollment(user,String(formData.get("code")??""))}
