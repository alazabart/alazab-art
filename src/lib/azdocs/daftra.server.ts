// Server-only Daftra client. Requests go through Lovable's connector gateway,
// which holds the account's API key; app code only carries the connection key.

// Filled in once the Daftra connection exists (connector id + its env var).
const GATEWAY_URL = "https://connector-gateway.lovable.dev/daftra";
const CONNECTION_KEY_ENV = "DAFTRA_API_KEY";

export class DaftraError extends Error {
  constructor(
    public code: "not_configured" | "unauthorized" | "not_found" | "rate_limited" | "upstream",
    message: string,
  ) {
    super(message);
  }
}

export function daftraConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env[CONNECTION_KEY_ENV]);
}

/** GET a Daftra api2 path such as `/invoices.json`; returns the parsed JSON body. */
export async function daftraGet(path: string, query: Record<string, string | number | undefined> = {}): Promise<Record<string, unknown>> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env[CONNECTION_KEY_ENV];
  if (!lovableKey || !connectionKey) {
    throw new DaftraError("not_configured", "Daftra is not connected yet.");
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params.set(k, String(v));
  const url = `${GATEWAY_URL}${path}${params.size ? `?${params}` : ""}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Daftra request failed [${res.status}] ${path}: ${body.slice(0, 500)}`);
    if (res.status === 401 || res.status === 403) throw new DaftraError("unauthorized", `Daftra refused the request [${res.status}]: ${body.slice(0, 200)}`);
    if (res.status === 404) throw new DaftraError("not_found", "Not found in Daftra.");
    if (res.status === 429) throw new DaftraError("rate_limited", "Daftra is busy, try again in a minute.");
    throw new DaftraError("upstream", `Daftra error [${res.status}]: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}
