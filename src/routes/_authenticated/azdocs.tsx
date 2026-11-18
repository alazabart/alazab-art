// src/routes/_authenticated/azdocs.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listSalesDocs, getSalesDoc } from "@/lib/azdocs/daftra.functions";
import { SalesDocPrint } from "@/components/azdocs/SalesDocPrint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Printer, Search, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/azdocs")({
  component: AzDocsPage,
});

function AzDocsPage() {
  const [kind, setKind] = useState<"invoice" | "quote">("invoice");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const listQuery = useQuery({
    queryKey: ["azdocs", kind, search],
    queryFn: () => listSalesDocs({ data: { kind, page: 1, q: search } }),
  });

  const docQuery = useQuery({
    queryKey: ["azdoc-detail", kind, selectedId],
    queryFn: () => getSalesDoc({ data: { kind, id: selectedId! } }),
    enabled: Boolean(selectedId),
  });

  if (selectedId && docQuery.data?.ok) {
    return <SalesDocPrint doc={docQuery.data.doc} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#030957]">مستندات دفترة وقوالب الطباعة</h1>
          <p className="text-sm text-slate-500">سحب مباشر للفواتير وعروض الأسعار من alazab-co.daftra.com وطباعتها بقوالب A4 الرسمية</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-6">
        <Tabs value={kind} onValueChange={(v) => { setKind(v as "invoice" | "quote"); setSelectedId(null); }}>
          <TabsList>
            <TabsTrigger value="invoice">الفواتير</TabsTrigger>
            <TabsTrigger value="quote">عروض الأسعار</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-72">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="بحث بالرقم أو اسم العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> جاري سحب المستندات من دفترة...
        </div>
      ) : !listQuery.data?.ok ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded p-4 text-sm">
          {listQuery.data?.message || "يرجى التأكد من ضبط DAFTRA_API_KEY في إعدادات البيئة."}
        </div>
      ) : (
        <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
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
                  <td className="p-3 font-mono font-bold text-[#030957]">{row.formattedNumber}</td>
                  <td className="p-3">{row.clientName}</td>
                  <td className="p-3 text-slate-500">{row.date}</td>
                  <td className="p-3 font-mono font-semibold">{row.total} ج.م</td>
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
      )}
    </div>
  );
}
