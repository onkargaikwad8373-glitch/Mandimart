import { 
  LayoutDashboard, 
  Sprout, 
  Users, 
  Boxes, 
  FileSpreadsheet, 
  History, 
  TrendingUp,
  X,
  LogOut,
  ClipboardList
} from "lucide-react";
import { useTranslation } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const allMenuItems = [
    { id: "dashboard", label: t("dashboard"), icon: LayoutDashboard, roles: ["Owner"] },
    { id: "farmers", label: t("farmers"), icon: Sprout, roles: ["Owner"] },
    { id: "customers", label: t("customers"), icon: Users, roles: ["Owner", "Staff"] },
    { id: "inventory", label: t("inventory"), icon: Boxes, roles: ["Owner", "Staff"] },
    { id: "farmer-stock", label: "Farmer Stock", icon: ClipboardList, roles: ["Owner"] },
    { id: "sales", label: t("sales"), icon: FileSpreadsheet, roles: ["Owner", "Staff"] },
    { id: "history", label: t("history"), icon: History, roles: ["Owner", "Staff"] },
    { id: "reports", label: t("reports"), icon: TrendingUp, roles: ["Owner"] },
    { id: "staff", label: "Staff Management", icon: Users, roles: ["Owner"] },
  ];

  const userRole = user?.role || "Staff";
  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <>
      {/* Backdrop overlay for mobile view */}
      <div 
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        id="sidebar-backdrop"
      />

      {/* Sidebar container */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0F172A] text-white flex flex-col h-screen transition-transform duration-300 ease-in-out border-r border-slate-800 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`} 
        id="sidebar-container"
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 w-8 h-8 rounded flex items-center justify-center font-bold text-lg text-white">
              M
            </div>
            <div>
              <h1 className="font-display font-bold text-xl tracking-tight leading-none text-white">{t("mandi_title")}</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{t("apmc")}</p>
            </div>
          </div>
          {/* Close button for mobile/tablet screens */}
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg lg:hidden transition-all duration-200"
            id="close-sidebar-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Controls */}
        <nav className="flex-1 px-4 py-6 space-y-1 block overflow-y-auto">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose(); // Automatically close mobile drawer when an item is selected
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-emerald-600/15 text-emerald-400 font-semibold"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Info with Logout option */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 bg-slate-900/50 flex flex-col gap-3">
          <div className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-xs font-bold text-emerald-400 shrink-0">
                {user ? getInitials(user.name) : "US"}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-300 truncate">{user?.name || "User"}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{user?.role || "Staff"}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-800/60 hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-900 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            id="sidebar-logout-btn"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
