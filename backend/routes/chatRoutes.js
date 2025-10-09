import express from "express";
import jwt from "jsonwebtoken";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Generic auth that accepts either student or mentor token
async function requireUser(req, res, next) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === "STUDENT") {
      const me = await Student.findById(decoded.sub);
      if (!me) return res.status(404).json({ message: "Student not found" });
      req.me = { id: me._id, model: "Student", doc: me };
    } else if (decoded.role === "MENTOR") {
      const me = await Teacher.findById(decoded.sub);
      if (!me || !me.active) return res.status(403).json({ message: "Mentor not active" });
      req.me = { id: me._id, model: "Teacher", doc: me };
    } else {
      return res.status(403).json({ message: "Not allowed" });
    }
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid token" });
  }
}

// POST /api/chat/start { targetId, targetModel }
router.post("/start", requireUser, async (req, res) => {
  try {
    const { targetId, targetModel } = req.body || {};
    if (!targetId || !["Student", "Teacher"].includes(targetModel)) return res.status(400).json({ message: "Invalid target" });

    const a = { userId: req.me.id, userModel: req.me.model };
    const b = { userId: targetId, userModel: targetModel };
    // Ensure exists target
    const existsTarget = targetModel === "Student" ? await Student.exists({ _id: targetId }) : await Teacher.exists({ _id: targetId });
    if (!existsTarget) return res.status(404).json({ message: "Target not found" });

    let conv = await Conversation.findOne({
      participants: {
        $all: [
          { $elemMatch: { userId: a.userId, userModel: a.userModel } },
          { $elemMatch: { userId: b.userId, userModel: b.userModel } },
        ],
      },
    });
    if (!conv) {
      conv = await Conversation.create({ participants: [a, b], lastMessageAt: new Date() });
    }
    res.status(201).json({ conversation: conv });
  } catch (e) {
    res.status(500).json({ message: "Failed to start conversation" });
  }
});

// GET /api/chat/conversations
router.get("/conversations", requireUser, async (req, res) => {
  try {
    const uid = req.me.id;
    const list = await Conversation.find({ "participants.userId": uid }).sort({ lastMessageAt: -1 }).lean();
    // Enrich with 'other' participant details
    const others = list.map(c => c.participants.find(p => String(p.userId) !== String(uid)));
    const studentIds = others.filter(o => o?.userModel === 'Student').map(o => o.userId);
    const teacherIds = others.filter(o => o?.userModel === 'Teacher').map(o => o.userId);
    const [sDocs, tDocs] = await Promise.all([
      studentIds.length ? Student.find({ _id: { $in: studentIds } }).select('name email profilePictureUrl').lean() : Promise.resolve([]),
      teacherIds.length ? Teacher.find({ _id: { $in: teacherIds } }).select('name email profilePictureUrl department designation').lean() : Promise.resolve([]),
    ]);
    const sMap = new Map(sDocs.map(d => [String(d._id), d]));
    const tMap = new Map(tDocs.map(d => [String(d._id), d]));
    const payload = list.map(c => {
      const other = c.participants.find(p => String(p.userId) !== String(uid));
      let meta = null;
      if (other?.userModel === 'Student') meta = sMap.get(String(other.userId)) || null;
      if (other?.userModel === 'Teacher') meta = tMap.get(String(other.userId)) || null;
      return {
        ...c,
        other: other ? {
          id: other.userId,
          model: other.userModel,
          name: meta?.name || null,
          email: meta?.email || null,
          profilePictureUrl: meta?.profilePictureUrl || null,
        } : null,
      };
    });
    res.json({ conversations: payload });
  } catch (e) {
    res.status(500).json({ message: "Failed to load conversations" });
  }
});

// GET /api/chat/messages?conversation=ID&limit=50
router.get("/messages", requireUser, async (req, res) => {
  try {
    const { conversation, limit = 50 } = req.query;
    if (!conversation) return res.status(400).json({ message: "conversation required" });
    const conv = await Conversation.findById(conversation);
    if (!conv) return res.status(404).json({ message: "Not found" });
    if (!conv.participants.some(p => String(p.userId) === String(req.me.id))) return res.status(403).json({ message: "Forbidden" });
    const lim = Math.min(parseInt(limit, 10) || 50, 100);
    const msgs = await Message.find({ conversation }).sort({ createdAt: -1 }).limit(lim).lean();
    res.json({ messages: msgs.reverse() });
  } catch (e) {
    res.status(500).json({ message: "Failed to load messages" });
  }
});

// POST /api/chat/messages { conversation, text }
router.post("/messages", requireUser, async (req, res) => {
  try {
    const { conversation, text } = req.body || {};
    if (!conversation || !text) return res.status(400).json({ message: "conversation and text required" });
    if (String(text).length > 2000) return res.status(400).json({ message: "Message too long" });
    const conv = await Conversation.findById(conversation);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    if (!conv.participants.some(p => String(p.userId) === String(req.me.id))) return res.status(403).json({ message: "Forbidden" });

    const other = conv.participants.find(p => String(p.userId) !== String(req.me.id));
    const msg = await Message.create({
      conversation: conv._id,
      from: { userId: req.me.id, userModel: req.me.model },
      to: { userId: other.userId, userModel: other.userModel },
      text: String(text),
    });
    conv.lastMessageAt = new Date();
    await conv.save();

    // Notify receiver
    await Notification.create({ user: { userId: other.userId, userModel: other.userModel }, type: "Message", refId: msg._id, text: String(text).slice(0, 140) });
    res.status(201).json({ message: msg });
  } catch (e) {
    res.status(500).json({ message: "Failed to send message" });
  }
});

export default router;
