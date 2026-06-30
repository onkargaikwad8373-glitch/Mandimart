import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingBag,
  User,
  Plus,
  Trash2,
  Coins,
  AlertCircle,
  CheckCircle,
  Printer,
  X,
  Sprout,
  ChevronRight,
  RefreshCw,
  Receipt,
  Search,
  Package,
  Weight,
  Tag,
  Hash,
} from "lucide-react";
import { Customer, Vegetable, InvoiceItem, Invoice, PaymentMethod } from "../types";
import InvoiceDetailModal from "./InvoiceDetailModal";
import { useTranslation } from "../context/LanguageContext";
import { apiFetch } from "../utils/api";
import { useAuth } from "../context/AuthContext";

// ─── Step definitions ────────────────────────────────────────────────────────
type BillingStep = "farmer" | "vegetable" | "bags" | "weight" | "rate" | "customer" | "total";
const STEPS: BillingStep[] = ["farmer", "vegetable", "bags", "weight", "rate", "customer", "total"];

const STEP_LABELS: Record<BillingStep, string> = {
  farmer: "Farmer",
  vegetable: "Vegetable",
  bags: "No. of Bags",
  weight: "Weight (Kg)",
  rate: "Rate (₹/kg)",
  customer: "Customer",
  total: "Item Total",
};

const STEP_ICONS: Record<BillingStep, React.ReactNode> = {
  farmer: <Sprout className="w-4 h-4" />,
  vegetable: <Package className="w-4 h-4" />,
  bags: <Hash className="w-4 h-4" />,
  weight: <Weight className="w-4 h-4" />,
  rate: <Tag className="w-4 h-4" />,
  customer: <User className="w-4 h-4" />,
  total: <Coins className="w-4 h-4" />,
};

// ─── Billing Item (before adding to cart) ────────────────────────────────────
interface BillingEntry {
  farmerName: string;
  farmerId: string;
  vegetable: Vegetable;
  bags: number;
  weight: number;
  rate: number;
  total: number;
}

// ─── Cart Item (added to bill) ────────────────────────────────────────────────
interface CartItem extends BillingEntry {
  id: string; // local key
}

