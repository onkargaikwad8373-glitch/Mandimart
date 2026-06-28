import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { Plus, Search, ArrowRight, Trash2, Edit3, X, RefreshCw, AlertTriangle, BadgePercent, Calendar, Camera, Image, Upload } from "lucide-react";
import { Vegetable, Farmer } from "../types";
import { useTranslation } from "../context/LanguageContext";
import { apiFetch } from "../utils/api";

export default function Inventory() {
  const { t, dt, language } = useTranslation();
  const [items, setItems] = useState<Vegetable[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuality, setSelectedQuality] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Photo viewer and live camera states
  const [photoModalItem, setPhotoModalItem] = useState<Vegetable | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");

  // Helper to get today's date in YYYY-MM-DD
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

  const formatCapturedDate = (isoStr: string | undefined) => {
    if (!isoStr) return "";
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (e) {
      return "";
    }
  };

  // State for dailywise filters
  const [dateFilterType, setDateFilterType] = useState<"all" | "today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>(getTodayString());

  // Modal Dialog controls
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    farmerId: "",
    farmerName: "",
    vegetableName: "",
    quality: "Premium",
    quantity: "",
    bags: "",
    purchasePrice: "",
    sellingPrice: "",
    dateAdded: "",
    imageUrl: "",
    photoCapturedAt: ""
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resVeg, resFarmers] = await Promise.all([
        apiFetch("/api/vegetables"),
        apiFetch("/api/farmers")
       ]);

      if (!resVeg.ok || !resFarmers.ok) throw new Error("Could not download Mandi stock catalogs");
      const vData = await resVeg.json();
      const fData = await resFarmers.json();

      setItems(vData);
      setFarmers(fData);
    } catch (e: any) {
      setErrorMsg(e.message || "Database connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [language]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showModal, photoModalItem, cameraStream]);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      farmerId: "",
      farmerName: "",
      vegetableName: "",
      quality: "Premium",
      quantity: "",
      bags: "",
      purchasePrice: "",
      sellingPrice: "",
      dateAdded: getTodayString(),
      imageUrl: "",
      photoCapturedAt: ""
    });
    setShowModal(true);
    setErrorMsg("");
  };

  const openEditModal = (item: Vegetable) => {
    setEditingId(item.id);
    setFormData({
      farmerId: item.farmerId,
      farmerName: item.farmerName,
      vegetableName: item.vegetableName,
      quality: item.quality,
      quantity: String(item.quantity),
      bags: item.bags !== undefined ? String(item.bags) : String(item.quantity / 20),
      purchasePrice: String(item.purchasePrice),
      sellingPrice: String(item.sellingPrice),
      dateAdded: item.dateAdded ? item.dateAdded.split('T')[0] : getTodayString(),
      imageUrl: item.imageUrl || "",
      photoCapturedAt: item.photoCapturedAt || ""
    });
    setShowModal(true);
    setErrorMsg("");
  };

  const handleFarmerNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const matchedFarmer = farmers.find(f => (f.name || "").toLowerCase() === (name || "").trim().toLowerCase());
    if (matchedFarmer) {
      setFormData(prev => ({
        ...prev,
        farmerName: name,
        farmerId: matchedFarmer.id
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        farmerName: name,
        farmerId: name.trim() ? `f-manual-${name.trim().toLowerCase().replace(/\s+/g, "-")}` : ""
      }));
    }
  };

  const handleBagsChange = (val: string) => {
    const calculatedKg = val ? String(Number(val) * 20) : "";
    setFormData(prev => ({
      ...prev,
      bags: val,
      quantity: calculatedKg
    }));
  };

  const handleQuantityChange = (val: string) => {
    const calculatedBags = val ? String(Number(val) / 20) : "";
    setFormData(prev => ({
      ...prev,
      quantity: val,
      bags: calculatedBags
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { vegetableName, quality, quantity, purchasePrice, sellingPrice, dateAdded, imageUrl, photoCapturedAt } = formData;
    let finalFarmerId = formData.farmerId;
    let finalFarmerName = formData.farmerName.trim();

    if (!finalFarmerName) {
      setErrorMsg("Producer/Farmer name is required.");
      return;
    }

    if (!vegetableName.trim() || !quality || !quantity || !purchasePrice || !sellingPrice) {
      setErrorMsg("All stock registration fields are required.");
      return;
    }

    if (Number(quantity) < 0 || Number(purchasePrice) < 0 || Number(sellingPrice) < 0) {
      setErrorMsg("Quantities and prices cannot be negative values.");
      return;
    }

    if (!finalFarmerId) {
      const matchedFarmer = farmers.find(f => (f.name || "").toLowerCase() === (finalFarmerName || "").toLowerCase());
      finalFarmerId = matchedFarmer ? matchedFarmer.id : `f-manual-${Date.now()}`;
    }

    const isoDateStr = dateAdded ? new Date(dateAdded + "T12:00:00").toISOString() : new Date().toISOString();

    try {
      setIsSaving(true);
      setErrorMsg("");
      const url = editingId ? `/api/vegetables/${editingId}` : "/api/vegetables";
      const method = editingId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "X-App-Language": language
        },
        body: JSON.stringify({
          farmerId: finalFarmerId,
          farmerName: finalFarmerName,
          vegetableName: vegetableName.trim(),
          quality,
          quantity: Number(quantity),
          bags: Number(formData.bags || 0),
          purchasePrice: Number(purchasePrice),
          sellingPrice: Number(sellingPrice),
          dateAdded: isoDateStr,
          imageUrl: imageUrl,
          photoCapturedAt: photoCapturedAt || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Save operation failed");
      }

      await fetchData();
      setShowModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  // Camera Utility Functions
  const startCamera = async (videoElementId: string) => {
    try {
      setCameraError("");
      setIsCameraActive(true);
      if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser or sandbox environment does not support camera capture. Please use the 'Upload Image' option instead.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      const video = document.getElementById(videoElementId) as HTMLVideoElement;
      if (video) {
        video.srcObject = stream;
        video.play().catch(err => console.error("Video stream playback failure:", err));
      }
    } catch (err: any) {
      console.error("Camera permissions / hardware missing:", err);
      setCameraError(err.message || "Camera access denied or hardware not found. Please upload an image file instead.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = (videoElementId: string, onCaptured: (base64: string) => void) => {
    const video = document.getElementById(videoElementId) as HTMLVideoElement;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Scale down image to manage storage size nicely in JSON (max width 600px)
    let finalCanvas = canvas;
    if (canvas.width > 600) {
      const scaleCanvas = document.createElement("canvas");
      scaleCanvas.width = 600;
      scaleCanvas.height = Math.round((600 * canvas.height) / canvas.width);
      const sCtx = scaleCanvas.getContext("2d");
      if (sCtx) {
        sCtx.drawImage(canvas, 0, 0, 600, scaleCanvas.height);
        finalCanvas = scaleCanvas;
      }
    }

    const base64Jpeg = finalCanvas.toDataURL("image/jpeg", 0.6);
    onCaptured(base64Jpeg);
    stopCamera();
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>, onPhotoSet: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Also resize files uploaded if they are huge
      const img = new window.Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 600;
        if (img.width > maxW) {
          canvas.width = maxW;
          canvas.height = Math.round((maxW * img.height) / img.width);
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          onPhotoSet(canvas.toDataURL("image/jpeg", 0.6));
        } else {
          onPhotoSet(base64);
        }
      };
      img.onerror = () => {
        onPhotoSet(base64);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhotoDirectly = async (item: Vegetable, newBase64: string | null) => {
    try {
      setErrorMsg("");
      const nowCapturedAt = newBase64 ? new Date().toISOString() : "";
      const res = await apiFetch(`/api/vegetables/${item.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-App-Language": language
        },
        body: JSON.stringify({
          farmerId: item.farmerId,
          farmerName: item.farmerName,
          vegetableName: item.vegetableName,
          quality: item.quality,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          dateAdded: item.dateAdded,
          imageUrl: newBase64 || "",
          photoCapturedAt: nowCapturedAt
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Save operation failed");
      }

      await fetchData();
      
      // Update local state if the photo modal is open for this item
      setPhotoModalItem(prev => prev && prev.id === item.id ? { ...prev, imageUrl: newBase64 || "", photoCapturedAt: nowCapturedAt } : prev);
    } catch (err: any) {
      console.error("Error saving photo directly:", err);
      setCameraError("Error saving photo: " + (err.message || "Unknown error"));
    }
  };

  const executeDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/vegetables/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Delete action failed");
      }
      await fetchData();
    } catch (err: any) {
      setErrorMsg(`Error deleting batch: ${err.message}`);
    }
  };

  const todayStr = getTodayString();
  const yesterdayStr = getYesterdayString();

  const todayCount = items.filter(item => item.dateAdded && item.dateAdded.split('T')[0] === todayStr).length;
  const yesterdayCount = items.filter(item => item.dateAdded && item.dateAdded.split('T')[0] === yesterdayStr).length;
  const allCount = items.length;

  // Filters logic
  const filteredItems = items.filter(v => {
    const query = (searchQuery || "").toLowerCase();
    const matchesSearch = 
      (v.vegetableName || "").toLowerCase().includes(query) ||
      (v.farmerName || "").toLowerCase().includes(query) ||
      (v.quality || "").toLowerCase().includes(query);
    
    const matchesQuality = selectedQuality === "" || v.quality === selectedQuality;

    let matchesDate = true;
    const itemDateStr = v.dateAdded ? v.dateAdded.split('T')[0] : "";
    if (dateFilterType === "today") {
      matchesDate = itemDateStr === todayStr;
    } else if (dateFilterType === "yesterday") {
      matchesDate = itemDateStr === yesterdayStr;
    } else if (dateFilterType === "custom") {
      matchesDate = itemDateStr === customDate;
    }

    return matchesSearch && matchesQuality && matchesDate;
  });

  // Global Inventory Metrics
  const totalWeight = filteredItems.reduce((acc, curr) => acc + curr.quantity, 0);
  const lowStockBatches = filteredItems.filter(v => v.quantity <= 15).length;
  const avgProfitMargin = filteredItems.length > 0 
    ? (filteredItems.reduce((acc, v) => acc + ((v.sellingPrice - v.purchasePrice) / v.purchasePrice), 0) / filteredItems.length) * 100
    : 0;

  return (
    <div className="space-y-6" id="inventory-module">
      {/* Module Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight">{t("live_vegetable_stock")}</h2>
          <p className="text-sm text-slate-500 mt-1">Monitor available quantities, farmer source batches, buying costs, and wholesale seller margins.</p>
        </div>
        <button
          id="add-inventory-btn"
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t("log_stock_batch")}
        </button>
      </div>

      <div className="bg-emerald-50/50 border border-emerald-100 text-emerald-800 text-xs p-3.5 rounded-xl font-semibold tracking-wide flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-emerald-600 max-sm:shrink-0" />
        <span>Tip: You can select from registered farmers or simply type any new farmer's name in the log form as they arrive!</span>
      </div>

      {/* Dailywise Stock Filter manager */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4" id="daily-stock-controls">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-800 tracking-wide uppercase">Daily Stock Manager</p>
            <p className="text-[11px] text-slate-500 font-semibold">Filter vegetable stock records day-by-day</p>
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

      {/* Metrics mini bars */}
      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4" id="inventory-metrics-row">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("stock_left")}</p>
            <h4 className="text-xl font-display font-semibold text-slate-950 mt-0.5">{totalWeight.toFixed(1)} <sub className="text-xs text-slate-400 font-sans font-normal">kg</sub></h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="bg-amber-50 text-amber-600 p-2.5 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Low Stock Batches (≤15 kg)</p>
            <h4 className="text-xl font-display font-semibold text-amber-700 mt-0.5">{lowStockBatches} batches</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="bg-teal-50 text-teal-600 p-2.5 rounded-lg">
            <BadgePercent className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("expected_profit")}</p>
            <h4 className="text-xl font-display font-semibold text-emerald-700 mt-0.5">+{avgProfitMargin.toFixed(0)}%</h4>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex gap-4 items-center max-md:flex-col bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full" id="search-inventory-wrapper">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("search_active_stock")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm"
          />
        </div>

        <div className="flex gap-3 max-sm:w-full">
          <select
            id="quality-filter-select"
            value={selectedQuality}
            onChange={(e) => setSelectedQuality(e.target.value)}
            className="p-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:border-emerald-500 outline-none"
          >
            <option value="">{t("all_suppliers")}</option>
            <option value="Premium">{t("premium_grade")}</option>
            <option value="Standard">{t("standard_grade")}</option>
            <option value="Medium">Medium Quality</option>
          </select>

          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            title="Reload metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inventory table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-400 font-semibold">{t("no_active_stock")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="inventory-table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest font-bold text-[10px]">
                  <th className="py-3 px-4">{t("vegetable_name")}</th>
                  <th className="py-3 px-4">Stock Date</th>
                  <th className="py-3 px-4">{t("quality_grade")}</th>
                  <th className="py-3 px-4">{t("farmer_name")}</th>
                  <th className="py-3 px-4 text-right">{t("sold_weight")}</th>
                  <th className="py-3 px-4 text-right">{t("cost_price")} / Kg</th>
                  <th className="py-3 px-4 text-right">{t("selling_price")} / Kg</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-900">{t("cumulative_profit")}</th>
                  <th className="py-3 px-4 text-center">Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredItems.map((item) => {
                  const profitRatio = ((item.sellingPrice - item.purchasePrice) / item.purchasePrice) * 100;
                  const isLow = item.quantity <= 15;

                  const formatDateString = (isoString: string) => {
                    if (!isoString) return "-";
                    try {
                      const d = new Date(isoString);
                      if (isNaN(d.getTime())) return isoString.split('T')[0];
                      return d.toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      });
                    } catch {
                      return isoString.split('T')[0];
                    }
                  };

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/40 transition-colors" id={`inventory-row-${item.id}`}>
                      <td className="py-4 px-4 font-bold text-sm text-slate-900">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              stopCamera();
                              setPhotoModalItem(item);
                            }}
                            className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center hover:border-emerald-500 transition-colors cursor-pointer group relative shadow-xs"
                            title="Click to view or capture stock photo"
                          >
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.vegetableName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Camera className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Camera className="w-3.5 h-3.5 text-white" />
                            </div>
                          </button>
                          <div>
                            <span className="block">{dt(item.vegetableName)}</span>
                            <span className="text-[10px] text-slate-400 font-normal block font-mono">ID: {item.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-500 font-semibold font-mono">{formatDateString(item.dateAdded)}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                          item.quality === "Premium" ? "bg-emerald-50 text-emerald-800 border-emerald-100" : "bg-slate-50 text-slate-700 border-slate-150"
                        }`}>
                          {dt(item.quality)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-600 font-semibold">{dt(item.farmerName)}</td>
                      <td className="py-4 px-4 text-right">
                        <span className={`font-mono font-bold text-[13px] ${isLow ? "text-amber-600" : "text-slate-900"}`}>
                          {item.quantity.toFixed(1)}
                        </span>
                        <span className="text-slate-400 font-medium ml-1">kg</span>
                        {item.bags !== undefined && item.bags > 0 ? (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            ({item.bags.toFixed(1)} bags)
                          </span>
                        ) : (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            ({(item.quantity / 20).toFixed(1)} bags)
                          </span>
                        )}
                        {isLow && (
                          <span className="block text-[9px] text-amber-500 font-bold tracking-wider uppercase mt-0.5 flex items-center justify-end gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Reorder
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-600">₹{item.purchasePrice}/kg</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 font-bold">₹{item.sellingPrice}/kg</td>
                      <td className="py-4 px-4 text-right font-mono">
                        <span className="text-emerald-700 font-bold">
                          +₹{(item.sellingPrice - item.purchasePrice)}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-normal">
                          (+{profitRatio.toFixed(0)}%)
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex gap-1.5 justify-center">
                          <button
                            id={`edit-stock-${item.id}`}
                            onClick={() => openEditModal(item)}
                            className="p-1 px-2 border border-slate-200 hover:bg-slate-50 rounded-md text-slate-600 hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Edit Stock details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-stock-${item.id}`}
                            onClick={() => setDeleteConfirm({ id: item.id, name: item.vegetableName })}
                            className="p-1 px-2 border border-slate-200 hover:bg-slate-50 rounded-md text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
                            title="Delete Stock"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                   );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Inventory Modal */}
      {showModal && (
        <div id="inventory-modal-backdrop" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">
                {editingId ? "Update Vegetable Stock" : t("log_incoming_producer_batch")}
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
              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t("select_producer_farmer")} *</label>
                  <input
                    type="text"
                    required
                    list="farmers-datalist"
                    placeholder="Enter producer name"
                    value={formData.farmerName}
                    onChange={handleFarmerNameChange}
                    className="w-full p-2.5 rounded-lg border border-gray-250 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800"
                  />
                  <datalist id="farmers-datalist">
                    {farmers.map(f => (
                      <option key={f.id} value={dt(f.name)} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t("comodity_vegetable_name")} *</label>
                  <input
                    type="text"
                    required
                    placeholder={t("veg_name_placeholder")}
                    value={formData.vegetableName}
                    onChange={(e) => setFormData({ ...formData, vegetableName: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-gray-250 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Stock Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.dateAdded}
                    onChange={(e) => setFormData({ ...formData, dateAdded: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-gray-250 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-850"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t("quality_grade")} *</label>
                  <select
                    required
                    value={formData.quality}
                    onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-gray-250 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-850"
                  >
                    <option value="Premium">{t("premium_grade")}</option>
                    <option value="Standard">{t("standard_grade")}</option>
                    <option value="Medium">Medium Quality</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Number of Bags</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 5"
                    value={formData.bags}
                    onChange={(e) => handleBagsChange(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-250 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t("incoming_weight")} (kg) *</label>
                  <input
                    type="number"
                    required
                    step="0.1"
                    min="1"
                    placeholder="e.g. 100"
                    value={formData.quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-250 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t("purchase_rate")} *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400 text-sm font-semibold">₹</span>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="1"
                      placeholder="e.g. 40"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-250 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono font-bold text-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t("expected_selling_price")} *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400 text-sm font-semibold">₹</span>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="1"
                      placeholder="e.g. 60"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                      className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-250 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-end">
                  {/* Pricing gap info */}
                </div>
              </div>

              {formData.purchasePrice && formData.sellingPrice && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-semibold uppercase">Pricing Gap (Est Profit):</span>
                  <div className="flex gap-2 items-center font-bold">
                    <span className="text-gray-500 font-mono">₹{formData.purchasePrice}/kg</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-slate-900 font-mono">₹{formData.sellingPrice}/kg</span>
                    <span className="text-emerald-700 block bg-emerald-50 px-2 py-0.5 rounded-md">
                      +₹{Number(formData.sellingPrice) - Number(formData.purchasePrice)}/kg ({(((Number(formData.sellingPrice) - Number(formData.purchasePrice)) / Number(formData.purchasePrice)) * 100 || 0).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Photo Snapper Integration */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Stock Batch Photo (Optional)
                </label>
                
                {formData.imageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video max-h-48 flex items-center justify-center">
                    <img src={formData.imageUrl} alt="Stock Preview" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                    {formData.photoCapturedAt && (
                      <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-medium font-mono px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-emerald-400" />
                        <span>{formatCapturedDate(formData.photoCapturedAt)}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imageUrl: "", photoCapturedAt: "" })}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-md transition-colors cursor-pointer"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : isCameraActive ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video max-h-48 flex flex-col items-center justify-center">
                    <video id="modal-video" className="w-full h-full object-cover" playsInline muted></video>
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 px-3">
                      <button
                        type="button"
                        onClick={() => capturePhoto("modal-video", (b64) => setFormData({ ...formData, imageUrl: b64, photoCapturedAt: new Date().toISOString() }))}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" /> Capture
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => startCamera("modal-video")}
                      className="flex-1 flex flex-col items-center justify-center py-5 border border-dashed border-slate-300 hover:border-emerald-500 rounded-lg bg-white text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer text-xs font-bold gap-1.5"
                    >
                      <Camera className="w-5 h-5 text-slate-400" />
                      <span>Take Photo (Camera)</span>
                    </button>
                    
                    <label className="flex-1 flex flex-col items-center justify-center py-5 border border-dashed border-slate-300 hover:border-emerald-500 rounded-lg bg-white text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer text-xs font-bold gap-1.5">
                      <Upload className="w-5 h-5 text-slate-400" />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e, (b64) => setFormData({ ...formData, imageUrl: b64, photoCapturedAt: new Date().toISOString() }))}
                      />
                    </label>
                  </div>
                )}
                {cameraError && (
                  <p className="text-[11px] text-amber-600 font-semibold">{cameraError}</p>
                )}
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
                      {editingId ? "Saving..." : "Logging entry..."}
                    </>
                  ) : (
                    editingId ? "Save Stock Specifications" : t("log_stock_batch")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in" id="delete-stock-modal">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 mx-4 animate-scale-up">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2 bg-red-50 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 font-display">Confirm Deletion</h3>
            </div>
            
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Are you sure you want to delete vegetable stock batch for <strong className="text-slate-900 font-semibold">{dt(deleteConfirm.name)}</strong>? 
              This action is permanent and cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                id="cancel-delete-stock-btn"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-stock-btn"
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

      {/* Standalone Stock Photo Viewer and Editor Modal */}
      {photoModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in" id="stock-photo-viewer-modal">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 mx-4 animate-scale-up">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                  <Camera className="w-5 h-5 text-emerald-600" />
                  <span>{dt(photoModalItem.vegetableName)}</span>
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Supplier: {dt(photoModalItem.farmerName)} | Grade: {dt(photoModalItem.quality)}
                </p>
              </div>
              <button 
                onClick={() => {
                  stopCamera();
                  setPhotoModalItem(null);
                }} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {photoModalItem.imageUrl && !isCameraActive ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video max-h-64 flex items-center justify-center shadow-inner">
                  <img src={photoModalItem.imageUrl} alt={photoModalItem.vegetableName} className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                  {photoModalItem.photoCapturedAt && (
                    <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-md text-white text-xs font-semibold font-mono px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5 shadow-lg">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>{formatCapturedDate(photoModalItem.photoCapturedAt)}</span>
                    </div>
                  )}
                </div>
              ) : isCameraActive ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video max-h-64 flex flex-col items-center justify-center shadow-inner">
                  <video id="standalone-video" className="w-full h-full object-cover" playsInline muted></video>
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 px-3">
                    <button
                      type="button"
                      onClick={() => {
                        capturePhoto("standalone-video", (b64) => {
                          handleSavePhotoDirectly(photoModalItem, b64);
                        });
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" /> Snap & Save
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col items-center justify-center">
                  <Image className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-500">No photo captured for this stock item yet</p>
                  <p className="text-xs text-slate-400 mt-1">Capture a photo to make verification easier during wholesale trading</p>
                </div>
              )}

              {/* Action buttons */}
              {!isCameraActive && (
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => startCamera("standalone-video")}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    {photoModalItem.imageUrl ? "Retake Photo" : "Capture Photo"}
                  </button>

                  <label className="flex-1 bg-white border border-slate-250 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, (b64) => {
                        handleSavePhotoDirectly(photoModalItem, b64);
                      })}
                    />
                  </label>

                  {photoModalItem.imageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this stock photo?")) {
                          handleSavePhotoDirectly(photoModalItem, null);
                        }
                      }}
                      className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 p-2.5 rounded-lg transition-all cursor-pointer"
                      title="Delete stock photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {cameraError && (
                <p className="text-[11px] text-amber-600 text-center font-semibold">{cameraError}</p>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 mt-5">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setPhotoModalItem(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-lg text-xs transition-all cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
