import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Teacher from "../models/Teacher.js";
import { requireMentor } from "../middleware/mentorAuth.js";
import ConnectionRequest from "../models/ConnectionRequest.js";
import Connection from "../models/Connection.js";
import Notification from "../models/Notification.js";
import Student from "../models/Student.js";

const router = express.Router();

// POST /api/mentor/auth/login
// Body: { identifier, password }
// identifier here is the Mentor ID (auth.username)
router.post("/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) return res.status(400).json({ message: "Missing credentials" });

    const id = String(identifier).trim();
    // Login by Mentor ID (auth.username), case-insensitive to avoid user confusion
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ci = new RegExp(`^${esc}$`, "i");
    const t = await Teacher.findOne({
      $or: [
        { "auth.username": { $regex: ci } },
        { employeeId: { $regex: ci } },
        { email: { $regex: ci } },
      ],
      active: true,
    });
    if (!t) return res.status(404).json({ message: "Mentor/Teacher not found" });
    if (!t.passwordHash) return res.status(403).json({ message: "Account not configured. Ask admin to set password." });

    const ok = await bcrypt.compare(String(password), t.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ sub: String(t._id), role: "MENTOR", schoolId: String(t.school) }, process.env.JWT_SECRET, { expiresIn: "7d" });
    t.lastLoginAt = new Date();
    await t.save();
    res.json({ token, mentor: { id: t._id, name: t.name, email: t.email, role: t.role, schoolId: t.school } });
  } catch (e) {
    res.status(500).json({ message: "Login failed" });
  }
});

// POST /api/mentor/auth/change-password
// Body: { currentPassword, newPassword }
// Requires mentor authentication
router.post("/auth/change-password", requireMentor, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }

    const t = await Teacher.findById(req.mentor._id);
    if (!t) return res.status(404).json({ message: "Mentor/Teacher not found" });
    if (!t.passwordHash) return res.status(403).json({ message: "Account not configured. Contact admin." });

    const ok = await bcrypt.compare(String(currentPassword), t.passwordHash);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    t.passwordHash = await bcrypt.hash(String(newPassword), 10);
    t.passwordChangedAt = new Date();
    await t.save();
    return res.json({ ok: true, message: "Password updated" });
  } catch (e) {
    return res.status(500).json({ message: "Failed to change password" });
  }
});

// GET /api/mentor/me
router.get("/me", requireMentor, async (req, res) => {
  res.json({ mentor: req.mentor });
});

export default router;

// Mentor-side: list pending requests to me
router.get("/requests", requireMentor, async (req, res) => {
  try {
    const list = await ConnectionRequest.find({ "target.userId": req.mentor._id, "target.userModel": "Teacher", status: "Pending" }).sort({ createdAt: -1 }).lean();
    res.json({ requests: list });
  } catch (e) {
    res.status(500).json({ message: "Failed to load requests" });
  }
});

// Mentor-side: accept request
router.post("/requests/:id/accept", requireMentor, async (req, res) => {
  try {
    const cr = await ConnectionRequest.findById(req.params.id);
    if (!cr || String(cr.target.userId) !== String(req.mentor._id) || cr.target.userModel !== "Teacher") return res.status(404).json({ message: "Request not found" });
    if (cr.status !== "Pending") return res.status(400).json({ message: "Already processed" });
    cr.status = "Accepted";
    await cr.save();
    // Normalize: userA is always Student, userB is always Teacher
    const reqIsStudent = cr.requester.userModel === 'Student';
    const studentSide = reqIsStudent ? cr.requester : cr.target;
    const teacherSide = reqIsStudent ? cr.target : cr.requester;
    const a = { userId: studentSide.userId, userModel: 'Student' };
    const b = { userId: teacherSide.userId, userModel: 'Teacher' };
    const exists = await Connection.findOne({
      $or: [
        { "userA.userId": a.userId, "userB.userId": b.userId },
        { "userA.userId": b.userId, "userB.userId": a.userId }
      ]
    });
    if (!exists) { try { await Connection.create({ userA: a, userB: b }); } catch (_) {} }
    await Notification.create({ user: { userId: cr.requester.userId, userModel: cr.requester.userModel }, type: "ConnectionAccepted", refId: cr._id, text: "Your request was accepted" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to accept" });
  }
});

// Mentor-side: reject request
router.post("/requests/:id/reject", requireMentor, async (req, res) => {
  try {
    const cr = await ConnectionRequest.findById(req.params.id);
    if (!cr || String(cr.target.userId) !== String(req.mentor._id) || cr.target.userModel !== "Teacher") return res.status(404).json({ message: "Request not found" });
    if (cr.status !== "Pending") return res.status(400).json({ message: "Already processed" });
    cr.status = "Rejected";
    await cr.save();
    await Notification.create({ user: { userId: cr.requester.userId, userModel: cr.requester.userModel }, type: "ConnectionRejected", refId: cr._id, text: "Your request was rejected" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to reject" });
  }
});

// GET /api/mentor/mentees - list connected students (accepted mentees)
router.get("/mentees", requireMentor, async (req, res) => {
  try {
    const mid = req.mentor._id;
    // Fetch all connections involving this mentor, regardless of ordering, then pick the student side
    const conns = await Connection.find({ $or: [ { "userA.userId": mid }, { "userB.userId": mid } ] }).lean();

    const studentIds = conns.map(c => {
      const a = c.userA, b = c.userB;
      if (String(a.userId) === String(mid)) {
        return b.userModel === 'Student' ? b.userId : null;
      }
      if (String(b.userId) === String(mid)) {
        return a.userModel === 'Student' ? a.userId : null;
      }
      return null;
    }).filter(Boolean);

    const uniqIds = Array.from(new Set(studentIds.map(String)));
    const sDocs = uniqIds.length ? await Student.find({ _id: { $in: uniqIds } })
      .select('name email department rollNumber admissionYear profilePictureUrl')
      .lean() : [];
    const sMap = new Map(sDocs.map(d => [String(d._id), d]));

    const mentees = conns.map(c => {
      const other = String(c.userA.userModel) === 'Student' ? c.userA : c.userB;
      const meta = sMap.get(String(other.userId));
      return {
        connectionId: c._id,
        connectedAt: c.createdAt,
        student: meta ? { id: meta._id, ...meta } : { id: other.userId },
      };
    });

    res.json({ mentees });
  } catch (e) {
    res.status(500).json({ message: 'Failed to load mentees' });
  }
});
