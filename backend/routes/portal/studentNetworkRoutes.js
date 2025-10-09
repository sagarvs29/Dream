import express from "express";
import jwt from "jsonwebtoken";
import Student from "../../models/Student.js";
import Teacher from "../../models/Teacher.js";
import ConnectionRequest from "../../models/ConnectionRequest.js";
import Connection from "../../models/Connection.js";
import Notification from "../../models/Notification.js";
import School from "../../models/School.js";
import Sponsor from "../../models/Sponsor.js";

const router = express.Router();

// Minimal student auth using JWT (reuses logic pattern from studentProfileRoutes)
const requireStudent = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "STUDENT") return res.status(403).json({ message: "Not a student token" });
    const me = await Student.findById(decoded.sub);
    if (!me) return res.status(404).json({ message: "Student not found" });
    req.student = me;
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// GET /api/student/network/recommendations?type=student|mentor&limit=20
router.get("/network/recommendations", requireStudent, async (req, res) => {
  try {
    const { type = "student" } = req.query;
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    const me = req.student;

    if (type === "mentor") {
      const mentors = await Teacher.find({ role: "Mentor", status: "Active" })
        .select("name email department role designation profilePictureUrl school")
        .limit(limit)
        .lean();
      return res.json({ mentors });
    }

    const baseSelect = "name email profileVisibility school profilePictureUrl";
    let students = [];
    if (me.profileVisibility === "Private") {
      students = await Student.find({ school: me.school, _id: { $ne: me._id } })
        .select(baseSelect)
        .limit(limit)
        .lean();
    } else {
      const half = Math.max(5, Math.floor(limit / 2));
      const cross = await Student.find({ school: { $ne: me.school }, profileVisibility: "Public" })
        .select(baseSelect)
        .limit(limit - half)
        .lean();
      const internal = await Student.find({ school: me.school, _id: { $ne: me._id } })
        .select(baseSelect)
        .limit(half)
        .lean();
      students = [...cross, ...internal].slice(0, limit);
    }

    res.json({ students });
  } catch (e) {
    res.status(500).json({ message: "Failed to load recommendations", error: e.message });
  }
});

// POST /api/student/network/requests
router.post("/network/requests", requireStudent, async (req, res) => {
  try {
    const { targetId, targetModel, message } = req.body || {};
    if (!targetId || !["Student", "Teacher"].includes(targetModel)) {
      return res.status(400).json({ message: "Invalid target" });
    }
    if (message && String(message).length > 280) {
      return res.status(400).json({ message: "Message too long" });
    }
    if (targetModel === "Student" && String(targetId) === String(req.student._id)) {
      return res.status(400).json({ message: "Cannot connect to yourself" });
    }

    // prevent duplicate pending
    const dup = await ConnectionRequest.findOne({
      "requester.userId": req.student._id,
      "target.userId": targetId,
      status: "Pending",
    });
    if (dup) return res.status(409).json({ message: "Request already pending" });

    const reqDoc = await ConnectionRequest.create({
      requester: { userId: req.student._id, userModel: "Student" },
      target: { userId: targetId, userModel: targetModel },
      message,
    });

    await Notification.create({
      user: { userId: targetId, userModel: targetModel },
      type: "ConnectionRequest",
      refId: reqDoc._id,
      text: message || "New connection request",
    });

    res.status(201).json({ success: true, request: reqDoc });
  } catch (e) {
    res.status(500).json({ message: "Failed to create request", error: e.message });
  }
});

// GET /api/student/network/requests?inbound=1
router.get("/network/requests", requireStudent, async (req, res) => {
  try {
    const inbound = String(req.query.inbound || "1") === "1";
    const q = inbound
      ? { "target.userId": req.student._id, status: "Pending" }
      : { "requester.userId": req.student._id, status: "Pending" };
    const list = await ConnectionRequest.find(q).sort({ createdAt: -1 }).lean();
    res.json({ requests: list });
  } catch (e) {
    res.status(500).json({ message: "Failed to load requests", error: e.message });
  }
});

