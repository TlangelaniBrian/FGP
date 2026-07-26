"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  apiErrorMessage,
  decodeIdentityToken,
  sessionFetch,
} from "@/lib/session";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? "";
  const encodedToken = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"ready" | "verified">("ready");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const canVerify = Boolean(userId && encodedToken);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const token = decodeIdentityToken(encodedToken);
      const response = await sessionFetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token }),
      });
      if (!response.ok) {
        setError(
          await apiErrorMessage(
            response,
            "The verification link is invalid or expired.",
          ),
        );
        return;
      }
      setStatus("verified");
    } catch {
      setError("The verification link is invalid or expired.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend(event: React.FormEvent) {
    event.preventDefault();
    setResending(true);
    setResendStatus(null);
    try {
      await sessionFetch("/api/auth/verification-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      setResendStatus(
        "If the account is awaiting verification, a new email has been sent.",
      );
    } catch {
      setResendStatus(
        "If the account is awaiting verification, a new email has been sent.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="verify-email-heading">
        <p className="eyebrow">Email verification</p>
        <h1 className="page-title" id="verify-email-heading">
          Verify your email
        </h1>
        {status === "verified" ? (
          <div className="auth-success" role="status">
            <p>Your email is verified. You can now access your organisation.</p>
            <Link className="button button-primary" href="/sign-in">
              Sign in
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <p className="page-subtitle">
              {canVerify
                ? "Complete the secure verification from your email."
                : "Open the verification link from your email to continue."}
            </p>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button button-primary"
              type="submit"
              disabled={!canVerify || submitting}
            >
              {submitting ? "Verifying…" : "Verify email"}
            </button>
          </form>
        )}
        <div className="auth-links">
          <Link href="/register">Use a different account</Link>
          <form className="auth-form" onSubmit={resend}>
            <label className="field-label" htmlFor="verification-email">
              Verification email
            </label>
            <input
              className="field"
              id="verification-email"
              type="email"
              autoComplete="email"
              value={resendEmail}
              onChange={(event) => setResendEmail(event.target.value)}
              required
            />
            <button
              className="button button-secondary"
              type="submit"
              disabled={resending}
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
            {resendStatus && <p role="status">{resendStatus}</p>}
          </form>
        </div>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="auth-page">Loading verification…</main>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
