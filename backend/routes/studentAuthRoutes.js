import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Student from "../models/Student.js";

const router = express.Router();

// POST /api/auth/student/login
router.post("/student/login", async (req, res) => {
  try {
    const { phone, email, identifier, password } = req.body || {};
    if (!password) return res.status(400).json({ message: "Missing password" });

    let query = null;
    const id = (identifier || "").trim();
    if (id) {
      if (/^\d{10}$/.test(id)) query = { phone: id };
      else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) query = { email: id.toLowerCase() };
    }
    if (!query) {
      if (phone) query = { phone };
      else if (email) query = { email: String(email).toLowerCase() };
    }
    if (!query) return res.status(400).json({ message: "Provide phone or email" });

    const s = await Student.findOne(query);
    if (!s) return res.status(404).json({ message: "Student not found" });

    if (s.status === "Pending") return res.status(403).json({ message: "Your signup request is under review.", status: "Pending" });
    if (s.status === "Rejected") return res.status(403).json({ message: "Your request was rejected.", status: "Rejected" });

    const ok = await bcrypt.compare(String(password), s.passwordHash);
    if (!ok) return res.status(401).json({ message: "Incorrect password." });

    const token = jwt.sign({ sub: String(s._id), role: "STUDENT", schoolId: String(s.school) }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ status: "Approved", token, student: { id: s._id, name: s.name, phone: s.phone, schoolId: s.school } });
  } catch (e) {
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;
