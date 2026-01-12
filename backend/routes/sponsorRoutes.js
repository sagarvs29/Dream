import express from "express";
import jwt from "jsonwebtoken";
import Sponsorship from "../models/Sponsorship.js";
import SponsorUser from "../models/SponsorUser.js";
import Student from "../models/Student.js";

const router = express.Router();

async function requireSponsor(req, res, next) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "SPONSOR") return res.status(403).json({ message: "Not a sponsor token" });
    const me = await SponsorUser.findById(decoded.sub).populate("sponsor", "name");
    if (!me || !me.active) return res.status(403).json({ message: "Sponsor inactive" });
    req.sponsorUser = me;
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid token" });
  }
}

// GET /api/sponsor/me - return sponsor user and sponsor org profile
router.get("/me", requireSponsor, async (req, res) => {
  try {
    const su = await SponsorUser.findById(req.sponsorUser._id).populate("sponsor");
    if (!su) return res.status(404).json({ message: "Sponsor user not found" });
    const s = su.sponsor;
    const sponsor = s
      ? {
          id: String(s._id),
          name: s.name,
          tier: s.tier,
          logoUrl: s.logoUrl,
          website: s.website,
          description: s.description,
          contactEmail: s.contactEmail,
          contactPhone: s.contactPhone,
          active: s.active,
          createdAt: s.createdAt,
        }
      : null;
    const user = { id: String(su._id), name: su.name, email: su.email };
    res.json({ user, sponsor });
  } catch (e) {
    res.status(500).json({ message: "Failed to load sponsor profile" });
  }
});

// GET /api/sponsor/sponsorships - mine (by my sponsor org)
router.get("/sponsorships", requireSponsor, async (req, res) => {
  try {
    const list = await Sponsorship.find({ sponsor: req.sponsorUser.sponsor._id })
      .populate({ path: "student", select: "name email profilePictureUrl school" })
      .sort({ createdAt: -1 })
      .lean();
    const total = list.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    res.json({ total, currency: list[0]?.currency || "INR", sponsorships: list });
  } catch (e) {
    res.status(500).json({ message: "Failed to load" });
  }
});

// POST /api/sponsor/sponsorships { studentId, amount, currency, message }
router.post("/sponsorships", requireSponsor, async (req, res) => {
  try {
    const { studentId, amount, currency = "INR", message } = req.body || {};
    if (!studentId || !amount) return res.status(400).json({ message: "studentId and amount required" });
    const existsStudent = await Student.exists({ _id: studentId });
    if (!existsStudent) return res.status(404).json({ message: "Student not found" });
    const doc = await Sponsorship.create({ student: studentId, sponsor: req.sponsorUser.sponsor._id, amount, currency, message, status: "Active" });
    res.status(201).json({ sponsorship: doc });
  } catch (e) {
    res.status(500).json({ message: "Failed to create" });
  }
});

// GET /api/sponsor/requests - pending (Pledged) requests for my sponsor
router.get("/requests", requireSponsor, async (req, res) => {
  try {
    const list = await Sponsorship.find({ sponsor: req.sponsorUser.sponsor._id, status: "Pledged" })
      .populate({ path: "student", select: "name email profilePictureUrl school" })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ requests: list });
  } catch (e) {
    res.status(500).json({ message: "Failed to load" });
  }
});

// PATCH /api/sponsor/sponsorships/:id/status { status, amount?, currency? }
router.patch("/sponsorships/:id/status", requireSponsor, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, amount, currency } = req.body || {};
    const allowed = ["Active", "Cancelled", "Completed"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });
    const doc = await Sponsorship.findOne({ _id: id, sponsor: req.sponsorUser.sponsor._id });
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (typeof amount === 'number') doc.amount = amount;
    if (currency) doc.currency = currency;
    doc.status = status;
    await doc.save();
    const populated = await doc.populate({ path: "student", select: "name email profilePictureUrl school" });
    res.json({ sponsorship: populated });
  } catch (e) {
    res.status(500).json({ message: "Failed to update" });
  }
});

export default router;
