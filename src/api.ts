export type ServiceName = "auth" | "payment";

export interface BackendSuccess {
  service: string;
  target: string;
  upstreamStatus: number;
  body: string;
}

export interface BackendError {
  service: string;
  target?: string;
  error: string;
}

export type BackendResponse = BackendSuccess | BackendError;

export function isBackendError(
  data: BackendResponse,
): data is BackendError {
  return "error" in data && Boolean(data.error);
}

// The ingress/gateway routes /api/auth and /api/payment to the backend
// services. In local dev, Vite's proxy (see vite.config.ts) forwards them.
export async function callBackend(
  service: ServiceName,
): Promise<BackendResponse> {
  const res = await fetch(`/api/${service}`);
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await res.json()) as BackendResponse;
  }

  // Fallback for non-JSON responses (e.g. a plain-text backend reply).
  const text = await res.text();
  if (res.ok) {
    return {
      service,
      target: `/api/${service}`,
      upstreamStatus: res.status,
      body: text,
    };
  }
  return { service, target: `/api/${service}`, error: text || res.statusText };
}
