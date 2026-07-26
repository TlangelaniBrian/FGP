"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/session-context";
import { safeReturnTo } from "@/lib/session";

export function RequireSession({
  children,
  pathname,
}: {
  children?: React.ReactNode;
  pathname?: string;
}) {
  const currentPathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const returnTo = safeReturnTo(pathname ?? currentPathname);
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;

  useEffect(() => {
    if (session.status === "unauthenticated") {
      router.replace(signInHref);
    }
  }, [router, session.status, signInHref]);

  if (session.status === "authenticated") return children ?? null;

  if (session.status === "loading") {
    return (
      <div className="auth-guard" role="status">
        Checking your secure workspace…
      </div>
    );
  }

  if (session.status === "error") {
    return (
      <div className="auth-guard" role="alert">
        <p>{session.error ?? "Could not verify your session."}</p>
        <button className="button button-primary" onClick={() => session.refresh()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="auth-guard">
      <p>Your session has expired.</p>
      <Link className="button button-primary" href={signInHref}>
        Sign in
      </Link>
    </div>
  );
}
