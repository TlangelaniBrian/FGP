"use client";

import Link from "next/link";
import { useState } from "react";
import { apiErrorMessage, sessionFetch } from "@/lib/session";

export default function RegisterPage() {
  const [form, setForm] = useState({
    displayName: "",
    organizationName: "",
    email: "",
    password: "",
  });
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await sessionFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        setError(
          await apiErrorMessage(response, "Could not create your account."),
        );
        return;
      }
      setRegistered(true);
    } catch {
      setError("Could not reach registration. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-heading">
        <p className="eyebrow">New organisation</p>
        <h1 className="page-title" id="register-heading">
          Create your FGP workspace
        </h1>
        {registered ? (
          <div className="auth-success" role="status">
            <p>
              Account created. Open the verification email sent to {form.email}
              , then sign in.
            </p>
            <Link className="button button-primary" href="/sign-in">
              Continue to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <label className="field-label" htmlFor="register-name">
              Your name
            </label>
            <input
              className="field"
              id="register-name"
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
              autoComplete="name"
              required
            />
            <label className="field-label" htmlFor="register-organisation">
              Organisation name
            </label>
            <input
              className="field"
              id="register-organisation"
              value={form.organizationName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  organizationName: event.target.value,
                }))
              }
              required
            />
            <label className="field-label" htmlFor="register-email">
              Email
            </label>
            <input
              className="field"
              id="register-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              autoComplete="email"
              required
            />
            <label className="field-label" htmlFor="register-password">
              Password
            </label>
            <input
              className="field"
              id="register-password"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              autoComplete="new-password"
              minLength={12}
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
              {submitting ? "Creating workspace…" : "Create organisation"}
            </button>
          </form>
        )}
        <div className="auth-links">
          <Link href="/sign-in">Already have an account? Sign in</Link>
        </div>
      </section>
    </main>
  );
}
