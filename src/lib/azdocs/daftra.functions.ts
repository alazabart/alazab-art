import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeDaftraDoc,
  normalizeDaftraListRow,
  normalizeDaftraProduct,
  type ProductInfo,
  type SalesDoc,
  type SalesListRow,
} from "./model";

export type DaftraFailure = { ok: false; code: string; message: string };

const kindSchema = z.enum(["invoice", "quote"]);
const PATH = { invoice: "invoices", quote: "estimates" } as const;

async function ensureStaff(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  return data === true;
}

function failure(e: unknown): DaftraFailure {
  if (e && typeof e === "object" && "code" in e && "message" in e) {
    return { ok: false, code: String((e as { code: unknown }).code), message: String((e as { message: unknown }).message) };
  }
  console.error(e);
  return { ok: false, code: "upstream", message: "Daftra request failed." };
}

const listSchema = z.object({
  kind: kindSchema,
  page: z.number().int().min(1).max(10000).default(1),
  q: z.string().trim().max(100).default(""),
});

/** Staff-only: one page (20) of Daftra invoices or estimates, newest first. */
export const listSalesDocs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof listSchema>) => listSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; rows: SalesListRow[]; page: number; pageCount: number } | DaftraFailure> => {
    if (!(await ensureStaff(context))) return { ok: false, code: "forbidden", message: "Staff only." };
    try {
      const { daftraGet } = await import("./daftra.server");
      const query: Record<string, string | number> = { page: data.page, limit: 20 };
      if (data.q) query[data.kind === "invoice" ? "keywords" : "name"] = data.q;
      const body = await daftraGet(`/${PATH[data.kind]}.json`, query);
      const rows = Array.isArray(body["data"]) ? (body["data"] as Record<string, unknown>[]) : [];
      const pg = (body["pagination"] ?? {}) as Record<string, unknown>;
      return {
        ok: true,
        rows: rows.map((r) => normalizeDaftraListRow(data.kind, r)),
        page: Number(pg["page"] ?? data.page) || data.page,
        pageCount: Number(pg["page_count"] ?? 1) || 1,
      };
    } catch (e) {
      return failure(e);
    }
  });

const getSchema = z.object({ kind: kindSchema, id: z.string().regex(/^\d{1,12}$/) });

/** Staff-only: a single Daftra invoice / estimate with line items, product codes and photos. */
export const getSalesDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof getSchema>) => getSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; doc: SalesDoc } | DaftraFailure> => {
    if (!(await ensureStaff(context))) return { ok: false, code: "forbidden", message: "Staff only." };
    try {
      const { daftraGet } = await import("./daftra.server");
      const body = await daftraGet(`/${PATH[data.kind]}/${data.id}.json`);
      const raw = (body["data"] ?? {}) as Record<string, unknown>;
      const itemsRaw = raw["InvoiceItem"] ?? raw["EstimateItem"];
      const items = Array.isArray(itemsRaw) ? (itemsRaw as Record<string, unknown>[]) : [];
      const productIds = [...new Set(items.map((i) => String(i["product_id"] ?? "")).filter((id) => /^\d+$/.test(id) && id !== "0"))].slice(0, 40);

      // Daftra is rate limited: fetch product details a few at a time.
      const products: Record<string, ProductInfo> = {};
      for (let i = 0; i < productIds.length; i += 3) {
        await Promise.all(
          productIds.slice(i, i + 3).map(async (pid) => {
            try {
              const p = await daftraGet(`/products/${pid}.json`);
              products[pid] = normalizeDaftraProduct((p["data"] ?? {}) as Record<string, unknown>);
            } catch {
              // A missing product only loses its code/photo.
            }
          }),
        );
      }
      return { ok: true, doc: normalizeDaftraDoc(data.kind, raw, products) };
    } catch (e) {
      return failure(e);
    }
  });

/** Staff-only: whether Daftra is connected and reachable, with the account name. */
export const daftraStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; business: string } | DaftraFailure> => {
    if (!(await ensureStaff(context))) return { ok: false, code: "forbidden", message: "Staff only." };
    try {
      const { daftraGet, daftraConfigured } = await import("./daftra.server");
      if (!daftraConfigured()) return { ok: false, code: "not_configured", message: "Daftra is not connected yet." };
      const body = await daftraGet("/site_info.json");
      const site = ((body["data"] as Record<string, unknown> | undefined)?.["Site"] ?? {}) as Record<string, unknown>;
      return { ok: true, business: String(site["business_name"] ?? site["subdomain"] ?? "Daftra") };
    } catch (e) {
      return failure(e);
    }
  });
