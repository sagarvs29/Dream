import React, { useMemo, useState } from "react";
import api from "./utils/apiClient";
import { useNavigate } from "react-router-dom";

const API = api;

const grades = [
  "Class 1","Class 2","Class 3","Class 4","Class 5",
  "Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12"
];

function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

function strength(pw) {
  let s = 0;
  if (!pw) return 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 5);
}

export default function SignupPage() {
  // Landing and modal state
  const [showLanding, setShowLanding] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Identity
  const [aadhaar, setAadhaar] = useState("");
  const [aadhaarErr, setAadhaarErr] = useState("");
  const [verifyingAadhaar, setVerifyingAadhaar] = useState(false);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [aadhaarToken, setAadhaarToken] = useState("");
  const [aadhaarLast4, setAadhaarLast4] = useState("");
  const [nameLocked, setNameLocked] = useState(false);
  const aadhaarValid = /^\d{12}$/.test(aadhaar);

  // Contact
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Academic
  const [grade, setGrade] = useState(""); // optional; sent as department
  const [classLevel, setClassLevel] = useState("");
  const [section, setSection] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [admissionYear, setAdmissionYear] = useState("");
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => String(currentYear - i));
  const [schools, setSchools] = useState([]);
  const [schoolCode, setSchoolCode] = useState("");

  // Security & consents
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const pwScore = strength(password);
  const pwLabel = ["Very weak","Weak","Okay","Good","Strong"][Math.max(0, pwScore - 1)] || "Very weak";

  // Parent details (guardian section removed)
  const age = useMemo(() => ageFromDob(dob), [dob]);
  const [parentName, setParentName] = useState("");

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [pendingBadge, setPendingBadge] = useState(false);
  const [missingList, setMissingList] = useState([]);

  // Dev helper to show OTP in a popup only during development
  function showDevOtp(label, otp) {
    try {
      if ((import.meta?.env && import.meta.env.DEV) || import.meta?.env?.VITE_SHOW_DEV_OTP === "true") {
        if (otp) window.alert(`${label} OTP (dev): ${otp}`);
      }
    } catch (_) {
      // no-op: guard against environments without import.meta
    }
  }

  async function onVerifyAadhaar(e) {
    e.preventDefault();
    setAadhaarErr("");
    if (!aadhaarValid) return setAadhaarErr("Enter 12-digit numeric Aadhaar number.");
    try {
      setVerifyingAadhaar(true);
      const { data } = await API.post("/identity/verifyAadhaar", { aadhaarNumber: aadhaar });
      setName(data.name || "");
      setDob(data.dob || "");
      setAadhaarToken(data.aadhaarToken || "");
      setAadhaarLast4(data.last4 || "");
      setNameLocked(true);
      setAadhaar(""); // drop full Aadhaar
    } catch (err) {
      setAadhaarErr(err.response?.data?.message || "Verification failed");
    } finally {
      setVerifyingAadhaar(false);
    }
  }

  // DigiLocker verification is not required for student signup; removed fallback.

  function canGoStep2() {
    return Boolean(name && dob && aadhaarToken && aadhaarLast4);
  }
  function canGoStep3() {
    return emailVerified && phoneVerified;
  }
  function canSubmit() {
    if (!parentName || !classLevel || !section || !admissionYear || !schoolCode) return false;
    if (!termsAccepted || !captchaChecked) return false;
    if (!password || password !== password2 || pwScore < 3) return false;
    return true;
  }

  async function sendEmailOtp() {
    setEmailErr("");
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) return setEmailErr("Enter a valid email.");
    try {
      setSendingEmailOtp(true);
      const { data } = await API.post("/contact/sendEmailOtp", { email });
      if (data?.otp) showDevOtp("Email", data.otp);
    } catch (e) {
      setEmailErr(e.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingEmailOtp(false);
    }
  }
  async function verifyEmail() {
    setEmailErr("");
    try {
      setVerifyingEmailOtp(true);
      await API.post("/contact/verifyEmail", { email, otp: emailOtp });
      setEmailVerified(true);
    } catch (e) {
      setEmailErr(e.response?.data?.message || "Invalid OTP");
    } finally {
      setVerifyingEmailOtp(false);
    }
  }
  async function sendPhoneOtp() {
    setPhoneErr("");
    if (!/^\d{10}$/.test(phone)) return setPhoneErr("Enter 10-digit phone number.");
    try {
      setSendingPhoneOtp(true);
      const { data } = await API.post("/contact/sendPhoneOtp", { phone });
      if (data?.otp) showDevOtp("Phone", data.otp);
    } catch (e) {
      setPhoneErr(e.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingPhoneOtp(false);
    }
  }
  async function verifyPhone() {
    setPhoneErr("");
    try {
      setVerifyingPhoneOtp(true);
      await API.post("/contact/verifyPhone", { phone, otp: phoneOtp });
      setPhoneVerified(true);
    } catch (e) {
      setPhoneErr(e.response?.data?.message || "Invalid OTP");
    } finally {
      setVerifyingPhoneOtp(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormErr("");
    setMissingList([]);
    if (!canSubmit()) return setFormErr("Please complete all required fields.");
    try {
      setSubmitting(true);
      const { data } = await API.post("/portal/students/signup", {
        name,
        parentName,
        email,
        phone,
        password,
        department: grade,
        classLevel,
        section,
        admissionYear: admissionYear ? parseInt(admissionYear, 10) : undefined,
        schoolCode,
        aadhaarNumber: aadhaarLast4 ? `**** **** ${aadhaarLast4}` : undefined,
        address: undefined,
      });
      if (data?.ok) setPendingBadge(true);
    } catch (e) {
      const msg = e.response?.data?.message || "Registration failed";
      const missing = e.response?.data?.missing;
      setFormErr(msg);
      if (Array.isArray(missing) && missing.length) {
        const labelMap = {
          name: "Full Name",
          email: "Email",
          phone: "Phone",
          password: "Password",
          department: "Grade/Class",
          parentName: "Parent Name",
          classLevel: "Class Level",
          section: "Section",
          admissionYear: "Admission Year",
          schoolIdOrCode: "School",
          schoolCode: "School Code",
        };
        setMissingList(missing.map((k)=> labelMap[k] || k));
      }
    } finally {
      setSubmitting(false);
    }
  }

  React.useEffect(() => {
    (async () => {
      try {
        const res = await API.get("/portal/schools");
        setSchools(res.data?.schools || []);
      } catch (_) {
        // ignore
      }
    })();
  }, []);

  // Colors inspired by reference (green buttermilk pack)
  // primary: fresh green, dark: deep leaf, light: soft cream
  const theme = {
    primary: "#6fbe44",
    dark: "#2e7d32",
    light: "#f3f8ed",
  };

  // LANDING VIEW -----------------------------------------------------------
  if (showLanding) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(180deg, ${theme.light} 0%, #e7f4d9 30%, ${theme.primary} 100%)` }}>
        {/* Logo top-left */}
        <div className="p-4">
          <img src="/logo.png" alt="App logo" className="h-10 w-auto drop-shadow" />
        </div>

        {/* Centered CTA */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-xl text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1f3a1f] mb-6">Welcome</h1>
            <p className="text-[#2f4f2f]/80 mb-8">Join the network or sign in to continue.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowLanding(false)}
                className="px-6 py-3 rounded-xl text-white shadow-md transition-transform duration-200 ease-out hover:scale-[1.03] hover:shadow-lg active:scale-100 focus:outline-none focus:ring-2 focus:ring-[#2e7d32]"
                style={{ backgroundColor: theme.dark }}
              >
                Signup
              </button>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-6 py-3 rounded-xl border shadow-md transition-transform duration-200 ease-out hover:scale-[1.03] hover:shadow-lg active:scale-100 focus:outline-none focus:ring-2 focus:ring-[#2e7d32]"
                style={{ borderColor: theme.dark, color: theme.dark, backgroundColor: "#ffffff" }}
              >
                Login
              </button>
            </div>
          </div>
        </div>

        {/* Login modal */}
        {showLoginModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            aria-modal="true" role="dialog"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowLoginModal(false)} />
            {/* Back button (top-left) to close modal and return */}
            <button
              onClick={() => setShowLoginModal(false)}
              aria-label="Back"
              className="fixed left-4 top-4 h-10 w-10 rounded-full bg-white/95 text-[#1f3a1f] shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#2e7d32] flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="relative w-full max-w-md rounded-2xl p-6 shadow-xl bg-white/20 backdrop-blur-xl border border-white/30">
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
              <h2 className="text-xl font-semibold mb-4" style={{ color: theme.dark }}>Choose login type</h2>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => { setShowLoginModal(false); navigate("/login/server"); }}
                  className="w-full px-4 py-2 rounded-lg transition-transform duration-200 ease-out hover:scale-105 hover:shadow-lg focus:scale-105 active:scale-100 backdrop-blur-md"
                  title="Login as Server Admin"
                  style={{ border: `1px solid ${theme.dark}`, color: theme.dark, backgroundColor: "rgba(255,255,255,0.5)" }}
                >
                  Server Admin
                </button>
                <button
                  onClick={() => { setShowLoginModal(false); navigate("/login/school"); }}
                  className="w-full px-4 py-2 rounded-lg transition-transform duration-200 ease-out hover:scale-105 hover:shadow-lg focus:scale-105 active:scale-100 backdrop-blur-md"
                  title="Login as School Admin"
                  style={{ border: `1px solid ${theme.dark}`, color: theme.dark, backgroundColor: "rgba(255,255,255,0.5)" }}
                >
                  School Admin
                </button>
                {/* Teacher login (uses existing Mentor login route) */}
                <button
                  onClick={() => { setShowLoginModal(false); navigate("/mentor/login"); }}
                  className="w-full px-4 py-2 rounded-lg transition-transform duration-200 ease-out hover:scale-105 hover:shadow-lg focus:scale-105 active:scale-100 backdrop-blur-md"
                  title="Login as Teacher"
                  style={{ border: `1px solid ${theme.dark}`, color: theme.dark, backgroundColor: "rgba(255,255,255,0.5)" }}
                >
                  Teacher
                </button>
                {/* Mentor login removed; all academic staff managed under Teachers module */}
                <button
                  onClick={() => { setShowLoginModal(false); navigate("/sponsor/login"); }}
                  className="w-full px-4 py-2 rounded-lg transition-transform duration-200 ease-out hover:scale-105 hover:shadow-lg focus:scale-105 active:scale-100 backdrop-blur-md"
                  title="Login as Sponsor"
                  style={{ border: `1px solid ${theme.dark}`, color: theme.dark, backgroundColor: "rgba(255,255,255,0.5)" }}
                >
                  Sponsor
                </button>
                <button
                  onClick={() => { setShowLoginModal(false); navigate("/login"); }}
                  className="w-full px-4 py-2 rounded-lg transition-transform duration-200 ease-out hover:scale-105 hover:shadow-lg focus:scale-105 active:scale-100 backdrop-blur-md"
                  title="Login as Student"
                  style={{ border: `1px solid ${theme.dark}`, color: theme.dark, backgroundColor: "rgba(255,255,255,0.5)" }}
                >
                  Student
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // SIGNUP FORM VIEW -------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: `linear-gradient(180deg, ${theme.light} 0%, #e7f4d9 30%, ${theme.primary} 100%)` }}>
      {/* Back to landing */}
      <button
        onClick={() => setShowLanding(true)}
        aria-label="Back to landing"
        className="fixed left-4 top-4 z-50 h-10 w-10 rounded-full bg-white/95 text-[#1f3a1f] shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#2e7d32] flex items-center justify-center"
        title="Back"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      {/* Centered signup card */}
      <div className="w-full max-w-lg rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.2)] bg-white/90 p-6 ring-1 ring-black/5">

          {/* Title */}
          <h2 className="text-[22px] font-bold text-[#1f3a1f] text-center mb-3">Sign Up</h2>

          {pendingBadge && (
            <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-800">
              Status: Pending School Approval
            </div>
          )}

          {/* Stepper */}
          <div className="flex gap-2 justify-center mb-6">
            {["Identity","Contact","Academic","Security"].map((label, idx) => (
              <div
                key={label}
                className={`px-3 py-1 rounded border text-sm ${step === idx+1 ? "bg-[var(--chip-on)] text-[#1f3a1f] border-[color:var(--chip-on-b)]" : "bg-[var(--chip-off)] text-[#1f3a1f]/70 border-[color:var(--chip-off-b)]"}`}
                style={{
                  // chip colors tuned to the green palette
                  ['--chip-on']: '#e8f5e9',
                  ['--chip-on-b']: '#c8e6c9',
                  ['--chip-off']: '#f6fbf2',
                  ['--chip-off-b']: '#e8f5e9',
                }}
              >
                {idx+1}. {label}
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
          {step === 1 && (
            <section>
              <h3 className="font-semibold mb-3 text-[#1f3a1f]">Step 1: Identity</h3>
              <div className="mb-3">
                <label htmlFor="aadhaar" className="block text-sm font-medium text-[#1f3a1f]/90">Aadhaar Number</label>
                <input
                  id="aadhaar"
                  type="text"
                  inputMode="numeric"
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0,12))}
                  className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#2e7d32] focus:border-[#2e7d32]"
                  placeholder="12-digit Aadhaar"
                  disabled={verifyingAadhaar}
                />
                {aadhaarErr && <p className="text-red-600 text-sm mt-1">{aadhaarErr}</p>}
              </div>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={onVerifyAadhaar} disabled={!aadhaarValid || verifyingAadhaar} className="px-4 py-2 rounded text-white disabled:opacity-50" style={{ backgroundColor: theme.dark }}>
                  {verifyingAadhaar ? "Verifying..." : "Verify Aadhaar"}
                </button>
              </div>

              <div className="mb-3">
                <label htmlFor="name" className="block text-sm font-medium text-[#1f3a1f]/90">Full Name (from Aadhaar)</label>
                <input id="name" type="text" value={name} readOnly className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800" />
                <p className="text-xs text-[#1f3a1f]/60 mt-1">Name becomes read-only after verification.</p>
              </div>
              <div className="mb-3">
                <label htmlFor="parentName" className="block text-sm font-medium text-[#1f3a1f]/90">Parent/Guardian Name</label>
                <input id="parentName" type="text" value={parentName} onChange={(e)=>setParentName(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800" />
              </div>
              <div className="mb-3">
                <label htmlFor="dob" className="block text-sm font-medium text-[#1f3a1f]/90">Date of Birth</label>
                <input id="dob" type="date" value={dob ? dob.substring(0,10) : ''} readOnly className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800" />
                <p className="text-xs text-[#1f3a1f]/60 mt-1">Auto-filled from Aadhaar verification.</p>
              </div>
              <div className="flex sm:justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canGoStep2()}
                  className="mt-2 sm:mt-0 px-4 py-2 rounded text-white disabled:opacity-50 w-full sm:w-auto"
                  style={{ backgroundColor: theme.dark }}
                >
                  Next
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h3 className="font-semibold mb-3 text-[#1f3a1f]">Step 2: Contact</h3>
              <div className="mb-3">
                <label htmlFor="email" className="block text-sm font-medium text-[#1f3a1f]/90">Email</label>
                <input id="email" type="email" value={email} onChange={(e)=>{ setEmail(e.target.value); setEmailVerified(false); }} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#2e7d32] focus:border-[#2e7d32]" />
                {!emailVerified && (
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" onClick={sendEmailOtp} disabled={sendingEmailOtp} className="px-3 py-1 rounded border" style={{ borderColor: theme.dark, color: theme.dark, backgroundColor: "#fff" }}>
                      {sendingEmailOtp ? "Sending..." : "Send Email OTP"}
                    </button>
                    <input aria-label="Email OTP" placeholder="Email OTP" value={emailOtp} onChange={(e)=>setEmailOtp(e.target.value)} className="px-2 py-1 border rounded bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#2e7d32] focus:border-[#2e7d32]" />
                    <button type="button" onClick={verifyEmail} disabled={verifyingEmailOtp || !emailOtp} className="px-3 py-1 rounded text-white disabled:opacity-50" style={{ backgroundColor: theme.dark }}>
                      {verifyingEmailOtp ? "Verifying..." : "Verify Email"}
                    </button>
                  </div>
                )}
                {emailErr && <p className="text-red-600 text-sm mt-1">{emailErr}</p>}
                {emailVerified && <p className="text-green-700 text-sm mt-1">Email verified</p>}
              </div>

              <div className="mb-3">
                <label htmlFor="phone" className="block text-sm font-medium text-[#1f3a1f]/90">Phone</label>
                <input id="phone" type="tel" inputMode="numeric" value={phone} onChange={(e)=>{ setPhone(e.target.value.replace(/\D/g,'').slice(0,10)); setPhoneVerified(false); }} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#2e7d32] focus:border-[#2e7d32]" />
                {!phoneVerified && (
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" onClick={sendPhoneOtp} disabled={sendingPhoneOtp} className="px-3 py-1 rounded border" style={{ borderColor: theme.dark, color: theme.dark, backgroundColor: "#fff" }}>
                      {sendingPhoneOtp ? "Sending..." : "Send Phone OTP"}
                    </button>
                    <input aria-label="Phone OTP" placeholder="Phone OTP" value={phoneOtp} onChange={(e)=>setPhoneOtp(e.target.value)} className="px-2 py-1 border rounded bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#2e7d32] focus:border-[#2e7d32]" />
                    <button type="button" onClick={verifyPhone} disabled={verifyingPhoneOtp || !phoneOtp} className="px-3 py-1 rounded text-white disabled:opacity-50" style={{ backgroundColor: theme.dark }}>
                      {verifyingPhoneOtp ? "Verifying..." : "Verify Phone"}
                    </button>
                  </div>
                )}
                {phoneErr && <p className="text-red-600 text-sm mt-1">{phoneErr}</p>}
                {phoneVerified && <p className="text-green-600 text-sm mt-1">Phone verified</p>}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={()=>setStep(1)} className="px-4 py-2 rounded border" style={{ borderColor: theme.dark, color: theme.dark, backgroundColor: "#fff" }}>Back</button>
                <button type="button" onClick={()=>setStep(3)} disabled={!canGoStep3()} className="px-4 py-2 rounded text-white disabled:opacity-50" style={{ backgroundColor: theme.dark }}>Next</button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h3 className="font-semibold mb-3 text-[#1f3a1f]">Step 3: Academic</h3>
              <div className="mb-3">
                <label htmlFor="classLevel" className="block text-sm font-medium text-[#1f3a1f]/90">Class Level</label>
                <select id="classLevel" value={classLevel} onChange={(e)=>setClassLevel(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800">
                  <option value="">Select class</option>
                  {["LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"].map((g)=> <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label htmlFor="schoolCode" className="block text-sm font-medium text-[#1f3a1f]/90">Select School</label>
                <select id="schoolCode" value={schoolCode} onChange={(e)=>setSchoolCode(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800">
                  <option value="">Choose your school</option>
                  {schools.map((s)=> <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                </select>
                <p className="text-xs text-[#1f3a1f]/60 mt-1">Only registered schools are listed.</p>
              </div>
              <div className="mb-3 grid md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="section" className="block text-sm font-medium text-[#1f3a1f]/90">Section</label>
                  <select id="section" value={section} onChange={(e)=>setSection(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800">
                    <option value="">Select section</option>
                    {["A","B","C","D","E"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="admissionYear" className="block text-sm font-medium text-[#1f3a1f]/90">Admission Year</label>
                  <select id="admissionYear" value={admissionYear} onChange={(e)=>setAdmissionYear(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800">
                    <option value="">Select year</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={()=>setStep(2)} className="px-4 py-2 rounded border" style={{ borderColor: theme.dark, color: theme.dark, backgroundColor: "#fff" }}>Back</button>
                <button type="button" onClick={()=>setStep(4)} disabled={!classLevel || !section || !schoolCode || !admissionYear} className="px-4 py-2 rounded text-white disabled:opacity-50" style={{ backgroundColor: theme.dark }}>Next</button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <h3 className="font-semibold mb-3 text-[#1f3a1f]">Step 4: Security & Consents</h3>
              <div className="mb-3">
                <label htmlFor="password" className="block text-sm font-medium text-[#1f3a1f]/90">Password</label>
                <div className="flex gap-2">
                  <input id="password" type={showPw ? "text" : "password"} value={password} onChange={(e)=>setPassword(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#2e7d32] focus:border-[#2e7d32]" />
                  <button type="button" onClick={()=>setShowPw(s=>!s)} className="px-3 py-2 rounded border" style={{ borderColor: theme.dark, color: theme.dark, backgroundColor: "#fff" }}>{showPw ? "Hide" : "Show"}</button>
                </div>
                <p className="text-xs text-[#1f3a1f]/60 mt-1">Strength: {pwLabel} ({pwScore}/5)</p>
              </div>
              <div className="mb-3">
                <label htmlFor="password2" className="block text-sm font-medium text-[#1f3a1f]/90">Confirm Password</label>
                <input id="password2" type={showPw ? "text" : "password"} value={password2} onChange={(e)=>setPassword2(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#2e7d32] focus:border-[#2e7d32]" />
                {password2 && password !== password2 && (<p className="text-red-600 text-sm mt-1">Passwords do not match</p>)}
              </div>

              {/* Guardian section removed as per requirements */}

              <div className="mb-3">
                <input id="terms" type="checkbox" checked={termsAccepted} onChange={(e)=>setTermsAccepted(e.target.checked)} />
                <label htmlFor="terms" className="ml-2 text-[#1f3a1f]/90">I accept the Terms of Use and Privacy Policy</label>
              </div>

              <div className="mb-3">
                <input id="captcha" type="checkbox" checked={captchaChecked} onChange={(e)=>setCaptchaChecked(e.target.checked)} />
                <label htmlFor="captcha" className="ml-2 text-[#1f3a1f]/90">I am not a bot</label>
                <p className="text-xs text-[#1f3a1f]/60">Replace with real CAPTCHA in production.</p>
              </div>

              {formErr && <div className="text-red-600 mb-2">
                <p>{formErr}</p>
                {missingList.length > 0 && (
                  <ul className="list-disc ml-5 mt-1">
                    {missingList.map((m)=> (<li key={m}>{m}</li>))}
                  </ul>
                )}
              </div>}

              <div className="flex gap-2">
                <button type="button" onClick={()=>setStep(3)} className="px-4 py-2 rounded border" style={{ borderColor: theme.dark, color: theme.dark, backgroundColor: "#fff" }}>Back</button>
                <button type="submit" disabled={!canSubmit() || submitting} className="px-4 py-2 rounded text-white disabled:opacity-50" style={{ backgroundColor: theme.dark }}>
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </section>
          )}

          {/* No duplicated login links below; optional small footer could go here */}
          </form>
      </div>
    </div>
  );
}
