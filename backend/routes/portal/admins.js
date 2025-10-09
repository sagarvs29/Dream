import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Student from "../../models/Student.js";
import Admin from "../../models/Admin.js";
import Approval from "../../models/Approval.js";

const router = express.Router();

// Admin login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const a = await Admin.findOne({ email }).populate("school");
    if (!a) return res.status(404).json({ message: "Admin not found" });
    const ok = await bcrypt.compare(password, a.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    const token = jwt.sign({ id: a._id, role: "admin", school: a.school._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, admin: { id: a._id, name: a.name, school: a.school } });
  } catch (e) {
    res.status(500).json({ message: "Login failed" });
  }
});

// Middleware for admin auth
function adminAuth(req, res, next) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// Pending students for this admin's school
router.get("/pending", adminAuth, async (req, res) => {
  try {
    const list = await Student.find({ school: req.admin.school, status: "Pending" }).sort({ createdAt: -1 });
    res.json({ students: list });
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch" });
  }
});

// Approve/Reject
router.post("/decide", adminAuth, async (req, res) => {
  try {
    const { studentId, status, remarks } = req.body || {};
    if (!studentId || !["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid input" });
    }
    const s = await Student.findOne({ _id: studentId, school: req.admin.school });
    if (!s) return res.status(404).json({ message: "Student not found for this school" });

    s.status = status;
    await s.save();
    await Approval.create({ student: s._id, admin: req.admin.id, status, remarks });

    res.json({ ok: true, studentId: s._id, status });
  } catch (e) {
    res.status(500).json({ message: "Decision failed" });
  }
});

export default router;
