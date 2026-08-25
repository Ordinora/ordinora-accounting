"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ACTIVE_TENANT_COOKIE, destroySession, requireStaff } from "@/lib/session";

export async function selectTenant(formData: FormData) {
  const user = await requireStaff();
  const tenantId = String(formData.get("tenantId") ?? "");
  const isAdmin = user.staffRole === "SYSTEM_ADMIN" || user.staffRole === "FIRM_ADMIN";
  const authorized = isAdmin ? await db.tenant.count({ where: { id: tenantId, firmId: user.firmId } }) > 0 : user.assignments.some((a) => a.tenantId === tenantId);
  if (!authorized) throw new Error("Tenant access denied.");
  (await cookies()).set(ACTIVE_TENANT_COOKIE, tenantId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 });
  redirect("/");
}

export async function logout() { await destroySession(); redirect("/login"); }
