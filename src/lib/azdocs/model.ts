import type { PaymentProfileId } from "./company";

export type SalesKind = "invoice" | "quote";

export interface LineItem {
  code: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imageUrl: string | null;
}

export interface SalesDoc {
  kind: SalesKind;
  /** Daftra record id (or "sample"). */
  id: string;
  /** Daftra's own number. */
  number: string;
  date: string; // YYYY-MM-DD
  currency: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  representative: string;
  section: string;
  paymentProfile: PaymentProfileId;
  items: LineItem[];
  subtotal: number;
  tax: number;
  paid: number;
  /** Amount still due: total with tax minus paid. */
  finalTotal: number;
  /** Online link encoded in the QR code (Daftra preview), when available. */
  qrValue: string | null;
}

export const KIND_PREFIX: Record<SalesKind, string> = { invoice: "INV", quote: "QUT" };
export const KIND_TITLE: Record<SalesKind, string> = { invoice: "INVOICE", quote: "QUOTATION" };

/**
 * Code printed in the yellow tab: AZ-{INV|QUT}-YYYY-MM-{10000 + Daftra number}.
 * Non-numeric Daftra numbers are kept as they are after the month.
 */
export function docCode(kind: SalesKind, date: string, number: string): string {
  const [y, m] = ymOf(date);
  const n = number.trim();
  const seq = /^\d+$/.test(n) ? String(10000 + Number(n)) : n || "00000";
  return `AZ-${KIND_PREFIX[kind]}-${y}-${m}-${seq}`;
}

export function ymOf(date: string): [string, string] {
  const match = /^(\d{4})-(\d{2})/.exec(date);
  if (match) return [match[1]!, match[2]!];
  const d = new Date();
  return [String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, "0")];
}

/** Rows that fit each page type of the multi-page design. */
export const PAGE_ROWS = { single: 3, first: 5, middle: 7, last: 5 } as const;

export interface PagePlan {
  start: number;
  end: number; // exclusive
  /** Empty rows to draw so the grid keeps its designed height. */
  capacity: number;
  header: boolean;
  totals: boolean;
}

/**
 * Splits line items across A4 pages: a one-page layout when they fit, otherwise
 * a first page with the header, full middle pages, and a last page with totals.
 * The last page always carries at least one item.
 */
export function paginate(count: number): PagePlan[] {
  const n = Math.max(0, Math.floor(count));
  if (n <= PAGE_ROWS.single) {
    return [{ start: 0, end: n, capacity: PAGE_ROWS.single, header: true, totals: true }];
  }
  const pages: PagePlan[] = [];
  const firstTake = Math.min(PAGE_ROWS.first, n - 1);
  pages.push({ start: 0, end: firstTake, capacity: PAGE_ROWS.first, header: true, totals: false });
  let at = firstTake;
  while (n - at > PAGE_ROWS.last) {
    const take = Math.min(PAGE_ROWS.middle, n - at - 1);
    pages.push({ start: at, end: at + take, capacity: PAGE_ROWS.middle, header: false, totals: false });
    at += take;
  }
  pages.push({ start: at, end: n, capacity: PAGE_ROWS.last, header: false, totals: true });
  return pages;
}

export function money(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function qty(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

/* ---------- Daftra → SalesDoc ---------- */

type Raw = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v)).trim();
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v.map(obj) : v && typeof v === "object" ? Object.values(v as Raw).map(obj) : []);

export interface ProductInfo {
  code: string;
  imageUrl: string | null;
}

/** Converts a Daftra single invoice / estimate response (`data`) into the template model. */
export function normalizeDaftraDoc(
  kind: SalesKind,
  data: Raw,
  products: Record<string, ProductInfo> = {},
): SalesDoc {
  const head = obj(data[kind === "invoice" ? "Invoice" : "Estimate"] ?? data["Invoice"]);
  const client = obj(data["Client"]);
  const items = arr(data["InvoiceItem"] ?? data["EstimateItem"]);

  const lineItems: LineItem[] = items.map((it) => {
    const quantity = num(it["quantity"]);
    const unitPrice = num(it["unit_price"]);
    const subtotal = it["subtotal"] !== undefined ? num(it["subtotal"]) : quantity * unitPrice - num(it["calculated_discount"]);
    const p = products[str(it["product_id"])];
    return {
      code: p?.code ?? "",
      name: str(it["item"]),
      description: str(it["description"]),
      quantity,
      unitPrice,
      total: subtotal,
      imageUrl: p?.imageUrl ?? null,
    };
  });

  const itemsSum = lineItems.reduce((s, i) => s + i.total, 0);
  const subtotal = head["summary_subtotal"] !== undefined ? num(head["summary_subtotal"]) - num(head["summary_discount"]) : itemsSum;
  const grand = head["summary_total"] !== undefined ? num(head["summary_total"]) : subtotal;
  const tax = Math.max(0, round2(grand - subtotal));
  const paid = num(head["summary_paid"]);

  const name =
    str(head["client_business_name"]) ||
    [str(head["client_first_name"]), str(head["client_last_name"])].filter(Boolean).join(" ") ||
    str(client["business_name"]);
  const address = [head["client_address1"] ?? client["address1"], head["client_address2"] ?? client["address2"], head["client_city"] ?? client["city"]]
    .map(str)
    .filter(Boolean)
    .join("، ");
  const staff = obj(data["Staff"] ?? data["SalesPerson"]);

  return {
    kind,
    id: str(head["id"]),
    number: str(head["no"]),
    date: str(head["date"]).slice(0, 10),
    currency: str(head["currency_code"]) || "EGP",
    clientName: name,
    clientPhone: str(client["phone2"]) || str(client["phone1"]) || str(head["client_phone"]),
    clientAddress: address,
    representative: str(staff["name"]) || str(staff["full_name"]),
    section: "",
    paymentProfile: "combined",
    items: lineItems,
    subtotal: round2(subtotal),
    tax,
    paid: round2(paid),
    finalTotal: round2(Math.max(0, grand - paid)),
    qrValue: str(head["invoice_html_url"]) || str(head["estimate_html_url"]) || null,
  };
}

