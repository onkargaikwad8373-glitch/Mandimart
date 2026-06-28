import { useState, useEffect, FormEvent } from "react";
import { Plus, Search, MapPin, Phone, Building2, Trash2, Edit3, X, RefreshCw, Coins, ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";
import { Customer, Invoice } from "../types";
import { useTranslation } from "../context/LanguageContext";
import { apiFetch } from "../utils/api";

interface CustomersProps {
  staffMode?: boolean;
}

export default function Customers({ staffMode = false }: CustomersProps) {
  const { t, dt, language } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Modal actions (Owner only)
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    address: "",
    businessName: ""
  });

  // Staff Payment Modal state
  const [paymentTarget, setPaymentTarget] = useState<{ customer: Customer; invoices: Invoice[] } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payModalError, setPayModalError] = useState("");
  const [isPaySubmitting, setIsPaySubmitting] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resCust, resInvs] = await Promise.all([
        apiFetch("/api/customers"),
        apiFetch("/api/invoices")
      ]);
      if (!resCust.ok) throw new Error("Could not retrieve wholesale customers");
      if (!resInvs.ok) throw new Error("Could not retrieve invoices");
      const custData = await resCust.json();
      const invData = await resInvs.json();
      setCustomers(custData);
      setInvoices(invData);
    } catch (e: any) {
      setErrorMsg(e.message || "Database connection failure");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [language]);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: "", mobile: "", address: "", businessName: "" });
    setShowModal(true);
    setErrorMsg("");
  };

  const openEditModal = (cust: Customer) => {
    setEditingId(cust.id);
    setFormData({
      name: cust.name,
      mobile: cust.mobile,
      address: cust.address || "",
      businessName: cust.businessName || ""
    });
    setShowModal(true);
    setErrorMsg("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.mobile.trim()) {
      setErrorMsg("Customer Name and Active Mobile No. are required.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg("");
      const url = editingId ? `/api/customers/${editingId}` : "/api/customers";
      const method = editingId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-App-Language": language
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Save operation failed");
      }

      await fetchData();
      setShowModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Error processing customer transaction.");
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Delete action failed");
      }
      await fetchData();
    } catch (err: any) {
      setErrorMsg(`Critical error: ${err.message}`);
    }
  };

  // Open Staff payment modal — fetch pending invoices for that customer
  const openPaymentModal = (cust: Customer) => {
    const custInvoices = invoices.filter(
      (inv) => inv.customerId === cust.id && inv.amountPending > 0
    );
    setPaymentTarget({ customer: cust, invoices: custInvoices });
    setSelectedInvoice(custInvoices.length > 0 ? custInvoices[0] : null);
    setPayAmount(custInvoices.length > 0 ? String(custInvoices[0].amountPending) : "");
    setPayMethod("Cash");
    setPayModalError("");
    setPaySuccess(false);
  };

  const handleInvoiceSelect = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPayAmount(String(inv.amountPending));
    setPayModalError("");
  };

  const handlePaySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPayModalError("");
    if (!selectedInvoice || !payAmount || Number(payAmount) <= 0) {
      setPayModalError("Please enter a valid payment amount.");
      return;
    }
    if (Number(payAmount) > selectedInvoice.amountPending) {
      setPayModalError(`Amount cannot exceed outstanding balance ₹${selectedInvoice.amountPending.toFixed(2)}`);
      return;
    }

    try {
      setIsPaySubmitting(true);
      const res = await apiFetch(`/api/invoices/${selectedInvoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(payAmount),
          paymentMethod: payMethod
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Payment recording failed");
      }

      setPaySuccess(true);
      // Refresh all data
      await fetchData();

      // Wait 1.5s then close
      setTimeout(() => {
        setPaymentTarget(null);
        setPaySuccess(false);
      }, 1500);
    } catch (err: any) {
      setPayModalError(`Payment error: ${err.message}`);
    } finally {
      setIsPaySubmitting(false);
    }
  };

  // --- Filtered customer lists ---
  const pendingCustomers = customers.filter((c) => {
    const custPending = invoices
      .filter((inv) => inv.customerId === c.id)
      .reduce((sum, inv) => sum + inv.amountPending, 0);
    return custPending > 0;
  });

  // Enrich pending customers with their total pending amount computed from invoices
  const pendingCustomersWithAmount = pendingCustomers.map((c) => {
    const totalPending = invoices
      .filter((inv) => inv.customerId === c.id)
      .reduce((sum, inv) => sum + inv.amountPending, 0);
    const invoiceCount = invoices.filter(
      (inv) => inv.customerId === c.id && inv.amountPending > 0
    ).length;
    return { ...c, totalPending, invoiceCount };
  });

  const filteredCustomers = customers.filter(
    (c) =>
      (c.name || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
      (c.mobile || "").includes(searchQuery || "") ||
      (c.businessName || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
      (c.address && (c.address || "").toLowerCase().includes((searchQuery || "").toLowerCase()))
  );

  const filteredPending = pendingCustomersWithAmount.filter(
    (c) =>
      (c.name || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
      (c.mobile || "").includes(searchQuery || "") ||
      (c.businessName || "").toLowerCase().includes((searchQuery || "").toLowerCase())
  );

  // ============================================================
  // STAFF MODE VIEW
  // ============================================================
  if (staffMode) {
    return (
      <div className="space-y-6" id="staff-customers-module">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-sm:flex-col max-sm:items-start max-sm:gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight">
              Pending Customer Payments
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Customers with outstanding partial or pending payment balances. Record received payments here.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-amber-700">Staff View — Read Only</span>
          </div>
        </div>

        {/* Summary banner */}
        {!loading && (
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Customers with Dues</p>
                <p className="text-2xl font-display font-bold text-amber-900">{pendingCustomersWithAmount.length}</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Total Outstanding</p>
                <p className="text-2xl font-display font-bold text-red-900">
                  ₹{pendingCustomersWithAmount.reduce((s, c) => s + c.totalPending, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer name, mobile, or business..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm"
            />
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors cursor-pointer shrink-0"
            title="Reload"
          >
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
        </div>

        {/* Pending customers grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredPending.length === 0 ? (
          <div className="bg-white p-14 text-center rounded-xl border border-slate-200 shadow-sm">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">All Clear!</h3>
            <p className="text-slate-400 font-semibold text-sm">
              {searchQuery ? "No pending customers match your search." : "No customers have outstanding payments right now."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1 gap-5" id="staff-pending-customers-grid">
            {filteredPending.map((cust) => (
              <div
                key={cust.id}
                className="bg-white rounded-xl border border-amber-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all p-5 flex flex-col justify-between"
                id={`staff-cust-card-${cust.id}`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="bg-amber-50 text-amber-700 font-mono font-bold px-2.5 py-1 rounded-md text-[10px] tracking-wide border border-amber-100">
                      {cust.invoiceCount} bill{cust.invoiceCount !== 1 ? "s" : ""} pending
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{dt(cust.name)}</h3>

                  {cust.businessName && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1.5 font-semibold">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{dt(cust.businessName)}</span>
                    </p>
                  )}

                  <div className="space-y-2 text-xs text-gray-600 mt-4 border-t border-gray-50 pt-3">
                    <p className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="font-mono text-gray-800">{cust.mobile}</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{cust.address ? dt(cust.address) : "Address unspecified"}</span>
                    </p>

                    {/* Outstanding amount badge */}
                    <div className="mt-3 pt-2.5 border-t border-red-50 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider">Outstanding Balance</span>
                      <span className="font-mono font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-md text-xs">
                        ₹{cust.totalPending.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Record Payment button */}
                <button
                  id={`staff-pay-btn-${cust.id}`}
                  onClick={() => openPaymentModal(cust)}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  <Coins className="w-4 h-4" />
                  Record Customer Payment
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Staff Payment Modal */}
        {paymentTarget && (
          <div id="staff-payment-modal-backdrop" className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-gray-900 text-base">Record Payment</h3>
                </div>
                <button
                  onClick={() => { setPaymentTarget(null); setPaySuccess(false); }}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer Info */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 mb-4">
                <p className="font-bold text-slate-900 text-sm">{dt(paymentTarget.customer.name)}</p>
                {paymentTarget.customer.businessName && (
                  <p className="text-xs text-emerald-700 font-semibold mt-0.5">{dt(paymentTarget.customer.businessName)}</p>
                )}
                <p className="font-mono text-xs text-slate-500 mt-1">{paymentTarget.customer.mobile}</p>
              </div>

              {paySuccess ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <p className="font-bold text-slate-900 text-base">Payment Recorded!</p>
                  <p className="text-sm text-slate-500 mt-1">The customer's balance has been updated.</p>
                </div>
              ) : (
                <form onSubmit={handlePaySubmit} className="space-y-4">
                  {payModalError && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{payModalError}</span>
                    </div>
                  )}

                  {/* Invoice selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Select Invoice Bill *
                    </label>
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {paymentTarget.invoices.length === 0 ? (
                        <p className="text-xs text-slate-400 font-semibold text-center py-4">No pending invoices found</p>
                      ) : (
                        paymentTarget.invoices.map((inv) => (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => handleInvoiceSelect(inv)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              selectedInvoice?.id === inv.id
                                ? "border-amber-400 bg-amber-50"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-mono font-bold text-slate-900 text-xs">{inv.invoiceNumber}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{inv.createdAt.slice(0, 10)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-slate-400">Outstanding</p>
                                <p className="font-mono font-bold text-amber-700 text-xs">₹{inv.amountPending.toFixed(2)}</p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {selectedInvoice && (
                    <>
                      {/* Amount */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Payment Amount (₹) *
                        </label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0.01"
                          max={selectedInvoice.amountPending}
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 text-sm font-mono font-bold"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Max: ₹{selectedInvoice.amountPending.toFixed(2)} remaining
                        </p>
                      </div>

                      {/* Payment method */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Payment Mode
                        </label>
                        <select
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value)}
                          className="w-full p-2.5 bg-white rounded-lg border border-gray-200 focus:border-amber-500 outline-none text-xs text-gray-950 font-semibold"
                        >
                          <option value="Cash">Cash Settlement</option>
                          <option value="Online">Online / UPI Transfer</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => { setPaymentTarget(null); }}
                      className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 border border-gray-200 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPaySubmitting || !selectedInvoice || paymentTarget.invoices.length === 0}
                      className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                      {isPaySubmitting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Recording...
                        </>
                      ) : (
                        <>
                          <Coins className="w-3.5 h-3.5" />
                          Confirm Payment
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // OWNER MODE VIEW (original)
  // ============================================================
  return (
    <div className="space-y-6" id="customers-module">
      {/* Module Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight">{t("registered_buyers")}</h2>
          <p className="text-sm text-slate-500 mt-1">Register bulk merchants, tracking business names, contact information, and shipping addresses.</p>
        </div>
        <button
          id="add-customer-btn"
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t("register_wholesale_customer")}
        </button>
      </div>

      {/* Search Filter actions */}
      <div className="flex gap-4 items-center max-md:flex-col bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full" id="search-cust-wrapper">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("search_customer_name")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm"
          />
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors cursor-pointer shrink-0"
          title="Reload list"
        >
          <RefreshCw className="w-4 h-4" />
          Reload
        </button>
      </div>

      {/* Customer profiles grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-400 font-semibold font-sans">{t("no_customers_yet")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1 gap-5" id="customers-card-grid">
          {filteredCustomers.map((cust) => (
            <div
              key={cust.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-350 transition-all p-5 flex flex-col justify-between"
              id={`customer-card-${cust.id}`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-emerald-50 text-emerald-800 font-mono font-bold px-3 py-1 rounded-md text-[10px] tracking-wide border border-emerald-100">
                    Merchant Code: {cust.id}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      id={`edit-cust-${cust.id}`}
                      onClick={() => openEditModal(cust)}
                      className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-md text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                      title="Edit Profile"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`delete-cust-${cust.id}`}
                      onClick={() => setDeleteConfirm({ id: cust.id, name: cust.name })}
                      className="p-1 px-2 border border-gray-200 hover:bg-gray-50 rounded-md text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
                      title="Delete profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{dt(cust.name)}</h3>

                {cust.businessName && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1.5 font-semibold">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{dt(cust.businessName)}</span>
                  </p>
                )}

                <div className="space-y-2 text-xs text-gray-600 mt-4 border-t border-gray-50 pt-3">
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-mono text-gray-800">{cust.mobile}</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{cust.address ? dt(cust.address) : "Address unspecified"}</span>
                  </p>
                  {cust.remainingAmount !== undefined && cust.remainingAmount > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider font-sans">{t("amount_pending")}</span>
                      <span className="font-mono font-bold text-red-600 bg-red-50/70 border border-red-100/50 px-2.5 py-0.5 rounded-md text-xs">
                        ₹{cust.remainingAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile Form overlay Dialog */}
      {showModal && (
        <div id="customer-modal-backdrop" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">
                {editingId ? "Edit Customer Details" : t("register_wholesale_customer")}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg mb-4 font-medium border border-red-100">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Amit Gupta"
                  className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t("business_mall_stall")}</label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="e.g. Gupta Veg Wholesalers"
                  className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t("buyer_contact_no")} *</label>
                <input
                  type="text"
                  required
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="e.g. 9988776655"
                  className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Market Delivery / Shipping Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Stall 45B, Market Yard, Pune"
                  rows={3}
                  className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 border border-gray-200 rounded-lg disabled:opacity-50 disabled:pointer-events-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-80 disabled:pointer-events-none"
                >
                  {isSaving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      {editingId ? "Saving..." : "Registering..."}
                    </>
                  ) : (
                    editingId ? "Save Profile" : t("register_customer_profile")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in" id="delete-customer-modal">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 mx-4 animate-scale-up">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2 bg-red-50 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 font-display">Confirm Deletion</h3>
            </div>

            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Are you sure you want to remove Customer: <strong className="text-slate-900 font-semibold">{dt(deleteConfirm.name)}</strong>?
              This action is permanent.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                id="cancel-delete-customer-btn"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-customer-btn"
                onClick={async () => {
                  const id = deleteConfirm.id;
                  setDeleteConfirm(null);
                  await executeDelete(id);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition-all shadow-md cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
