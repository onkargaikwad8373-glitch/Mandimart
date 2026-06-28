import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Coins, 
  Wallet, 
  Hourglass, 
  Users, 
  ShoppingBag, 
  ChevronRight,
  ArrowUpRight,
  PackageCheck,
  Calendar
} from "lucide-react";
import { DashboardStats } from "../types";
import { 
  ResponsiveContainer, 
  BarChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Bar, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from "recharts";
import { useTranslation } from "../context/LanguageContext";
import { apiFetch } from "../utils/api";

interface DashboardProps {
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({ setActiveTab }: DashboardProps) {
  const { t, dt, language } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const fetchStats = async (dateVal: string) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/dashboard/stats?date=${dateVal}`);
      if (!res.ok) throw new Error("Could not fetch today's sales data");
      const data = await res.json();
      setStats(data);
    } catch (e: any) {
      setErr(e.message || "Failed to contact database statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(targetDate);
  }, [language, targetDate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3" id="loading-container">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
        <p className="text-gray-500 font-medium text-sm">Calculating Mandi profit accounts & stocks...</p>
      </div>
    );
  }

  if (err || !stats) {
    return (
      <div className="p-8 text-center bg-red-50 text-red-600 rounded-xl" id="error-container">
        <p className="font-semibold">Error Loading Dashboard statistics: {err}</p>
        <button onClick={() => fetchStats(targetDate)} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Retry Connection
        </button>
      </div>
    );
  }

  // Formatting currency helper
  const fNum = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

  // Recharts color assignments
  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

  // Pie chart data for payments
  const paymentChartData = [
    { name: t("cash_collection"), value: stats.paymentBreakdown.cashReceived },
    { name: t("online_upi"), value: stats.paymentBreakdown.onlineReceived },
    { name: t("outstanding_credit"), value: stats.paymentBreakdown.pendingPayments }
  ].filter(p => p.value > 0);

  // Profit/Revenue comparison data
  const barRevenue = t("revenue");
  const barProfit = t("cumulative_profit");
  const vegBarData = stats.topSellingVegetables.map(item => ({
    name: dt(item.name),
    [barRevenue]: item.revenue,
    [barProfit]: item.profit,
    "Weight / Quantity (Kg)": item.quantity
  }));

  return (
    <div className="space-y-6" id="dashboard-main">
      {/* Welcome Banner */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-250/80 shadow-sm max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight text-slate-950">{t("todays_operations")}</h2>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            {t("realtime_stats")}
            <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 font-medium">
              {(() => {
                const parts = targetDate.split('-');
                const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                return dObj.toLocaleDateString(language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : "en-IN", { month: "short", day: "2-digit", year: "numeric" });
              })()}
            </span>
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <Calendar className="w-4.5 h-4.5 text-emerald-600" />
            <span className="text-xs text-slate-500 font-bold max-sm:hidden">Select Date:</span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            />
          </div>
          <button 
            id="dash-quick-invoice-btn"
            onClick={() => setActiveTab("sales")}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-all shadow-md cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            {t("new_sale_invoice")}
          </button>
        </div>
      </div>

      {/* Primary KPI Widgets */}
      <div className="grid grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4" id="kpi-grid">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("total_revenue")}</p>
            <h3 className="text-2xl font-display font-semibold text-slate-950 mt-1">{fNum(stats.todaySales.revenue)}</h3>
            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5 font-bold">
              <ArrowUpRight className="w-3 text-emerald-500" />
              {stats.todaySales.transactions} bills
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-teal-50 text-teal-600 p-3 rounded-lg">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("net_profit_eod")}</p>
            <h3 className="text-2xl font-display font-semibold text-slate-950 mt-1">{fNum(stats.todaySales.profit)}</h3>
            <p className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded font-extrabold mt-0.5 inline-block">
              Margin trade Gap
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("quantity_sold")}</p>
            <h3 className="text-2xl font-display font-semibold text-slate-950 mt-1">
              {stats.todaySales.quantity.toFixed(1)} <sub className="text-xs font-medium text-slate-400 bottom-0 font-sans">kg</sub>
            </h3>
            <p className="text-xs text-blue-600 mt-0.5 font-medium">Bulk weight</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-purple-50 text-purple-600 p-3 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("buyers_served")}</p>
            <h3 className="text-2xl font-display font-semibold text-slate-950 mt-1">{stats.customersServedToday}</h3>
            <p className="text-xs text-purple-600 mt-0.5 font-medium">Active merchants</p>
          </div>
        </div>
      </div>

      {/* Payment Collections Breakdown Row */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{t("settlement_split")}</h3>
        <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4" id="payments-kpi-subgrid">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-5 rounded-xl shadow-md border border-emerald-500/10">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">{t("cash_collection")}</p>
                <h4 className="text-2xl font-mono font-bold mt-1.5">{fNum(stats.paymentBreakdown.cashReceived)}</h4>
              </div>
              <Wallet className="w-5 h-5 text-emerald-100 opacity-90" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 rounded-xl shadow-md border border-blue-500/10">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">{t("online_upi")}</p>
                <h4 className="text-2xl font-mono font-bold mt-1.5">{fNum(stats.paymentBreakdown.onlineReceived)}</h4>
              </div>
              <ArrowUpRight className="w-5 h-5 text-blue-100 opacity-90" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-5 rounded-xl shadow-md border border-amber-500/10">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-amber-100 uppercase tracking-widest">{t("outstanding_credit")}</p>
                <h4 className="text-2xl font-mono font-bold mt-1.5">{fNum(stats.paymentBreakdown.pendingPayments)}</h4>
              </div>
              <Hourglass className="w-5 h-5 text-amber-100 opacity-90" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts & Graphs Row */}
      <div className="grid grid-cols-12 gap-5" id="dashboard-charts">
        {/* Sales vs Profit comparison chart */}
        <div className="col-span-8 max-lg:col-span-12 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="font-display font-bold text-slate-900 text-sm">{t("veg_performance_index")}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{t("comparing_sales")}</p>
            </div>
          </div>
          <div className="h-80" id="chart-veg-performance">
            {vegBarData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No vegetables sold today yet to compile index.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vegBarData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "white", fontSize: "11px" }} formatter={(value) => [`₹${value}`, ""]} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar dataKey={barRevenue} fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={barProfit} fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Shares Pie Chart */}
        <div className="col-span-4 max-lg:col-span-12 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-display font-bold text-slate-900 text-sm">{t("settlement_breakdown")}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{t("cash_vs_online")}</p>
          </div>
          <div className="h-56 relative flex items-center justify-center my-3" id="chart-settlements">
            {paymentChartData.length === 0 ? (
              <div className="text-slate-400 text-xs text-center font-medium">No transaction funds received.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "white", fontSize: "11px" }} formatter={(value) => [`₹${value}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-2 text-xs" id="pie-legend-labels">
            {paymentChartData.map((entry, idx) => (
              <div key={entry.name} className="flex justify-between items-center text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span className="font-medium">{entry.name}</span>
                </div>
                <span className="font-mono font-bold text-slate-900">{fNum(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row - Top Vegetables & Key Suppliers */}
      <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-5" id="dashboard-bottom-reports">
        {/* Top Commodities Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="font-display font-bold text-slate-900 text-sm">{t("fast_moving")}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{t("highest_turnover")}</p>
            </div>
            <button onClick={() => setActiveTab("reports")} className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:text-emerald-700 transition-colors cursor-pointer">
              {t("view_all_reports")}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold text-[10px] bg-slate-50/50">
                  <th className="py-2.5 px-3">{t("vegetable_name")}</th>
                  <th className="py-2.5 px-3 text-right">{t("sold_weight")}</th>
                  <th className="py-2.5 px-3 text-right">{t("revenue")}</th>
                  <th className="py-2.5 px-3 text-right">{t("cumulative_profit")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {stats.topSellingVegetables.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 font-medium">
                      No sales recorded today to rank commodities.
                    </td>
                  </tr>
                ) : (
                  stats.topSellingVegetables.map((v) => (
                    <tr key={v.name} className="hover:bg-slate-50/40 transition-colors font-medium">
                      <td className="py-3 px-3 font-semibold text-slate-900">{dt(v.name)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">{v.quantity.toFixed(1)} kg</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-900 font-semibold">{fNum(v.revenue)}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-600 font-semibold">+{fNum(v.profit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Farmer Settlements Snapshot */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="font-display font-bold text-slate-900 text-sm">{t("active_farmers_summary")}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{t("today_bulk_volume")}</p>
            </div>
            <button onClick={() => setActiveTab("farmers")} className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:text-emerald-700 transition-colors cursor-pointer">
              {t("manage_farmers")}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold text-[10px] bg-slate-50/50">
                  <th className="py-2.5 px-3">{t("farmer_name")}</th>
                  <th className="py-2.5 px-3">{t("vegetables_sold")}</th>
                  <th className="py-2.5 px-3 text-right">{t("qty_cleared")}</th>
                  <th className="py-2.5 px-3 text-right">{t("total_clearance")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {stats.farmerWiseReport.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 font-medium">
                      No active farmer batches sold yet today.
                    </td>
                  </tr>
                ) : (
                  stats.farmerWiseReport.slice(0, 5).map((f) => (
                    <tr key={f.farmerId} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">{dt(f.farmerName)}</td>
                      <td className="py-3 px-3 text-slate-500 max-w-[120px] truncate" title={f.vegetablesSupplied.map(veg => dt(veg)).join(", ")}>
                        {f.vegetablesSupplied.map(veg => dt(veg)).join(", ") || "N/A"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">{f.quantitySold.toFixed(1)} kg</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-900 font-semibold">{fNum(f.revenueGenerated)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
