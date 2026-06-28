import { useState, useEffect } from "react";
import { Sprout, RefreshCw, Search, PackageCheck, AlertTriangle, Calendar } from "lucide-react";
import { Vegetable } from "../types";
import { useTranslation } from "../context/LanguageContext";
import { apiFetch } from "../utils/api";

interface FarmerStockRow {
  farmerName: string;
  vegetableName: string;
  quality: string;
  bags: number;
  purchasePricePerBag: number;
  totalPurchaseCost: number;
  quantityKg: number;
  dateAdded: string;
  id: string;
}

export default function FarmerStock() {
  const { dt, language } = useTranslation();
  const [rows, setRows] = useState<FarmerStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Dailywise stock filters
  const [dateFilterType, setDateFilterType] = useState<"all" | "today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchStock = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await apiFetch("/api/vegetables");
      if (!res.ok) throw new Error("Failed to load farmer stock data.");
      const data: Vegetable[] = await res.json();

      const mapped: FarmerStockRow[] = data.map((v) => {
        const bags = v.bags !== undefined && v.bags > 0 ? v.bags : v.quantity / 20;
        const purchasePricePerBag = v.purchasePrice * 20;
        return {
          id: v.id,
          farmerName: v.farmerName,
          vegetableName: v.vegetableName,
          quality: v.quality,
          bags: Number(bags.toFixed(2)),
          purchasePricePerBag: Number(purchasePricePerBag.toFixed(2)),
          totalPurchaseCost: Number((bags * purchasePricePerBag).toFixed(2)),
          quantityKg: v.quantity,
          dateAdded: v.dateAdded,
        };
      });

      mapped.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
      setRows(mapped);
    } catch (e: any) {
      setErrorMsg(e.message || "Could not load farmer stock.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [language]);

  const todayStr = getTodayString();
  const yesterdayStr = getYesterdayString();

  const todayCount = rows.filter(r => r.dateAdded && r.dateAdded.split('T')[0] === todayStr).length;
  const yesterdayCount = rows.filter(r => r.dateAdded && r.dateAdded.split('T')[0] === yesterdayStr).length;
  const allCount = rows.length;

  const filteredRows = rows.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      (r.farmerName || "").toLowerCase().includes(q) ||
      (r.vegetableName || "").toLowerCase().includes(q) ||
      (r.quality || "").toLowerCase().includes(q)
    );

    let matchesDate = true;
    const itemDateStr = r.dateAdded ? r.dateAdded.split('T')[0] : "";
    if (dateFilterType === "today") {
      matchesDate = itemDateStr === todayStr;
    } else if (dateFilterType === "yesterday") {
      matchesDate = itemDateStr === yesterdayStr;
    } else if (dateFilterType === "custom") {
      matchesDate = itemDateStr === customDate;
    }

    return matchesSearch && matchesDate;
  });

  const farmerSummary: Record<string, { bags: number; cost: number }> = {};
  for (const row of filteredRows) {
    if (!farmerSummary[row.farmerName]) farmerSummary[row.farmerName] = { bags: 0, cost: 0 };
    farmerSummary[row.farmerName].bags += row.bags;
    farmerSummary[row.farmerName].cost += row.totalPurchaseCost;
  }

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(language === "mr" ? "mr-IN" : "en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso.split("T")[0];
    }
  };

  const totalBags = filteredRows.reduce((acc, r) => acc + r.bags, 0);
  const totalCost = filteredRows.reduce((acc, r) => acc + r.totalPurchaseCost, 0);
  const uniqueFarmers = new Set(filteredRows.map((r) => r.farmerName)).size;

  return (
    <div className="space-y-6" id="farmer-stock-page">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            Farmer Stock Ledger
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Quick view of all stock batches received from farmers
          </p>
        </div>
        <button
          onClick={fetchStock}
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          id="refresh-farmer-stock-btn"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Farmers</span>
          <span className="text-3xl font-display font-bold text-slate-900">{uniqueFarmers}</span>
          <span className="text-xs text-slate-500">supplying stock</span>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Total Bags in Stock</span>
          <span className="text-3xl font-display font-bold text-emerald-700">{totalBags.toFixed(1)}</span>
          <span className="text-xs text-slate-500">bags received</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Purchase Cost</span>
          <span className="text-3xl font-display font-bold text-slate-900">
            ₹{totalCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-xs text-slate-500">capital deployed</span>
        </div>
      </div>

      {/* Farmer Summary Cards */}
      {Object.keys(farmerSummary).length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            By Farmer
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(farmerSummary).map(([name, agg]) => (
              <div
                key={name}
                className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3 min-w-[200px]"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                  {dt(name).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{dt(name)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-semibold text-emerald-700">{agg.bags.toFixed(1)} bags</span>
                    <span className="text-slate-300 mx-1.5">·</span>
                    <span className="font-mono">₹{agg.cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dailywise Stock Filter manager */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4" id="daily-stock-controls">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-800 tracking-wide uppercase">Daily Stock Manager</p>
            <p className="text-[11px] text-slate-500 font-semibold">Filter farmer stock records day-by-day</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDateFilterType("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
              dateFilterType === "all"
                ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                : "bg-white border-slate-250 text-slate-600 hover:bg-slate-50"
            }`}
          >
            All Stock ({allCount})
          </button>
          <button
            onClick={() => setDateFilterType("today")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
              dateFilterType === "today"
                ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                : "bg-white border-slate-250 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Today ({todayCount})
          </button>
          <button
            onClick={() => setDateFilterType("yesterday")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
              dateFilterType === "yesterday"
                ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                : "bg-white border-slate-250 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Yesterday ({yesterdayCount})
          </button>
          
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <button
              onClick={() => setDateFilterType("custom")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                dateFilterType === "custom"
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                  : "bg-white border-slate-250 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Select Date
            </button>
            {dateFilterType === "custom" && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="p-1 px-2.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              />
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          id="farmer-stock-search"
          placeholder="Search by farmer, vegetable, or quality..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
        />
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium p-4 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center gap-3 text-center">
          <PackageCheck className="w-10 h-10 text-slate-300" />
          <p className="text-slate-400 font-semibold text-sm">
            {searchQuery ? "No matching stock entries found." : "No stock batches registered yet."}
          </p>
        </div>
      ) : (
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          id="farmer-stock-table-container"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest font-bold text-[10px]">
                  <th className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Sprout className="w-3 h-3" />
                      Farmer Name
                    </div>
                  </th>
                  <th className="py-3 px-4">Vegetable</th>
                  <th className="py-3 px-4">Quality</th>
                  <th className="py-3 px-4 text-right">No. of Bags</th>
                  <th className="py-3 px-4 text-right">Kg in Stock</th>
                  <th className="py-3 px-4 text-right">Purchase / Bag</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-900">Total Cost</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/50 transition-colors"
                    id={`farmer-stock-row-${row.id}`}
                  >
                    {/* Farmer */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-[10px] shrink-0">
                          {dt(row.farmerName).charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900 text-sm">{dt(row.farmerName)}</span>
                      </div>
                    </td>

                    {/* Vegetable */}
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{dt(row.vegetableName)}</td>

                    {/* Quality Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          row.quality === "Premium"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-slate-50 text-slate-600 border-slate-150"
                        }`}
                      >
                        {dt(row.quality)}
                      </span>
                    </td>

                    {/* Bags */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono font-bold text-slate-900 text-[13px]">{row.bags.toFixed(1)}</span>
                      <span className="text-slate-400 ml-1 text-[10px]">bags</span>
                    </td>

                    {/* Kg */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                      {row.quantityKg.toFixed(1)} kg
                    </td>

                    {/* Price per Bag */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono font-bold text-slate-700">
                        ₹{row.purchasePricePerBag.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-slate-400 block text-[9px]">per bag</span>
                    </td>

                    {/* Total Cost */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        ₹{row.totalPurchaseCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {formatDate(row.dateAdded)}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Footer totals row */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold text-slate-600">
                  <td colSpan={3} className="py-3 px-4 text-slate-400 uppercase tracking-wider text-[10px]">
                    Total ({filteredRows.length} batches)
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">
                    {totalBags.toFixed(1)} bags
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">
                    {filteredRows.reduce((a, r) => a + r.quantityKg, 0).toFixed(1)} kg
                  </td>
                  <td className="py-3 px-4" />
                  <td className="py-3 px-4 text-right font-mono text-slate-900 text-sm">
                    ₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
