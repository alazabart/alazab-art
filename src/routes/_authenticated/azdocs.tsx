// src/routes/_authenticated/azdocs.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listSalesDocs, getSalesDoc } from "@/lib/azdocs/daftra.functions";
import { SalesDocPrint } from "@/components/azdocs/SalesDocPrint";
import { docCode, formatCurrency } from "@/lib/azdocs/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  FileText,
  Printer,
  Search,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/azdocs")({
  component: AzDocsPage,
});

function AzDocsPage() {
  const [kind, setKind] = useState<"invoice" | "quote">("invoice");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ["azdocs", kind, page, search],
    queryFn: () => listSalesDocs({ data: { kind, page, q: search } }),
  });

  const docQuery = useQuery({
    queryKey: ["azdoc-detail", kind, selectedId],
    queryFn: () => getSalesDoc({ data: { kind, id: selectedId! } }),
    enabled: Boolean(selectedId),
  });
  const pageCount = listQuery.data?.ok ? listQuery.data.pageCount : 1;

  if (selectedId && docQuery.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" /> جارٍ تحميل المستند...
      </div>
    );
  }

  if (selectedId && docQuery.data?.ok) {
    return (
      <div className="py-6">
        <div className="mb-4 flex justify-center gap-2 print:hidden">
          <Button variant="outline" onClick={() => setSelectedId(null)}>
            رجوع للمستندات
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> طباعة A4
          </Button>
        </div>
        <SalesDocPrint doc={docQuery.data.doc} />
      </div>
    );
  }

  if (selectedId) {
    return (
      <div className="mx-auto max-w-2xl p-6" dir="rtl">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <AlertCircle className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            {docQuery.data && "message" in docQuery.data
              ? docQuery.data.message
              : "تعذر تحميل المستند. تحقق من الاتصال بدفترة ثم حاول مرة أخرى."}
          </p>
          <Button className="mt-5" variant="outline" onClick={() => setSelectedId(null)}>
            رجوع للمستندات
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
            <FileText className="size-4" aria-hidden="true" /> مستندات الشركة
          </span>
          <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            الفواتير وعروض الأسعار
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            ابحث في مستندات المبيعات وعاين قالب الطباعة الرسمي بحجم A4.
          </p>
        </div>
      </header>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <Tabs
          value={kind}
          onValueChange={(v) => {
            setKind(v as "invoice" | "quote");
            setSelectedId(null);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="invoice">الفواتير</TabsTrigger>
            <TabsTrigger value="quote">عروض الأسعار</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="absolute right-3 top-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="البحث في الفواتير وعروض الأسعار"
            placeholder="بحث بالرقم أو اسم العميل..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="pr-9"
          />
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> جاري سحب المستندات من دفترة...
        </div>
      ) : !listQuery.data?.ok ? (
        <div role="status" className="rounded-2xl border border-border bg-card p-6 text-center">
          <AlertCircle className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 font-semibold">
            {listQuery.data?.code === "not_configured"
              ? "المزامنة غير مفعّلة"
              : "تعذر تحميل المستندات"}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {listQuery.data?.code === "not_configured"
              ? "لا يوجد اتصال مباشر بدفترة في هذه النسخة، لذلك لا تُعرض بيانات تجريبية أو غير موثقة. ستبقى قوالب الطباعة متاحة عند تفعيل مصدر البيانات لاحقًا."
              : listQuery.data?.message || "تعذر جلب المستندات حاليًا. حاول مرة أخرى لاحقًا."}
          </p>
        </div>
      ) : listQuery.data.rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">لا توجد مستندات مطابقة</p>
          <p className="mt-1 text-sm text-muted-foreground">غيّر نوع المستند أو كلمة البحث.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="border-b bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="p-3">رقم المستند</th>
                  <th className="p-3">العميل</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-[#030957]">
                      {docCode(kind, row.date, row.number)}
                    </td>
                    <td className="p-3">{row.clientName}</td>
                    <td className="p-3 text-slate-500">{row.date}</td>
                    <td className="p-3 font-mono font-semibold">
                      {formatCurrency(row.total, row.currency, "ar-EG")}
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedId(row.id)}
                        className="gap-1 text-[#030957]"
                      >
                        <Printer className="h-3.5 w-3.5" /> معاينة وطباعة
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {listQuery.data.pageCount > 1 && (
            <nav
              aria-label="صفحات المستندات"
              className="flex items-center justify-between border-t border-border px-4 py-3"
            >
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || listQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronRight className="size-4" aria-hidden="true" /> السابق
              </Button>
              <span aria-live="polite" className="text-xs text-muted-foreground">
                صفحة {listQuery.data.page} من {listQuery.data.pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount || listQuery.isFetching}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                التالي <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
