import React, { useState, useEffect, useRef } from "react";
import { 
  ShoppingBag, 
  User, 
  Plus, 
  Trash2, 
  Coins, 
  FileCheck, 
  Calculator, 
  AlertCircle,
  AlertTriangle,
  Building,
  CheckCircle,
  Printer,
  Download,
  X
} from "lucide-react";
import { Customer, Vegetable, InvoiceItem, Invoice, PaymentMethod } from "../types";
import InvoiceDetailModal from "./InvoiceDetailModal";
import { useTranslation } from "../context/LanguageContext";
import { apiFetch } from "../utils/api";
import { useAuth } from "../context/AuthContext";

interface SessionTab {
  id: string;
  label: string;
  selectedCustomerId: string;
  customerNameInput: string;
  customerMobileInput: string;
  customerBusinessInput: string;
  vegSearchInput: string;
  selectedStockId: string;
  soldBags: string;
  soldWeight: string;
  soldRate: string;
  cartItems: InvoiceItem[];
  paymentMethod: PaymentMethod;
  amountPaid: string;
}

export default function SalesSheet() {
  const { t, dt, language } = useTranslation();
  const { user } = useAuth();
  const storageKey = `mandimate_sales_sheet_session_${user?.id || "guest"}`;

  // Get initial session data synchronously
  const savedSession = (() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  })();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stock, setStock] = useState<Vegetable[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Customer selection & typing autocompletes
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => savedSession?.activeStates?.selectedCustomerId ?? "");
  const [customerNameInput, setCustomerNameInput] = useState(() => savedSession?.activeStates?.customerNameInput ?? "");
  const [customerMobileInput, setCustomerMobileInput] = useState(() => savedSession?.activeStates?.customerMobileInput ?? "");
  const [customerBusinessInput, setCustomerBusinessInput] = useState(() => savedSession?.activeStates?.customerBusinessInput ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Autocomplete Click-Outside handling
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const vegAutocompleteRef = useRef<HTMLDivElement>(null);

  // Vegetable autocomplete state
  const [vegSearchInput, setVegSearchInput] = useState(() => savedSession?.activeStates?.vegSearchInput ?? "");
  const [showVegSuggestions, setShowVegSuggestions] = useState(false);

  // Multi-Session Queue state
  const [tabs, setTabs] = useState<SessionTab[]>(() => savedSession?.tabs ?? [
    {
      id: "tab-default",
      label: "Customer Tab 1",
      selectedCustomerId: "",
      customerNameInput: "",
      customerMobileInput: "",
      customerBusinessInput: "",
      vegSearchInput: "",
      selectedStockId: "",
      soldBags: "",
      soldWeight: "",
      soldRate: "",
      cartItems: [],
      paymentMethod: "Cash",
      amountPaid: "",
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(() => savedSession?.activeTabId ?? "tab-default");

  const createEmptyTab = (index: number): SessionTab => ({
    id: `tab-${Date.now()}-${Math.random()}`,
    label: `Customer Tab ${index}`,
    selectedCustomerId: "",
    customerNameInput: "",
    customerMobileInput: "",
    customerBusinessInput: "",
    vegSearchInput: "",
    selectedStockId: "",
    soldBags: "",
    soldWeight: "",
    soldRate: "",
    cartItems: [],
    paymentMethod: "Cash",
    amountPaid: "",
  });

  const switchTab = (targetTabId: string) => {
    if (targetTabId === activeTabId) return;

    // 1. Save current active tab fields to snapshot
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          label: customerNameInput.trim() ? customerNameInput.trim() : t.label,
          selectedCustomerId,
          customerNameInput,
          customerMobileInput,
          customerBusinessInput,
          vegSearchInput,
          selectedStockId,
          soldBags,
          soldWeight,
          soldRate,
          cartItems,
          paymentMethod,
          amountPaid
        };
      }
      return t;
    }));

    // 2. Load target tab stats
    const targetTab = tabs.find(t => t.id === targetTabId);
    if (targetTab) {
      setSelectedCustomerId(targetTab.selectedCustomerId);
      setCustomerNameInput(targetTab.customerNameInput);
      setCustomerMobileInput(targetTab.customerMobileInput);
      setCustomerBusinessInput(targetTab.customerBusinessInput);
      setVegSearchInput(targetTab.vegSearchInput);
      setSelectedStockId(targetTab.selectedStockId);
      setSoldBags(targetTab.soldBags || "");
      setSoldWeight(targetTab.soldWeight);
      setSoldRate(targetTab.soldRate);
      setCartItems(targetTab.cartItems);
      setPaymentMethod(targetTab.paymentMethod);
      setAmountPaid(targetTab.amountPaid);

      setActiveTabId(targetTabId);
    }
  };

  const addNewTab = () => {
    setTabs(prev => {
      const updated = prev.map(t => {
        if (t.id === activeTabId) {
          return {
            ...t,
            label: customerNameInput.trim() ? customerNameInput.trim() : t.label,
            selectedCustomerId,
            customerNameInput,
            customerMobileInput,
            customerBusinessInput,
            vegSearchInput,
            selectedStockId,
            soldBags,
            soldWeight,
            soldRate,
            cartItems,
            paymentMethod,
            amountPaid
          };
        }
        return t;
      });

      const nextIndex = updated.length + 1;
      const newTabObj = createEmptyTab(nextIndex);

      setSelectedCustomerId(newTabObj.selectedCustomerId);
      setCustomerNameInput(newTabObj.customerNameInput);
      setCustomerMobileInput(newTabObj.customerMobileInput);
      setCustomerBusinessInput(newTabObj.customerBusinessInput);
      setVegSearchInput(newTabObj.vegSearchInput);
      setSelectedStockId(newTabObj.selectedStockId);
      setSoldBags(newTabObj.soldBags || "");
      setSoldWeight(newTabObj.soldWeight);
      setSoldRate(newTabObj.soldRate);
      setCartItems(newTabObj.cartItems);
      setPaymentMethod(newTabObj.paymentMethod);
      setAmountPaid(newTabObj.amountPaid);

      setActiveTabId(newTabObj.id);
      return [...updated, newTabObj];
    });
  };

  const closeTab = (tabIdToClose: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (tabs.length <= 1) {
      // Clear out the single remaining tab
      setCartItems([]);
      setSelectedCustomerId("");
      setCustomerNameInput("");
      setCustomerMobileInput("");
      setCustomerBusinessInput("");
      setSelectedStockId("");
      setVegSearchInput("");
      setSoldBags("");
      setSoldWeight("");
      setSoldRate("");
      setAmountPaid("");
      setPaymentMethod("Cash");
      setTabs([createEmptyTab(1)]);
      return;
    }

    const tabIndex = tabs.findIndex(t => t.id === tabIdToClose);
    const remainingTabs = tabs.filter(t => t.id !== tabIdToClose);
    setTabs(remainingTabs);

    if (activeTabId === tabIdToClose) {
      const nextActiveIndex = Math.max(0, tabIndex - 1);
      const fallbackTab = remainingTabs[nextActiveIndex];

      setSelectedCustomerId(fallbackTab.selectedCustomerId);
      setCustomerNameInput(fallbackTab.customerNameInput);
      setCustomerMobileInput(fallbackTab.customerMobileInput);
      setCustomerBusinessInput(fallbackTab.customerBusinessInput);
      setVegSearchInput(fallbackTab.vegSearchInput);
      setSelectedStockId(fallbackTab.selectedStockId);
      setSoldBags(fallbackTab.soldBags || "");
      setSoldWeight(fallbackTab.soldWeight);
      setSoldRate(fallbackTab.soldRate);
      setCartItems(fallbackTab.cartItems);
      setPaymentMethod(fallbackTab.paymentMethod);
      setAmountPaid(fallbackTab.amountPaid);

      setActiveTabId(fallbackTab.id);
    }
  };

  const handleCustomerNameChange = (val: string) => {
    setCustomerNameInput(val);
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          label: val.trim() ? val.trim() : `Customer Tab`
        };
      }
      return t;
    }));
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (vegAutocompleteRef.current && !vegAutocompleteRef.current.contains(event.target as Node)) {
        setShowVegSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerNameInput(c.name);
    setCustomerMobileInput(c.mobile);
    setCustomerBusinessInput(c.businessName || "");
    setShowSuggestions(false);
    
    // Rename tab label in real-time
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, label: c.name } : t));
  };

  const filteredCustomers = customers.filter(c => 
    (c.name || "").toLowerCase().includes((customerNameInput || "").toLowerCase()) ||
    (c.businessName && (c.businessName || "").toLowerCase().includes((customerNameInput || "").toLowerCase())) ||
    (c.mobile || "").includes(customerNameInput || "")
  );

  const handleSelectStock = (v: Vegetable) => {
    setSelectedStockId(v.id);
    setVegSearchInput(`${v.vegetableName || ""} (${v.quality || ""}) - Supplied by: ${(v.farmerName || "Unknown").split(" ")[0]} (${(v.quantity || 0).toFixed(1)}kg left)`);
    setSoldRate(String(v.sellingPrice || 0));
    setSoldWeight("");
    setShowVegSuggestions(false);
  };

  const filteredStock = stock.filter(v =>
    (v.vegetableName || "").toLowerCase().includes((vegSearchInput || "").toLowerCase()) ||
    (v.farmerName || "").toLowerCase().includes((vegSearchInput || "").toLowerCase()) ||
    (v.quality || "").toLowerCase().includes((vegSearchInput || "").toLowerCase())
  );
  
  // Current Item Builder state
  const [selectedStockId, setSelectedStockId] = useState(() => savedSession?.activeStates?.selectedStockId ?? "");
  const [soldBags, setSoldBags] = useState(() => savedSession?.activeStates?.soldBags ?? "");
  const [soldWeight, setSoldWeight] = useState(() => savedSession?.activeStates?.soldWeight ?? "");
  const [soldRate, setSoldRate] = useState(() => savedSession?.activeStates?.soldRate ?? "");

  // Cart List items
  const [cartItems, setCartItems] = useState<InvoiceItem[]>(() => savedSession?.activeStates?.cartItems ?? []);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => savedSession?.activeStates?.paymentMethod ?? "Cash");
  const [amountPaid, setAmountPaid] = useState(() => savedSession?.activeStates?.amountPaid ?? "");

  // Success Output
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    const session = {
      tabs,
      activeTabId,
      activeStates: {
        selectedCustomerId,
        customerNameInput,
        customerMobileInput,
        customerBusinessInput,
        vegSearchInput,
        selectedStockId,
        soldBags,
        soldWeight,
        soldRate,
        cartItems,
        paymentMethod,
        amountPaid
      }
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(session));
    } catch (e) {
      console.error("Failed to save sales sheet session", e);
    }
  }, [
    storageKey,
    tabs,
    activeTabId,
    selectedCustomerId,
    customerNameInput,
    customerMobileInput,
    customerBusinessInput,
    vegSearchInput,
    selectedStockId,
    soldBags,
    soldWeight,
    soldRate,
    cartItems,
    paymentMethod,
    amountPaid
  ]);

  const handleDownloadInvoiceCSV = () => {
    if (!savedInvoice) return;
    let csv = "Invoice Number,Date,Customer Name,Business,Mobile,Payment Method,Payment Status\n";
    csv += `"${savedInvoice.invoiceNumber}","${savedInvoice.createdAt ? savedInvoice.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}","${savedInvoice.customerName}","${savedInvoice.customerBusiness || ""}","${savedInvoice.customerMobile || ""}","${savedInvoice.paymentMethod}","${savedInvoice.paymentStatus}"\n\n`;
    
    csv += "Item No,Vegetable Name,Quality,Quantity (Kg),Bags,Rate (₹/Kg),Amount (₹)\n";
    savedInvoice.items.forEach((item, index) => {
      csv += `"${index + 1}","${item.vegetableName}","${item.quality}","${item.quantity}","${item.bags || (item.quantity / 20)}","${item.rate}","${item.amount}"\n`;
    });
    csv += `\nSummary,,,,\n`;
    csv += `Subtotal,,,,"${savedInvoice.subtotal}"\n`;
    csv += `GST (5%),,,,"${savedInvoice.gst}"\n`;
    csv += `Total,,,,"${savedInvoice.total}"\n`;
    csv += `Amount Paid,,,,"${savedInvoice.amountPaid}"\n`;
    csv += `Amount Pending,,,,"${savedInvoice.amountPending}"\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `MandiMate_Invoice_${savedInvoice.invoiceNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchSalesResources = async () => {
    try {
      setLoading(true);
      const [resCustomers, resStock] = await Promise.all([
        apiFetch("/api/customers"),
        apiFetch("/api/vegetables")
      ]);

      if (!resCustomers.ok || !resStock.ok) {
        throw new Error("Unable to retrieve registered accounts or stock files.");
      }

      const cData = await resCustomers.json();
      const sData = await resStock.json();

      setCustomers(cData);
      // Only keep vegetables with stock > 0
      setStock(sData.filter((v: Vegetable) => v.quantity > 0));
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to sync transaction resources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesResources();
  }, []);

  // Update rates automatically when a stock batch is chosen
  const handleStockSelect = (id: string) => {
    setSelectedStockId(id);
    const selectedBatch = stock.find(v => v.id === id);
    if (selectedBatch) {
      setSoldRate(String(selectedBatch.sellingPrice));
      setSoldWeight("");
      setSoldBags("");
    } else {
      setSoldRate("");
    }
  };

  const handleBagsChange = (val: string) => {
    setSoldBags(val);
    if (val) {
      setSoldWeight(String(Number(val) * 20));
    } else {
      setSoldWeight("");
    }
  };

  const handleWeightChange = (val: string) => {
    setSoldWeight(val);
    if (val) {
      setSoldBags(String(Number(val) / 20));
    } else {
      setSoldBags("");
    }
  };

  // Add Item to Bill Cart
  const addItemToCart = () => {
    if (!selectedStockId || !soldWeight || !soldRate) {
      setErrorMsg("Please select a vegetable, enters weight, and verify the rate.");
      return;
    }

    const weightNum = Number(soldWeight);
    const rateNum = Number(soldRate);
    const selectedBatch = stock.find(v => v.id === selectedStockId);

    if (!selectedBatch) return;

    if (weightNum <= 0 || rateNum <= 0) {
      setErrorMsg("Weight and Rate must be postitive values.");
      return;
    }

    if (weightNum > selectedBatch.quantity) {
      setErrorMsg(`Oversell Warning: Selected farmer batch only has ${selectedBatch.quantity} kg of ${selectedBatch.vegetableName} remaining.`);
      return;
    }

    // Check duplicate item in cart
    const existingIdx = cartItems.findIndex(item => item.vegetableId === selectedStockId);
    if (existingIdx !== -1) {
      setErrorMsg(`Vegetable batch is already added to invoice. Remove the existing line to revise it.`);
      return;
    }

    const newItem: InvoiceItem = {
      farmerId: selectedBatch.farmerId,
      farmerName: selectedBatch.farmerName,
      vegetableId: selectedBatch.id,
      vegetableName: selectedBatch.vegetableName,
      quality: selectedBatch.quality,
      quantity: weightNum,
      bags: Number(soldBags) || (weightNum / 20),
      rate: rateNum,
      purchasePrice: selectedBatch.purchasePrice, // kept for profit math on DB save
      amount: Number((weightNum * rateNum).toFixed(2))
    };

    setCartItems(prev => [...prev, newItem]);
    setErrorMsg("");
    
    // Clear item inputs
    setSelectedStockId("");
    setVegSearchInput("");
    setSoldBags("");
    setSoldWeight("");
    setSoldRate("");
  };

  const removeCartItem = (idx: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Pricing math
  const subtotal = cartItems.reduce((acc, curr) => acc + curr.amount, 0);
  const gst = Number((subtotal * 0.05).toFixed(2)); // Wholesale GST is 5% standard
  const grandTotal = Number((subtotal + gst).toFixed(2));

  // Payment helper logic
  const derivedStatusAndPending = (): { status: "Paid" | "Unpaid" | "Partial"; pending: number; paid: number } => {
    if (paymentMethod === "Cash" || paymentMethod === "Online") {
      return { status: "Paid", pending: 0, paid: grandTotal };
    }
    if (paymentMethod === "Pending Payment") {
      return { status: "Unpaid", pending: grandTotal, paid: 0 };
    }
    // Partial terms
    const paidInput = Number(amountPaid) || 0;
    const clampedPaid = Math.min(grandTotal, paidInput);
    const pendingVal = Number((grandTotal - clampedPaid).toFixed(2));
    const statusVal: "Paid" | "Unpaid" | "Partial" = clampedPaid === 0 ? "Unpaid" : (clampedPaid >= grandTotal ? "Paid" : "Partial");
    return { status: statusVal, pending: pendingVal, paid: clampedPaid };
  };

  const paymentBreakdown = derivedStatusAndPending();

  const [isGeneratingBill, setIsGeneratingBill] = useState(false);

  const handleCreateBill = async () => {
    let finalCustomerId = selectedCustomerId;
    let finalCustomerName = customerNameInput.trim();
    let finalCustomerMobile = customerMobileInput.trim();
    let finalCustomerBusiness = customerBusinessInput.trim();

    if (!finalCustomerName) {
      setErrorMsg("Please enter a customer name for the invoice.");
      return;
    }

    if (cartItems.length === 0) {
      setErrorMsg("Invoice items grid is empty. Choose stock batches to add.");
      return;
    }

    if (paymentMethod === "Partial Payment" && (!amountPaid || Number(amountPaid) <= 0)) {
      setErrorMsg("For partial payments, enter the specific amount paid down.");
      return;
    }

    try {
      setIsGeneratingBill(true);
      setErrorMsg("");

      // If no registered customer is selected, check if we should auto-register or match
      if (!finalCustomerId || finalCustomerId === "new-customer") {
        const exactMatch = customers.find(c => (c.name || "").toLowerCase() === (finalCustomerName || "").toLowerCase());
        
        if (exactMatch) {
          finalCustomerId = exactMatch.id;
          finalCustomerName = exactMatch.name;
          finalCustomerMobile = exactMatch.mobile;
          finalCustomerBusiness = exactMatch.businessName || "";
        } else {
          // Auto-register new customer on the backend
          const regRes = await apiFetch("/api/customers", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "X-App-Language": language
            },
            body: JSON.stringify({
              name: finalCustomerName,
              mobile: finalCustomerMobile || "Walking-Buyer",
              businessName: finalCustomerBusiness || "Walking Retailer",
              address: "Mandi Guest"
            })
          });

          if (!regRes.ok) {
            const errBlob = await regRes.json();
            throw new Error(errBlob.error || "Failed to auto-register new customer profile.");
          }

          const newCustomer: Customer = await regRes.json();
          finalCustomerId = newCustomer.id;
          finalCustomerName = newCustomer.name;
          finalCustomerMobile = newCustomer.mobile;
          finalCustomerBusiness = newCustomer.businessName || "";

          // Append to local customers list to keep state clean without full reload
          setCustomers(prev => [...prev, newCustomer]);
        }
      }

      const payload = {
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        customerMobile: finalCustomerMobile,
        customerBusiness: finalCustomerBusiness,
        items: cartItems,
        subtotal,
        gst,
        total: grandTotal,
        amountPaid: paymentBreakdown.paid,
        amountPending: paymentBreakdown.pending,
        paymentMethod,
        paymentStatus: paymentBreakdown.status
      };

      const res = await apiFetch("/api/invoices", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-App-Language": language
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Save operation aborted");
      }

      const completedInvs: Invoice = await res.json();
      setSavedInvoice(completedInvs);
      setShowPrintModal(true);

      // Reset current active transaction variables
      setCartItems([]);
      setSelectedCustomerId("");
      setCustomerNameInput("");
      setCustomerMobileInput("");
      setCustomerBusinessInput("");
      setSelectedStockId("");
      setVegSearchInput("");
      setSoldWeight("");
      setSoldRate("");
      setAmountPaid("");
      setPaymentMethod("Cash");
      setErrorMsg("");

      // Remove current complete billing tab if others exist, otherwise reset this tab
      setTabs(prev => {
        if (prev.length > 1) {
          const tabIndex = prev.findIndex(t => t.id === activeTabId);
          const remainingTabs = prev.filter(t => t.id !== activeTabId);
          const nextActiveIndex = Math.max(0, tabIndex - 1);
          const fallbackTab = remainingTabs[nextActiveIndex];

          // Setup active states for next active tab
          setSelectedCustomerId(fallbackTab.selectedCustomerId);
          setCustomerNameInput(fallbackTab.customerNameInput);
          setCustomerMobileInput(fallbackTab.customerMobileInput);
          setCustomerBusinessInput(fallbackTab.customerBusinessInput);
          setVegSearchInput(fallbackTab.vegSearchInput);
          setSelectedStockId(fallbackTab.selectedStockId);
          setSoldWeight(fallbackTab.soldWeight);
          setSoldRate(fallbackTab.soldRate);
          setCartItems(fallbackTab.cartItems);
          setPaymentMethod(fallbackTab.paymentMethod);
          setAmountPaid(fallbackTab.amountPaid);

          setActiveTabId(fallbackTab.id);
          return remainingTabs;
        } else {
          // Keep single tab but reset its structure
          const firstNewTab = createEmptyTab(1);
          setActiveTabId(firstNewTab.id);
          return [firstNewTab];
        }
      });

      // Refresh stock balance sheets
      await fetchSalesResources();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to log invoice on database.");
    } finally {
      setIsGeneratingBill(false);
    }
  };

  return (
    <div className="space-y-6" id="sales-sheet-panel">
      {/* Module Title */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight">Create Wholesale Invoice</h2>
          <p className="text-sm text-slate-500 mt-1">Deduct inventory stock automatically and calculate totals, 5% APMC cess, and outstanding dues.</p>
        </div>
      </div>

      {/* Active Customer Queues / Tabs */}
      <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2" id="crowd-billing-tabs">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 pr-1 shrink-0 flex items-center gap-1.5 font-mono select-none">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
          Crowd Billings Queue:
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const itemsCount = tab.cartItems.length;
            return (
              <div
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer font-bold text-xs border transition-all ${
                  isActive
                    ? "bg-emerald-600 border-emerald-700 text-white shadow-sm"
                    : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                <User className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-100" : "text-slate-400"}`} />
                <span className="truncate max-w-[125px]">
                  {dt(tab.label.trim() ? tab.label.trim() : "Walk-in Buyer")}
                </span>
                {itemsCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black ${
                    isActive ? "bg-emerald-800 text-emerald-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                  }`}>
                    {itemsCount}
                  </span>
                )}
                
                <button
                  type="button"
                  onClick={(e) => closeTab(tab.id, e)}
                  className={`p-0.5 rounded-full transition-colors ${
                    isActive ? "hover:bg-emerald-700 text-white" : "hover:bg-slate-200 text-slate-500"
                  }`}
                  title="Clear & Close Tab"
                >
                  <X className="w-3 h-3 shrink-0" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addNewTab}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-800 rounded-lg font-bold text-xs transition-colors shrink-0 cursor-pointer ml-auto max-sm:w-full max-sm:justify-center"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>+ Add Customer Tab</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 text-xs p-3.5 rounded-lg font-medium border border-red-150 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6 items-start" id="sales-interface-grid">
          {/* Main invoice line builder */}
          <div className="col-span-8 max-xl:col-span-12 space-y-6">
            
            {/* Step 1: Customer Link with Autocomplete Typing suggestions */}
            <div ref={autocompleteRef} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <User className="w-4 h-4 text-emerald-600" />
                  <h3>1. Choose or Enter Wholesale Buyer</h3>
                </div>
                {selectedCustomerId && selectedCustomerId !== "new-customer" && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 border border-emerald-100">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    Registered Profile Linked
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Buyer / Customer Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="buyer-name-autocomplete"
                      placeholder="Type customer name (e.g. Amit Gupta)..."
                      value={customerNameInput}
                      autoComplete="off"
                      onChange={(e) => {
                        const val = e.target.value;
                        handleCustomerNameChange(val);
                        // If it corresponds to an exact registered customer name, select it, otherwise new-customer
                        const exactMatch = customers.find(c => (c.name || "").toLowerCase() === (val || "").trim().toLowerCase());
                        if (exactMatch) {
                          setSelectedCustomerId(exactMatch.id);
                          setCustomerMobileInput(exactMatch.mobile);
                          setCustomerBusinessInput(exactMatch.businessName || "");
                        } else {
                          setSelectedCustomerId("new-customer");
                        }
                        setShowSuggestions(false);
                      }}
                      onFocus={() => setShowSuggestions(false)}
                      className="w-full p-2.5 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 font-semibold outline-none text-xs text-slate-800"
                    />
                    {customerNameInput && (
                      <button
                        type="button"
                        onClick={() => {
                          handleCustomerNameChange("");
                          setCustomerMobileInput("");
                          setCustomerBusinessInput("");
                          setSelectedCustomerId("");
                          setShowSuggestions(false);
                        }}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Additional inputs for on-the-fly merchant details */}
                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Buyer Contact No. {selectedCustomerId && selectedCustomerId !== "new-customer" ? "(Registered)" : "(Optional)"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210 (Default: Walking-Buyer)"
                      value={customerMobileInput}
                      autoComplete="off"
                      onChange={(e) => setCustomerMobileInput(e.target.value)}
                      disabled={selectedCustomerId !== "" && selectedCustomerId !== "new-customer"}
                      className={`w-full p-2.5 rounded-lg border outline-none font-semibold text-xs text-slate-800 ${
                        selectedCustomerId && selectedCustomerId !== "new-customer"
                          ? "bg-slate-50 border-slate-200 cursor-not-allowed text-slate-500"
                          : "border-slate-200 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Business / Mall Stall {selectedCustomerId && selectedCustomerId !== "new-customer" ? "(Registered)" : "(Optional)"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sharma Stores (Default: Walking Retailer)"
                      value={customerBusinessInput}
                      autoComplete="off"
                      onChange={(e) => setCustomerBusinessInput(e.target.value)}
                      disabled={selectedCustomerId !== "" && selectedCustomerId !== "new-customer"}
                      className={`w-full p-2.5 rounded-lg border outline-none font-semibold text-xs text-slate-800 ${
                        selectedCustomerId && selectedCustomerId !== "new-customer"
                          ? "bg-slate-50 border-slate-200 cursor-not-allowed text-slate-500"
                          : "border-slate-200 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                      }`}
                    />
                  </div>
                </div>

                {selectedCustomerId === "new-customer" && customerNameInput.trim() && (
                  <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 flex items-center gap-2 text-[10px] text-amber-800 font-semibold leading-relaxed">
                    <span className="text-[12px]">ℹ️</span>
                    <span>
                      High Crowd Mode: <strong>"{customerNameInput.trim()}"</strong> is a brand new merchant. Generating the bill will automatically log their profile instantly into database records.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Vegetables Selector */}
            <div ref={vegAutocompleteRef} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
              <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-sm border-b border-slate-100 pb-2.5">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <h3>2. Add Vegetable Batches to Invoice</h3>
              </div>

              {stock.length === 0 ? (
                <div className="bg-amber-50 text-amber-805 p-4 rounded-lg text-xs leading-relaxed border border-amber-100 font-medium">
                  ⚠️ Stall inventory stock is empty! Please add quantities supplied by farmers under "Stock & Inventory" module before attempting a sale.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Select line items */}
                  <div className="grid grid-cols-12 gap-4 items-end max-md:grid-cols-1" id="checkout-line-builder">
                    <div className="col-span-12 md:col-span-4 relative">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                        Search Commodity Stock
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          id="checkout-stock-autocomplete"
                          placeholder="Type vegetable name, quality, or farmer..."
                          value={vegSearchInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVegSearchInput(val);
                            // If user clears or types something that doesn't exactly match, reset state to force selection from suggestion list
                            const matched = stock.find(v => 
                              `${v.vegetableName} (${v.quality}) - Supplied by: ${v.farmerName.split(" ")[0]} (${v.quantity.toFixed(1)}kg left)` === val.trim()
                            );
                            if (matched) {
                              handleStockSelect(matched.id);
                            } else {
                              setSelectedStockId("");
                            }
                            setShowVegSuggestions(true);
                          }}
                          onFocus={() => setShowVegSuggestions(true)}
                          className="w-full p-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-xs font-semibold text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setVegSearchInput("");
                            setSelectedStockId("");
                            setSoldRate("");
                            setSoldWeight("");
                            setSoldBags("");
                          }}
                          className="absolute right-2.5 top-3.5 text-slate-450 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Stock Autocomplete Suggestion Dropdown */}
                      {showVegSuggestions && vegSearchInput.trim() && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {filteredStock.length > 0 ? (
                            <>
                              <div className="p-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                Available Batches
                              </div>
                              {filteredStock.map(v => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => handleSelectStock(v)}
                                  className="w-full text-left p-2.5 hover:bg-slate-50/70 select-none cursor-pointer flex flex-col transition-colors"
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-900">{dt(v.vegetableName)}</span>
                                    <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                      ₹{v.sellingPrice}/kg
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500">
                                    <span>Farmer: <strong className="text-slate-700 font-semibold">{dt(v.farmerName)}</strong></span>
                                    <span>Stock Left: <strong className="text-emerald-700 font-mono font-bold">{v.quantity.toFixed(1)}kg</strong></span>
                                  </div>
                                  <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">
                                    Quality: <span className="font-bold text-emerald-600 bg-emerald-50/40 px-1 rounded">{dt(v.quality)}</span>
                                  </div>
                                </button>
                              ))}
                            </>
                          ) : (
                            <div className="p-3 text-center text-xs text-slate-400 font-medium bg-slate-50/40">
                              No matching vegetable stocks found.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="col-span-12 md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Sold Bags</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 5"
                        value={soldBags}
                        onChange={(e) => handleBagsChange(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Sold Weight (Kg) *</label>
                      <input
                        type="number"
                        step="0.1"
                        id="line-weight-input"
                        placeholder="e.g. 50"
                        value={soldWeight}
                        onChange={(e) => handleWeightChange(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Selling Rate (₹/Kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        id="line-rate-input"
                        placeholder="Price"
                        value={soldRate}
                        onChange={(e) => setSoldRate(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-xs font-mono font-bold text-slate-800 bg-slate-50"
                      />
                    </div>

                    <button
                      type="button"
                      id="add-to-bill-btn"
                      onClick={addItemToCart}
                      className="col-span-12 md:col-span-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 focus:outline-none shrink-0 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      Add Line
                    </button>
                  </div>

                  {/* Stock validation badge helpers */}
                  {selectedStockId && (
                    (() => {
                      const sel = stock.find(v => v.id === selectedStockId);
                      if (!sel) return null;
                      return (
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-semibold">Stock Verification:</span>
                          <div className="flex gap-4">
                            <span>Quality Grade: <strong className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md font-bold text-[10px]">{dt(sel.quality)}</strong></span>
                            <span>Supplier Farmer: <strong className="text-gray-900 font-bold">{dt(sel.farmerName)}</strong></span>
                            <span>Available Limit: <strong className="text-emerald-800 underline font-bold font-mono">{sel.quantity.toFixed(1)} kg</strong></span>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>

            {/* Bill Lines Grid Table */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="font-display font-bold text-slate-950 mb-4 tracking-tight">Invoice Items list</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest font-bold text-[9px]">
                      <th className="py-2.5 px-3">Vegetable</th>
                      <th className="py-2.5 px-3">Quality</th>
                      <th className="py-2.5 px-3">Farmer</th>
                      <th className="py-2.5 px-3 text-right">Weight (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Rate / Kg</th>
                      <th className="py-2.5 px-3 text-right font-bold text-slate-900">Total Amount</th>
                      <th className="py-2.5 px-3 text-center">Settings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {cartItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                          No vegetable lines added yet. Setup quantities in section 2.
                        </td>
                      </tr>
                    ) : (
                      cartItems.map((item, idx) => (
                        <tr key={`${item.vegetableId}-${idx}`} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-900 text-sm">{dt(item.vegetableName)}</td>
                          <td className="py-3 px-3">
                            <span className="bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md font-bold text-[10px] text-slate-700">
                              {dt(item.quality)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-semibold">{dt(item.farmerName.split(" ")[0])}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                            <div>{item.quantity} kg</div>
                            {item.bags !== undefined && item.bags > 0 && (
                              <div className="text-[10px] text-slate-400 font-normal font-sans">({item.bags.toFixed(1)} bags)</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">₹{item.rate}/kg</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-950 text-sm">₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-3 text-center">
                            <button
                              id={`remove-item-${idx}`}
                              onClick={() => removeCartItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-md border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Checkout billing aggregates and payment column */}
          <div className="col-span-4 max-xl:col-span-12 space-y-6" id="sales-aggregate-panel">
            
            {/* Payment term configurator */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm border-b border-slate-100 pb-2.5">
                <Coins className="w-4 h-4 text-emerald-600" />
                <h3>3. Settlement Terms</h3>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Payment Method</label>
                <div className="grid grid-cols-2 gap-2" id="payment-method-selector-grid">
                  {(["Cash", "Online", "Partial Payment", "Pending Payment"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      id={`pay-method-${m.replace(/\s+/g, "-")}`}
                      onClick={() => {
                        setPaymentMethod(m);
                        if (m !== "Partial Payment") setAmountPaid("");
                      }}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        paymentMethod === m
                          ? "bg-emerald-50 border-emerald-600 text-emerald-800 ring-2 ring-emerald-500/10"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional partial cash payment layout */}
              {paymentMethod === "Partial Payment" && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Downpayment Paid (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 2000"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-xs font-mono font-bold border rounded-lg border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Live breakdown summary receipts */}
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 text-slate-700 text-xs space-y-2 font-medium" id="payment-summary-receipt">
                <div className="flex justify-between">
                  <span>Subtotal Amount:</span>
                  <span className="font-mono text-gray-900">₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Wholesale CGST/SGST (5%):</span>
                  <span className="font-mono text-gray-900">₹{gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-slate-200 my-1 pb-1"></div>
                <div className="flex justify-between text-sm text-gray-950 font-bold">
                  <span>Grand Total:</span>
                  <span className="font-mono text-emerald-800">₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="border-t border-dashed border-slate-200 my-2 pt-2 text-[10px] space-y-1">
                  <div className="flex justify-between text-emerald-700">
                    <span>Clearing Received Amount:</span>
                    <span className="font-mono font-bold">₹{paymentBreakdown.paid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>Outstanding Debt (Pending):</span>
                    <span className="font-mono font-bold">₹{paymentBreakdown.pending.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Calculated Bill Status:</span>
                    <span className="uppercase font-bold tracking-wider">{paymentBreakdown.status}</span>
                  </div>
                </div>
              </div>

              {/* Save invoice CTA triggers */}
              <button
                type="button"
                id="generate-bill-cta"
                disabled={isGeneratingBill}
                onClick={handleCreateBill}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer focus:ring-2 focus:ring-emerald-500/10 focus:outline-none disabled:opacity-80 disabled:pointer-events-none"
              >
                {isGeneratingBill ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Generating Bill...
                  </>
                ) : (
                  <>
                    <span className="shrink-0 font-bold">✓</span>
                    Generate Wholesale Bill
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice receipt popups on successfully saving */}
      {showPrintModal && savedInvoice && (
        <div id="print-modal-backdrop" className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 border border-gray-150 relative">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-gray-900 text-md flex items-center gap-1.5 text-emerald-800">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Wholesale Invoice Logged Successfully!
              </h3>
              <button 
                id="close-success-modal"
                onClick={() => {
                  setShowPrintModal(false);
                  setSavedInvoice(null);
                }} 
                className="text-gray-400 hover:text-gray-600 font-semibold text-lg"
              >
                Done
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              The invoice has been booked. You can print the paper bill for the delivery truck or download details.
            </p>

            {/* Embed the raw paper bill preview */}
            <div className="border border-gray-200 rounded-lg p-2 bg-gray-50 max-h-[350px] overflow-y-auto mb-4">
              <InvoiceDetailModal invoice={savedInvoice} />
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1.5 px-4 py-2 border border-emerald-600 hover:bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print Bill
              </button>

              <button
                onClick={handleDownloadInvoiceCSV}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export CSV Actions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
