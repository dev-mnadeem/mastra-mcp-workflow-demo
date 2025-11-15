/**
 * The one place the browser learns where the API lives.
 *
 * `NEXT_PUBLIC_API_BASE` is inlined at build time, so the fallback has to be a
 * literal rather than a runtime lookup. It matches the backend's default port.
 */
export const DEFAULT_API_BASE = "http://localhost:7271";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || DEFAULT_API_BASE
).replace(/\/$/, "");

export const endpoints = {
  chat: `${API_BASE}/api/chat`,
  tools: `${API_BASE}/api/tools`,
  health: `${API_BASE}/healthz`,
} as const;
