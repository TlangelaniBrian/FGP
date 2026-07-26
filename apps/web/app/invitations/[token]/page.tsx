"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { apiErrorMessage, sessionFetch } from "@/lib/session";

export default function InvitationPage() {
  const params = useParams<{ token: string }>();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
  });
  const [accepted, setAccepted] = useState(false);
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
        body: JSON.stringify({
          ...form,
          invitationToken: params.token,
        }),
      });
      if (!response.ok) {
        setError(
          await apiErrorMessage(
            response,
            "The invitation is invalid, expired, or belongs to another email.",
          ),
        );
        return;
      }
      setAccepted(true);
    } catch {
      setError("Could not accept the invitation. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="invitation-heading">
        <p className="eyebrow">Organisation invitation</p>
        <h1 className="page-title" id="invitation-heading">
          Join an FGP workspace
        </h1>
        {accepted ? (
          <div className="auth-success" role="status">
            <p>
              Invitation accepted. Verify the email sent to {form.email}, then
              sign in.
            </p>
            <Link className="button button-primary" href="/sign-in">
              Continue to sign in
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label className="field-label" htmlFor="invitation-name">
              Your name
            </label>
            <input
              className="field"
              id="invitation-name"
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
            <label className="field-label" htmlFor="invitation-email">
              Invited email
            </label>
            <input
              className="field"
              id="invitation-email"
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
            <label className="field-label" htmlFor="invitation-password">
              Create password
            </label>
            <input
              className="field"
              id="invitation-password"
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
              {submitting ? "Joining…" : "Accept invitation"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