export default function SalesSheet() {
  const { dt, language } = useTranslation();
  const { user } = useAuth();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [allVegetables, setAllVegetables] = useState<Vegetable[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // ── Billing Flow State ────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<BillingStep>("farmer");

  // Step 1 – Farmer
  const [farmerQuery, setFarmerQuery] = useState("");
  const [selectedFarmerName, setSelectedFarmerName] = useState("");
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [farmerSuggestions, setFarmerSuggestions] = useState<{ name: string; id: string; farmerId: string }[]>([]);
  const [showFarmerDropdown, setShowFarmerDropdown] = useState(false);

  // Step 2 – Vegetable
  const [farmerVegetables, setFarmerVegetables] = useState<Vegetable[]>([]);
  const [selectedVegetable, setSelectedVegetable] = useState<Vegetable | null>(null);
  const [vegQuery, setVegQuery] = useState("");

  // Step 3 – Bags
  const [bags, setBags] = useState<string>("");

  // Step 4 – Weight
  const [weight, setWeight] = useState<string>("");

  // Step 5 – Rate
  const [rate, setRate] = useState<string>("");

  // Step 6 – Customer
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustDropdown, setShowCustDropdown] = useState(false);

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // ── Bill Level Customer (selected once per bill) ──────────────────────────
  const [billCustomer, setBillCustomer] = useState<Customer | null>(null);

  // ── Payment ───────────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [amountPaid, setAmountPaid] = useState<string>("");

  // ── Invoice Result ────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);

  // ── Refs for auto-focus ───────────────────────────────────────────────────
  const farmerInputRef = useRef<HTMLInputElement>(null);
  const vegSearchRef = useRef<HTMLInputElement>(null);
  const bagsRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const custInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Load data
  // ─────────────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      setDataError("");
      const [resVeg, resCust] = await Promise.all([
        apiFetch("/api/vegetables"),
        apiFetch("/api/customers"),
      ]);
      if (!resVeg.ok || !resCust.ok) throw new Error("Could not load billing data");
      setAllVegetables(await resVeg.json());
      setCustomers(await resCust.json());
    } catch (e: any) {
      setDataError(e.message || "Data load error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [language]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived: unique farmers from vegetable stock
  // ─────────────────────────────────────────────────────────────────────────
  const uniqueFarmers = React.useMemo(() => {
    const seen = new Map<string, { name: string; id: string; farmerId: string }>();
    allVegetables.forEach((v) => {
      const key = (v.farmerName || "").toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { name: v.farmerName, id: v.id, farmerId: v.farmerId });
      }
    });
    return Array.from(seen.values());
  }, [allVegetables]);

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-focus on step change
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (currentStep === "farmer") farmerInputRef.current?.focus();
      else if (currentStep === "vegetable") vegSearchRef.current?.focus();
      else if (currentStep === "bags") bagsRef.current?.focus();
      else if (currentStep === "weight") weightRef.current?.focus();
      else if (currentStep === "rate") rateRef.current?.focus();
      else if (currentStep === "customer") custInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(timeout);
  }, [currentStep]);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Farmer
  // ─────────────────────────────────────────────────────────────────────────
  const handleFarmerQuery = (val: string) => {
    setFarmerQuery(val);
    setSelectedFarmerName("");
    setSelectedFarmerId("");
    if (val.trim().length === 0) {
      setFarmerSuggestions([]);
      setShowFarmerDropdown(false);
      return;
    }
    const q = val.toLowerCase();
    const filtered = uniqueFarmers.filter((f) => f.name.toLowerCase().includes(q));
    setFarmerSuggestions(filtered);
    setShowFarmerDropdown(filtered.length > 0);
  };

  const selectFarmer = (farmer: { name: string; id: string; farmerId: string }) => {
    setFarmerQuery(farmer.name);
    setSelectedFarmerName(farmer.name);
    setSelectedFarmerId(farmer.farmerId);
    setShowFarmerDropdown(false);

    // Filter vegetables from this farmer with remaining stock > 0
    const vegs = allVegetables.filter(
      (v) =>
        (v.farmerName || "").toLowerCase() === farmer.name.toLowerCase() && v.quantity > 0
    );
    setFarmerVegetables(vegs);
    setVegQuery("");
    setSelectedVegetable(null);
    setTimeout(() => setCurrentStep("vegetable"), 50);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — Vegetable
  // ─────────────────────────────────────────────────────────────────────────
  const filteredVegs = farmerVegetables.filter(
    (v) =>
      vegQuery.trim() === "" ||
      (v.vegetableName || "").toLowerCase().includes(vegQuery.toLowerCase())
  );

  const selectVegetable = (veg: Vegetable) => {
    setSelectedVegetable(veg);
    setBags("");
    setWeight("");
    setRate(String(veg.sellingPrice));
    setTimeout(() => setCurrentStep("bags"), 50);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3 — Bags → auto-fill weight
  // ─────────────────────────────────────────────────────────────────────────
  const handleBagsChange = (val: string) => {
    setBags(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) {
      setWeight(String(n * 20));
    } else {
      setWeight("");
    }
  };

  const handleBagsNext = () => {
    const n = parseFloat(bags);
    if (isNaN(n) || n <= 0) return;
    setCurrentStep("weight");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4 — Weight
  // ─────────────────────────────────────────────────────────────────────────
  const handleWeightNext = () => {
    const n = parseFloat(weight);
    if (isNaN(n) || n <= 0) return;
    setCurrentStep("rate");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5 — Rate
  // ─────────────────────────────────────────────────────────────────────────
  const handleRateNext = () => {
    const n = parseFloat(rate);
    if (isNaN(n) || n <= 0) return;
    // If customer already locked (already added an item), skip to total
    if (billCustomer) {
      setCurrentStep("total");
    } else {
      setCurrentStep("customer");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6 — Customer
  // ─────────────────────────────────────────────────────────────────────────
  const filteredCusts = customers.filter(
    (c) =>
      custInputRef.current?.value === "" ||
      (c.name || "").toLowerCase().includes(customerQuery.toLowerCase()) ||
      (c.businessName || "").toLowerCase().includes(customerQuery.toLowerCase())
  );

  const handleCustQuery = (val: string) => {
    setCustomerQuery(val);
    setShowCustDropdown(val.trim().length > 0);
    setSelectedCustomer(null);
  };

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerQuery(c.name);
    setShowCustDropdown(false);
    setTimeout(() => setCurrentStep("total"), 50);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 7 — Total: Add to cart
  // ─────────────────────────────────────────────────────────────────────────
  const itemTotal = parseFloat(weight) * parseFloat(rate) || 0;

  const addToCart = () => {
    if (!selectedVegetable || !parseFloat(bags) || !parseFloat(weight) || !parseFloat(rate)) return;
    const cust = billCustomer || selectedCustomer;
    if (!cust) return;

    if (!billCustomer && selectedCustomer) {
      setBillCustomer(selectedCustomer);
    }

    const newItem: CartItem = {
      id: Date.now().toString(),
      farmerName: selectedFarmerName,
      farmerId: selectedFarmerId,
      vegetable: selectedVegetable,
      bags: parseFloat(bags),
      weight: parseFloat(weight),
      rate: parseFloat(rate),
      total: parseFloat(weight) * parseFloat(rate),
    };

    setCartItems((prev) => [...prev, newItem]);

    // Reset item fields for next item, keep customer locked
    setFarmerQuery("");
    setSelectedFarmerName("");
    setSelectedFarmerId("");
    setFarmerVegetables([]);
    setSelectedVegetable(null);
    setBags("");
    setWeight("");
    setRate("");
    setSelectedCustomer(null);
    setCustomerQuery("");
    setCurrentStep("farmer");
  };

  const removeCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Bill Totals
  // ─────────────────────────────────────────────────────────────────────────
  const subtotal = cartItems.reduce((s, i) => s + i.total, 0);
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = subtotal + gst;

  const effectiveAmountPaid =
    paymentMethod === "Cash" || paymentMethod === "Online"
      ? grandTotal
      : paymentMethod === "Pending Payment"
      ? 0
      : parseFloat(amountPaid) || 0;

  const amountPending = Math.max(0, grandTotal - effectiveAmountPaid);

  // ─────────────────────────────────────────────────────────────────────────
  // Submit Invoice
  // ─────────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!billCustomer || cartItems.length === 0) return;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const items: InvoiceItem[] = cartItems.map((ci) => ({
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
        paymentMethod === "Cash" || paymentMethod === "Online"
          ? "Paid"
          : paymentMethod === "Pending Payment"
          ? "Unpaid"
          : "Partial";

      const res = await apiFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: billCustomer.id,
          customerName: billCustomer.name,
          customerMobile: billCustomer.mobile,
          customerBusiness: billCustomer.businessName || "",
          items,
          subtotal,
          gst,
          total: grandTotal,
          amountPaid: effectiveAmountPaid,
          amountPending,
          paymentMethod,
          paymentStatus: payStatus,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Invoice creation failed");
      }

      const invoice: Invoice = await res.json();
      setCompletedInvoice(invoice);

      // Reset entire session
      resetAll();
    } catch (e: any) {
      setSubmitError(e.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAll = () => {
    setCartItems([]);
    setBillCustomer(null);
    setFarmerQuery("");
    setSelectedFarmerName("");
    setSelectedFarmerId("");
    setFarmerVegetables([]);
    setSelectedVegetable(null);
    setBags("");
    setWeight("");
    setRate("");
    setSelectedCustomer(null);
    setCustomerQuery("");
    setPaymentMethod("Cash");
    setAmountPaid("");
    setCurrentStep("farmer");
    setSubmitError("");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Step indicator helpers
  // ─────────────────────────────────────────────────────────────────────────
  const stepIndex = STEPS.indexOf(currentStep);

  const isStepDone = (step: BillingStep): boolean => {
    const si = STEPS.indexOf(step);
    return si < stepIndex;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render — Loading / Error
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // Render — Completed Invoice Modal
  // ─────────────────────────────────────────────────────────────────────────
  if (completedInvoice) {
    return (
      <div className="space-y-6" id="salessheet-done">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-emerald-900">Bill Created Successfully!</h2>
          <p className="text-emerald-700 text-sm font-semibold">
            Invoice <span className="font-mono">{completedInvoice.invoiceNumber}</span> has been saved.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-xl mx-auto">
          <InvoiceDetailModal invoice={completedInvoice} />
          <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-slate-100">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 border border-emerald-600 hover:bg-emerald-50 text-emerald-700 font-semibold rounded-lg text-sm cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Bill
            </button>
            <button
              onClick={() => {
                setCompletedInvoice(null);
                fetchData();
              }}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm cursor-pointer transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Bill
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render — Main Billing Console
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5" id="salessheet-module">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            Billing Console
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Follow the guided steps to create a sale bill.
            {billCustomer && (
              <span className="ml-2 text-emerald-700 font-bold">
                Customer: {billCustomer.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            title="Reload stock data"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {cartItems.length > 0 && (
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              Clear Bill
            </button>
          )}
        </div>
      </div>

      {dataError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {dataError}
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* ── LEFT: Step-by-step Form ─────────────────────────────────────── */}
        <div className="col-span-7 max-lg:col-span-12 space-y-4">

          {/* Step Progress Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-1 flex-wrap">
              {STEPS.map((step, idx) => {
                const done = isStepDone(step);
                const active = currentStep === step;
                return (
                  <React.Fragment key={step}>
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        active
                          ? "bg-emerald-600 text-white shadow-sm"
                          : done
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-50 text-slate-400 border border-slate-200"
                      }`}
                    >
                      {done ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <span className="opacity-80">{STEP_ICONS[step]}</span>
                      )}
                      <span>{STEP_LABELS[step]}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Active Step Card */}
          <div className="bg-white rounded-xl border-2 border-emerald-500 shadow-md p-6 min-h-[260px]">

            {/* ── STEP 1: FARMER ─────────────────────────────────────────── */}
            {currentStep === "farmer" && (
              <div className="space-y-4" id="step-farmer">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Sprout className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 1 of 7</p>
                    <h3 className="text-lg font-bold text-slate-900">Select Farmer</h3>
                  </div>
                </div>
                <p className="text-sm text-slate-500">Which farmer is supplying the vegetables for this sale?</p>

                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    ref={farmerInputRef}
                    id="farmer-name-input"
                    type="text"
                    placeholder="Type farmer name..."
                    value={farmerQuery}
                    onChange={(e) => handleFarmerQuery(e.target.value)}
                    onFocus={() => {
                      if (farmerQuery.trim()) setShowFarmerDropdown(farmerSuggestions.length > 0);
                    }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-base font-semibold text-slate-800 transition-colors"
                  />

                  {showFarmerDropdown && farmerSuggestions.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                      {farmerSuggestions.map((f) => (
                        <button
                          key={f.farmerId}
                          type="button"
                          id={`farmer-option-${f.farmerId}`}
                          onClick={() => selectFarmer(f)}
                          className="w-full text-left px-4 py-3 hover:bg-emerald-50 flex items-center gap-3 border-b border-slate-50 last:border-0 transition-colors cursor-pointer"
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
                          <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                        </button>
                      ))}
                    </div>
                  )}

                  {farmerQuery.trim().length > 0 && farmerSuggestions.length === 0 && (
                    <div className="mt-2 text-xs text-slate-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      No farmer found with that name in current stock.
                    </div>
                  )}
                </div>

                {/* Quick farmer chips */}
                {farmerQuery.trim() === "" && uniqueFarmers.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Available Farmers</p>
                    <div className="flex flex-wrap gap-2">
                      {uniqueFarmers.map((f) => (
                        <button
                          key={f.farmerId}
                          type="button"
                          onClick={() => selectFarmer(f)}
                          id={`farmer-chip-${f.farmerId}`}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Sprout className="w-3 h-3" />
                          {dt(f.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: VEGETABLE ──────────────────────────────────────── */}
            {currentStep === "vegetable" && (
              <div className="space-y-4" id="step-vegetable">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 2 of 7</p>
                    <h3 className="text-lg font-bold text-slate-900">Select Vegetable</h3>
                  </div>
                  <button
                    onClick={() => setCurrentStep("farmer")}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                  >
                    ← Change Farmer
                  </button>
                </div>

                <div className="text-sm text-slate-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 font-semibold">
                  🧑‍🌾 Farmer: <span className="text-emerald-800">{selectedFarmerName}</span>
                  &nbsp;·&nbsp; {farmerVegetables.length} item(s) in stock
                </div>

                {farmerVegetables.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-semibold text-sm">
                    No stock available from this farmer right now.
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        ref={vegSearchRef}
                        type="text"
                        placeholder="Search vegetable..."
                        value={vegQuery}
                        onChange={(e) => setVegQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm font-semibold text-slate-800 transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-h-52 overflow-y-auto pr-1">
                      {filteredVegs.map((veg) => (
                        <button
                          key={veg.id}
                          type="button"
                          id={`veg-option-${veg.id}`}
                          onClick={() => selectVegetable(veg)}
                          className="text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all cursor-pointer group"
                        >
                          <div className="flex justify-between items-start">
                            <p className="font-bold text-slate-900 text-sm group-hover:text-emerald-800">
                              {dt(veg.vegetableName)}
                            </p>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              veg.quality === "Premium"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-slate-50 text-slate-600 border-slate-150"
                            }`}>
                              {veg.quality}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5 font-semibold">
                            Stock: <span className="text-slate-700 font-bold">{veg.quantity.toFixed(1)} kg</span>
                          </p>
                          <p className="text-xs text-emerald-700 font-bold mt-0.5">
                            ₹{veg.sellingPrice}/kg
                          </p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── STEP 3: BAGS ──────────────────────────────────────────── */}
            {currentStep === "bags" && (
              <div className="space-y-4" id="step-bags">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 3 of 7</p>
                    <h3 className="text-lg font-bold text-slate-900">Number of Bags</h3>
                  </div>
                  <button
                    onClick={() => setCurrentStep("vegetable")}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                  >
                    ← Change Veg
                  </button>
                </div>

                <div className="text-sm text-slate-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 font-semibold">
                  🥦 {dt(selectedVegetable?.vegetableName || "")} &nbsp;·&nbsp;
                  Stock: {selectedVegetable?.quantity.toFixed(1)} kg &nbsp;·&nbsp;
                  ₹{selectedVegetable?.sellingPrice}/kg
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    No. of Bags (1 bag = 20 kg)
                  </label>
                  <input
                    ref={bagsRef}
                    id="bags-input"
                    type="number"
                    min="0.5"
                    step="0.5"
                    placeholder="e.g. 2.5"
                    value={bags}
                    onChange={(e) => handleBagsChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleBagsNext()}
                    className="w-full py-3.5 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-2xl font-bold text-slate-900 transition-colors"
                  />
                  {bags && parseFloat(bags) > 0 && (
                    <p className="text-xs text-slate-400 mt-2 font-semibold">
                      = <span className="text-emerald-700 font-bold">{(parseFloat(bags) * 20).toFixed(1)} kg</span> will be auto-filled in next step
                    </p>
                  )}
                </div>

                <button
                  onClick={handleBagsNext}
                  disabled={!bags || parseFloat(bags) <= 0}
                  id="bags-next-btn"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors shadow-sm"
                >
                  Next: Weight <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── STEP 4: WEIGHT ────────────────────────────────────────── */}
            {currentStep === "weight" && (
              <div className="space-y-4" id="step-weight">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Weight className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 4 of 7</p>
                    <h3 className="text-lg font-bold text-slate-900">Weight (Kg)</h3>
                  </div>
                  <button
                    onClick={() => setCurrentStep("bags")}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                  >
                    ← Change Bags
                  </button>
                </div>

                <div className="text-sm text-slate-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 font-semibold">
                  Bags: <span className="text-emerald-800 font-bold">{bags}</span>
                  &nbsp;·&nbsp; Auto-calculated: <span className="text-emerald-800 font-bold">{parseFloat(bags) * 20} kg</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Weight in Kg (editable)
                  </label>
                  <input
                    ref={weightRef}
                    id="weight-input"
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="e.g. 50"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleWeightNext()}
                    className="w-full py-3.5 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-2xl font-bold text-slate-900 transition-colors"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 font-semibold">
                    You can adjust the weight if actual differs from calculated value.
                  </p>
                </div>

                <button
                  onClick={handleWeightNext}
                  disabled={!weight || parseFloat(weight) <= 0}
                  id="weight-next-btn"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors shadow-sm"
                >
                  Next: Rate <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── STEP 5: RATE ──────────────────────────────────────────── */}
            {currentStep === "rate" && (
              <div className="space-y-4" id="step-rate">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 5 of 7</p>
                    <h3 className="text-lg font-bold text-slate-900">Rate (₹ per Kg)</h3>
                  </div>
                  <button
                    onClick={() => setCurrentStep("weight")}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                  >
                    ← Change Weight
                  </button>
                </div>

                <div className="text-sm text-slate-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 font-semibold">
                  Weight: <span className="text-emerald-800 font-bold">{weight} kg</span>
                  &nbsp;·&nbsp; Listed price: <span className="text-emerald-800 font-bold">₹{selectedVegetable?.sellingPrice}/kg</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Selling Rate ₹/kg (editable)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">₹</span>
                    <input
                      ref={rateRef}
                      id="rate-input"
                      type="number"
                      min="1"
                      step="0.5"
                      placeholder="e.g. 25"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRateNext()}
                      className="w-full py-3.5 pl-9 pr-4 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-2xl font-bold text-slate-900 transition-colors"
                    />
                  </div>
                  {rate && weight && parseFloat(rate) > 0 && parseFloat(weight) > 0 && (
                    <p className="text-sm text-emerald-700 font-bold mt-2">
                      Item Total Preview: ₹{(parseFloat(weight) * parseFloat(rate)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleRateNext}
                  disabled={!rate || parseFloat(rate) <= 0}
                  id="rate-next-btn"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors shadow-sm"
                >
                  Next: {billCustomer ? "Item Total" : "Customer"} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── STEP 6: CUSTOMER ──────────────────────────────────────── */}
            {currentStep === "customer" && (
              <div className="space-y-4" id="step-customer">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 6 of 7</p>
                    <h3 className="text-lg font-bold text-slate-900">Customer Name</h3>
                  </div>
                  <button
                    onClick={() => setCurrentStep("rate")}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                  >
                    ← Change Rate
                  </button>
                </div>

                <p className="text-sm text-slate-500">Who is buying this? Select the customer for this bill.</p>

                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    ref={custInputRef}
                    id="customer-name-input"
                    type="text"
                    placeholder="Search customer name or business..."
                    value={customerQuery}
                    onChange={(e) => handleCustQuery(e.target.value)}
                    onFocus={() => setShowCustDropdown(customerQuery.trim().length > 0)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-base font-semibold text-slate-800 transition-colors"
                  />

                  {showCustDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                      {customers
                        .filter(
                          (c) =>
                            (c.name || "").toLowerCase().includes(customerQuery.toLowerCase()) ||
                            (c.businessName || "").toLowerCase().includes(customerQuery.toLowerCase())
                        )
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            id={`cust-option-${c.id}`}
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-4 py-3 hover:bg-emerald-50 flex items-center gap-3 border-b border-slate-50 last:border-0 transition-colors cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{dt(c.name)}</p>
                              {c.businessName && (
                                <p className="text-[10px] text-emerald-700 font-semibold">{dt(c.businessName)}</p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                          </button>
                        ))}
                      {customers.filter(
                        (c) =>
                          (c.name || "").toLowerCase().includes(customerQuery.toLowerCase()) ||
                          (c.businessName || "").toLowerCase().includes(customerQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="px-4 py-3 text-xs text-slate-400 font-semibold text-center">
                          No customer found.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick customer list */}
                {customerQuery.trim() === "" && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Registered Customers</p>
                    <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                      {customers.slice(0, 20).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCustomer(c)}
                          id={`cust-chip-${c.id}`}
                          className="text-left px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg transition-all cursor-pointer"
                        >
                          <p className="font-bold text-slate-900 text-xs">{dt(c.name)}</p>
                          {c.businessName && (
                            <p className="text-[10px] text-emerald-600 font-semibold truncate">{dt(c.businessName)}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 7: TOTAL ─────────────────────────────────────────── */}
            {currentStep === "total" && (
              <div className="space-y-4" id="step-total">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 7 of 7</p>
                    <h3 className="text-lg font-bold text-slate-900">Item Total</h3>
                  </div>
                  <button
                    onClick={() => {
                      if (billCustomer) setCurrentStep("rate");
                      else setCurrentStep("customer");
                    }}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                  >
                    ← Edit
                  </button>
                </div>

                {/* Summary card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">Farmer</span>
                    <span className="font-bold text-slate-900">{selectedFarmerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">Vegetable</span>
                    <span className="font-bold text-slate-900">{dt(selectedVegetable?.vegetableName || "")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">Bags</span>
                    <span className="font-bold text-slate-900">{bags}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">Weight</span>
                    <span className="font-bold text-slate-900">{weight} kg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">Rate</span>
                    <span className="font-bold text-slate-900">₹{rate}/kg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">Customer</span>
                    <span className="font-bold text-slate-900">
                      {(billCustomer || selectedCustomer)?.name}
                    </span>
                  </div>
                  <div className="border-t border-slate-300 pt-3 flex justify-between">
                    <span className="font-bold text-slate-700 text-base">Item Total</span>
                    <span className="font-bold text-emerald-700 text-xl font-mono">
                      ₹{itemTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={addToCart}
                  id="add-to-cart-btn"
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-base cursor-pointer transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  Add to Bill
                </button>
              </div>
            )}

          </div>
        </div>

        {/* ── RIGHT: Bill Summary Panel ─────────────────────────────────────── */}
        <div className="col-span-5 max-lg:col-span-12 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-20">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                Current Bill
              </h3>
              {billCustomer && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-800">
                  {billCustomer.name}
                </div>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="py-12 text-center text-slate-300 flex flex-col items-center gap-2">
                <ShoppingBag className="w-10 h-10" />
                <p className="text-sm font-semibold">No items yet</p>
                <p className="text-xs">Complete the steps to add items</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between bg-slate-50 rounded-lg p-3 border border-slate-100"
                    id={`cart-item-${item.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 text-sm">{dt(item.vegetable.vegetableName)}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        {item.farmerName} · {item.bags} bags · {item.weight} kg · ₹{item.rate}/kg
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        ₹{item.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={() => removeCartItem(item.id)}
                        id={`remove-cart-${item.id}`}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer rounded"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cartItems.length > 0 && (
              <>
                {/* Totals */}
                <div className="border-t border-slate-200 mt-4 pt-3 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500 font-semibold">
                    <span>Subtotal ({cartItems.length} item{cartItems.length > 1 ? "s" : ""})</span>
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

                {/* Payment Section */}
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["Cash", "Online", "Partial Payment", "Pending Payment"] as PaymentMethod[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          id={`pay-method-${m.replace(/\s+/g, "-").toLowerCase()}`}
                          className={`py-2 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            paymentMethod === m
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === "Partial Payment" && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Amount Paid (₹)
                      </label>
                      <input
                        type="number"
                        id="partial-amount-input"
                        min="1"
                        step="1"
                        max={grandTotal}
                        placeholder={`Max ₹${grandTotal.toFixed(2)}`}
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-sm font-mono font-bold"
                      />
                      {amountPaid && (
                        <p className="text-[10px] text-amber-600 font-bold mt-1">
                          Pending: ₹{Math.max(0, grandTotal - (parseFloat(amountPaid) || 0)).toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}

                  {submitError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg font-semibold flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {submitError}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !billCustomer || cartItems.length === 0}
                    id="submit-bill-btn"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors shadow-md"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving Bill...
                      </>
                    ) : (
                      <>
                        <Receipt className="w-4 h-4" />
                        Generate Invoice
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
