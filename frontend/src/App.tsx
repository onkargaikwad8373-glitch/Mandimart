import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Farmers from "./components/Farmers";
import Customers from "./components/Customers";
import Inventory from "./components/Inventory";
import SalesSheet from "./components/SalesSheet";
import SalesHistory from "./components/SalesHistory";
import Reports from "./components/Reports";
import Staff from "./components/Staff";
import FarmerStock from "./components/FarmerStock";
import Login from "./components/Login";
import { User, Clock, Languages, Menu, Loader2 } from "lucide-react";
import { useTranslation } from "./context/LanguageContext";
import { useAuth } from "./context/AuthContext";
import { Language } from "./utils/translations";

export default function App() {
  const { token, user, loading, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem("mandimate_user");
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed.role === "Staff") {
          return "sales";
        }
      }
    } catch {}
    return "dashboard";
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Set up live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync activeTab if user role changes or loads
  useEffect(() => {
    if (user && user.role === "Staff" && !["inventory", "sales", "history", "customers"].includes(activeTab)) {
      setActiveTab("sales");
    }
  }, [user, activeTab]);

  const formatClockTime = (date: Date) => {
    return date.toLocaleTimeString(language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : "en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  const formatClockDate = (date: Date) => {
    return date.toLocaleDateString(language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : "en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans" id="app-auth-loading">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <span className="text-slate-500 font-semibold text-sm mt-3 animate-pulse">Verifying secure session...</span>
      </div>
    );
  }

  if (!token || !user) {
    return <Login />;
  }

  return (
    <div className="flex bg-[#f8fafc] text-slate-800 min-h-screen font-sans" id="mandimate-app-root">
      {/* Sidebar Navigation Left Panel */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0" id="mandimate-core-view-port">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 px-8 max-md:px-4 flex items-center justify-between z-10 shadow-3xs" id="header-bar">
          {/* Mobile Hamburger Toggle Button & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg focus:outline-none transition-all duration-200"
              id="mobile-sidebar-toggle"
              aria-label="Toggle Sidebar"
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </button>
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-gray-400 capitalize text-xs tracking-wider">MandiMate</span>
              <span className="text-gray-300 text-xs">/</span>
              <span className="font-bold text-gray-800 capitalize text-sm tracking-wide">
                {activeTab === "staff" ? "Staff Management" : t(activeTab)}
              </span>
            </div>
          </div>

          {/* Clock & Language & Administrator profile info */}
          <div className="flex items-center gap-4 md:gap-6" id="header-meta-info">
            
            {/* Elegant Language Selector */}
            <div className="flex items-center gap-1.5" id="language-selector-wrapper">
              <Languages className="w-4 h-4 text-emerald-600" />
              <select
                id="language-selector"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer transition-all"
              >
                <option value="en">English (EN)</option>
                <option value="mr">मराठी (MR)</option>
                <option value="hi">हिंदी (HI)</option>
              </select>
            </div>

            <div className="h-4 w-[1px] bg-slate-200"></div>

            {/* Live UTC/Local clock */}
            <div className="flex items-center gap-1.5 text-gray-500 max-lg:hidden shrink-0">
              <Clock className="w-4 h-4 text-emerald-600" />
              <div className="text-[11px] font-mono leading-none">
                <span className="font-bold text-slate-700">{formatClockTime(currentTime)}</span>
                <span className="text-gray-400 ml-1.5">{formatClockDate(currentTime)}</span>
              </div>
            </div>

            <div className="h-4 w-[1px] bg-gray-200 max-lg:hidden"></div>

            {/* Quick Profile display */}
            <div className="flex items-center gap-2 text-right">
              <div className="max-sm:hidden">
                <p className="text-xs font-bold text-gray-900 leading-none">{user.name}</p>
                <p className="text-[10px] text-emerald-600 font-bold tracking-wider mt-1 uppercase leading-none">
                  {user.role === "Owner" ? t("mandi_owner") : "Staff"}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold shadow-3xs shrink-0">
                <User className="w-4 h-4" />
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Panel Content container */}
        <main className="flex-1 px-8 py-6 overflow-y-auto max-sm:px-4" id="view-content-canvas">
          {activeTab === "dashboard" && user.role === "Owner" && <Dashboard setActiveTab={setActiveTab} />}
          {activeTab === "farmers" && user.role === "Owner" && <Farmers />}
          {activeTab === "customers" && user.role === "Owner" && <Customers />}
          {activeTab === "customers" && user.role === "Staff" && <Customers staffMode={true} />}
          {activeTab === "inventory" && <Inventory />}
          {activeTab === "sales" && <SalesSheet />}
          {activeTab === "history" && <SalesHistory />}
          {activeTab === "reports" && user.role === "Owner" && <Reports />}
          {activeTab === "staff" && user.role === "Owner" && <Staff />}
          {activeTab === "farmer-stock" && user.role === "Owner" && <FarmerStock />}
        </main>
      </div>
    </div>
  );
}
