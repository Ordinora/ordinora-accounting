import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { canAccessModule } from "@/lib/staff-access";

export default async function PayrollLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  if (!canAccessModule(user.staffRole, "payroll")) redirect("/");
  return children;
}
