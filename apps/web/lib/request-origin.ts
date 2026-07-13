function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function getRequestOrigin(requestHeaders: Pick<Headers, "get">) {
  const host = firstHeaderValue(requestHeaders.get("x-forwarded-host")) ?? firstHeaderValue(requestHeaders.get("host"));
  if (host) {
    const protocol = firstHeaderValue(requestHeaders.get("x-forwarded-proto")) ?? "http";
    return `${protocol}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
