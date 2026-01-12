import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import SponsorUser from "../models/SponsorUser.js";

const router = express.Router();

// POST /api/sponsor/auth/login { email, password }
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });
    const user = await SponsorUser.findOne({ email, active: true }).populate("sponsor", "name");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(String(password), user.passwordHash || "");
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign({ sub: user._id, role: "SPONSOR", sponsor: user.sponsor?._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, sponsorName: user.sponsor?.name } });
  } catch (e) {
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;
