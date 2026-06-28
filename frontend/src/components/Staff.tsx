import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LanguageContext";
import { 
  Users, UserPlus, Shield, Mail, CheckCircle2, XCircle, 
  Edit2, Key, ToggleLeft, ToggleRight, Loader2, AlertCircle, Search
} from "lucide-react";
import { User } from "../types";
import { apiFetch } from "../utils/api";

export default function Staff() {
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const [staffList, setStaffList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"Owner" | "Staff">("Staff");
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/users");
      if (!res.ok) {
        throw new Error("Failed to fetch staff list");
      }
      const data = await res.json();
      setStaffList(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading staff.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !role) return;

    setActionLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add staff");
      }
      setStaffList(prev => [...prev, data]);
      setIsAddOpen(false);
      resetForms();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !name || !email || !role) return;

    setActionLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/users/${selectedStaff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update staff");
      }
      setStaffList(prev => prev.map(s => s.id === selectedStaff.id ? { ...s, ...data } : s));
      setIsEditOpen(false);
      resetForms();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleDisable = async (staff: User) => {
    setError(null);
    const targetStatus = !staff.isDisabled;
    try {
      const res = await apiFetch(`/api/users/${staff.id}/disable`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDisabled: targetStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle status");
      }
      setStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, isDisabled: targetStatus } : s));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !resetPasswordVal) return;

    setActionLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/users/${selectedStaff.id}/reset-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordVal })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }
      setIsResetOpen(false);
      resetForms();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const resetForms = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("Staff");
    setResetPasswordVal("");
    setSelectedStaff(null);
  };

  const openEdit = (staff: User) => {
    setSelectedStaff(staff);
    setName(staff.name);
    setEmail(staff.email);
    setRole(staff.role);
    setIsEditOpen(true);
  };

  const openReset = (staff: User) => {
    setSelectedStaff(staff);
    setResetPasswordVal("");
    setIsResetOpen(true);
  };

  const filteredStaff = staffList.filter(s => 
    (s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="staff-management-panel">
      {/* Top action row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-3xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Staff & User Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage wholesale vegetable stall owner and staff accounts.
          </p>
        </div>
        <button
          onClick={() => { resetForms(); setIsAddOpen(true); }}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
          id="btn-add-staff"
        >
          <UserPlus className="w-4 h-4" />
          Add Staff Account
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-800 flex items-start gap-2.5" id="staff-error">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Search and List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-3xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-slate-50/50 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{staff.name || "N/A"}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono">{staff.email || "N/A"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        staff.role === "Owner" 
                          ? "bg-purple-50 text-purple-700 border border-purple-100" 
                          : "bg-blue-50 text-blue-700 border border-blue-100"
                      }`}>
                        <Shield className="w-3.5 h-3.5" />
                        {staff.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {staff.isDisabled ? (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full text-xs">
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          Disabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Toggle Disable Button */}
                        <button
                          onClick={() => handleToggleDisable(staff)}
                          disabled={currentUser?.id === staff.id}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                          title={staff.isDisabled ? "Enable Account" : "Disable Account"}
                        >
                          {staff.isDisabled ? <ToggleLeft className="w-5 h-5 text-slate-400" /> : <ToggleRight className="w-5 h-5 text-emerald-600" />}
                        </button>

                        {/* Reset Password Button */}
                        <button
                          onClick={() => openReset(staff)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all cursor-pointer"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => openEdit(staff)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all cursor-pointer"
                          title="Edit Details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD STAFF MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full shadow-xl overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Add Staff Account</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">×</button>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="enter@email.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="Staff">Staff</option>
                  <option value="Owner">Owner</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {isEditOpen && selectedStaff && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full shadow-xl overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Edit Account Details</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">×</button>
            </div>
            <form onSubmit={handleEditStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  disabled={currentUser?.id === selectedStaff.id}
                >
                  <option value="Staff">Staff</option>
                  <option value="Owner">Owner</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetOpen && selectedStaff && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full shadow-xl overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Reset Staff Password</h3>
              <button onClick={() => setIsResetOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">×</button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                You are resetting the password for <strong className="text-slate-800">{selectedStaff.name}</strong> ({selectedStaff.email}).
              </p>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700">New Password</label>
                <input
                  type="password"
                  required
                  value={resetPasswordVal}
                  onChange={e => setResetPasswordVal(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter new secure password"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
