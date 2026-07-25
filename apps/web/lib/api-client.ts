function isAuthenticationRequest(input: RequestInfo | URL) {
  const path = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  return path.startsWith("/api/auth/");
}

function currentReturnTo() {
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, credentials: "include" });
  if (response.status === 401 && typeof window !== "undefined" && !isAuthenticationRequest(input)) {
    window.location.assign(`/login?next=${encodeURIComponent(currentReturnTo())}`);
  }
  return response;
}
