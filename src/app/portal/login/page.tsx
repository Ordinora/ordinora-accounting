import { redirect } from "next/navigation";
import { PortalLoginForm } from "@/components/portal-login-form";
import { getCurrentClient } from "@/lib/session";
export default async function PortalLoginPage(){if(await getCurrentClient())redirect("/portal");return <main className="login-page"><section className="login-card"><div className="login-brand"><span className="brand-mark">O</span><div><strong>Ordinora</strong><small>CLIENT PORTAL</small></div></div><p className="login-kicker">SECURE COMPANY ACCESS</p><h1>Client sign in</h1><p className="login-copy">View the reports and information authorized by your accountant.</p><PortalLoginForm/></section></main>}
