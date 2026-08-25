"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);
  return <form action={action} className="login-form">
    <label htmlFor="email">Email address</label><div className="input-wrap"><Mail size={17}/><input id="email" name="email" type="email" autoComplete="username" required placeholder="name@firm.com"/></div>
    <label htmlFor="password">Password</label><div className="input-wrap"><LockKeyhole size={17}/><input id="password" name="password" type={showPassword?"text":"password"} autoComplete="current-password" required/><button type="button" className="password-toggle" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
    {state?.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="login-button" disabled={pending}>{pending ? "Signing in…" : "Sign in securely"}</button>
  </form>;
}
