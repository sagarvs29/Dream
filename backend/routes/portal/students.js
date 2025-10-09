import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Student from "../../models/Student.js";
import School from "../../models/School.js";

const router = express.Router();

// Student signup
router.post("/signup", async (req, res) => {
  try {
    const {
      name = "",
      email = "",
      phone = "",
      password = "",
      rollNumber = "",
      department = "",
      admissionYear,
      schoolId,
      schoolCode,
      aadhaarNumber,
      address,
    } = req.body || {};

    const required = [
      ["name", name],
      ["email", email],
      ["phone", phone],
      ["password", password],
      ["rollNumber", rollNumber],
      ["department", department],
      ["admissionYear", admissionYear],
    ];
    const missing = required
      .filter(([, v]) => v === undefined || v === null || String(v).trim() === "")
      .map(([k]) => k);
    // Either schoolId or schoolCode is required
    if (!schoolId && !schoolCode) missing.push("schoolIdOrCode");

    // Validate year
    const yearNum = Number(admissionYear);
    if (!Number.isFinite(yearNum)) missing.push("admissionYear");

    if (missing.length) {
      return res.status(400).json({ message: "Missing required fields", missing });
    }
    const existsEmail = await Student.findOne({ email });
    if (existsEmail) return res.status(409).json({ message: "Email already registered" });
    const existsPhone = await Student.findOne({ phone });
    if (existsPhone) return res.status(409).json({ message: "Phone already registered" });
    let resolvedSchoolId = schoolId;
    if (!resolvedSchoolId && schoolCode) {
      const school = await School.findOne({ code: schoolCode });
      if (!school) return res.status(400).json({ message: "Invalid school code", missing: ["schoolCode"] });
      resolvedSchoolId = String(school._id);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const s = await Student.create({
      name,
      email,
      phone,
      passwordHash,
      rollNumber,
      school: resolvedSchoolId,
      department,
      admissionYear: yearNum,
      aadhaarNumber,
      address,
      status: "Pending",
    });
    res.status(201).json({ ok: true, studentId: s._id, status: s.status });
  } catch (e) {
    res.status(500).json({ message: "Signup failed" });
  }
});

// Student login (only Approved)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const s = await Student.findOne({ email });
    if (!s) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, s.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    if (s.status === "Pending") {
      return res.json({ status: "Pending", message: "Awaiting approval by school." });
    }
    if (s.status === "Rejected") {
      return res.json({ status: "Rejected", message: "Your application was rejected by school management." });
    }
    // Approved
    const token = jwt.sign({ id: s._id, role: "student" }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ status: "Approved", token, student: { id: s._id, name: s.name, schoolId: s.school } });
  } catch (e) {
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;
