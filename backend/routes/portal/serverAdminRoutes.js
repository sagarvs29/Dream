import express from "express";
import bcrypt from "bcryptjs";
import School from "../../models/School.js";
import Admin from "../../models/Admin.js";
import AuditLog from "../../models/AuditLog.js";
import { requireServerAdmin } from "../../middleware/adminAuth.js";
import multer from "multer";
import cloudinary from "../../utils/cloudinary.js";
import streamifier from "streamifier";
import Sponsor from "../../models/Sponsor.js";
import Student from "../../models/Student.js";
import Teacher from "../../models/Teacher.js";

const router = express.Router();

// Create school
router.post("/schools", requireServerAdmin, async (req, res) => {
  const { name, code, address, contactEmail, logoUrl } = req.body || {};
  if (!name) return res.status(400).json({ message: "Name required" });
  let schoolCode = code?.trim();
  if (!schoolCode) {
    schoolCode = "SCH-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  }
  const school = await School.create({ name, code: schoolCode, address, contactEmail, logoUrl });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SERVER", action: "CreateSchool", entityType: "School", entityId: String(school._id), meta: { name, code: schoolCode } });
  res.json({ school });
});

// List schools
router.get("/schools", requireServerAdmin, async (req, res) => {
  const schools = await School.find().sort({ createdAt: -1 });
  res.json({ schools });
});

// Delete a school (with optional cascade)
// Usage: DELETE /api/server/schools/:id[?force=true]
// - If force is not provided and there are linked records, returns 409 with counts
// - If force=true, deletes linked Students, Teachers, and SCHOOL Admins, cleans logo from Cloudinary, then deletes the School
router.delete("/schools/:id", requireServerAdmin, async (req, res) => {
  const { id } = req.params;
  const force = String(req.query.force).toLowerCase() === "true";

  const school = await School.findById(id);
  if (!school) return res.status(404).json({ message: "School not found" });

  const [studentCount, teacherCount, adminCount] = await Promise.all([
    Student.countDocuments({ school: id }),
    Teacher.countDocuments({ school: id }),
    Admin.countDocuments({ school: id, role: "SCHOOL" })
  ]);

  if (!force && (studentCount > 0 || teacherCount > 0 || adminCount > 0)) {
    return res.status(409).json({
      message: "School has linked records. Use ?force=true to cascade delete or detach/reassign first.",
      counts: { students: studentCount, teachers: teacherCount, admins: adminCount }
    });
  }

  // Best-effort logo cleanup
  try {
    if (school.logoPublicId) {
      await cloudinary.uploader.destroy(school.logoPublicId);
    }
  } catch (_) {}

  let deleted = { students: 0, teachers: 0, admins: 0 };
  if (force) {
    const [sRes, tRes, aRes] = await Promise.all([
      Student.deleteMany({ school: id }),
      Teacher.deleteMany({ school: id }),
      Admin.deleteMany({ school: id, role: "SCHOOL" })
    ]);
    deleted = {
      students: sRes?.deletedCount || 0,
      teachers: tRes?.deletedCount || 0,
      admins: aRes?.deletedCount || 0,
    };
  }

  await school.deleteOne();
  await AuditLog.create({
    actorId: req.admin.sub,
    actorRole: "SERVER",
    action: "DeleteSchool",
    entityType: "School",
    entityId: String(id),
    meta: { force, deleted }
  });

  return res.json({ ok: true, schoolId: String(id), deleted, force });
});

// Provision school admin
router.post("/schools/:id/provision-admin", requireServerAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body || {};
  if (!name || !email) return res.status(400).json({ message: "Missing fields" });
  const school = await School.findById(id);
  if (!school) return res.status(404).json({ message: "School not found" });

  const tempPassword = Math.random().toString().slice(-8);
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const admin = await Admin.create({ name, email, passwordHash, role: "SCHOOL", school: school._id, isTempPassword: true });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SERVER", action: "ProvisionSchoolAdmin", entityType: "Admin", entityId: String(admin._id), meta: { school: String(school._id) } });

  // Mark school as verified once at least one admin is provisioned
  if (!school.isVerified) {
    school.isVerified = true;
    await school.save();
  }

  // Dev: return temp password; production would send email only
  res.json({ ok: true, admin: { id: admin._id, name: admin.name, email: admin.email }, tempPassword });
});

// List school admins
router.get("/school/:id/admins", requireServerAdmin, async (req, res) => {
  const { id } = req.params;
  const admins = await Admin.find({ school: id, role: "SCHOOL" }).select("name email createdAt isTempPassword");
  res.json({ admins });
});

export default router;

