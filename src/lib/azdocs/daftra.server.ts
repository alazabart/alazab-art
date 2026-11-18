// src/lib/azdocs/daftra.server.ts
const SUBDOMAIN = "alazab-co";
const BASE_URL = `https://${SUBDOMAIN}.daftra.com/api2`;
const API_KEY_ENV = "DAFTRA_API_KEY";

export class DaftraError extends Error {
  constructor(
    public code: "not_configured" | "unauthorized" | "not_found" | "rate_limited" | "upstream",
    message: string,
  ) {
    super(message);
  }
}

export function daftraConfigured(): boolean {
  return Boolean(process.env[API_KEY_ENV]);
}

/** طلب GET لنقاط نهاية دفترة api2 مثل `/invoices.json` */
export async function daftraGet(
  path: string,
  query: Record<string, string | number | undefined> = {}
): Promise<Record<string, unknown>> {
  const apiKey = process.env[API_KEY_ENV];
  if (!apiKey) {
    throw new DaftraError("not_configured", "مفتاح API الخاص بدفترة غير مهيأ بعد.");
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }

  const url = `${BASE_URL}${path}${params.size ? `?${params}` : ""}`;

  const res = await fetch(url, {
    headers: {
      APIKEY: apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Daftra error [${res.status}] ${path}: ${body.slice(0, 500)}`);
    if (res.status === 401 || res.status === 403) {
      throw new DaftraError("unauthorized", "مفتاح API غير صالح أو غير مصرح له.");
    }
    if (res.status === 404) throw new DaftraError("not_found", "المستند غير موجود في دفترة.");
    if (res.status === 429) throw new DaftraError("rate_limited", "تم تجاوز معدل الطلبات المسموح في دفترة.");
    throw new DaftraError("upstream", `خطأ من مزود الخدمة دفترة [${res.status}].`);
  }

  return (await res.json()) as Record<string, unknown>;
}