/** Pulls the product code and first photo out of a Daftra single-product response (`data`). */
export function normalizeDaftraProduct(data: Raw): ProductInfo {
  const product = obj(data["Product"]);
  const images = arr(data["ProductImage"]);
  let imageUrl: string | null = null;
  for (const img of images) {
    for (const key of ["file_full_path", "full_path", "url", "image", "file"]) {
      const v = str(img[key]);
      if (/^https?:\/\//.test(v)) {
        imageUrl = v;
        break;
      }
    }
    if (imageUrl) break;
  }
  return { code: str(product["product_code"]) || str(product["barcode"]), imageUrl };
}

export interface SalesListRow {
  id: string;
  number: string;
  date: string;
  clientName: string;
  total: number;
  currency: string;
  paymentStatus: string;
}

export function normalizeDaftraListRow(kind: SalesKind, row: Raw): SalesListRow {
  const head = obj(row[kind === "invoice" ? "Invoice" : "Estimate"] ?? row["Invoice"]);
  const client = obj(row["Client"]);
  return {
    id: str(head["id"]),
    number: str(head["no"]),
    date: str(head["date"]).slice(0, 10),
    clientName:
      str(head["client_business_name"]) ||
      [str(head["client_first_name"]), str(head["client_last_name"])].filter(Boolean).join(" ") ||
      str(client["business_name"]),
    total: num(head["summary_total"]),
    currency: str(head["currency_code"]) || "EGP",
    paymentStatus: str(head["payment_status"]),
  };
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

/* ---------- Sample (shown before Daftra is connected) ---------- */

export function sampleSalesDoc(kind: SalesKind, itemCount = 3): SalesDoc {
  const catalogue: Omit<LineItem, "total">[] = [
    { code: "SL-PL-6060", name: "Panel light 60×60 — 48W", description: "", quantity: 24, unitPrice: 850, imageUrl: null },
    { code: "SL-TR-12", name: "Track spot 12W — black", description: "", quantity: 40, unitPrice: 420, imageUrl: null },
    { code: "AZ-GYP-01", name: "Gypsum board ceiling — supply & install (m²)", description: "", quantity: 120, unitPrice: 310, imageUrl: null },
    { code: "SL-LS-5M", name: "LED strip 5m — warm white", description: "", quantity: 30, unitPrice: 260, imageUrl: null },
    { code: "AZ-PNT-02", name: "Wall painting — Jotun (m²)", description: "", quantity: 300, unitPrice: 95, imageUrl: null },
    { code: "SL-DL-9", name: "Downlight 9W — recessed", description: "", quantity: 60, unitPrice: 180, imageUrl: null },
  ];
  const items = Array.from({ length: itemCount }, (_, i) => {
    const c = catalogue[i % catalogue.length]!;
    return { ...c, total: c.quantity * c.unitPrice };
  });
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const tax = round2(subtotal * 0.14);
  const paid = kind === "invoice" ? 20000 : 0;
  return {
    kind,
    id: "sample",
    number: "1",
    date: new Date().toISOString().slice(0, 10),
    currency: "EGP",
    clientName: "شركة النيل للتطوير العقاري",
    clientPhone: "+20 100 000 0000",
    clientAddress: "التجمع الخامس، القاهرة الجديدة",
    representative: "م. أحمد سالم",
    section: kind === "invoice" ? "Smart Lights" : "Finishing works",
    paymentProfile: "combined",
    items,
    subtotal,
    tax,
    paid,
    finalTotal: round2(subtotal + tax - paid),
    qrValue: null,
  };
}
