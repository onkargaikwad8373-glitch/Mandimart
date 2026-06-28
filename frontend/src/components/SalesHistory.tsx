import { useState, useEffect, FormEvent } from "react";
import { 
  Search, 
  Printer, 
  Calendar, 
  User, 
  Sprout, 
  X, 
  RefreshCw, 
  Eye, 
  CreditCard, 
  Check, 
  Clock, 
  Coins 
} from "lucide-react";
import { Invoice, Customer, Farmer } from "../types";
import InvoiceDetailModal from "./InvoiceDetailModal";
import { useTranslation } from "../context/LanguageContext";
import { apiFetch } from "../utils/api";

export default function SalesHistory() {
  const { t, dt, language } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");
  const [selectedCustId, setSelectedCustId] = useState("");
  const [selectedFarmerId, setSelectedFarmerId] = useState("");

  // Selected Detail Modal
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const fetchHistoryResources = async () => {
    try {
      setLoading(true);
      const [resInvs, resCust, resFarmers] = await Promise.all([
        apiFetch("/api/invoices"),
        apiFetch("/api/customers"),
        apiFetch("/api/farmers")
      ]);

      if (!resInvs.ok || !resCust.ok || !resFarmers.ok) {
        throw new Error("Failed to load historical invoice registries");
      }

      const invData = await resInvs.json();
      const cuData = await resCust.json();
      const faData = await resFarmers.json();

      setInvoices(invData.sort((a: Invoice, b: Invoice) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setCustomers(cuData);
      setFarmers(faData);
    } catch (e: any) {
      setErr(e.message || "Something went wrong syncing database bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryResources();
  }, [language]);

  // Filter application
  const filteredInvoices = invoices.filter(inv => {
    // 1. Search Query (matching Invoice Number, Buyer name, Business name)
    const query = (searchQuery || "").toLowerCase();
    const invoiceNum = (inv.invoiceNumber || "").toLowerCase();
    const nameMatch = (inv.customerName || "").toLowerCase().includes(query);
    const busMatch = (inv.customerBusiness || "").toLowerCase().includes(query);
    const numMatch = invoiceNum.includes(query);
    const matchesSearch = nameMatch || busMatch || numMatch;

    // 2. Date ranges
    const invDateStr = inv.createdAt.slice(0, 10); // get YYYY-MM-DD
    const matchesStart = startDateStr === "" || invDateStr >= startDateStr;
    const matchesEnd = endDateStr === "" || invDateStr <= endDateStr;

    // 3. Customer filters
    const matchesCust = selectedCustId === "" || inv.customerId === selectedCustId;

    // 4. Farmer filters (check if any item supplied by selective farmer)
    const matchesFarmer = selectedFarmerId === "" || inv.items.some(item => item.farmerId === selectedFarmerId);

    return matchesSearch && matchesStart && matchesEnd && matchesCust && matchesFarmer;
  });

  return (
    <div className="space-y-6" id="history-module">
      {/* Page Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight">{t("recorded_transactions")}</h2>
          <p className="text-sm text-slate-500 mt-1">Review finalized bulk transactions, reprint physical receipts, and settle outstanding credit accounts.</p>
        </div>
      </div>

      {err && (
        <div className="bg-red-50 text-red-600 text-xs p-3 px-3.5 rounded-lg border border-red-150 font-bold">
          Error syncing records: {err}
        </div>
      )}

      {/* Multidimensional Filters Panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-12 gap-4 items-end" id="history-filter-panel">
        {/* Full-text query */}
        <div className="col-span-3 max-xl:col-span-6 max-md:col-span-12">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-emerald-600" />
            Search Text
          </label>
          <input
            type="text"
            placeholder={t("search_invoice_placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-xs font-semibold"
          />
        </div>

        {/* Start Date */}
        <div className="col-span-2 max-xl:col-span-3 max-md:col-span-6">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            From Date
          </label>
          <input
            type="date"
            value={startDateStr}
            onChange={(e) => setStartDateStr(e.target.value)}
            className="w-full p-2 bg-white rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-xs text-slate-700 font-semibold"
          />
        </div>

        {/* End Date */}
        <div className="col-span-2 max-xl:col-span-3 max-md:col-span-6">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            To Date
          </label>
          <input
            type="date"
            value={endDateStr}
            onChange={(e) => setEndDateStr(e.target.value)}
            className="w-full p-2 bg-white rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-xs text-slate-700 font-semibold"
          />
        </div>

        {/* Customer Select */}
        <div className="col-span-2 max-xl:col-span-6 max-md:col-span-12">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-emerald-600" />
            Filter Buyer
          </label>
          <select
            value={selectedCustId}
            onChange={(e) => setSelectedCustId(e.target.value)}
            className="w-full p-2 bg-white rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-xs text-slate-700 font-bold"
          >
            <option value="">{t("all_suppliers")}</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{dt(c.name)}</option>
            ))}
          </select>
        </div>

        {/* Farmer Select */}
        <div className="col-span-2 max-xl:col-span-6 max-md:col-span-12">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Sprout className="w-3.5 h-3.5 text-emerald-600" />
            Farmer Source
          </label>
          <select
            value={selectedFarmerId}
            onChange={(e) => setSelectedFarmerId(e.target.value)}
            className="w-full p-2 bg-white rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-xs text-slate-700 font-bold"
          >
            <option value="">All Farmer Batches</option>
            {farmers.map(f => (
              <option key={f.id} value={f.id}>{dt(f.name.split(" ")[0])}</option>
            ))}
          </select>
        </div>

        {/* Reset */}
        <div className="col-span-1 max-xl:col-span-12 flex justify-end">
          <button
            onClick={() => {
              setSearchQuery("");
              setStartDateStr("");
              setEndDateStr("");
              setSelectedCustId("");
              setSelectedFarmerId("");
              fetchHistoryResources();
            }}
            className="p-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer w-full justify-center shrink-0"
            title="Reset Filters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Invoices list renders */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-400 font-semibold">{t("no_transactions_found")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="history-table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest font-bold text-[10px]">
                  <th className="py-3 px-4">{t("invoice_id")}</th>
                  <th className="py-3 px-4">{t("bill_date")}</th>
                  <th className="py-3 px-4">{t("customers")}</th>
                  <th className="py-3 px-4 flex-1">Items Summary</th>
                  <th className="py-3 px-4 text-right">{t("total_amount")}</th>
                  <th className="py-3 px-4 text-right">{t("amount_pending")}</th>
                  <th className="py-3 px-4 text-center">{t("payment_status_col")}</th>
                  <th className="py-3 px-4 text-right">{t("action_invoice")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredInvoices.map((inv) => {
                  const itemsSummary = inv.items.map(it => `${dt(it.vegetableName)} (${it.quantity.toFixed(0)}kg)`).join(", ");
                  const isPending = inv.amountPending > 0;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-55/40 transition-colors" id={`invoice-row-${inv.id}`}>
                      <td className="py-4 px-4 font-mono font-bold text-slate-950 text-sm">{inv.invoiceNumber}</td>
                      <td className="py-4 px-4 text-slate-400 font-medium">
                        {inv.createdAt.slice(0, 10)}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-900 block">{dt(inv.customerName)}</span>
                        {inv.customerBusiness && (
                          <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md font-bold mt-1 inline-block">{dt(inv.customerBusiness)}</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500 max-w-[180px] truncate" title={itemsSummary}>
                        {itemsSummary}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-sm text-slate-900">
                        ₹{inv.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-sm font-semibold">
                        {isPending ? (
                          <span className="text-amber-600 font-bold">
                            ₹{inv.amountPending.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">--</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          inv.paymentStatus === "Paid" 
                            ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                            : (inv.paymentStatus === "Partial" ? "bg-amber-50 border-amber-100 text-amber-800" : "bg-red-50 border-red-100 text-red-800")
                        }`}>
                          {inv.paymentStatus}
                        </span>
                        <span className="block text-[9px] text-slate-400 mt-1 font-mono font-bold">{inv.paymentMethod}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button
                            id={`view-detail-${inv.id}`}
                            onClick={() => setViewInvoice(inv)}
                            className="p-1 px-2 border border-slate-200 hover:bg-slate-55 rounded-md text-slate-600 hover:text-emerald-700 transition-colors flex items-center justify-center gap-1 cursor-pointer font-bold"
                            title="View Slip"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Review</span>
                          </button>


                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1. Paper bill details overlays */}
      {viewInvoice && (
        <div id="invoice-details-backdrop" className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-gray-900 text-md">
                Invoice #{viewInvoice.invoiceNumber} Details
              </h3>
              <button onClick={() => setViewInvoice(null)} className="text-gray-400 hover:text-gray-600 font-semibold text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg p-2 bg-gray-50 max-h-[400px] overflow-y-auto mb-4">
              <InvoiceDetailModal invoice={viewInvoice} />
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-3">
              <button 
                onClick={() => window.print()} 
                className="flex items-center gap-1.5 px-4 py-2 border border-emerald-600 hover:bg-emerald-50 text-emerald-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print Bill
              </button>
              <button 
                onClick={() => setViewInvoice(null)} 
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
