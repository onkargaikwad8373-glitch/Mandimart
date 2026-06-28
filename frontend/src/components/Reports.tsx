import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Download, 
  Printer, 
  Calendar, 
  Coins, 
  BookOpen, 
  ShieldAlert, 
  Users, 
  Sprout, 
  BookOpen as BookIcon, // avoid conflict
  Briefcase,
  X
} from "lucide-react";
import { Invoice, Farmer, Customer } from "../types";
import { useTranslation } from "../context/LanguageContext";
import { apiFetch } from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function Reports() {
  const { t, dt, language } = useTranslation();
  const { user } = useAuth();
  const isStaff = user?.role === "Staff";
  const [reportType, setReportType] = useState<"sales" | "profit" | "farmers" | "customers" | "pending">("sales");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Pay Due Popups
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [modalError, setModalError] = useState("");

  // Filters
  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10));

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const [resInvs, resFarmers, resCust] = await Promise.all([
        apiFetch("/api/invoices"),
        apiFetch("/api/farmers"),
        apiFetch("/api/customers")
      ]);

      if (!resInvs.ok || !resFarmers.ok || !resCust.ok) {
        throw new Error("Unable to download databases for reports");
      }

      setInvoices(await resInvs.json());
      setFarmers(await resFarmers.json());
      setCustomers(await resCust.json());
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [language]);

  const handlePayDue = async (e: any) => {
    e.preventDefault();
    setModalError("");
    if (!payingInvoice || !payAmount || Number(payAmount) <= 0) {
      setModalError("Invalid payment amount entered.");
      return;
    }

    try {
      const res = await apiFetch(`/api/invoices/${payingInvoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(payAmount),
          paymentMethod: payMethod
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Execution failed");
      }

      setPayingInvoice(null);
      setPayAmount("");
      setPayMethod("Cash");
      setModalError("");
      
      // Refresh list to update paid amount structures
      await fetchReportData();
    } catch (errErr: any) {
      setModalError(`Payment error: ${errErr.message}`);
    }
  };

  // Format currency
  const fNum = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 1 })}`;

  // Math helper for date comparison (ISO string comparison vs simple date strings)
  const isSameDay = (isoStr: string, compStr: string) => isoStr.startsWith(compStr);

  const isWithinDays = (isoStr: string, days: number) => {
    const date = new Date(isoStr);
    const target = new Date();
    target.setDate(target.getDate() - days);
    return date >= target;
  };

  // --- Calculations for Profit Module (Module 8) ---
  // Profit = Selling Amount - Purchase Amount
  // Automatic Daily, Weekly, and Monthly Profit
  const calculateChronoProfit = () => {
    let dailyProfit = 0;
    let weeklyProfit = 0;
    let monthlyProfit = 0;

    const todayStr = new Date().toISOString().slice(0, 10);

    invoices.forEach(inv => {
      let invProfit = 0;
      inv.items.forEach(item => {
        const itemProfit = item.amount - (item.quantity * item.purchasePrice);
        invProfit += itemProfit;
      });

      // 1. Daily
      if (inv.createdAt.startsWith(todayStr)) {
        dailyProfit += invProfit;
      }
      // 2. Weekly (7 Days)
      if (isWithinDays(inv.createdAt, 7)) {
        weeklyProfit += invProfit;
      }
      // 3. Monthly (30 Days)
      if (isWithinDays(inv.createdAt, 30)) {
        monthlyProfit += invProfit;
      }
    });

    return { dailyProfit, weeklyProfit, monthlyProfit };
  };

  const profits = calculateChronoProfit();

  // --- Dynamic calculations for specific grids ---

  // 1. Daily Sales report entries (matching target date)
  const targetDaySales = invoices.filter(inv => isSameDay(inv.createdAt, targetDate));

  // 2. Daily Profit report entries (with detail of individual margins)
  const targetDayProfitEntries = invoices.filter(inv => isSameDay(inv.createdAt, targetDate)).map(inv => {
    let totalPurchaseCost = 0;
    inv.items.forEach(item => {
      totalPurchaseCost += item.quantity * item.purchasePrice;
    });
    const netProfit = inv.subtotal - totalPurchaseCost;
    return {
      invoiceNumber: inv.invoiceNumber,
      createdAt: inv.createdAt,
      customerName: inv.customerName,
      revenue: inv.subtotal,
      cost: totalPurchaseCost,
      profit: netProfit
    };
  });

  // 3. Farmer aggregations (Farmer Name | Vegetables Supplied | Quantity Sold | Revenue Generated | Profit Generated)
  const farmerSuppliesAgg = () => {
    const agg: Record<string, { farmerName: string; vegetables: Set<string>; weight: number; revenue: number; profit: number }> = {};
    
    invoices.forEach(inv => {
      inv.items.forEach(item => {
        const fId = item.farmerId;
        const profit = item.amount - (item.quantity * item.purchasePrice);
        if (!agg[fId]) {
          agg[fId] = { farmerName: item.farmerName, vegetables: new Set<string>(), weight: 0, revenue: 0, profit: 0 };
        }
        agg[fId].vegetables.add(item.vegetableName);
        agg[fId].weight += item.quantity;
        agg[fId].revenue += item.amount;
        agg[fId].profit += profit;
      });
    });

    return Object.entries(agg).map(([farmerId, d]) => ({
      farmerId,
      farmerName: d.farmerName,
      vegetables: Array.from(d.vegetables).join(", "),
      weight: d.weight,
      revenue: d.revenue,
      profit: d.profit
    }));
  };

  // 4. Customer outlines (Buyer Name, Business Name, total transactions value, average size, outstanding credit)
  const customerOutlines = () => {
    const agg: Record<string, { name: string; business: string; mobile: string; billsCount: number; spend: number; pending: number }> = {};
    customers.forEach(c => {
      agg[c.id] = { name: c.name, business: c.businessName, mobile: c.mobile, billsCount: 0, spend: 0, pending: 0 };
    });

    invoices.forEach(inv => {
      if (!agg[inv.customerId]) {
        agg[inv.customerId] = { name: inv.customerName, business: inv.customerBusiness || "", mobile: inv.customerMobile || "", billsCount: 0, spend: 0, pending: 0 };
      }
      agg[inv.customerId].billsCount += 1;
      agg[inv.customerId].spend += inv.total;
      agg[inv.customerId].pending += inv.amountPending;
    });

    return Object.values(agg);
  };

  // 5. Pending Credit accounts (Bills needing collection action)
  const pendingBillsList = invoices.filter(inv => inv.amountPending > 0);

  const handleExportCSV = () => {
    let csv = "";
    let filename = `MandiMate_${reportType}_report.csv`;

    if (reportType === "sales") {
      csv = "Invoice Number,Date,Customer Name,Business,Subtotal,GST (5%),Grand Total,Payment Method,Payment Status\n";
      targetDaySales.forEach(inv => {
        csv += `"${inv.invoiceNumber}","${inv.createdAt.slice(0, 10)}","${inv.customerName}","${inv.customerBusiness || ""}","₹${inv.subtotal}","₹${inv.gst}","₹${inv.total}","${inv.paymentMethod}","${inv.paymentStatus}"\n`;
      });
    } else if (reportType === "profit") {
      csv = "Invoice Number,Date,Customer Name,Items Sold,Selling Amount,Purchase Cost,Net Profit\n";
      targetDayProfitEntries.forEach(ent => {
        const matchingInv = invoices.find(inv => inv.invoiceNumber === ent.invoiceNumber);
        let itemNames: string[] = [];
        if (matchingInv) {
          matchingInv.items.forEach(item => {
            const bagsText = item.bags ? `, ${item.bags} bags` : `, ${item.quantity / 20} bags`;
            itemNames.push(`${item.vegetableName} (${item.quantity}kg${bagsText})`);
          });
        }
        csv += `"${ent.invoiceNumber}","${ent.createdAt.slice(0, 10)}","${ent.customerName}","${itemNames.join(" | ")}","₹${ent.revenue}","₹${ent.cost}","₹${ent.profit}"\n`;
      });
    } else if (reportType === "farmers") {
      csv = "Farmer Name,Mobile,Vegetables Supplied,Total Sold Weight (Kg),Sales Value,Profit Value\n";
      farmerSuppliesAgg().forEach(f => {
        const mob = farmers.find(farmer => farmer.id === f.farmerId)?.mobile || "";
        csv += `"${f.farmerName}","${mob}","${f.vegetables}","${f.weight} kg","₹${f.revenue}","₹${f.profit}"\n`;
      });
    } else if (reportType === "customers") {
      csv = "Customer Name,Business Name,Mobile,Total Purchased,Amount Paid,Amount Pending\n";
      customerOutlines().forEach(c => {
        csv += `"${c.name}","${c.business}","${c.mobile}","₹${c.spend}","₹${c.spend - c.pending}","₹${c.pending}"\n`;
      });
    } else if (reportType === "pending") {
      csv = "Invoice Number,Date,Customer Name,Business,Mobile,Total Amount,Paid,Outstanding Balance\n";
      pendingBillsList.forEach(inv => {
        csv += `"${inv.invoiceNumber}","${inv.createdAt.slice(0, 10)}","${inv.customerName}","${inv.customerBusiness || ""}","${inv.customerMobile}","₹${inv.total}","₹${inv.amountPaid}","₹${inv.amountPending}"\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="reports-module">
      {/* Page header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight">{t("overall_performance_analytics")}</h2>
          <p className="text-sm text-slate-500 mt-1">Review aggregated wholesale cashflow, daily trade margins, and farmer/customer ledgers.</p>
        </div>
      </div>

      {/* Automatic Profit Calculations widgets (Module 8) — Owner only */}
      {!isStaff && (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5 leading-none">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          Profit Margin Chronology (Estimated Cumulative Profit)
        </h3>
        
        <div className="grid grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-5" id="profit-cards">
          <div className="p-4 bg-emerald-50 text-emerald-950 rounded-xl border border-emerald-100/60">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Today's Profit</span>
            <h4 id="calc-today-profit" className="text-2xl font-display font-semibold transition-all mt-1">{fNum(profits.dailyProfit)}</h4>
            <p className="text-[10px] text-emerald-700/60 mt-1 font-semibold">Sales finalized on target date</p>
          </div>

          <div className="p-4 bg-slate-50 text-slate-950 rounded-xl border border-slate-200/65">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Weekly Profit (7 Days)</span>
            <h4 id="calc-weekly-profit" className="text-2xl font-display font-semibold transition-all mt-1 text-slate-900">{fNum(profits.weeklyProfit)}</h4>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Stall wholesale performance</p>
          </div>

          <div className="p-4 bg-emerald-50/50 text-emerald-950 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Monthly Profit (30 Days)</span>
            <h4 id="calc-monthly-profit" className="text-2xl font-display font-semibold transition-all mt-1 text-emerald-800">{fNum(profits.monthlyProfit)}</h4>
            <p className="text-[10px] text-emerald-600/70 mt-1 font-semibold">Active cumulative margin log</p>
          </div>

          <div className="p-4 bg-slate-50 text-slate-700 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Profit Calculation Code</span>
            <p className="font-mono text-[10px] text-slate-500 leading-relaxed mt-1">
              Profit = Selling Price - Buying Price
            </p>
            <p className="text-[9px] text-slate-400 italic leading-relaxed mt-1">
              Tracked per kilogram supplied from individual farmer batch orders
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Reports navigation toolbar */}
      <div className="flex gap-4 items-center max-md:flex-col bg-white p-4 rounded-xl border border-slate-200 shadow-sm justify-between">
        {/* Tab triggers */}
        <div className="flex gap-2 max-md:flex-wrap" id="report-type-selector-tab">
          <button
            onClick={() => setReportType("sales")}
            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
              reportType === "sales" ? "bg-emerald-600 border-emerald-600 text-white shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Daily Sales Report
          </button>
          {!isStaff && (
          <button
            onClick={() => setReportType("profit")}
            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
              reportType === "profit" ? "bg-emerald-600 border-emerald-600 text-white shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Daily Profit Report
          </button>
          )}
          <button
            onClick={() => setReportType("farmers")}
            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
              reportType === "farmers" ? "bg-emerald-600 border-emerald-600 text-white shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Farmer Wise Report
          </button>
          <button
            onClick={() => setReportType("customers")}
            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
              reportType === "customers" ? "bg-emerald-600 border-emerald-600 text-white shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Customer Wise Report
          </button>
          <button
            onClick={() => setReportType("pending")}
            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
              reportType === "pending" ? "bg-emerald-600 border-emerald-600 text-white shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Pending Payments
          </button>
        </div>

        {/* Dynamic actions / downloads */}
        <div className="flex gap-3 justify-end items-center max-sm:w-full">
          {/* Selective date filter for sale/profit tab */}
          {(reportType === "sales" || reportType === "profit") && (
            <div className="relative">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="p-2 border border-slate-200 text-xs bg-white text-slate-700 font-bold rounded-lg outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
            title="Print Current Sheet"
          >
            <Printer className="w-4 h-4" />
            <span className="max-sm:hidden">Print Layout</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            title="Download Excel compatible CSV file"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Structured reports display screens */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" id="reports-sheets-visualizer">
                   {/* Sub-tab 1: Daily Sales Report */}
          {reportType === "sales" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <h4 className="font-bold text-slate-950 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  Wholesale Sales Book for Date: <strong className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">{targetDate}</strong>
                </h4>
                <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Record Count: {targetDaySales.length} bills</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest font-bold text-[10px]">
                      <th className="py-2.5 px-3">Invoice No</th>
                      <th className="py-2.5 px-3">Customer Buyer</th>
                      <th className="py-2.5 px-3">Business name</th>
                      <th className="py-2.5 px-3">Payment method</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-right">GST (5%)</th>
                      <th className="py-2.5 px-3 text-right font-bold text-slate-900">Total Bill</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {targetDaySales.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold text-sm">
                          No wholesale transactions booked on {targetDate}. Create sales to populate files!
                        </td>
                      </tr>
                    ) : (
                      targetDaySales.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-slate-950 text-sm">{inv.invoiceNumber}</td>
                          <td className="py-3 px-3 text-slate-900 font-bold text-sm">{dt(inv.customerName)}</td>
                          <td className="py-3 px-3 text-emerald-800 font-bold">{dt(inv.customerBusiness || "--")}</td>
                          <td className="py-3 px-3 text-slate-500 font-semibold">{inv.paymentMethod}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700">₹{inv.subtotal.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700">₹{inv.gst.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800 text-sm">₹{inv.total.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Daily Profit Report */}
          {reportType === "profit" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <h4 className="font-bold text-slate-950 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  Daily Operating Profit Margins for Date: <strong className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">{targetDate}</strong>
                </h4>
                <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Calculation Rule: Total Sales - Initial Purchase Cost</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest font-bold text-[10px]">
                      <th className="py-2.5 px-3">Invoice No</th>
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3 text-right">Selling Value (Revenue)</th>
                      <th className="py-2.5 px-3 text-right">Initial Purchase Cost</th>
                      <th className="py-2.5 px-3 text-right font-bold text-emerald-800">Net Profit Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-xs animate-fade-in">
                    {targetDayProfitEntries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 font-semibold text-sm">
                          No wholesale profits calculated. None recorded on {targetDate}.
                        </td>
                      </tr>
                    ) : (
                      targetDayProfitEntries.map((e) => (
                        <tr key={e.invoiceNumber} className="hover:bg-slate-50/40 font-medium">
                          <td className="py-3 px-3 font-mono font-bold text-slate-950 text-sm">{e.invoiceNumber}</td>
                          <td className="py-3 px-3 text-slate-700 font-bold text-sm">{dt(e.customerName)}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-800">₹{e.revenue.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-400">₹{e.cost.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-sm">+{fNum(e.profit)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Farmer Wise Clearances */}
          {reportType === "farmers" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <h4 className="font-bold text-slate-950 flex items-center gap-1.5">
                  <Sprout className="w-4 h-4 text-emerald-600" />
                  Farmer-Wise Stock Clearance ledgers
                </h4>
                <p className="text-slate-400 font-extrabold uppercase tracking-widest text-[9px]">Total Sold Volume from Farmer Harvests</p>
              </div>

              <div className="overflow-x-auto animate-fade-in">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest font-bold text-[10px]">
                      <th className="py-2.5 px-3">Farmer Name</th>
                      <th className="py-2.5 px-3">Vegetables Supplied</th>
                      <th className="py-2.5 px-3 text-right">Wholesale Weight Cleared</th>
                      <th className="py-2.5 px-3 text-right">Clearance Revenue</th>
                      <th className="py-2.5 px-3 text-right font-bold text-emerald-800">Operating Net Profit Generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-xs">
                    {farmerSuppliesAgg().length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 font-semibold text-sm">
                          No farmer stock supplies traded or sold yet.
                        </td>
                      </tr>
                    ) : (
                      farmerSuppliesAgg().map((f) => (
                        <tr key={f.farmerId} className="hover:bg-slate-50/40 leading-normal">
                          <td className="py-3.5 px-3 font-bold text-slate-900 text-sm">{dt(f.farmerName)}</td>
                          <td className="py-3.5 px-3 text-slate-500 font-semibold max-w-[200px] truncate animate-fade-in" title={f.vegetables.split(", ").map(v => dt(v)).join(", ")}>{f.vegetables.split(", ").map(v => dt(v)).join(", ")}</td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-600">{f.weight.toFixed(1)} kg</td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">{fNum(f.revenue)}</td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700 text-sm">+{fNum(f.profit)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 4: Customer outlines list */}
          {reportType === "customers" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <h4 className="font-bold text-slate-950 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Buyer Wise trading Volume summary
                </h4>
                <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-widest">Lifetime Purchases & Credits Outstanding</p>
              </div>

              <div className="overflow-x-auto animate-fade-in">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest font-bold text-[10px]">
                      <th className="py-2.5 px-3">Customer Buyer</th>
                      <th className="py-2.5 px-3">Business name</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3 text-center">Invoices count</th>
                      <th className="py-2.5 px-3 text-right">Lifetime Purchase value</th>
                      <th className="py-2.5 px-3 text-right font-bold text-amber-700">Total Outstanding Credits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-xs animate-fade-in">
                    {customerOutlines().length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400 font-semibold text-sm">
                          No wholesale merchants found on database registries.
                        </td>
                      </tr>
                    ) : (
                      customerOutlines().map((c, ix) => (
                        <tr key={ix} className="hover:bg-slate-50/40 font-medium">
                          <td className="py-3 px-3 font-bold text-slate-900 text-sm">{dt(c.name)}</td>
                          <td className="py-3 px-3 text-emerald-800 font-bold">{dt(c.business || "Street Retailer")}</td>
                          <td className="py-3 px-3 font-mono text-slate-500 font-bold">{c.mobile}</td>
                          <td className="py-3 px-3 text-center text-slate-600 font-bold">{c.billsCount}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-950">₹{c.spend.toLocaleString("en-IN")}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-700">
                            {c.pending > 0 ? `₹${c.pending.toLocaleString("en-IN")}` : <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-sm px-2 py-0.5 font-bold uppercase tracking-widest text-[9px]">Cleared</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 5: Pending Credits Outstanding */}
          {reportType === "pending" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <h4 className="font-bold text-slate-950 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Mandi outstanding Credit collections
                </h4>
                <p className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-sm font-bold tracking-widest text-[9px] uppercase">
                  Cash Flow pending Settle
                </p>
              </div>

              <div className="overflow-x-auto animate-fade-in">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest font-bold text-[10px]">
                      <th className="py-2.5 px-3">Invoice No</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">buyer Merchant</th>
                      <th className="py-2.5 px-3">Mobile contact</th>
                      <th className="py-2.5 px-3 text-right">Total Invoice bill</th>
                      <th className="py-2.5 px-3 text-right font-bold text-emerald-800">Cash/Online Paid</th>
                      <th className="py-2.5 px-3 text-right font-bold text-amber-700">Outstanding Balance Due</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold animate-fade-in">
                    {pendingBillsList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg font-bold text-sm">
                          🎉 Perfect score! No outstanding buyer debts remaining in Mandi accounts.
                        </td>
                      </tr>
                    ) : (
                      pendingBillsList.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/40 font-medium">
                          <td className="py-3 px-3 font-mono font-bold text-slate-950 text-sm">{inv.invoiceNumber}</td>
                          <td className="py-3 px-3 text-slate-400 font-bold">{inv.createdAt.slice(0, 10)}</td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 text-sm">{dt(inv.customerName)}</span>
                            {inv.customerBusiness && (
                              <span className="text-[9px] block text-emerald-800 font-bold">{dt(inv.customerBusiness)}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500 font-bold">{inv.customerMobile}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-950">₹{inv.total.toLocaleString("en-IN")}</td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-800 font-bold">₹{inv.amountPaid.toLocaleString("en-IN")}</td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-amber-700 text-sm">
                            ₹{inv.amountPending.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              id={`pay-pending-${inv.id}`}
                              onClick={() => {
                                setPayingInvoice(inv);
                                setPayAmount(String(inv.amountPending));
                                setPayMethod("Cash");
                              }}
                              className="p-1 px-2 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-md text-amber-700 transition-all flex items-center justify-center gap-1 cursor-pointer font-bold inline-flex"
                              title="Record Payment"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Pay Due</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
        </div>
      )}

      {/* Record Outstanding payment modal */}
      {payingInvoice && (
        <div id="pay-outstanding-backdrop" className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-150 pb-2 mb-4">
              <h3 className="font-bold text-gray-900 text-md">
                Settle Outstandings
              </h3>
              <button onClick={() => { setPayingInvoice(null); setModalError(""); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handlePayDue} className="space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 space-y-1 text-xs text-slate-700">
                <div className="flex justify-between font-medium">
                  <span>To Customer:</span>
                  <span className="font-bold text-slate-900">{dt(payingInvoice.customerName)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Bill Invoice No:</span>
                  <span className="font-mono text-slate-900">{payingInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between font-medium pt-1 border-t border-slate-200 mt-1.5 font-bold text-amber-700">
                  <span>Remaining Credit:</span>
                  <span className="font-mono">₹{payingInvoice.amountPending.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Clearing Payment (₹) *</label>
                <input
                  type="number"
                  required
                  step="0.1"
                  max={payingInvoice.amountPending}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Settle Mode</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full p-2.5 bg-white rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-xs text-gray-950 font-semibold"
                >
                  <option value="Cash">Cash Settlement</option>
                  <option value="Online">Online / UPI Transfer</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setPayingInvoice(null); setModalError(""); }}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 border border-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
