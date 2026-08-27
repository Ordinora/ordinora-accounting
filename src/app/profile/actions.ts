"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";

export type ProfileActionState = { error?: string; success?: string };

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your full name.").max(120),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(14, "The new password must contain at least 14 characters.").max(128),
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"], message: "The new passwords do not match.",
});

export async function updateProfile(_state: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  try {
    const user = await requireStaff();
    const input = profileSchema.parse(Object.fromEntries(formData));
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { displayName: input.displayName } });
      await tx.auditEvent.create({ data: {
        firmId: user.firmId, actorId: user.id, actorKind: "STAFF", action: "PROFILE_UPDATED",
        entityType: "User", entityId: user.id, previousValues: { displayName: user.displayName },
        newValues: { displayName: input.displayName },
      } });
    });
    revalidatePath("/", "layout");
    return { success: "Your profile has been updated." };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Check the entered details." };
    return { error: error instanceof Error ? error.message : "Your profile could not be updated." };
  }
}

export async function changePassword(_state: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  try {
    const user = await requireStaff();
    const input = passwordSchema.parse(Object.fromEntries(formData));
    if (!await bcrypt.compare(input.currentPassword, user.passwordHash)) return { error: "The current password is incorrect." };
    if (await bcrypt.compare(input.newPassword, user.passwordHash)) return { error: "Choose a new password that is different from the current password." };
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.auditEvent.create({ data: {
        firmId: user.firmId, actorId: user.id, actorKind: "STAFF", action: "PROFILE_PASSWORD_CHANGED",
        entityType: "User", entityId: user.id,
      } });
    });
    return { success: "Your password has been changed." };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Check the entered details." };
    return { error: error instanceof Error ? error.message : "Your password could not be changed." };
  }
}
