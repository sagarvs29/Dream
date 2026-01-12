import express from "express";
import bcrypt from "bcryptjs";
import Sponsor from "../models/Sponsor.js";
import SponsorUser from "../models/SponsorUser.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import cloudinary from "../utils/cloudinary.js";
import validator from "validator";

const router = express.Router();

function canManageSponsors(admin) {
  // Allow both SERVER and SCHOOL admins; if later you want to restrict school admins,
  // validate admin.schoolId or add policy logic here.
  return admin?.role === "SERVER" || admin?.role === "SCHOOL";
}

// GET /api/admin/sponsors - list sponsors with user counts
router.get("/sponsors", requireAdmin, async (req, res) => {
  try {
    if (!canManageSponsors(req.admin)) return res.status(403).json({ message: "Forbidden" });
    const sponsors = await Sponsor.find({}).sort({ createdAt: -1 }).lean();
    const ids = sponsors.map(s => s._id);
    const users = await SponsorUser.aggregate([
      { $match: { sponsor: { $in: ids } } },
      { $group: { _id: "$sponsor", count: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(users.map(u => [String(u._id), u.count]));
    const list = sponsors.map(s => ({
      id: s._id,
      name: s.name,
      tier: s.tier,
      active: s.active,
      logoUrl: s.logoUrl,
      userCount: countMap[String(s._id)] || 0,
      createdAt: s.createdAt,
    }));
    res.json({ sponsors: list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load sponsors" });
  }
});

// POST /api/admin/sponsors - create sponsor + user
router.post("/sponsors", requireAdmin, async (req, res) => {
  try {
    if (!canManageSponsors(req.admin)) return res.status(403).json({ message: "Forbidden" });

    const { sponsor: s, user: u } = req.body || {};
    // Validation rules
    const errors = [];
    if (!s?.name || s.name.trim().length < 3) errors.push("Sponsor name min 3 characters");
    if (!s?.tier) errors.push("Tier required");
    if (s?.website && !validator.isURL(s.website, { require_protocol: true })) errors.push("Website must be a valid URL inc protocol");
    if (s?.contactEmail && !validator.isEmail(s.contactEmail)) errors.push("Contact email invalid");
    if (s?.contactPhone && !/^\d{10}$/.test(s.contactPhone)) errors.push("Contact phone must be 10 digits");
    if (s?.description && s.description.length > 300) errors.push("Description max 300 chars");
    if (!u?.name) errors.push("Sponsor user name required");
    if (!u?.email || !validator.isEmail(u.email)) errors.push("Sponsor user email invalid");
    if (!u?.password || String(u.password).length < 8) errors.push("Password min 8 characters");
    if (errors.length) return res.status(400).json({ message: errors.join("; ") });

    const existingUser = await SponsorUser.findOne({ email: u.email });
    if (existingUser) return res.status(409).json({ message: "User email already in use" });

    let sponsor = await Sponsor.findOne({ name: s.name });
    if (!sponsor) {
      sponsor = await Sponsor.create({
        name: s.name,
        website: s.website,
        description: s.description,
        tier: s.tier,
        contactEmail: s.contactEmail || u.email,
        contactPhone: s.contactPhone,
        active: true,
      });
    }

    const passwordHash = await bcrypt.hash(String(u.password), 12);
    const sponsorUser = await SponsorUser.create({
      name: u.name,
      email: u.email,
      passwordHash,
      sponsor: sponsor._id,
      active: true,
      tempPasswordPlain: u.password,
      isTempPassword: true,
    });

    res.status(201).json({
      sponsor: { id: sponsor._id, name: sponsor.name, tier: sponsor.tier },
      user: { id: sponsorUser._id, name: sponsorUser.name, email: sponsorUser.email },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to create sponsor" });
  }
});

// POST /api/admin/sponsors/:id/logo - set/replace logo via Cloudinary
router.post("/sponsors/:id/logo", requireAdmin, async (req, res) => {
  try {
    if (!canManageSponsors(req.admin)) return res.status(403).json({ message: "Forbidden" });
    const { id } = req.params;
    const { file } = req.body || {}; // expects base64 data URL or remote URL
    if (!file) return res.status(400).json({ message: "file required (base64 or URL)" });

    if (!process.env.CLOUDINARY_CLOUD_NAME) return res.status(400).json({ message: "Cloudinary not configured" });

    const upload = await cloudinary.uploader.upload(file, {
      folder: "sponsors",
      resource_type: "image",
      overwrite: true
    });

    const sponsor = await Sponsor.findByIdAndUpdate(
      id,
      { logoUrl: upload.secure_url, logoPublicId: upload.public_id },
      { new: true }
    );
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

    res.json({ id: sponsor._id, logoUrl: sponsor.logoUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to upload logo" });
  }
});

export default router;

// DELETE /api/admin/sponsors/:id - delete sponsor and all its users
router.delete("/sponsors/:id", requireAdmin, async (req, res) => {
  try {
    if (!canManageSponsors(req.admin)) return res.status(403).json({ message: "Forbidden" });
    const { id } = req.params;
    const sponsor = await Sponsor.findById(id);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    // Remove logo from Cloudinary if present
    try { if (sponsor.logoPublicId) await cloudinary.uploader.destroy(sponsor.logoPublicId); } catch (_) {}
    await SponsorUser.deleteMany({ sponsor: sponsor._id });
    await sponsor.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to delete sponsor" });
  }
});

// GET /api/admin/sponsors/:id/credentials - view sponsor user credentials (temp passwords only)
router.get("/sponsors/:id/credentials", requireAdmin, async (req, res) => {
  try {
    if (!canManageSponsors(req.admin)) return res.status(403).json({ message: "Forbidden" });
    const { id } = req.params;
    const sponsor = await Sponsor.findById(id);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    const users = await SponsorUser.find({ sponsor: id }).select("name email tempPasswordPlain isTempPassword");
    const list = users.map(u => ({ id: u._id, name: u.name, email: u.email, tempPassword: u.isTempPassword ? u.tempPasswordPlain : null, isTempPassword: u.isTempPassword }));
    res.json({ sponsorId: id, users: list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load credentials" });
  }
});

// POST /api/admin/sponsors/users/:userId/reset-password - generate new temp password for a sponsor user
router.post("/sponsors/users/:userId/reset-password", requireAdmin, async (req, res) => {
  try {
    if (!canManageSponsors(req.admin)) return res.status(403).json({ message: "Forbidden" });
    const { userId } = req.params;
    const user = await SponsorUser.findById(userId);
    if (!user) return res.status(404).json({ message: "Sponsor user not found" });
    // Generate new temp password (simple pattern: 8-10 chars alnum + special)
    const raw = Math.random().toString(36).slice(-8) + "@1";
    user.passwordHash = await bcrypt.hash(raw, 12);
    user.tempPasswordPlain = raw;
    user.isTempPassword = true;
    await user.save();
    res.json({ ok: true, userId, tempPassword: raw });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to reset password" });
  }
});
