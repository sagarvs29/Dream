import React, { useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const API = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
});

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
  const [grade, setGrade] = useState("");
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

  // Minor/guardian
  const age = useMemo(() => ageFromDob(dob), [dob]);
  const isMinor = age !== null && age < 18;
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");

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

  function onDigiLockerFallback() {
    window.location.href = `${API.defaults.baseURL.replace(/\/$/, "")}/identity/digilocker/start`;
  }

  function canGoStep2() {
    return Boolean(name && dob && aadhaarToken && aadhaarLast4);
  }
  function canGoStep3() {
    return emailVerified && phoneVerified;
  }
  function canSubmit() {
    if (!grade || !rollNumber || !admissionYear || !schoolCode) return false;
    if (!termsAccepted || !captchaChecked) return false;
    if (!password || password !== password2 || pwScore < 3) return false;
    if (isMinor && (!guardianConsent || !guardianPhone || !guardianEmail)) return false;
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
        email,
        phone,
        password,
        rollNumber,
        department: grade,
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
          rollNumber: "Roll Number",
          department: "Grade/Class",
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

  return (
    <div className="min-h-screen scenic-bg">
      {/* Top glass navbar */}
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="glass-nav flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center font-bold text-indigo-600">O</div>
            <span className="text-white/90 font-semibold">OurApp</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-white/90">
            <a className="hover:text-white" href="#">Home</a>
            <a className="hover:text-white" href="#">Service</a>
            <a className="hover:text-white" href="#">Contact</a>
            <a className="hover:text-white" href="#">About</a>
            <div className="glass-nav flex items-center gap-2 px-3 py-1 text-sm">
              <span>Search</span>
              <span className="opacity-70">⌘K</span>
            </div>
            <Link to="/admin/login" className="ml-2 bg-white/80 text-indigo-700 hover:bg-white text-sm px-3 py-1 rounded-lg">Admin Login</Link>
          </nav>
          <div className="md:hidden text-white/90">☰</div>
        </div>
      </div>

      {/* Centered glass card */}
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-4xl glass-card p-6">
          <h2 className="text-2xl font-bold text-white text-center">Sign Up</h2>
          <p className="text-center text-white/80 mb-4">
            Already a member? <Link to="/login" className="underline">Student Log In</Link>
            <span className="mx-2">•</span>
            <Link to="/mentor/login" className="underline">Mentor Login</Link>
            <span className="mx-2">•</span>
            <Link to="/admin/login" className="underline">Admin Login</Link>
          </p>

          {pendingBadge && (
            <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-800">
              Status: Pending School Approval
            </div>
          )}

          {/* Stepper */}
          <div className="flex gap-2 justify-center mb-6">
            {["Identity","Contact","Academic","Security"].map((label, idx) => (
              <div key={label} className={`px-3 py-1 rounded border text-sm ${step === idx+1 ? "bg-white/80 text-gray-800 border-white/70" : "bg-white/30 text-white border-white/40"}`}>
                {idx+1}. {label}
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
          {step === 1 && (
            <section>
              <h3 className="font-semibold mb-3">Step 1: Identity</h3>
              <div className="mb-3">
                <label htmlFor="aadhaar" className="block text-sm font-medium text-white/90">Aadhaar Number</label>
                <input
                  id="aadhaar"
                  type="text"
                  inputMode="numeric"
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0,12))}
                  className="mt-1 w-full px-3 py-2 border rounded frost-input input-dark"
                  placeholder="12-digit Aadhaar"
                  disabled={verifyingAadhaar}
                />
                {aadhaarErr && <p className="text-red-600 text-sm mt-1">{aadhaarErr}</p>}
              </div>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={onVerifyAadhaar} disabled={!aadhaarValid || verifyingAadhaar} className="px-4 py-2 btn-primary rounded disabled:opacity-50">
                  {verifyingAadhaar ? "Verifying..." : "Verify Aadhaar"}
                </button>
                <button type="button" onClick={onDigiLockerFallback} className="px-4 py-2 bg-white/70 rounded">
                  Verify via DigiLocker
                </button>
              </div>

              <div className="mb-3">
                <label htmlFor="name" className="block text-sm font-medium text-white/90">Full Name (from Aadhaar)</label>
                <input id="name" type="text" value={name} readOnly className="mt-1 w-full px-3 py-2 border rounded bg-white/70" />
                <p className="text-xs text-white/80 mt-1">Name becomes read-only after verification.</p>
              </div>
              <div className="mb-3">
                <label htmlFor="dob" className="block text-sm font-medium text-white/90">Date of Birth</label>
                <input id="dob" type="date" value={dob ? dob.substring(0,10) : ''} readOnly className="mt-1 w-full px-3 py-2 border rounded bg-white/70" />
                <p className="text-xs text-white/80 mt-1">Auto-filled from Aadhaar/DigiLocker.</p>
              </div>
              <button type="button" onClick={() => setStep(2)} disabled={!canGoStep2()} className="px-4 py-2 btn-primary rounded disabled:opacity-50">
                Next
              </button>
            </section>
          )}

          {step === 2 && (
            <section>
              <h3 className="font-semibold mb-3 text-white">Step 2: Contact</h3>
              <div className="mb-3">
                <label htmlFor="email" className="block text-sm font-medium text-white/90">Email</label>
                <input id="email" type="email" value={email} onChange={(e)=>{ setEmail(e.target.value); setEmailVerified(false); }} className="mt-1 w-full px-3 py-2 border rounded frost-input input-dark" />
                {!emailVerified && (
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" onClick={sendEmailOtp} disabled={sendingEmailOtp} className="px-3 py-1 bg-white/70 rounded">
                      {sendingEmailOtp ? "Sending..." : "Send Email OTP"}
                    </button>
                    <input aria-label="Email OTP" placeholder="Email OTP" value={emailOtp} onChange={(e)=>setEmailOtp(e.target.value)} className="px-2 py-1 border rounded frost-input input-dark" />
                    <button type="button" onClick={verifyEmail} disabled={verifyingEmailOtp || !emailOtp} className="px-3 py-1 btn-primary rounded disabled:opacity-50">
                      {verifyingEmailOtp ? "Verifying..." : "Verify Email"}
                    </button>
                  </div>
                )}
                {emailErr && <p className="text-red-600 text-sm mt-1">{emailErr}</p>}
                {emailVerified && <p className="text-green-700 text-sm mt-1">Email verified</p>}
              </div>

              <div className="mb-3">
                <label htmlFor="phone" className="block text-sm font-medium text-white/90">Phone</label>
                <input id="phone" type="tel" inputMode="numeric" value={phone} onChange={(e)=>{ setPhone(e.target.value.replace(/\D/g,'').slice(0,10)); setPhoneVerified(false); }} className="mt-1 w-full px-3 py-2 border rounded frost-input input-dark" />
                {!phoneVerified && (
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" onClick={sendPhoneOtp} disabled={sendingPhoneOtp} className="px-3 py-1 bg-white/70 rounded">
                      {sendingPhoneOtp ? "Sending..." : "Send Phone OTP"}
                    </button>
                    <input aria-label="Phone OTP" placeholder="Phone OTP" value={phoneOtp} onChange={(e)=>setPhoneOtp(e.target.value)} className="px-2 py-1 border rounded frost-input input-dark" />
                    <button type="button" onClick={verifyPhone} disabled={verifyingPhoneOtp || !phoneOtp} className="px-3 py-1 btn-primary rounded disabled:opacity-50">
                      {verifyingPhoneOtp ? "Verifying..." : "Verify Phone"}
                    </button>
                  </div>
                )}
                {phoneErr && <p className="text-red-600 text-sm mt-1">{phoneErr}</p>}
                {phoneVerified && <p className="text-green-200 text-sm mt-1">Phone verified</p>}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={()=>setStep(1)} className="px-4 py-2 bg-white/70 rounded">Back</button>
                <button type="button" onClick={()=>setStep(3)} disabled={!canGoStep3()} className="px-4 py-2 btn-primary rounded disabled:opacity-50">Next</button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h3 className="font-semibold mb-3 text-white">Step 3: Academic</h3>
              <div className="mb-3">
                <label htmlFor="grade" className="block text-sm font-medium text-white/90">Grade/Class</label>
                <select id="grade" value={grade} onChange={(e)=>setGrade(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800">
                  <option value="">Select grade</option>
                  {grades.map((g)=> <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label htmlFor="schoolCode" className="block text-sm font-medium text-white/90">Select School</label>
                <select id="schoolCode" value={schoolCode} onChange={(e)=>setSchoolCode(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800">
                  <option value="">Choose your school</option>
                  {schools.map((s)=> <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                </select>
                <p className="text-xs text-white/80 mt-1">Only registered schools are listed.</p>
              </div>
              <div className="mb-3 grid md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rollNumber" className="block text-sm font-medium text-white/90">Roll Number</label>
                  <input id="rollNumber" type="text" value={rollNumber} onChange={(e)=>setRollNumber(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded frost-input input-dark" />
                </div>
                <div>
                  <label htmlFor="admissionYear" className="block text-sm font-medium text-white/90">Admission Year</label>
                  <select id="admissionYear" value={admissionYear} onChange={(e)=>setAdmissionYear(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded bg-white text-slate-800">
                    <option value="">Select year</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={()=>setStep(2)} className="px-4 py-2 bg-white/70 rounded">Back</button>
                <button type="button" onClick={()=>setStep(4)} disabled={!grade || !schoolCode || !rollNumber || !admissionYear} className="px-4 py-2 btn-primary rounded disabled:opacity-50">Next</button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <h3 className="font-semibold mb-3 text-white">Step 4: Security & Consents</h3>
              <div className="mb-3">
                <label htmlFor="password" className="block text-sm font-medium text-white/90">Password</label>
                <div className="flex gap-2">
                  <input id="password" type={showPw ? "text" : "password"} value={password} onChange={(e)=>setPassword(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded frost-input input-dark" />
                  <button type="button" onClick={()=>setShowPw(s=>!s)} className="px-3 py-2 bg-white/70 rounded">{showPw ? "Hide" : "Show"}</button>
                </div>
                <p className="text-xs text-white/80 mt-1">Strength: {pwLabel} ({pwScore}/5)</p>
              </div>
              <div className="mb-3">
                <label htmlFor="password2" className="block text-sm font-medium text-white/90">Confirm Password</label>
                <input id="password2" type={showPw ? "text" : "password"} value={password2} onChange={(e)=>setPassword2(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded frost-input input-dark" />
                {password2 && password !== password2 && (<p className="text-red-600 text-sm mt-1">Passwords do not match</p>)}
              </div>

              {isMinor && (
                <div className="border rounded p-3 mb-3">
                  <div className="mb-2">
                    <input id="guardianConsent" type="checkbox" checked={guardianConsent} onChange={(e)=>setGuardianConsent(e.target.checked)} />
                    <label htmlFor="guardianConsent" className="ml-2">I am a guardian and consent to account creation</label>
                  </div>
                  <div className="mb-2">
                    <label htmlFor="guardianPhone" className="block text-sm font-medium text-white/90">Guardian Phone</label>
                    <input id="guardianPhone" type="tel" value={guardianPhone} onChange={(e)=>setGuardianPhone(e.target.value.replace(/\D/g,'').slice(0,10))} className="mt-1 w-full px-3 py-2 border rounded frost-input input-dark" />
                  </div>
                  <div>
                    <label htmlFor="guardianEmail" className="block text-sm font-medium text-white/90">Guardian Email</label>
                    <input id="guardianEmail" type="email" value={guardianEmail} onChange={(e)=>setGuardianEmail(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded frost-input input-dark" />
                  </div>
                </div>
              )}

              <div className="mb-3">
                <input id="terms" type="checkbox" checked={termsAccepted} onChange={(e)=>setTermsAccepted(e.target.checked)} />
                <label htmlFor="terms" className="ml-2 text-white/90">I accept the Terms of Use and Privacy Policy</label>
              </div>

              <div className="mb-3">
                <input id="captcha" type="checkbox" checked={captchaChecked} onChange={(e)=>setCaptchaChecked(e.target.checked)} />
                <label htmlFor="captcha" className="ml-2 text-white/90">I am not a bot</label>
                <p className="text-xs text-white/80">Replace with real CAPTCHA in production.</p>
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
                <button type="button" onClick={()=>setStep(3)} className="px-4 py-2 bg-white/70 rounded">Back</button>
                <button type="submit" disabled={!canSubmit() || submitting} className="px-4 py-2 btn-primary rounded disabled:opacity-50 text-white">
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </section>
          )}

          <p className="text-sm text-white/80 text-center">
            Already have an account? <Link to="/login" className="underline">Student Sign In</Link>
            <span className="mx-2">•</span>
            <Link to="/admin/login" className="underline">Admin Login</Link>
          </p>
          </form>
          <div className="text-center mt-6 text-white/80">
            Already have an account? <Link to="/login" className="underline">Student Sign In</Link>
            <span className="mx-2">•</span>
            <Link to="/mentor/login" className="underline">Mentor Login</Link>
            <span className="mx-2">•</span>
            <Link to="/admin/login" className="underline">Admin Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
