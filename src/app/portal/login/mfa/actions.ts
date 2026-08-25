"use server";
import type { MfaState } from "@/lib/mfa-challenge";
import { completeMfaChallenge } from "@/lib/mfa-challenge";
export async function verifyClientMfa(_state: MfaState, formData: FormData) { return completeMfaChallenge("CLIENT", formData); }
