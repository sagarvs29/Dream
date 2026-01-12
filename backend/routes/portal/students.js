import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Student from "../../models/Student.js";
import Blacklist from "../../models/Blacklist.js";
import School from "../../models/School.js";
import { academicYearFromStart } from "../../utils/rollNumber.js";

const router = express.Router();

// Student signup
router.post("/signup", async (req, res) => {
  try {
    const {
      name = "",
      parentName = "",
      email = "",
      phone = "",
      password = "",
      department = "",
      academicYearLabel,
      admissionYear,
      schoolId,
      schoolCode,
      classLevel,
      section,
      aadhaarNumber,
      address,
    } = req.body || {};

    const required = [
      ["name", name],
      ["parentName", parentName],
      ["email", email],
      ["phone", phone],
      ["password", password],
      ["classLevel", classLevel],
      ["section", section],
      ["academicYear", academicYearLabel || academicYearFromStart(Number(admissionYear))],
      ["admissionYear", admissionYear],
    ];
    let missing = required
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

    // Blacklist check
    let resolvedSchoolId = schoolId;
    if (!resolvedSchoolId && schoolCode) {
      const school = await School.findOne({ code: schoolCode });
      if (!school) return res.status(400).json({ message: "Invalid school code", missing: ["schoolCode"] });
      resolvedSchoolId = String(school._id);
    }
    const bl = await Blacklist.findOne({ school: resolvedSchoolId, $or: [{ email: email.toLowerCase() }, { phone }] });
    if (bl) return res.status(403).json({ message: "Contact school administration" });

    const existsEmail = await Student.findOne({ email });
    if (existsEmail) return res.status(409).json({ message: "Email already registered" });
    const existsPhone = await Student.findOne({ phone });
    if (existsPhone) return res.status(409).json({ message: "Phone already registered" });

    // Load school document to enforce workflow gating and validate class/section
    const schoolDoc = await School.findById(resolvedSchoolId);
    if (!schoolDoc) return res.status(400).json({ message: "Invalid school", missing: ["schoolIdOrCode"] });

  const wf = schoolDoc.workflowState || {};
    // Admissions must be enabled by school admin (per-year toggle takes precedence)
    const perYear = Array.isArray(schoolDoc.admissionsByYear) ? schoolDoc.admissionsByYear.find(a => Number(a.year) === yearNum) : null;
    const admissionsEnabled = perYear ? !!perYear.enabled : wf.studentAdmissionEnabled !== false;
    if (!admissionsEnabled) {
      return res.status(403).json({ message: "Admissions are closed for this academic year" });
    }

    // If classes/sections are defined, enforce selection and validate against config
    const requireClass = !!wf.classesDefined;
    const requireSection = !!wf.sectionsDefined;
    const classCfg = Array.isArray(schoolDoc.classConfig) ? schoolDoc.classConfig : [];
    const secCfg = Array.isArray(schoolDoc.sectionsConfig) ? schoolDoc.sectionsConfig : [];

    if (requireClass && (classLevel === undefined || String(classLevel).trim() === "")) {
      missing = missing.concat(["classLevel"]);
    }
    if (requireSection && (section === undefined || String(section).trim() === "")) {
      missing = missing.concat(["section"]);
    }
    if (missing.length) {
      return res.status(400).json({ message: "Missing required fields", missing });
    }
    if (requireClass && classCfg.length && !classCfg.includes(String(classLevel))) {
      return res.status(400).json({ message: "Invalid classLevel for this school", allowed: classCfg });
    }
    if (requireSection && secCfg.length && !secCfg.includes(String(section))) {
      return res.status(400).json({ message: "Invalid section for this school", allowed: secCfg });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Prepare per-year assignment if provided
    const classAssignments = [{ year: yearNum, classLevel, section }];
    const s = await Student.create({
      name,
      parentDetails: { name: parentName },
      email,
      phone,
      passwordHash,
      school: resolvedSchoolId,
      department,
      academicYear: academicYearLabel || academicYearFromStart(yearNum),
      admissionYear: yearNum,
      classLevel,
      section,
      classAssignments,
      aadhaarNumber,
      address,
      status: "Pending",
    });
    // If school hasn't defined sections/classes yet, surface a soft warning
    const warnings = [];
    if (!wf.classesDefined) warnings.push("School hasn't finalized class list; placement will be assigned later.");
    if (!wf.sectionsDefined) warnings.push("School hasn't finalized section list; placement will be assigned later.");
    res.status(201).json({ ok: true, studentId: s._id, status: s.status, warnings, placement: { classLevel: s.classLevel || null, section: s.section || null } });
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
