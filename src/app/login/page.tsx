import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentStaff } from "@/lib/session";
import { OrdinoraEmblem } from "@/components/ordinora-emblem";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentStaff()) redirect("/");
  return <main className="login-page"><section className="login-card"><div className="login-brand"><span className="brand-mark"><OrdinoraEmblem className="ordinora-emblem" /></span><div><strong>Ordinora</strong><small>ACCOUNTING</small></div></div><p className="login-kicker">STAFF WORKSPACE</p><h1>Welcome back</h1><p className="login-copy">Sign in to manage your assigned clients and accounting work.</p><LoginForm/><div className="login-security"><ShieldCheck size={16}/><span>Protected with encrypted, expiring sessions</span></div></section></main>;
}
