"use client";
import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";

export default function LoginPage(){
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const fd=new FormData(e.currentTarget);const r=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:fd.get("email"),password:fd.get("password")})});const j=await r.json();if(!r.ok){setError(j.error||"Prijava nije uspjela.");setBusy(false);return}location.href=j.redirect}
  return <main className="center-shell"><div className="auth-card">
    <a className="brand" href="/"><span className="brand-mark">L+</span><span>Rezervacije</span></a>
    <div className="feature-icon" style={{marginTop:28}}><LockKeyhole size={21}/></div>
    <h1>Dobro došli natrag.</h1><p className="muted" style={{marginTop:0}}>Prijavite se za pregled termina, klijenata i statistike.</p>
    <form onSubmit={submit}><div className="field"><label>Email</label><input className="input" name="email" type="email" autoComplete="email" required placeholder="ime@salon.hr"/></div><div className="field"><label>Lozinka</label><input className="input" name="password" type="password" autoComplete="current-password" required placeholder="••••••••"/></div>{error&&<div className="error">{error}</div>}<button className="btn btn-brand" style={{width:"100%",marginTop:12}} disabled={busy}>{busy?"Prijava…":"Prijavi se"}<ArrowRight size={17}/></button></form>
    <p className="muted" style={{fontSize:12,marginBottom:0,marginTop:20}}>Za pristup novoj firmi račun otvara administrator platforme.</p>
  </div></main>
}
