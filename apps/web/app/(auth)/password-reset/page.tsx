"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  apiErrorMessage,
  decodeIdentityToken,
  sessionFetch,
} from "@/lib/session";

function PasswordResetForm() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? "";
  const encodedToken = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [reset, setReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canReset = Boolean(userId && encodedToken);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const token = decodeIdentityToken(encodedToken);
      const response = await sessionFetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token, newPassword }),
      });
      if (!response.ok) {
        setError(
          await apiErrorMessage(
            response,
            "The reset link is invalid or expired.",
          ),
        );
        return;
      }
      setReset(true);
    } catch {
      setError("The reset link is invalid or expired.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-reset-heading">
        <p className="eyebrow">Secure reset</p>
        <h1 className="page-title" id="password-reset-heading">
          Choose a new password
        </h1>
        {reset ? (
          <div className="auth-success" role="status">
            <p>Your password was updated.</p>
            <Link className="button button-primary" href="/sign-in">
              Sign in
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label className="field-label" htmlFor="new-password">
              New password
            </label>
            <input
              className="field"
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
              disabled={!canReset}
            />
            {!canReset && (
              <p className="field-error" role="alert">
                Open the password reset link from your email.
              </p>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button button-primary"
              type="submit"
              disabled={!canReset || submitting}
            >
              {submitting ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function PasswordResetPage() {
  return (
    <Suspense fallback={<main className="auth-page">Loading reset…</main>}>
      <PasswordResetForm />
    </Suspense>
  );
}
