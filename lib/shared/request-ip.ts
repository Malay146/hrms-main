import { headers } from "next/headers";

export function ipFromHeaders(requestHeaders: Headers) {
  const forwarded = requestHeaders.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return requestHeaders.get("x-real-ip")?.trim() || "local";
}

export async function clientIp() {
  return ipFromHeaders(await headers());
}
