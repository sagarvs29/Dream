import React, { useMemo, useState } from "react";
import NavHeader from "../../components/NavHeader";
import axios from "axios";
import { getAdminToken } from "../../utils/tokens";
import ProtectedRoute from "../ProtectedRoute";
import validator from "validator";

export default function SponsorNew() {
  const API = axios.create({ baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api" });
  const TIERS = ["Platinum","Gold","Silver","Bronze","Partner","Supporter"];
  const [sponsor, setSponsor] = useState({ name: "", website: "", description: "", tier: "Supporter", contactEmail: "", contactPhone: "" });
  const [user, setUser] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  // Validation error bag (populated on submit for most fields)
  const [errors, setErrors] = useState({});
  // Track if user attempted to exceed 10 digits
  const [phoneOverflow, setPhoneOverflow] = useState(false);
  // Enable only when required fields present AND phone rule satisfied (other field logic unchanged)
  const canSubmit = useMemo(() => (
    sponsor.name &&
    user.name &&
    user.email &&
    user.password &&
    !loading &&
    !phoneOverflow // allow partial phone (backend + submit validation will enforce length)
  ), [sponsor.name, user.name, user.email, user.password, loading, phoneOverflow]);

  // getAdminToken now centralized in utils/tokens.js

  function validateAll() {
    const vErr = {};
    if (!sponsor.name || sponsor.name.trim().length < 3) vErr.name = "Min 3 characters";
    if (!sponsor.tier) vErr.tier = "Tier required";
    if (sponsor.website && !validator.isURL(sponsor.website, { require_protocol: true })) vErr.website = "Invalid URL (include https://)";
    if (sponsor.contactEmail && !validator.isEmail(sponsor.contactEmail)) vErr.contactEmail = "Invalid email";
    if (sponsor.contactPhone && !/^\d{10}$/.test(sponsor.contactPhone)) vErr.contactPhone = "Phone must be 10 digits";
    if (sponsor.description && sponsor.description.length > 300) vErr.description = "Max 300 chars";
    if (!user.name) vErr.userName = "Full name required";
    if (!user.email || !validator.isEmail(user.email)) vErr.userEmail = "Valid email required";
    if (!user.password || user.password.length < 8) vErr.userPassword = "Min 8 characters";
    return vErr;
  }

  async function submit(e) {
    e.preventDefault();
    setMsg(""); setErr("");
    const vErr = validateAll();
    setErrors(vErr);
    if (Object.keys(vErr).length) return;
    try {
      setLoading(true);
  const token = getAdminToken();
      const r = await API.post("/admin/sponsors", { sponsor, user }, { headers: { Authorization: `Bearer ${token}` } });
      setMsg(`Created sponsor ${r.data?.sponsor?.name}`);
      setSponsor({ name: "", website: "", description: "", tier: "Supporter", contactEmail: "", contactPhone: "" });
      setUser({ name: "", email: "", password: "" });
    } catch (e) {
      const status = e?.response?.status;
      const message = e?.response?.data?.message;
      if (status === 403) setErr("Forbidden: need SERVER or SCHOOL admin token. Please re-login as admin.");
      else setErr(message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute role={undefined}>
      <div className="min-h-screen relative text-white">
        {/* Subtle layered background: base gradient + soft radial glow */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#6325c7] via-[#4e1f96] to-[#3b176d]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(147,51,234,0.45),transparent_65%)]" />
        <div className="mx-auto max-w-5xl px-4 py-10">
          <NavHeader fallbackParent="/server/sponsors" />
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-semibold">Create Sponsor</h1>
            {canSubmit && (
              <span className="hidden md:inline-flex items-center gap-2 text-xs bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" /> Ready to create
              </span>
            )}
          </div>

          {msg && <div className="mt-4 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 px-4 py-3">{msg}</div>}
          {err && <div className="mt-4 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-100 px-4 py-3">{err}</div>}

          <form onSubmit={submit} className="mt-6 grid lg:grid-cols-2 gap-6">
            {/* Left: Sponsor details card */}
            <div className="bg-white/15 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] border border-white/20 p-5 backdrop-blur-md transition-colors">
              <h2 className="text-lg font-medium mb-4">Sponsor Details</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm/6">Sponsor Name</span>
                  <input
                    value={sponsor.name}
                    onChange={e=>setSponsor(s=>({...s, name:e.target.value}))}
                    className="mt-1 w-full rounded-xl px-3 py-2 text-slate-900 placeholder-slate-500 bg-white focus:outline-none focus:ring-4 focus:ring-purple-300/60 transition"
                    placeholder="eg. Acme Foundation"
                    required
                  />
                  {errors.name && <div className="text-xs text-rose-300 mt-1">{errors.name}</div>}
                </label>

                <div>
                  <span className="block text-sm/6 mb-1">Tier</span>
                  <div className="flex flex-wrap gap-2">
                    {TIERS.map(t => (
                      <button
                        type="button"
                        key={t}
                        onClick={()=>setSponsor(s=>({...s, tier:t}))}
                        className={`px-3 py-1.5 rounded-full text-sm transition border ${sponsor.tier===t ? "bg-white text-purple-700 border-white shadow" : "bg-white/10 border-white/30 hover:bg-white/20"}`}
                      >{t}</button>
                    ))}
                  </div>
                  {errors.tier && <div className="text-xs text-rose-300 mt-1">{errors.tier}</div>}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm/6">Website</span>
                    <input value={sponsor.website} onChange={e=>setSponsor(s=>({...s, website:e.target.value}))} placeholder="https://…" className="mt-1 w-full rounded-xl px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-purple-300/60" />
                    {errors.website && <div className="text-xs text-rose-300 mt-1">{errors.website}</div>}
                  </label>
                  <label className="block">
                    <span className="text-sm/6">Contact Email</span>
                    <input value={sponsor.contactEmail} onChange={e=>setSponsor(s=>({...s, contactEmail:e.target.value}))} placeholder="contact@sponsor.org" className="mt-1 w-full rounded-xl px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-purple-300/60" />
                    {errors.contactEmail && <div className="text-xs text-rose-300 mt-1">{errors.contactEmail}</div>}
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm/6">Contact Phone</span>
                    <input
                      value={sponsor.contactPhone}
                      onChange={e => {
                        const raw = e.target.value;
                        const digitsOnly = raw.replace(/\D/g, ""); // strip non-digits
                        if (digitsOnly.length > 10) {
                          // Trim to 10 and flag overflow
                          setPhoneOverflow(true);
                          setSponsor(s => ({ ...s, contactPhone: digitsOnly.slice(0,10) }));
                        } else {
                          setPhoneOverflow(false);
                          setSponsor(s => ({ ...s, contactPhone: digitsOnly }));
                        }
                      }}
                      placeholder="Phone (10 digits)"
                      inputMode="numeric"
                      pattern="\d{10}"
                      className="mt-1 w-full rounded-xl px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-purple-300/60"
                    />
                    {(phoneOverflow || errors.contactPhone) && (
                      <div className="text-xs text-rose-300 mt-1">{phoneOverflow ? "Max 10 digits" : errors.contactPhone}</div>
                    )}
                  </label>
                  <label className="block sm:col-span-1">
                    <span className="text-sm/6">Description</span>
                    <textarea value={sponsor.description} onChange={e=>setSponsor(s=>({...s, description:e.target.value}))} rows={3} placeholder="Short intro about the sponsor" className="mt-1 w-full rounded-xl px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-purple-300/60" />
                    {errors.description && <div className="text-xs text-rose-300 mt-1">{errors.description}</div>}
                  </label>
                </div>
              </div>
            </div>

            {/* Right: Primary user card */}
            <div className="bg-white/15 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] border border-white/20 p-5 backdrop-blur-md transition-colors">
              <h2 className="text-lg font-medium mb-4">Primary Sponsor User</h2>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm/6">Full Name</span>
                    <input value={user.name} onChange={e=>setUser(u=>({...u, name:e.target.value}))} className="mt-1 w-full rounded-xl px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-purple-300/60" required />
                    {errors.userName && <div className="text-xs text-rose-300 mt-1">{errors.userName}</div>}
                  </label>
                  <label className="block">
                    <span className="text-sm/6">Email</span>
                    <input type="email" value={user.email} onChange={e=>setUser(u=>({...u, email:e.target.value}))} className="mt-1 w-full rounded-xl px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-purple-300/60" required />
                    {errors.userEmail && <div className="text-xs text-rose-300 mt-1">{errors.userEmail}</div>}
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm/6">Password</span>
                  <input type="password" value={user.password} onChange={e=>setUser(u=>({...u, password:e.target.value}))} className="mt-1 w-full rounded-xl px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-purple-300/60" required />
                  <div className="text-xs text-white/80 mt-1">This temporary password can be changed by the sponsor after first login.</div>
                  {errors.userPassword && <div className="text-xs text-rose-300 mt-1">{errors.userPassword}</div>}
                </label>

                <div className="pt-1 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={`px-5 py-2 rounded-xl font-medium transition shadow ${canSubmit ? "bg-white text-purple-700 hover:shadow-purple-500/40 hover:-translate-y-0.5" : "bg-white/30 text-white/60 cursor-not-allowed"}`}
                  >{loading ? "Creating..." : "Create Sponsor"}</button>
                  <span className="text-xs opacity-80">Sponsor user will log in at <span className="underline">/sponsor/login</span></span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