// Accept a request
router.post("/network/requests/:id/accept", requireStudent, async (req, res) => {
  try {
    const cr = await ConnectionRequest.findById(req.params.id);
    if (!cr || cr.status !== "Pending") return res.status(404).json({ message: "Request not found" });
    if (String(cr.target.userId) !== String(req.student._id)) return res.status(403).json({ message: "Not your request" });

    cr.status = "Accepted";
    await cr.save();

    // Create connection (idempotent; normalized Student-Teacher ordering)
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
    if (!exists) {
      try { await Connection.create({ userA: a, userB: b }); } catch (_) {}
    }

    await Notification.create({
      user: { userId: cr.requester.userId, userModel: cr.requester.userModel },
      type: "ConnectionAccepted",
      refId: cr._id,
      text: "Your connection request was accepted",
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to accept", error: e.message });
  }
});

// Reject a request
router.post("/network/requests/:id/reject", requireStudent, async (req, res) => {
  try {
    const cr = await ConnectionRequest.findById(req.params.id);
    if (!cr || cr.status !== "Pending") return res.status(404).json({ message: "Request not found" });
    if (String(cr.target.userId) !== String(req.student._id)) return res.status(403).json({ message: "Not your request" });

    cr.status = "Rejected";
    await cr.save();

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to reject", error: e.message });
  }
});

// DELETE /api/student/network/requests/:id -> cancel my outgoing pending request
router.delete("/network/requests/:id", requireStudent, async (req, res) => {
  try {
    const cr = await ConnectionRequest.findById(req.params.id);
    if (!cr || cr.status !== "Pending") return res.status(404).json({ message: "Request not found" });
    if (String(cr.requester.userId) !== String(req.student._id)) return res.status(403).json({ message: "Not your request" });

    await cr.deleteOne();
    return res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to cancel request", error: e.message });
  }
});

// GET /api/student/network/connections
router.get("/network/connections", requireStudent, async (req, res) => {
  try {
    const uid = req.student._id;
    const list = await Connection.find({ $or: [ { "userA.userId": uid }, { "userB.userId": uid } ] }).lean();
    res.json({ connections: list });
  } catch (e) {
    res.status(500).json({ message: "Failed to load connections", error: e.message });
  }
});

// GET /api/student/network/schools - returns schools with basic info and mentors preview
router.get("/network/schools", requireStudent, async (_req, res) => {
  try {
    const schools = await School.find({}).select("name code address logoUrl website about principalName heads").lean();
    const byId = new Map(schools.map(s => [String(s._id), s]));
    const mentorDocs = await Teacher.find({ role: "Mentor", status: "Active" })
      .select("name department school profilePictureUrl designation")
      .lean();
    const grouped = {};
    for (const m of mentorDocs) {
      const sid = String(m.school);
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push(m);
    }
    const payload = schools.map(s => ({ ...s, mentors: (grouped[String(s._id)] || []).slice(0, 6) }));
    res.json({ schools: payload });
  } catch (e) {
    res.status(500).json({ message: "Failed to load schools", error: e.message });
  }
});

// Notifications (basic polling)
router.get("/notifications/unread-count", requireStudent, async (req, res) => {
  const c = await Notification.countDocuments({ "user.userId": req.student._id, read: false });
  res.json({ count: c });
});
router.get("/notifications", requireStudent, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
  const items = await Notification.find({ "user.userId": req.student._id }).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ notifications: items });
});
router.patch("/notifications/:id/read", requireStudent, async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, "user.userId": req.student._id }, { $set: { read: true } });
  res.json({ ok: true });
});

// GET /api/student/network/sponsors - public list for students
router.get("/network/sponsors", requireStudent, async (_req, res) => {
  try {
    // Tier priority mapping
    const tierOrder = { Platinum: 1, Gold: 2, Silver: 3, Bronze: 4, Partner: 5, Supporter: 6 };
    const sponsors = await Sponsor.find({ active: true }).lean();
    sponsors.sort((a, b) => (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99) || String(a.name).localeCompare(String(b.name)));
    res.json({ sponsors });
  } catch (e) {
    res.status(500).json({ message: "Failed to load sponsors", error: e.message });
  }
});

export default router;
