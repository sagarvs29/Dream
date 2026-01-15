import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../../models/Admin.js";
import { requireAdmin } from "../../middleware/adminAuth.js";

const router = express.Router();

// Server admin login
router.post("/server/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const admin = await Admin.findOne({ email, role: "SERVER" });
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    admin.lastLoginAt = new Date();
    await admin.save();
    const exp = process.env.JWT_EXPIRES_IN || "7d";
    const token = jwt.sign({ sub: String(admin._id), role: "SERVER" }, process.env.JWT_SECRET, { expiresIn: exp });
    res.json({ token, admin: { id: admin._id, name: admin.name, role: admin.role } });
  } catch (e) {
    res.status(500).json({ message: e?.message || "Login failed" });
  }
});

// School admin login
router.post("/school/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const admin = await Admin.findOne({ email, role: "SCHOOL" }).populate("school");
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    admin.lastLoginAt = new Date();
    await admin.save();
    const exp = process.env.JWT_EXPIRES_IN || "7d";
    const token = jwt.sign({ sub: String(admin._id), role: "SCHOOL", schoolId: String(admin.school?._id) }, process.env.JWT_SECRET, { expiresIn: exp });
    res.json({ token, admin: { id: admin._id, name: admin.name, role: admin.role, school: admin.school }, isTempPassword: admin.isTempPassword });
  } catch (e) {
    res.status(500).json({ message: e?.message || "Login failed" });
  }
});

// Change password (any admin)
router.post("/change-password", requireAdmin, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json({ message: "Missing fields" });
  const admin = await Admin.findById(req.admin.sub);
  if (!admin) return res.status(404).json({ message: "Admin not found" });
  const ok = await bcrypt.compare(oldPassword, admin.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid password" });
  admin.passwordHash = await bcrypt.hash(newPassword, 10);
  admin.isTempPassword = false;
  await admin.save();
  res.json({ ok: true });
});

export default router;