// Reset a school admin password (generate new temp password)
router.post("/admins/:adminId/reset-password", requireServerAdmin, async (req, res) => {
  const { adminId } = req.params;
  const admin = await Admin.findById(adminId);
  if (!admin || admin.role !== "SCHOOL") {
    return res.status(404).json({ message: "School admin not found" });
  }
  const tempPassword = Math.random().toString(36).slice(-10) + "@1";
  admin.passwordHash = await bcrypt.hash(tempPassword, 10);
  admin.isTempPassword = true;
  await admin.save();
  await AuditLog.create({
    actorId: req.admin.sub,
    actorRole: "SERVER",
    action: "ResetSchoolAdminPassword",
    entityType: "Admin",
    entityId: String(admin._id),
    meta: { school: admin.school ? String(admin.school) : undefined }
  });
  // Return temp password so server admin can communicate it securely (dev/demo). In production, send via email/SMS and do not return.
  res.json({ ok: true, tempPassword });
});

// Update school logo
router.put("/schools/:id/logo", requireServerAdmin, async (req, res) => {
  const { id } = req.params;
  const { logoUrl } = req.body || {};
  const school = await School.findById(id);
  if (!school) return res.status(404).json({ message: "School not found" });
  school.logoUrl = logoUrl;
  await school.save();
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SERVER", action: "UpdateSchoolLogo", entityType: "School", entityId: String(school._id), meta: { logoUrl } });
  res.json({ ok: true, school });
});

// Upload school logo (multipart) and set logoUrl via Cloudinary
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.post("/schools/:id/logo-upload", requireServerAdmin, upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const school = await School.findById(id);
    if (!school) return res.status(404).json({ message: "School not found" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const uploadStream = cloudinary.uploader.upload_stream({ folder: "schools" }, async (err, result) => {
      if (err) return res.status(500).json({ message: "Upload failed" });
      // Cleanup old asset if exists
      if (school.logoPublicId) {
        try { await cloudinary.uploader.destroy(school.logoPublicId); } catch (_) {}
      }
      school.logoUrl = result.secure_url;
      school.logoPublicId = result.public_id;
      await school.save();
      res.json({ ok: true, logoUrl: result.secure_url });
    });
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (e) {
    res.status(500).json({ message: "Upload failed" });
  }
});

// Delete school logo and clear references
router.delete("/schools/:id/logo", requireServerAdmin, async (req, res) => {
  const { id } = req.params;
  const school = await School.findById(id);
  if (!school) return res.status(404).json({ message: "School not found" });
  try {
    if (school.logoPublicId) {
      await cloudinary.uploader.destroy(school.logoPublicId);
    }
    school.logoUrl = undefined;
    school.logoPublicId = undefined;
    await school.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Delete failed" });
  }
});

// ================= Sponsors (Server Admin only) =================
// List sponsors
router.get("/sponsors", requireServerAdmin, async (_req, res) => {
  const items = await Sponsor.find().sort({ active: -1, tier: 1, name: 1 });
  res.json({ sponsors: items });
});

// Create sponsor
router.post("/sponsors", requireServerAdmin, async (req, res) => {
  const { name, website, description, tier, contactEmail, contactPhone, active } = req.body || {};
  if (!name) return res.status(400).json({ message: "Name required" });
  const doc = await Sponsor.create({ name, website, description, tier, contactEmail, contactPhone, active });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SERVER", action: "CreateSponsor", entityType: "Sponsor", entityId: String(doc._id), meta: { name, tier } });
  res.status(201).json({ sponsor: doc });
});

// Update sponsor
router.put("/sponsors/:id", requireServerAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, website, description, tier, contactEmail, contactPhone, active } = req.body || {};
  const doc = await Sponsor.findByIdAndUpdate(id, { name, website, description, tier, contactEmail, contactPhone, active }, { new: true, runValidators: true });
  if (!doc) return res.status(404).json({ message: "Sponsor not found" });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SERVER", action: "UpdateSponsor", entityType: "Sponsor", entityId: String(doc._id) });
  res.json({ sponsor: doc });
});

// Delete sponsor
router.delete("/sponsors/:id", requireServerAdmin, async (req, res) => {
  const { id } = req.params;
  const doc = await Sponsor.findById(id);
  if (!doc) return res.status(404).json({ message: "Sponsor not found" });
  try {
    if (doc.logoPublicId) {
      await cloudinary.uploader.destroy(doc.logoPublicId);
    }
  } catch (_) {}
  await doc.deleteOne();
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SERVER", action: "DeleteSponsor", entityType: "Sponsor", entityId: id });
  res.json({ ok: true });
});

// Upload sponsor logo
router.post("/sponsors/:id/logo", requireServerAdmin, upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Sponsor.findById(id);
    if (!doc) return res.status(404).json({ message: "Sponsor not found" });
    if (!req.file) return res.status(400).json({ message: "No file" });
    const uploadStream = cloudinary.uploader.upload_stream({ folder: "sponsors" }, async (err, result) => {
      if (err) return res.status(500).json({ message: "Upload failed" });
      if (doc.logoPublicId) { try { await cloudinary.uploader.destroy(doc.logoPublicId); } catch (_) {} }
      doc.logoUrl = result.secure_url;
      doc.logoPublicId = result.public_id;
      await doc.save();
      res.json({ ok: true, logoUrl: result.secure_url });
    });
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (e) {
    res.status(500).json({ message: "Upload failed" });
  }
});
