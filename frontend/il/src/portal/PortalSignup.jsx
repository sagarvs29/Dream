import React, { useEffect, useState } from "react";
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
});

export default function PortalSignup() {
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    rollNumber: "",
    schoolId: "",
    department: "",
    admissionYear: "",
    aadhaarNumber: "",
    address: "",
  });
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    API.get("/portal/schools").then(({ data }) => setSchools(data.schools || []));
  }, []);

  function onChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    try {
      setSubmitting(true);
      // derive schoolCode from selection (optional, backend also accepts schoolId)
      const selected = schools.find((s) => String(s._id) === String(form.schoolId));
      const schoolCode = selected?.code || "";

      // build payload and validate required fields
      const payload = {
        name: form.name?.trim(),
        email: form.email?.trim().toLowerCase(),
        phone: form.phone?.trim(),
        password: form.password,
        rollNumber: form.rollNumber?.trim(),
        department: form.department?.trim(),
        admissionYear: Number(form.admissionYear),
        schoolId: form.schoolId || undefined,
        schoolCode: schoolCode || undefined,
        aadhaarNumber: form.aadhaarNumber?.trim() || undefined,
        address: form.address?.trim() || undefined,
      };

      const labels = {
        name: "Full Name",
        email: "Email",
        phone: "Phone Number",
        password: "Password",
        rollNumber: "Roll Number",
        department: "Department",
        admissionYear: "Admission Year",
        schoolIdOrCode: "Select School",
      };
      const missing = [];
      if (!payload.name) missing.push("name");
      if (!payload.email) missing.push("email");
      if (!payload.phone) missing.push("phone");
      if (!payload.password) missing.push("password");
      if (!payload.rollNumber) missing.push("rollNumber");
      if (!payload.department) missing.push("department");
      if (!Number.isFinite(payload.admissionYear)) missing.push("admissionYear");
      if (!payload.schoolId && !payload.schoolCode) missing.push("schoolIdOrCode");

      if (missing.length) {
        setMsg(
          `Missing required fields: ${missing
            .map((k) => labels[k] || k)
            .join(", ")}`
        );
        setSubmitting(false);
        return;
      }

      const { data } = await API.post("/portal/students/signup", payload);
      setMsg(`Signup submitted. Status: ${data.status}. Wait for school approval.`);
    } catch (e) {
      const apiMissing = e.response?.data?.missing;
      if (Array.isArray(apiMissing) && apiMissing.length) {
        const map = {
          name: "Full Name",
          email: "Email",
          phone: "Phone Number",
          password: "Password",
          rollNumber: "Roll Number",
          department: "Department",
          admissionYear: "Admission Year",
          schoolIdOrCode: "Select School",
          schoolCode: "School Code",
        };
        setMsg(`Missing required fields: ${apiMissing.map(k=>map[k]||k).join(", ")}`);
      } else {
        setMsg(e.response?.data?.message || "Signup failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen scenic-bg flex items-center justify-center px-4 py-10 text-white">
      <div className="w-full max-w-xl glass-card p-6">
        <h2 className="text-2xl font-bold text-center">Student Signup</h2>
        <p className="text-white/80 text-center mb-4">Select your school and submit for approval</p>
        <div className="glass-nav p-3 rounded text-xs text-white/90 mb-3">
          Your login will be enabled only after your school approves your request.
        </div>
        {msg && <div className="mb-3 text-center">{msg}</div>}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Full Name</label>
            <input className="w-full frost-input px-3 py-2 rounded border" name="name" value={form.name} onChange={onChange} />
          </div>
          <div>
            <label className="block text-sm mb-1">Phone Number (for login)</label>
            <input className="w-full frost-input px-3 py-2 rounded border" name="phone" value={form.phone} onChange={onChange} placeholder="Enter phone number" />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input type="email" className="w-full frost-input px-3 py-2 rounded border" name="email" value={form.email} onChange={onChange} />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input type="password" className="w-full frost-input px-3 py-2 rounded border" name="password" value={form.password} onChange={onChange} />
          </div>
          <div>
            <label className="block text-sm mb-1">Roll Number</label>
            <input className="w-full frost-input px-3 py-2 rounded border" name="rollNumber" value={form.rollNumber} onChange={onChange} />
          </div>
          <div>
            <label className="block text-sm mb-1">Aadhaar Number</label>
            <input className="w-full frost-input px-3 py-2 rounded border" name="aadhaarNumber" value={form.aadhaarNumber} onChange={onChange} placeholder="12-digit Aadhaar" />
          </div>
          <div>
            <label className="block text-sm mb-1">School</label>
            <select className="w-full frost-input px-3 py-2 rounded border" name="schoolId" value={form.schoolId} onChange={onChange}>
              <option value="">Select school</option>
              {schools.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Department</label>
            <input className="w-full frost-input px-3 py-2 rounded border" name="department" value={form.department} onChange={onChange} />
          </div>
          <div>
            <label className="block text-sm mb-1">Admission Year</label>
            <input type="number" className="w-full frost-input px-3 py-2 rounded border" name="admissionYear" value={form.admissionYear} onChange={onChange} />
          </div>
          <div>
            <label className="block text-sm mb-1">Address</label>
            <input className="w-full frost-input px-3 py-2 rounded border" name="address" value={form.address} onChange={onChange} placeholder="City, State" />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 rounded w-full">{submitting ? "Submitting..." : "Submit for Approval"}</button>
        </form>
      </div>
    </div>
  );
}
