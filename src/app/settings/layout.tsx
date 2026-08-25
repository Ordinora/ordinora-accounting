import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { isSystemAdministrator } from "@/lib/staff-access";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  if (!isSystemAdministrator(user.staffRole)) redirect("/");
  return children;
}
