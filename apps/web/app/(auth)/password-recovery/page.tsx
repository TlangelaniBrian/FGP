"use client";

import Link from "next/link";
import { useState } from "react";
import { apiErrorMessage, sessionFetch } from "@/lib/session";

export default function PasswordRecoveryPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await sessionFetch("/api/auth/password-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError(
          await apiErrorMessage(
            response,
            "Could not start password recovery.",
          ),
        );
        return;
      }
      setSent(true);
    } catch {
      setError("Could not reach password recovery. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="recovery-heading">
        <p className="eyebrow">Account recovery</p>
        <h1 className="page-title" id="recovery-heading">
          Reset your password
        </h1>
        {sent ? (
          <div className="auth-success" role="status">
            <p>
              If an eligible account exists for {email}, a reset email has been
              sent.
            </p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label className="field-label" htmlFor="recovery-email">
              Account email
            </label>
            <input
              className="field"
              id="recovery-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button button-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Sending…" : "Send reset email"}
            </button>
          </form>
        )}
        <div className="auth-links">
          <Link href="/sign-in">Return to sign in</Link>
        </div>
      </section>
    </main>
  );
}
