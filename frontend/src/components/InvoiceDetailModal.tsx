import { Invoice } from "../types";
import { Leaf } from "lucide-react";
import { useTranslation } from "../context/LanguageContext";

interface InvoiceDetailModalProps {
  invoice: Invoice;
}

export default function InvoiceDetailModal({ invoice }: InvoiceDetailModalProps) {
  const { dt } = useTranslation();
  // Date formatting helpers
  const fmtDate = (dStr: string) => {
    try {
      return new Date(dStr).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      });
    } catch {
      return dStr;
    }
  };

  const fNum = (n: number) => `₹${Number(n).toFixed(2)}`;

  return (
    <div className="bg-white p-6 max-sm:p-4 text-xs font-sans text-gray-800 space-y-4 max-w-full print:p-0 print:text-black print:max-w-none print:shadow-none print:border-0" id="raw-paper-invoice-print-block">
      {/* Receipt Header Grid */}
      <div className="flex justify-between items-start border-b border-gray-200 pb-4 max-sm:flex-col max-sm:gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-sm mb-1 uppercase tracking-wider print:text-black">
            <Leaf className="w-5 h-5 shrink-0" />
            <span>MandiMate Wholesalers</span>
          </div>
          <p className="text-[10px] text-gray-400 font-medium">Stall No. 5, Wholesale Veg Market Yard</p>
          <p className="text-[10px] text-gray-400 font-medium">Pune - 411037 | Mobile: +91 9988776655</p>
        </div>
        <div className="text-right max-sm:text-left">
          <h2 className="font-extrabold text-base text-gray-900 leading-none">INVOICE BILL</h2>
          <p className="font-mono text-gray-600 font-bold mt-1 text-[11px]">{invoice.invoiceNumber}</p>
          <p className="text-[10px] text-gray-400 mt-1">{fmtDate(invoice.createdAt)}</p>
        </div>
      </div>

      {/* Customer Information Block */}
      <div className="grid grid-cols-2 gap-4 border-b border-gray-100 pb-4">
        <div>
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bill To (Wholesale Customer):</h4>
          <p className="font-bold text-gray-950 text-sm leading-none">{dt(invoice.customerName)}</p>
          {invoice.customerBusiness && (
            <p className="font-semibold text-emerald-800 mt-1 print:text-black">{dt(invoice.customerBusiness)}</p>
          )}
          <p className="text-gray-500 font-mono mt-1">Ph: {invoice.customerMobile}</p>
        </div>
        <div className="text-right flex flex-col justify-end">
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 font-medium font-sans">Payment Method: <span className="font-bold text-gray-900">{invoice.paymentMethod}</span></p>
            <p className="text-[10px] text-gray-500 font-medium font-sans">
              Status: 
              <span className={`ml-1 px-2 py-0.5 rounded-sm text-[9px] font-extrabold uppercase ${
                invoice.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-800" : (invoice.paymentStatus === "Partial" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800")
              }`}>
                {invoice.paymentStatus}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Vegetable details bill table */}
      <div>
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-900 bg-slate-50 text-[10px] text-slate-600 font-extrabold uppercase print:bg-white print:border-b">
              <th className="py-2 px-1">Farmer origin</th>
              <th className="py-2 px-1">Vegetable</th>
              <th className="py-2 px-1">Grade</th>
              <th className="py-2 px-1 text-right">Weight</th>
              <th className="py-2 px-1 text-right">Selling Rate</th>
              <th className="py-2 px-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150 font-medium">
            {invoice.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50/50 print:bg-white">
                <td className="py-2 px-1 text-gray-500 max-w-[110px] truncate" title={dt(item.farmerName)}>{dt(item.farmerName)}</td>
                <td className="py-2 px-1 font-bold text-gray-900">{dt(item.vegetableName)}</td>
                <td className="py-2 px-1 text-gray-400 text-[10px] uppercase font-bold">{dt(item.quality)}</td>
                <td className="py-2 px-1 text-right font-mono font-bold text-gray-800">
                  <div>{item.quantity.toFixed(1)} kg</div>
                  {item.bags !== undefined && item.bags > 0 && (
                    <div className="text-[9px] text-gray-400 font-normal font-sans">({item.bags.toFixed(1)} bags)</div>
                  )}
                </td>
                <td className="py-2 px-1 text-right font-mono text-gray-600">₹{item.rate}/kg</td>
                <td className="py-2 px-1 text-right font-mono font-bold text-gray-900">{fNum(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals settlement aggregates section */}
      <div className="flex justify-end pt-2">
        <div className="w-64 max-sm:w-full text-[11px] space-y-1.5 font-semibold text-gray-700">
          <div className="flex justify-between">
            <span>Items Subtotal:</span>
            <span className="font-mono text-gray-900">{fNum(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>CGST/SGST Wholesale (5%):</span>
            <span className="font-mono text-gray-900">{fNum(invoice.gst)}</span>
          </div>
          <div className="border-t border-gray-200 my-1"></div>
          <div className="flex justify-between text-sm font-extrabold text-gray-900">
            <span>Grand Total:</span>
            <span className="font-mono text-emerald-800 print:text-black">{fNum(invoice.total)}</span>
          </div>
          <div className="border-t border-dashed border-gray-200 my-1"></div>
          <div className="flex justify-between text-[10px] text-emerald-700 print:text-black">
            <span>Amount Received Today:</span>
            <span className="font-mono font-bold">{fNum(invoice.amountPaid)}</span>
          </div>
          {invoice.amountPending > 0 && (
            <div className="flex justify-between text-[10px] text-amber-700 print:text-red-800">
              <span>Outstanding Debt balance:</span>
              <span className="font-mono font-bold">{fNum(invoice.amountPending)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bill terms footer */}
      <div className="text-[10px] text-gray-400 font-medium italic border-t border-gray-200 pt-3 text-center my-4 space-y-0.5 leading-normal">
        <p>1. Wholesale vegetable supply purchases are final, returns subject to quality check within 12 hours.</p>
        <p>2. Please check bulk weights before exit. Thank you for your business!</p>
        <p className="font-bold text-emerald-800 print:text-black mt-2">MandiMate - Digital Stall Operations Softwares</p>
      </div>
    </div>
  );
}
