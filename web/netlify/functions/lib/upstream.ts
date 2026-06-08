import { getRuntimeConfig } from "./config";

export async function fetchUpstreamJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { proofFirstApiBase } = getRuntimeConfig();
  const targetUrl = new URL(path, `${proofFirstApiBase}/`);
  const response = await fetch(targetUrl, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof payload === "string" ? payload : payload?.detail || payload?.error || "Upstream request failed");
  }

  return payload as T;
}
