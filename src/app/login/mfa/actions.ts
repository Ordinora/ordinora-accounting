"use server";
import type { MfaState } from "@/lib/mfa-challenge";
import { completeMfaChallenge } from "@/lib/mfa-challenge";
export async function verifyStaffMfa(_state: MfaState, formData: FormData) { return completeMfaChallenge("STAFF", formData); }
