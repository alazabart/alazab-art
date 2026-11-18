// src/components/azdocs/SalesDocPrint.tsx
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { SalesDoc } from "@/lib/azdocs/model";
import { COMPANY, BANK_ACCOUNTS, DOC_TERMS, formatMoneyEgp, tafqeetEgp } from "@/lib/azdocs/company";
import logoUrl from "@/assets/alazab-logo.png.asset.json";
import watermarkUrl from "@/assets/az-watermark.png.asset.json";
import { Button } from "@/components/ui/button";
import { Printer, ArrowRight } from "lucide-react";

interface Props {
  doc: SalesDoc;
  onBack?: () => void;
}

export function SalesDocPrint({ doc, onBack }: Props) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  useEffect(() => {
    const payload = [
      `المورد: ${COMPANY.nameAr}`,
      `الرقم الضريبي: ${COMPANY.taxNumber}`,
      `رقم المستند: ${doc.formattedNumber}`,
      `التاريخ: ${doc.issueDate}`,
      `الإجمالي: ${doc.total} ج.م`,
      `الضريبة: ${doc.taxAmount} ج.م`,
    ].join("\n");

    QRCode.toDataURL(payload, { width: 140, margin: 1 })
      .then(setQrCodeDataUrl)
      .catch(console.error);
  }, [doc]);

  return (
    <div className="bg-slate-100 min-h-screen py-8 print:bg-white print:p-0">
      {/* شريط الإجراءات قبل الطباعة */}
      <div className="max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-4 print:hidden">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowRight className="h-4 w-4" /> رجوع للمستندات
          </Button>
        )}
        <Button onClick={() => window.print()} className="bg-[#030957] text-[#FFB900] hover:bg-[#030957]/90 gap-2">
          <Printer className="h-4 w-4" /> طباعة المستند (A4 / PDF)
        </Button>
      </div>

      {/* ورقة المستند A4 */}
      <div className="a4-page relative mx-auto bg-white text-[#030957] shadow-xl p-8 print:shadow-none print:m-0 print:w-full">
        {/* خلفية العلامة المائية */}
        <img
          src={watermarkUrl}
          alt="Watermark"
          className="absolute inset-0 m-auto w-2/3 opacity-5 pointer-events-none select-none z-0"
        />

        {/* الشريط العلوي والشعار */}
        <div className="relative z-10 flex justify-between items-start border-b-4 border-[#FFB900] pb-4 mb-6">
          <div className="flex items-center gap-4">
            <img src={logoUrl} alt={COMPANY.nameEn} className="h-16 object-contain" />
            <div>
              <h1 className="text-xl font-bold font-ibm-plex text-[#030957]">{COMPANY.nameAr}</h1>
              <p className="text-xs text-slate-500">{COMPANY.taglineAr}</p>
              <p className="text-xs text-slate-500 font-mono">س.ت: {COMPANY.commercialReg} | ب.ض: {COMPANY.taxNumber}</p>
            </div>
          </div>
          <div className="text-left font-mono">
            <span className="inline-block bg-[#FFB900] text-[#030957] font-bold px-3 py-1 rounded text-sm mb-1">
              {doc.kind === "invoice" ? "فاتورة ضريبية / TAX INVOICE" : "عرض أسعار / QUOTATION"}
            </span>
            <div className="text-xs font-semibold mt-1">الرقم: {doc.formattedNumber}</div>
            <div className="text-xs text-slate-500">التاريخ: {doc.issueDate}</div>
          </div>
        </div>

        {/* بطاقة العميل والمشروع */}
        <div className="relative z-10 grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded p-4 mb-6 text-sm">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">بيانات العميل:</span>
            <div className="font-bold text-base">{doc.clientName}</div>
            {doc.clientTaxNumber && <div className="text-xs text-slate-600">الرقم الضريبي: {doc.clientTaxNumber}</div>}
            {doc.clientAddress && <div className="text-xs text-slate-600">العنوان: {doc.clientAddress}</div>}
          </div>
          <div className="text-left">
            <span className="text-xs font-bold text-slate-400 block mb-1">تفاصيل الدفع:</span>
            <div>شروط الدفع: {doc.paymentTerms || "حسب الاتفاق"}</div>
            {doc.dueDate && <div>تاريخ الاستحقاق: {doc.dueDate}</div>}
          </div>
        </div>

        {/* جدول بنود الأعمال */}
        <table className="relative z-10 w-full text-right border-collapse text-xs mb-6">
          <thead>
            <tr className="bg-[#030957] text-white">
              <th className="p-2 w-10 text-center">#</th>
              <th className="p-2">البند والمواصفات</th>
              <th className="p-2 w-16 text-center">الكمية</th>
              <th className="p-2 w-20 text-center">سعر الوحدة</th>
              <th className="p-2 w-20 text-center">الضريبة</th>
              <th className="p-2 w-24 text-center">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200 odd:bg-white even:bg-slate-50/50">
                <td className="p-2 text-center text-slate-500 font-mono">{idx + 1}</td>
                <td className="p-2">
                  <div className="font-semibold">{item.name}</div>
                  {item.description && <div className="text-[11px] text-slate-500">{item.description}</div>}
                </td>
                <td className="p-2 text-center font-mono">{item.quantity}</td>
                <td className="p-2 text-center font-mono">{formatMoneyEgp(item.unitPrice)}</td>
                <td className="p-2 text-center font-mono">{item.taxPercent}%</td>
                <td className="p-2 text-center font-mono font-semibold">{formatMoneyEgp(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ملخص الإجماليات والتفقيط والـ QR */}
        <div className="relative z-10 grid grid-cols-2 gap-6 items-start mb-6">
          <div className="border border-slate-200 rounded p-3 bg-slate-50">
            <div className="text-xs font-bold mb-1">المبلغ بالحروف:</div>
            <div className="text-xs text-slate-700 leading-relaxed font-semibold">
              {tafqeetEgp(doc.total)}
            </div>
            {qrCodeDataUrl && (
              <div className="mt-4 flex items-center gap-3">
                <img src={qrCodeDataUrl} alt="QR Code" className="w-20 h-20 border border-slate-200 p-1 bg-white" />
                <span className="text-[10px] text-slate-500 leading-tight">
                  رمز التحقق الإلكتروني المعتمد من هيئة الضرائب وشركة العزب للمقاولات
                </span>
              </div>
            )}
          </div>

          <div className="border border-slate-200 rounded overflow-hidden text-xs">
            <div className="flex justify-between p-2 border-b">
              <span>المجموع الفرعي:</span>
              <span className="font-mono">{formatMoneyEgp(doc.subtotal)} ج.م</span>
            </div>
            {doc.discountAmount > 0 && (
              <div className="flex justify-between p-2 border-b text-red-600">
                <span>الخصم:</span>
                <span className="font-mono">-{formatMoneyEgp(doc.discountAmount)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between p-2 border-b">
              <span>ضريبة القيمة المضافة (14%):</span>
              <span className="font-mono">{formatMoneyEgp(doc.taxAmount)} ج.م</span>
            </div>
            <div className="flex justify-between p-3 bg-[#030957] text-[#FFB900] font-bold text-sm">
              <span>الإجمالي النهائي:</span>
              <span className="font-mono">{formatMoneyEgp(doc.total)} ج.م</span>
            </div>
          </div>
        </div>

        {/* الحسابات البنكية المعتمدة */}
        <div className="relative z-10 border-t border-slate-200 pt-3 mb-4">
          <div className="text-[11px] font-bold text-[#030957] mb-2">طرق الدفع والحسابات البنكية المعتمدة:</div>
          <div className="grid grid-cols-3 gap-2 text-[10px] bg-slate-50 p-2 rounded border border-slate-200 font-mono">
            <div>
              <span className="font-bold text-[#030957] block">{BANK_ACCOUNTS.cib.bankName}</span>
              <span>الحساب: {BANK_ACCOUNTS.cib.accountNumber}</span>
              <br />
              <span>IBAN: {BANK_ACCOUNTS.cib.iban}</span>
            </div>
            <div>
              <span className="font-bold text-[#030957] block">{BANK_ACCOUNTS.qnb.bankName}</span>
              <span>الحساب: {BANK_ACCOUNTS.qnb.accountNumber}</span>
              <br />
              <span>IBAN: {BANK_ACCOUNTS.qnb.iban}</span>
            </div>
            <div>
              <span className="font-bold text-[#030957] block">انستاباي Instapay</span>
              <span>الرقم: {BANK_ACCOUNTS.instapay.phone}</span>
              <br />
              <span>IPA: {BANK_ACCOUNTS.instapay.username}</span>
            </div>
          </div>
        </div>

        {/* شروط وأحكام التعامل */}
        <div className="relative z-10 text-[9px] text-slate-500 border-t border-slate-200 pt-2 mb-6">
          <div className="font-bold text-slate-700 mb-1">الشروط والأحكام:</div>
          <ol className="list-decimal list-inside space-y-0.5">
            {DOC_TERMS.map((term, i) => (
              <li key={i}>{term}</li>
            ))}
          </ol>
        </div>

        {/* التوقيع والختم */}
        <div className="relative z-10 flex justify-between items-end text-center text-xs pt-4 border-t border-dashed border-slate-300">
          <div className="w-48">
            <div className="mb-8 font-semibold">المستلم / العميل</div>
            <div className="border-b border-slate-400 w-36 mx-auto"></div>
          </div>
          <div className="w-48">
            <div className="mb-8 font-semibold">إدارة الحسابات والمراجعة</div>
            <div className="border-b border-slate-400 w-36 mx-auto"></div>
          </div>
          <div className="w-48">
            <div className="mb-8 font-semibold">المدير العام / الاعتماد</div>
            <div className="border-b border-slate-400 w-36 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
