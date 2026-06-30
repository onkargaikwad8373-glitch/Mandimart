import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ShoppingBag, User, Plus, Trash2, Coins, AlertCircle, CheckCircle,
  Printer, X, Sprout, ChevronRight, RefreshCw, Receipt, Search,
  Package, Weight, Tag, Hash, UserPlus,
} from "lucide-react";
import { Customer, Vegetable, InvoiceItem, Invoice, PaymentMethod } from "../types";
import InvoiceDetailModal from "./InvoiceDetailModal";
import { useTranslation } from "../context/LanguageContext";
import { apiFetch } from "../utils/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type BillingStep = "farmer" | "vegetable" | "bags" | "weight" | "rate" | "customer" | "total";
const STEPS: BillingStep[] = ["farmer", "vegetable", "bags", "weight", "rate", "customer", "total"];

interface CartItem {
  id: string;
  farmerName: string;
  farmerId: string;
  vegetable: Vegetable;
  bags: number;
  weight: number;
  rate: number;
  total: number;
}

interface BillSession {
  id: string;
  tabLabel: string;
  currentStep: BillingStep;
  // Farmer step
  farmerQuery: string;
  selectedFarmerName: string;
  selectedFarmerId: string;
  farmerVegetables: Vegetable[];
  showFarmerDropdown: boolean;
  // Vegetable step
  selectedVegetable: Vegetable | null;
  vegQuery: string;
  // Entry fields
  bags: string;
  weight: string;
  rate: string;
  // Customer (free-text, optionally from saved list)
  customerName: string;
  customerId: string;
  customerMobile: string;
  customerBusiness: string;
  showCustDropdown: boolean;
  // Cart
  cartItems: CartItem[];
  // Payment
  paymentMethod: PaymentMethod;
  amountPaid: string;
  // Status
  submitError: string;
  isSubmitting: boolean;
  completedInvoice: Invoice | null;
}

