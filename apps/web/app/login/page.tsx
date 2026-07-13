"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const visibleError = error ?? (searchParams.get("error") === "membership_required" ? "Your account does not have active workspace membership. Sign in with an active team account." : null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(null);
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    const next = typeof window === "undefined" ? "/" : new URLSearchParams(window.location.search).get("next") ?? "/";
    router.replace(next); router.refresh();
  }
  return <main className="auth-page"><div className="auth-card"><div className="brand-lockup"><div className="brand-mark">⌂</div><div><strong>First Generation</strong><span>PROPERTIES</span></div></div><p className="eyebrow" style={{ marginTop: 28 }}>Secure workspace</p><h1 className="page-title" style={{ fontSize: 28 }}>Sign in to FGP</h1><p className="page-subtitle">Use your team account to access land analysis, project records, and capital governance.</p><form onSubmit={submit} style={{ marginTop: 24 }}><label className="field-label">Email<input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label className="field-label" style={{ marginTop: 14 }}>Password<input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>{visibleError && <p className="field-error">{visibleError}</p>}<button className="button button-primary" style={{ width: "100%", marginTop: 20 }} disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button></form></div></main>;
}
