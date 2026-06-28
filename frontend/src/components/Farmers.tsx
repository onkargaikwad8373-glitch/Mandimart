import { useState, useEffect, FormEvent } from "react";
import { Plus, Search, MapPin, Phone, FileText, Trash2, Edit3, X, RefreshCw } from "lucide-react";
import { Farmer } from "../types";
import { useTranslation } from "../context/LanguageContext";
import { apiFetch } from "../utils/api";

export default function Farmers() {
  const { t, dt, language } = useTranslation();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    address: "",
    notes: ""
  });

  const fetchFarmers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/farmers");
      if (!res.ok) throw new Error("Failed to load farmer Directory");
      const data = await res.json();
      setFarmers(data);
    } catch (e: any) {
      setErrorMsg(e.message || "Database connection failure");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmers();
  }, [language]);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: "", mobile: "", address: "", notes: "" });
    setShowModal(true);
    setErrorMsg("");
  };

  const openEditModal = (farmer: Farmer) => {
    setEditingId(farmer.id);
    setFormData({
      name: farmer.name,
      mobile: farmer.mobile,
      address: farmer.address || "",
      notes: farmer.notes || ""
    });
    setShowModal(true);
    setErrorMsg("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.mobile.trim()) {
      setErrorMsg("Farmer Name and Mobile Number are required.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg("");
      const url = editingId ? `/api/farmers/${editingId}` : "/api/farmers";
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

      await fetchFarmers();
      setShowModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Error processing your request.");
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/farmers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Delete call failed");
      }
      await fetchFarmers();
    } catch (err: any) {
      setErrorMsg(`Critical error: ${err.message}`);
    }
  };

  const filteredFarmers = farmers.filter(f => 
    (f.name || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
    (f.mobile || "").includes(searchQuery) ||
    (f.address && (f.address || "").toLowerCase().includes((searchQuery || "").toLowerCase()))
  );

  return (
    <div className="space-y-6" id="farmers-module">
      {/* Module Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight">{t("registered_farmers")}</h2>
          <p className="text-sm text-slate-500 mt-1">Manage wholesale agrarian suppliers, contact numbers, and delivery notes.</p>
        </div>
        <button
          id="add-farmer-btn"
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t("add_new_farmer")}
        </button>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex gap-4 items-center max-md:flex-col bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full" id="search-input-wrapper">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("search_farmer_name")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm"
          />
        </div>
        <button
          onClick={fetchFarmers}
          className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors cursor-pointer shrink-0"
          title="Refresh List"
        >
          <RefreshCw className="w-4 h-4" />
          Reload
        </button>
      </div>

      {/* Farmers Grid/List rendering */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : filteredFarmers.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-400 font-semibold">{t("no_farmers_yet")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1 gap-5" id="farmers-card-grid">
          {filteredFarmers.map((farmer) => (
            <div 
              key={farmer.id} 
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-350 transition-all p-5 flex flex-col justify-between"
              id={`farmer-card-${farmer.id}`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-emerald-50 text-emerald-800 font-mono font-bold px-3 py-1 rounded-md text-[10px] tracking-wide border border-emerald-100">
                    ID: {farmer.id}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      id={`edit-farmer-${farmer.id}`}
                      onClick={() => openEditModal(farmer)}
                      className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-md text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                      title="Edit Profile"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`delete-farmer-${farmer.id}`}
                      onClick={() => setDeleteConfirm({ id: farmer.id, name: farmer.name })}
                      className="p-1 px-2 border border-gray-200 hover:bg-gray-50 rounded-md text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
                      title="Delete Farmer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 text-lg leading-tight mb-3 truncate">{dt(farmer.name)}</h3>

                <div className="space-y-2 text-xs text-gray-600">
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-mono text-gray-800">{farmer.mobile}</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{farmer.address ? dt(farmer.address) : "No address provided"}</span>
                  </p>
                  {farmer.notes && (
                    <div className="mt-3 bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 flex gap-1.5 items-start">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-gray-500 italic leading-relaxed text-[11px] line-clamp-3">{dt(farmer.notes)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Add/Edit Overlay Modal */}
      {showModal && (
        <div id="farmer-modal-backdrop" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">
                {editingId ? "Modify Farmer Record" : t("register_farmer_supplier")}
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
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Farmer Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Patil"
                  className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t("farmer_contact_mobile")} *</label>
                <input
                  type="text"
                  required
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="e.g. 9823456789"
                  className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t("farmer_location_village")}</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. farm location, tehsil, district info"
                  rows={2}
                  className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Trading Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="..."
                  rows={2}
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
                    editingId ? "Save Changes" : t("register_profile")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in" id="delete-farmer-modal">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 mx-4 animate-scale-up">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2 bg-red-50 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 font-display">Confirm Deletion</h3>
            </div>
            
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Are you sure you want to remove Farmer: <strong className="text-slate-900 font-semibold">{dt(deleteConfirm.name)}</strong>? 
              This won't delete their historical invoices.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                id="cancel-delete-farmer-btn"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-farmer-btn"
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

