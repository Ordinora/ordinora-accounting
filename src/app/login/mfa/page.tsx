import { redirect } from "next/navigation";
import { MfaChallengeForm } from "@/components/mfa-challenge-form";
import { hasMfaChallenge } from "@/lib/mfa-challenge";
import { verifyStaffMfa } from "./actions";
import { OrdinoraEmblem } from "@/components/ordinora-emblem";
export default async function Page(){if(!await hasMfaChallenge("STAFF"))redirect("/login");return <main className="login-page"><section className="login-card"><div className="login-brand"><span className="brand-mark"><OrdinoraEmblem className="ordinora-emblem" /></span><div><strong>Ordinora</strong><small>ACCOUNTING</small></div></div><p className="login-kicker">SECOND VERIFICATION</p><h1>Authenticator code</h1><p className="login-copy">Enter the current six-digit code from your authenticator app, or one unused recovery code.</p><MfaChallengeForm action={verifyStaffMfa}/></section></main>}