let _sessionCount = 1;
function createSession(): BillSession {
  return {
    id: `s${Date.now()}${_sessionCount++}`,
    tabLabel: "New Bill",
    currentStep: "farmer",
    farmerQuery: "",
    selectedFarmerName: "",
    selectedFarmerId: "",
    farmerVegetables: [],
    showFarmerDropdown: false,
    selectedVegetable: null,
    vegQuery: "",
    bags: "",
    weight: "",
    rate: "",
    customerName: "",
    customerId: "",
    customerMobile: "",
    customerBusiness: "",
    showCustDropdown: false,
    cartItems: [],
    paymentMethod: "Cash",
    amountPaid: "",
    submitError: "",
    isSubmitting: false,
    completedInvoice: null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SalesSheet() {
  const { dt, language } = useTranslation();

  // Global data
  const [allVegetables, setAllVegetables] = useState<Vegetable[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // Tab / session management
  const initialSession = createSession();
  const [sessions, setSessions] = useState<BillSession[]>([initialSession]);
  const [activeTabId, setActiveTabId] = useState<string>(initialSession.id);

  // Focus refs (for the active step)
  const farmerInputRef = useRef<HTMLInputElement>(null);
  const vegSearchRef   = useRef<HTMLInputElement>(null);
  const bagsRef        = useRef<HTMLInputElement>(null);
  const weightRef      = useRef<HTMLInputElement>(null);
  const rateRef        = useRef<HTMLInputElement>(null);
  const custInputRef   = useRef<HTMLInputElement>(null);

  // ── Fetch stock + customers ─────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      setDataError("");
      const [rv, rc] = await Promise.all([
        apiFetch("/api/vegetables"),
        apiFetch("/api/customers"),
      ]);
      if (!rv.ok || !rc.ok) throw new Error("Could not load billing data");
      setAllVegetables(await rv.json());
      setCustomers(await rc.json());
    } catch (e: any) {
      setDataError(e.message || "Data load error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [language]);

  // ── Active session helpers ──────────────────────────────────────────────
  const activeSession = sessions.find(s => s.id === activeTabId) ?? sessions[0];

  const patchSession = useCallback((id: string, patch: Partial<BillSession>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  // Shorthand: patch the active session
  const patch = useCallback((p: Partial<BillSession>) => {
    setSessions(prev => prev.map(s => s.id === activeTabId ? { ...s, ...p } : s));
  }, [activeTabId]);

  // ── Auto-focus on step change ───────────────────────────────────────────
  useEffect(() => {
    const step = activeSession.currentStep;
    const t = setTimeout(() => {
      if      (step === "farmer")   farmerInputRef.current?.focus();
      else if (step === "vegetable") vegSearchRef.current?.focus();
      else if (step === "bags")     bagsRef.current?.focus();
      else if (step === "weight")   weightRef.current?.focus();
      else if (step === "rate")     rateRef.current?.focus();
      else if (step === "customer") custInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [activeTabId, activeSession.currentStep]);

  // ── Unique farmers list ─────────────────────────────────────────────────
  const uniqueFarmers = React.useMemo(() => {
    const seen = new Map<string, { name: string; farmerId: string }>();
    allVegetables.forEach(v => {
      const key = (v.farmerName || "").toLowerCase();
      if (!seen.has(key)) seen.set(key, { name: v.farmerName, farmerId: v.farmerId });
    });
    return Array.from(seen.values());
  }, [allVegetables]);

  // ── Derived: filtered lists for active session ──────────────────────────
  const farmerSuggestions = uniqueFarmers.filter(f =>
    activeSession.farmerQuery.trim().length > 0 &&
    f.name.toLowerCase().includes(activeSession.farmerQuery.toLowerCase())
  );

  const filteredVegs = activeSession.farmerVegetables.filter(v =>
    activeSession.vegQuery.trim() === "" ||
    v.vegetableName.toLowerCase().includes(activeSession.vegQuery.toLowerCase())
  );

  const filteredCusts = customers.filter(c =>
    activeSession.customerName.trim().length > 0 &&
    (
      (c.name || "").toLowerCase().includes(activeSession.customerName.toLowerCase()) ||
      (c.businessName || "").toLowerCase().includes(activeSession.customerName.toLowerCase())
    )
  );

  // ── Tab management ──────────────────────────────────────────────────────
  const addTab = () => {
    const s = createSession();
    setSessions(prev => [...prev, s]);
    setActiveTabId(s.id);
  };

  const closeTab = (id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (next.length === 0) {
        const fresh = createSession();
        setActiveTabId(fresh.id);
        return [fresh];
      }
      if (activeTabId === id) {
        setActiveTabId(next[next.length - 1].id);
      }
      return next;
    });
  };

  const resetSession = (id: string) => {
    const fresh = createSession();
    setSessions(prev => prev.map(s => s.id === id ? { ...fresh, id } : s));
  };

  // ── Step 1: Farmer ──────────────────────────────────────────────────────
  const handleFarmerQuery = (val: string) => {
    patch({
      farmerQuery: val,
      selectedFarmerName: "",
      selectedFarmerId: "",
      showFarmerDropdown: val.trim().length > 0,
    });
  };

  const selectFarmer = (farmer: { name: string; farmerId: string }) => {
    const vegs = allVegetables.filter(
      v => (v.farmerName || "").toLowerCase() === farmer.name.toLowerCase() && v.quantity > 0
    );
    patch({
      farmerQuery: farmer.name,
      selectedFarmerName: farmer.name,
      selectedFarmerId: farmer.farmerId,
      farmerVegetables: vegs,
      showFarmerDropdown: false,
      vegQuery: "",
      selectedVegetable: null,
      currentStep: "vegetable",
    });
  };

  // ── Step 2: Vegetable ───────────────────────────────────────────────────
  const selectVegetable = (veg: Vegetable) => {
    patch({
      selectedVegetable: veg,
      bags: "",
      weight: "",
      rate: String(veg.sellingPrice),
      currentStep: "bags",
    });
  };

  // ── Step 3: Bags (allow 0) ──────────────────────────────────────────────
  const handleBagsChange = (val: string) => {
    const n = parseFloat(val);
    // Auto-fill weight only if bags > 0; for 0 or empty, leave weight blank
    const autoWeight = (!isNaN(n) && n > 0) ? String(n * 20) : "";
    patch({ bags: val, weight: autoWeight });
  };

  const handleBagsNext = () => {
    // bags can be 0 or any number; just need it to not be invalid text
    const val = activeSession.bags.trim();
    const n = parseFloat(val);
    if (val !== "" && isNaN(n)) return; // invalid text
    if (val === "") {
      // treat empty as 0
      patch({ bags: "0", weight: "", currentStep: "weight" });
    } else {
      patch({ currentStep: "weight" });
    }
  };

  // ── Step 4: Weight ──────────────────────────────────────────────────────
  const handleWeightNext = () => {
    const n = parseFloat(activeSession.weight);
    if (isNaN(n) || n <= 0) return;
    patch({ currentStep: "rate" });
  };

  // ── Step 5: Rate ────────────────────────────────────────────────────────
  const handleRateNext = () => {
    const n = parseFloat(activeSession.rate);
    if (isNaN(n) || n <= 0) return;
    patch({ currentStep: "customer" });
  };

  // ── Step 6: Customer (free-text) ────────────────────────────────────────
  const handleCustInput = (val: string) => {
    patch({
      customerName: val,
      customerId: "",
      customerMobile: "",
      customerBusiness: "",
      showCustDropdown: val.trim().length > 0,
      // Update tab label as user types name
      tabLabel: val.trim() || "New Bill",
    });
  };

  const selectSavedCustomer = (c: Customer) => {
    patch({
      customerName: c.name,
      customerId: c.id,
      customerMobile: c.mobile || "",
      customerBusiness: c.businessName || "",
      showCustDropdown: false,
      tabLabel: c.name,
      currentStep: "total",
    });
  };

  const proceedWithFreeTextCustomer = () => {
    const name = activeSession.customerName.trim();
    if (!name) return;
    patch({
      customerId: `walkin-${Date.now()}`,
      showCustDropdown: false,
      tabLabel: name,
      currentStep: "total",
    });
  };

  // ── Step 7: Add to cart ─────────────────────────────────────────────────
  const itemTotal =
    (parseFloat(activeSession.weight) || 0) * (parseFloat(activeSession.rate) || 0);

  const addToCart = () => {
    const s = activeSession;
    if (!s.selectedVegetable || !s.customerName.trim()) return;
    const wt = parseFloat(s.weight);
    const rt = parseFloat(s.rate);
    if (isNaN(wt) || wt <= 0 || isNaN(rt) || rt <= 0) return;

    const newItem: CartItem = {
      id: Date.now().toString(),
      farmerName: s.selectedFarmerName,
      farmerId: s.selectedFarmerId,
      vegetable: s.selectedVegetable,
      bags: parseFloat(s.bags) || 0,
      weight: wt,
      rate: rt,
      total: wt * rt,
    };

    // Customer info (keep for next items)
    const custId = s.customerId || `walkin-${Date.now()}`;
    const custName = s.customerName;
    const custMobile = s.customerMobile;
    const custBusiness = s.customerBusiness;

    setSessions(prev => prev.map(sess => {
      if (sess.id !== activeTabId) return sess;
      return {
        ...sess,
        cartItems: [...sess.cartItems, newItem],
        // Reset item fields, keep customer
        farmerQuery: "",
        selectedFarmerName: "",
        selectedFarmerId: "",
        farmerVegetables: [],
        showFarmerDropdown: false,
        selectedVegetable: null,
        vegQuery: "",
        bags: "",
        weight: "",
        rate: "",
        // Keep customer locked
        customerName: custName,
        customerId: custId,
        customerMobile: custMobile,
        customerBusiness: custBusiness,
        showCustDropdown: false,
        tabLabel: custName,
        currentStep: "farmer",
        submitError: "",
      };
    }));
  };

  const removeCartItem = (sessionId: string, itemId: string) => {
    patchSession(sessionId, {
      cartItems: sessions.find(s => s.id === sessionId)?.cartItems.filter(i => i.id !== itemId) || [],
    });
  };

  // ── Bill totals ─────────────────────────────────────────────────────────
  const subtotal = activeSession.cartItems.reduce((s, i) => s + i.total, 0);
  const gst      = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = subtotal + gst;

  const effectiveAmountPaid =
    activeSession.paymentMethod === "Cash" || activeSession.paymentMethod === "Online"
      ? grandTotal
      : activeSession.paymentMethod === "Pending Payment"
      ? 0
      : parseFloat(activeSession.amountPaid) || 0;

  const amountPending = Math.max(0, grandTotal - effectiveAmountPaid);

  // ── Submit invoice ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const s = activeSession;
    if (!s.customerName.trim() || s.cartItems.length === 0) return;

    patch({ isSubmitting: true, submitError: "" });

    try {
      const items: InvoiceItem[] = s.cartItems.map(ci => ({
        farmerId: ci.farmerId,
        farmerName: ci.farmerName,
        vegetableId: ci.vegetable.id,
        vegetableName: ci.vegetable.vegetableName,
        quality: ci.vegetable.quality,
        quantity: ci.weight,
        bags: ci.bags,
        rate: ci.rate,
        purchasePrice: ci.vegetable.purchasePrice,
        amount: ci.total,
      }));

      const payStatus =
        s.paymentMethod === "Cash" || s.paymentMethod === "Online" ? "Paid"
        : s.paymentMethod === "Pending Payment" ? "Unpaid"
        : "Partial";

      const custId = s.customerId || `walkin-${Date.now()}`;

      const res = await apiFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: custId,
          customerName: s.customerName.trim(),
          customerMobile: s.customerMobile || "",
          customerBusiness: s.customerBusiness || "",
          items,
          subtotal,
          gst,
          total: grandTotal,
          amountPaid: effectiveAmountPaid,
          amountPending,
          paymentMethod: s.paymentMethod,
          paymentStatus: payStatus,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Invoice creation failed");
      }

      const invoice: Invoice = await res.json();
      patch({ completedInvoice: invoice, isSubmitting: false });
    } catch (e: any) {
      patch({ submitError: e.message || "Something went wrong", isSubmitting: false });
    }
  };

  // ── Step index helpers ──────────────────────────────────────────────────
  const stepIdx = STEPS.indexOf(activeSession.currentStep);
  const isStepDone = (step: BillingStep) => STEPS.indexOf(step) < stepIdx;

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center py-32" id="salessheet-loading">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
          <p className="text-slate-400 font-semibold text-sm">Loading billing console...</p>
        </div>
      </div>
    );
  }

  // ── Completed Invoice View (replaces step area for this session) ─────────
  const renderCompletedInvoice = () => {
    const inv = activeSession.completedInvoice!;
    return (
      <div className="space-y-5" id="invoice-success-view">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-emerald-900">Bill Created!</h3>
          <p className="text-emerald-700 text-sm font-semibold">
            Invoice <span className="font-mono">{inv.invoiceNumber}</span> saved for{" "}
            <span className="font-bold">{inv.customerName}</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <InvoiceDetailModal invoice={inv} />
          <div className="flex gap-3 justify-end mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 border border-emerald-600 hover:bg-emerald-50 text-emerald-700 font-semibold rounded-lg text-sm cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" /> Print Bill
            </button>
            <button
              onClick={() => {
                resetSession(activeTabId);
                fetchData();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm cursor-pointer transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Bill
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" id="salessheet-module">

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm max-sm:flex-col max-sm:items-start max-sm:gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            Billing Console
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage multiple customer bills simultaneously using tabs.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Stock
        </button>
      </div>

      {dataError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {dataError}
        </div>
      )}

      {/* ── Customer Tabs ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-0 border-b border-slate-200 overflow-x-auto">
          {sessions.map((sess, idx) => {
            const isActive = sess.id === activeTabId;
            const hasItems = sess.cartItems.length > 0;
            const isDone = !!sess.completedInvoice;
            return (
              <div
                key={sess.id}
                className={`group flex items-center gap-2 px-4 py-3 border-r border-slate-100 cursor-pointer shrink-0 transition-all relative ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "bg-white hover:bg-emerald-50 text-slate-600"
                }`}
                onClick={() => setActiveTabId(sess.id)}
                id={`tab-${sess.id}`}
              >
                {/* Active indicator line */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
                )}

                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isActive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : (idx + 1)}
                </div>

                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate max-w-[100px] ${isActive ? "text-white" : "text-slate-700"}`}>
                    {sess.tabLabel}
                  </p>
                  {hasItems && !isDone && (
                    <p className={`text-[10px] font-semibold ${isActive ? "text-emerald-100" : "text-emerald-600"}`}>
                      {sess.cartItems.length} item{sess.cartItems.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(sess.id); }}
                  className={`p-0.5 rounded-full ml-1 transition-colors shrink-0 ${
                    isActive
                      ? "text-emerald-100 hover:text-white hover:bg-emerald-500"
                      : "text-slate-300 hover:text-red-500"
                  }`}
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Add new tab */}
          <button
            onClick={addTab}
            id="add-tab-btn"
            className="flex items-center gap-1.5 px-4 py-3 text-emerald-600 hover:bg-emerald-50 text-xs font-bold transition-colors cursor-pointer shrink-0 border-r border-slate-100"
            title="Add new customer bill"
          >
            <Plus className="w-4 h-4" />
            New Customer
          </button>
        </div>

        {/* ── Active Tab Content ──────────────────────────────────────── */}
        <div className="p-5">

          {/* Show invoice success view if completed */}
          {activeSession.completedInvoice ? renderCompletedInvoice() : (
            <div className="grid grid-cols-12 gap-5">

              {/* ── LEFT: Guided Steps ──────────────────────────────── */}
              <div className="col-span-7 max-lg:col-span-12 space-y-4">

                {/* Step progress bar */}
                <div className="flex items-center gap-1 flex-wrap">
                  {STEPS.map((step, idx) => {
                    const done = isStepDone(step);
                    const active = activeSession.currentStep === step;
                    const canClick = STEPS.indexOf(step) < STEPS.indexOf(activeSession.currentStep);
                    return (
                      <React.Fragment key={step}>
                        <button
                          type="button"
                          disabled={!canClick}
                          onClick={() => canClick && patch({ currentStep: step })}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            active ? "bg-emerald-600 text-white shadow-sm"
                            : done && canClick ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                            : done ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-50 text-slate-400 border border-slate-200"
                          }`}
                        >
                          {done && <CheckCircle className="w-3 h-3" />}
                          <span>{
                            step === "farmer" ? "Farmer" :
                            step === "vegetable" ? "Vegetable" :
                            step === "bags" ? "Bags" :
                            step === "weight" ? "Weight" :
                            step === "rate" ? "Rate" :
                            step === "customer" ? "Customer" : "Total"
                          }</span>
                        </button>
                        {idx < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Step card */}
                <div className="bg-white rounded-xl border-2 border-emerald-500 shadow-sm p-6 min-h-[280px]">

                  {/* ═══ STEP 1: FARMER ══════════════════════════════════ */}
                  {activeSession.currentStep === "farmer" && (
                    <div className="space-y-4" id="step-farmer">
                      <StepHeader step={1} title="Select Farmer" icon={<Sprout className="w-5 h-5" />} />

                      {activeSession.customerName && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-bold text-emerald-800">
                          👤 Customer locked: {activeSession.customerName}
                        </div>
                      )}

                      <div className="relative">
                        <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                        <input
                          ref={farmerInputRef}
                          id="farmer-name-input"
                          type="text"
                          placeholder="Type farmer name..."
                          value={activeSession.farmerQuery}
                          onChange={e => handleFarmerQuery(e.target.value)}
                          onFocus={() => {
                            if (activeSession.farmerQuery.trim()) patch({ showFarmerDropdown: true });
                          }}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-base font-semibold text-slate-800 transition-colors"
                        />
                        {activeSession.showFarmerDropdown && farmerSuggestions.length > 0 && (
                          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                            {farmerSuggestions.map(f => (
                              <button key={f.farmerId} type="button"
                                onClick={() => selectFarmer(f)}
                                className="w-full text-left px-4 py-3 hover:bg-emerald-50 flex items-center gap-3 border-b border-slate-50 last:border-0 cursor-pointer transition-colors"
                              >
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                                  {f.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">{dt(f.name)}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {allVegetables.filter(v => v.farmerName.toLowerCase() === f.name.toLowerCase() && v.quantity > 0).length} item(s) in stock
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {activeSession.farmerQuery.trim().length > 0 && farmerSuggestions.length === 0 && (
                        <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> No farmer found with available stock.
                        </p>
                      )}

                    </div>
                  )}

                  {/* ═══ STEP 2: VEGETABLE ═══════════════════════════════ */}
                  {activeSession.currentStep === "vegetable" && (
                    <div className="space-y-4" id="step-vegetable">
                      <div className="flex items-center">
                        <StepHeader step={2} title="Select Vegetable" icon={<Package className="w-5 h-5" />} />
                        <button onClick={() => patch({ currentStep: "farmer" })}
                          className="ml-auto text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                          ← Farmer
                        </button>
                      </div>
                      <div className="text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 font-semibold text-emerald-800">
                        🧑‍🌾 {activeSession.selectedFarmerName} — {activeSession.farmerVegetables.length} item(s)
                      </div>
                      {activeSession.farmerVegetables.length === 0 ? (
                        <p className="text-slate-400 font-semibold text-sm text-center py-8">No stock available from this farmer.</p>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input ref={vegSearchRef} type="text"
                              placeholder="Search vegetable..."
                              value={activeSession.vegQuery}
                              onChange={e => patch({ vegQuery: e.target.value })}
                              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm font-semibold text-slate-800 transition-colors"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3 max-h-52 overflow-y-auto pr-1">
                            {filteredVegs.map(veg => (
                              <button key={veg.id} type="button" onClick={() => selectVegetable(veg)}
                                className="text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all cursor-pointer group"
                              >
                                <div className="flex justify-between items-start">
                                  <p className="font-bold text-slate-900 text-sm group-hover:text-emerald-800">{dt(veg.vegetableName)}</p>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                    veg.quality === "Premium" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-600 border-slate-200"
                                  }`}>{veg.quality}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 font-semibold">
                                  Stock: <span className="text-slate-700 font-bold">{veg.quantity.toFixed(1)} kg</span>
                                </p>
                                <p className="text-xs text-emerald-700 font-bold mt-0.5">₹{veg.sellingPrice}/kg</p>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ═══ STEP 3: BAGS (allow 0) ══════════════════════════ */}
                  {activeSession.currentStep === "bags" && (
                    <div className="space-y-4" id="step-bags">
                      <div className="flex items-center">
                        <StepHeader step={3} title="Number of Bags" icon={<Hash className="w-5 h-5" />} />
                        <button onClick={() => patch({ currentStep: "vegetable" })}
                          className="ml-auto text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                          ← Vegetable
                        </button>
                      </div>
                      <div className="text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 font-semibold text-emerald-800">
                        🥦 {dt(activeSession.selectedVegetable?.vegetableName || "")} &nbsp;·&nbsp;
                        Stock: {activeSession.selectedVegetable?.quantity.toFixed(1)} kg &nbsp;·&nbsp;
                        ₹{activeSession.selectedVegetable?.sellingPrice}/kg
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          No. of Bags &nbsp;<span className="text-slate-400 font-normal normal-case">(1 bag = 20 kg · Enter 0 for loose weight)</span>
                        </label>
                        <input
                          ref={bagsRef}
                          id="bags-input"
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="e.g. 2 or 0 for direct weight"
                          value={activeSession.bags}
                          onChange={e => handleBagsChange(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleBagsNext()}
                          className="w-full py-3.5 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-2xl font-bold text-slate-900 transition-colors"
                        />
                        {activeSession.bags !== "" && parseFloat(activeSession.bags) > 0 && (
                          <p className="text-xs text-emerald-700 font-semibold mt-1.5">
                            Auto-fills weight → <span className="font-bold">{(parseFloat(activeSession.bags) * 20).toFixed(1)} kg</span>
                          </p>
                        )}
                        {activeSession.bags === "0" || activeSession.bags === "" ? (
                          <p className="text-xs text-slate-400 font-semibold mt-1.5">
                            Enter 0 or leave blank to type weight manually in the next step.
                          </p>
                        ) : null}
                      </div>
                      <button onClick={handleBagsNext} id="bags-next-btn"
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm cursor-pointer transition-colors shadow-sm">
                        Next: Weight <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* ═══ STEP 4: WEIGHT ══════════════════════════════════ */}
                  {activeSession.currentStep === "weight" && (
                    <div className="space-y-4" id="step-weight">
                      <div className="flex items-center">
                        <StepHeader step={4} title="Weight (Kg)" icon={<Weight className="w-5 h-5" />} />
                        <button onClick={() => patch({ currentStep: "bags" })}
                          className="ml-auto text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                          ← Bags
                        </button>
                      </div>
                      <div className="text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 font-semibold text-emerald-800">
                        Bags: <span className="font-bold">{activeSession.bags || "0"}</span>
                        {parseFloat(activeSession.bags) > 0 && (
                          <span> &nbsp;·&nbsp; Auto-calc: <span className="font-bold">{(parseFloat(activeSession.bags) * 20).toFixed(1)} kg</span></span>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Actual Weight in Kg
                        </label>
                        <input
                          ref={weightRef}
                          id="weight-input"
                          type="number"
                          min="0.1"
                          step="0.1"
                          placeholder="e.g. 50.5"
                          value={activeSession.weight}
                          onChange={e => patch({ weight: e.target.value })}
                          onKeyDown={e => e.key === "Enter" && handleWeightNext()}
                          className="w-full py-3.5 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-2xl font-bold text-slate-900 transition-colors"
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5 font-semibold">
                          You can adjust the weight even if auto-filled.
                        </p>
                      </div>
                      <button
                        onClick={handleWeightNext}
                        disabled={!activeSession.weight || parseFloat(activeSession.weight) <= 0}
                        id="weight-next-btn"
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors shadow-sm"
                      >
                        Next: Rate <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* ═══ STEP 5: RATE ════════════════════════════════════ */}
                  {activeSession.currentStep === "rate" && (
                    <div className="space-y-4" id="step-rate">
                      <div className="flex items-center">
                        <StepHeader step={5} title="Rate (₹/kg)" icon={<Tag className="w-5 h-5" />} />
                        <button onClick={() => patch({ currentStep: "weight" })}
                          className="ml-auto text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                          ← Weight
                        </button>
                      </div>
                      <div className="text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 font-semibold text-emerald-800">
                        Weight: <span className="font-bold">{activeSession.weight} kg</span>
                        &nbsp;·&nbsp; Listed price: <span className="font-bold">₹{activeSession.selectedVegetable?.sellingPrice}/kg</span>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Selling Rate ₹/kg
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">₹</span>
                          <input
                            ref={rateRef}
                            id="rate-input"
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="e.g. 25"
                            value={activeSession.rate}
                            onChange={e => patch({ rate: e.target.value })}
                            onKeyDown={e => e.key === "Enter" && handleRateNext()}
                            className="w-full py-3.5 pl-9 pr-4 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-2xl font-bold text-slate-900 transition-colors"
                          />
                        </div>
                        {activeSession.rate && activeSession.weight && parseFloat(activeSession.rate) > 0 && parseFloat(activeSession.weight) > 0 && (
                          <p className="text-sm text-emerald-700 font-bold mt-2">
                            Preview Total: ₹{(parseFloat(activeSession.weight) * parseFloat(activeSession.rate)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={handleRateNext}
                        disabled={!activeSession.rate || parseFloat(activeSession.rate) <= 0}
                        id="rate-next-btn"
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors shadow-sm"
                      >
                        Next: Customer <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* ═══ STEP 6: CUSTOMER (free-text) ════════════════════ */}
                  {activeSession.currentStep === "customer" && (
                    <div className="space-y-4" id="step-customer">
                      <div className="flex items-center">
                        <StepHeader step={6} title="Customer Name" icon={<User className="w-5 h-5" />} />
                        <button onClick={() => patch({ currentStep: "rate" })}
                          className="ml-auto text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                          ← Rate
                        </button>
                      </div>
                      <p className="text-sm text-slate-500">
                        Type any customer name, or select from saved list below.
                      </p>

                      <div className="relative">
                        <User className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                        <input
                          ref={custInputRef}
                          id="customer-name-input"
                          type="text"
                          placeholder="Customer name (saved or new)..."
                          value={activeSession.customerName}
                          onChange={e => handleCustInput(e.target.value)}
                          onFocus={() => {
                            if (activeSession.customerName.trim()) patch({ showCustDropdown: true });
                          }}
                          onKeyDown={e => e.key === "Enter" && activeSession.customerName.trim() && proceedWithFreeTextCustomer()}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-base font-semibold text-slate-800 transition-colors"
                        />

                        {activeSession.showCustDropdown && filteredCusts.length > 0 && (
                          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                            {filteredCusts.map(c => (
                              <button key={c.id} type="button"
                                onClick={() => selectSavedCustomer(c)}
                                className="w-full text-left px-4 py-3 hover:bg-emerald-50 flex items-center gap-3 border-b border-slate-50 last:border-0 cursor-pointer transition-colors"
                              >
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                                  {c.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">{dt(c.name)}</p>
                                  {c.businessName && <p className="text-[10px] text-emerald-700 font-semibold">{dt(c.businessName)}</p>}
                                  <p className="text-[10px] text-slate-400 font-mono">{c.mobile}</p>
                                </div>
                                <span className="ml-auto text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">Saved</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={proceedWithFreeTextCustomer}
                        disabled={!activeSession.customerName.trim()}
                        id="customer-next-btn"
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors shadow-sm"
                      >
                        Next: Item Total <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* Quick saved customer list */}
                      {activeSession.customerName.trim() === "" && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Saved Customers</p>
                          <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                            {customers.slice(0, 20).map(c => (
                              <button key={c.id} type="button"
                                onClick={() => selectSavedCustomer(c)}
                                className="text-left px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg transition-all cursor-pointer"
                              >
                                <p className="font-bold text-slate-900 text-xs">{dt(c.name)}</p>
                                {c.businessName && <p className="text-[10px] text-emerald-600 font-semibold truncate">{dt(c.businessName)}</p>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ STEP 7: ITEM TOTAL ══════════════════════════════ */}
                  {activeSession.currentStep === "total" && (
                    <div className="space-y-4" id="step-total">
                      <div className="flex items-center">
                        <StepHeader step={7} title="Item Total" icon={<Coins className="w-5 h-5" />} />
                        <button onClick={() => patch({ currentStep: "customer" })}
                          className="ml-auto text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                          ← Customer
                        </button>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2.5">
                        {[
                          ["Farmer", activeSession.selectedFarmerName],
                          ["Vegetable", dt(activeSession.selectedVegetable?.vegetableName || "")],
                          ["Quality", activeSession.selectedVegetable?.quality || ""],
                          ["Bags", activeSession.bags || "0"],
                          ["Weight", `${activeSession.weight} kg`],
                          ["Rate", `₹${activeSession.rate}/kg`],
                          ["Customer", activeSession.customerName],
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between text-sm">
                            <span className="text-slate-500 font-semibold">{label}</span>
                            <span className="font-bold text-slate-900">{value}</span>
                          </div>
                        ))}
                        <div className="border-t border-slate-300 pt-3 flex justify-between">
                          <span className="font-bold text-slate-700 text-base">Item Total</span>
                          <span className="font-bold text-emerald-700 text-xl font-mono">
                            ₹{itemTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={addToCart}
                        disabled={!activeSession.customerName.trim() || !activeSession.weight || parseFloat(activeSession.weight) <= 0 || parseFloat(activeSession.rate) <= 0}
                        id="add-to-cart-btn"
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-base disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors shadow-sm"
                      >
                        <Plus className="w-5 h-5" /> Add to Bill
                      </button>
                    </div>
                  )}

                </div>
              </div>

              {/* ── RIGHT: Bill Summary ─────────────────────────────────── */}
              <div className="col-span-5 max-lg:col-span-12">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-20">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-emerald-600" /> Bill Summary
                    </h3>
                    {activeSession.customerName && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-800 max-w-[120px] truncate">
                        {activeSession.customerName}
                      </div>
                    )}
                  </div>

                  {activeSession.cartItems.length === 0 ? (
                    <div className="py-12 text-center text-slate-300 flex flex-col items-center gap-2">
                      <ShoppingBag className="w-10 h-10" />
                      <p className="text-sm font-semibold">No items added yet</p>
                      <p className="text-xs">Complete the steps on the left</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {activeSession.cartItems.map(item => (
                          <div key={item.id}
                            className="flex items-start justify-between bg-slate-50 rounded-lg p-3 border border-slate-100"
                            id={`cart-item-${item.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-900 text-sm">{dt(item.vegetable.vegetableName)}</p>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate">
                                {item.farmerName} · {item.bags} bags · {item.weight} kg · ₹{item.rate}/kg
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-2 shrink-0">
                              <span className="font-mono font-bold text-emerald-700 text-sm">
                                ₹{item.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </span>
                              <button
                                onClick={() => removeCartItem(activeTabId, item.id)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div className="border-t border-slate-200 mt-4 pt-3 space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500 font-semibold">
                          <span>Subtotal ({activeSession.cartItems.length} item{activeSession.cartItems.length > 1 ? "s" : ""})</span>
                          <span className="font-mono">₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 font-semibold">
                          <span>GST (5%)</span>
                          <span className="font-mono">₹{gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base text-slate-900 border-t border-slate-200 pt-2">
                          <span>Grand Total</span>
                          <span className="font-mono text-emerald-700">₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Payment */}
                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(["Cash", "Online", "Partial Payment", "Pending Payment"] as PaymentMethod[]).map(m => (
                              <button key={m} type="button"
                                onClick={() => patch({ paymentMethod: m })}
                                id={`pay-method-${m.replace(/\s+/g, "-").toLowerCase()}`}
                                className={`py-2 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                  activeSession.paymentMethod === m
                                    ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>

                        {activeSession.paymentMethod === "Partial Payment" && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount Paid (₹)</label>
                            <input
                              type="number"
                              id="partial-amount-input"
                              min="1"
                              step="1"
                              max={grandTotal}
                              placeholder={`Max ₹${grandTotal.toFixed(2)}`}
                              value={activeSession.amountPaid}
                              onChange={e => patch({ amountPaid: e.target.value })}
                              className="w-full p-2.5 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-sm font-mono font-bold"
                            />
                            {activeSession.amountPaid && (
                              <p className="text-[10px] text-amber-600 font-bold mt-1">
                                Pending: ₹{Math.max(0, grandTotal - (parseFloat(activeSession.amountPaid) || 0)).toFixed(2)}
                              </p>
                            )}
                          </div>
                        )}

                        {activeSession.submitError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg font-semibold flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {activeSession.submitError}
                          </div>
                        )}

                        <button
                          onClick={handleSubmit}
                          disabled={activeSession.isSubmitting || !activeSession.customerName.trim() || activeSession.cartItems.length === 0}
                          id="submit-bill-btn"
                          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors shadow-md"
                        >
                          {activeSession.isSubmitting ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Saving Bill...
                            </>
                          ) : (
                            <>
                              <Receipt className="w-4 h-4" /> Generate Invoice
                            </>
                          )}
                        </button>

                        {activeSession.cartItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => resetSession(activeTabId)}
                            className="w-full py-2 border border-red-200 hover:bg-red-50 text-red-500 font-semibold rounded-lg text-xs cursor-pointer transition-colors"
                          >
                            Clear This Bill
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step Header sub-component ────────────────────────────────────────────────
function StepHeader({ step, title, icon }: { step: number; title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step {step} of 7</p>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      </div>
    </div>
  );
}
