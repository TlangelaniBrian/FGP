"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiErrorMessage, safeReturnTo, sessionFetch } from "@/lib/session";
import { useSession } from "@/lib/session-context";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await sessionFetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError(
          await apiErrorMessage(
            response,
            "Unable to sign in. Check your email and password.",
          ),
        );
        return;
      }

      await session.refresh();
      router.replace(safeReturnTo(searchParams.get("returnTo")));
      router.refresh();
    } catch {
      setError("Could not reach the sign-in service. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <p className="eyebrow">Secure workspace</p>
        <h1 className="page-title" id="sign-in-heading">
          Sign in to FGP
        </h1>
        <p className="page-subtitle">
          Continue to your organisation&apos;s property intelligence workspace.
        </p>
        <form onSubmit={submit} className="auth-form">
          <label className="field-label" htmlFor="sign-in-email">
            Email
          </label>
          <input
            className="field"
            id="sign-in-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <label className="field-label" htmlFor="sign-in-password">
            Password
          </label>
          <input
            className="field"
            id="sign-in-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-primary"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="auth-links">
          <Link href="/password-recovery">Forgot your password?</Link>
          <Link href="/register">Create an organisation account</Link>
        </div>
      </section>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="auth-page">Loading sign in…</main>}>
      <SignInForm />
    </Suspense>
  );
}
