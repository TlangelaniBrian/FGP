function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function safeHost(value: string | null) {
  if (!value || !/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(value)) return null;
  return value;
}

export function getRequestOrigin(requestHeaders: Pick<Headers, "get">) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const configuredHost = safeHost(new URL(configuredOrigin).host);
  const directHost = safeHost(firstHeaderValue(requestHeaders.get("host")));
  const forwardedHost = safeHost(firstHeaderValue(requestHeaders.get("x-forwarded-host")));
  const trustedForwardedHost = forwardedHost && (forwardedHost === directHost || forwardedHost === configuredHost)
    ? forwardedHost
    : null;
  const host = trustedForwardedHost ?? directHost;
  if (host) {
    const forwardedProtocol = firstHeaderValue(requestHeaders.get("x-forwarded-proto"));
    const protocol = forwardedProtocol === "https" || forwardedProtocol === "http" ? forwardedProtocol : "http";
    return `${protocol}://${host}`;
  }
  return configuredOrigin;
}
