import { createClient } from "@supabase/supabase-js";

export async function handleDaftraSync(req: Request) {
  // 1. التحقق من سر أمان الطلب القادم من دفترة أو المهام المجدولة
  const authHeader = req.headers.get("x-daftra-secret") || req.headers.get("authorization");
  if (authHeader !== process.env.DAFTRA_SYNC_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // صلاحية خادم للكتابة
  );

  try {
    const payload = await req.json();
    const invoice = payload.invoice || payload;

    // 2. توحيد صيغة الحقول وحفظها (Upsert)
    const { error } = await supabase.from("daftra_invoices").upsert({
      id: invoice.id,
      doc_number: invoice.number || invoice.id,
      client_name: invoice.client_business_name || invoice.client_name,
      client_phone: invoice.client_phone,
      issue_date: invoice.date,
      subtotal: invoice.sub_total,
      tax_total: invoice.tax,
      final_total: invoice.total,
      paid_amount: invoice.paid || 0,
      currency: invoice.currency_code || "EGP",
      status: invoice.status,
      items_json: invoice.invoice_items || [],
      raw_data: invoice,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, id: invoice.id }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
