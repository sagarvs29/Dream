import express from "express";
import jwt from "jsonwebtoken";
import Post from "../models/Post.js";
import Notification from "../models/Notification.js";
import PostLike from "../models/PostLike.js";
import Appreciation from "../models/Appreciation.js";
import Student from "../models/Student.js";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import streamifier from "streamifier";

const router = express.Router();

// lightweight student auth middleware (uses same JWT as student portal)
function requireStudent(req, res, next) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "STUDENT") return res.status(403).json({ message: "Student token required" });
    req.student = { id: decoded.sub, schoolId: decoded.schoolId };
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// Accept Student or Mentor as actor for interactions
function requireUser(req, res, next) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'STUDENT') {
      req.actor = { userId: decoded.sub, userModel: 'Student', schoolId: decoded.schoolId };
      return next();
    }
    if (decoded.role === 'MENTOR') {
      req.actor = { userId: decoded.sub, userModel: 'Teacher', schoolId: decoded.schoolId };
      return next();
    }
    return res.status(403).json({ message: 'Not allowed' });
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// ===== Upload media (image/video) for posts =====
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

router.post("/upload", requireStudent, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const cfg = cloudinary.config();
    if (!cfg?.cloud_name || !cfg?.api_key || !cfg?.api_secret) {
      return res.status(500).json({ message: "Cloudinary not configured on server (missing env vars)" });
    }

    const mime = req.file.mimetype || "";
    const isVideo = mime.startsWith("video/");
    const resourceType = isVideo ? "video" : "image";

    const folder = "student-posts";

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto", eager: isVideo ? [{ format: "mp4" }] : undefined },
      (err, result) => {
        if (err) {
          console.error("Cloudinary upload error:", err);
          return res.status(500).json({ message: "Upload failed", error: err.message });
        }
        // Determine kind from resource_type or mime
        const kind = (result.resource_type === "video" || isVideo) ? "video" : "image";
        return res.json({
          success: true,
          media: {
            kind,
            url: result.secure_url,
            thumbUrl: kind === "image" ? result.secure_url : undefined,
            width: result.width,
            height: result.height,
            durationSec: result.duration
          }
        });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (e) {
    console.error("/api/posts/upload failed:", e);
    res.status(500).json({ message: "Failed to upload", error: e.message });
  }
});

// Create a post (expects media URLs already uploaded; can be extended to handle uploads)
router.post("/", requireStudent, async (req, res) => {
  const { media, caption = "", hashtags = [], visibility, tagged = [], location, musicTitle, musicArtist } = req.body || {};
  if (!Array.isArray(media) || media.length === 0) return res.status(400).json({ message: "media required" });
  const vis = visibility === "public" ? "public" : "school";
  // sanitize hashtags -> lowercased unique, trimmed
  const cleanTags = Array.from(new Set((hashtags || []).map(h => String(h).toLowerCase().trim()).filter(Boolean)));
  // sanitize tagged users
  const cleanTagged = Array.isArray(tagged) ? tagged
    .map(t => ({ userId: t?.userId, userModel: t?.userModel }))
    .filter(t => t.userId && (t.userModel === 'Student' || t.userModel === 'Teacher'))
    : [];
  const post = await Post.create({ author: req.student.id, media, caption, hashtags: cleanTags, visibility: vis, tagged: cleanTagged, location, musicTitle, musicArtist });

  // notify tagged users (best-effort)
  if (cleanTagged.length) {
    try {
      const docs = cleanTagged.map(t => ({ user: { userId: t.userId, userModel: t.userModel }, type: 'PostTagged', refId: post._id, text: 'You were tagged in a post' }));
      // Insert many but ignore failures
      await Notification.insertMany(docs);
    } catch (_) {}
  }
  res.status(201).json({ post });
});

// Public or school feed
router.get("/feed", async (req, res) => {
  // if token present, allow school feed; otherwise, only public
  let decoded = null;
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (token) decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {}

  const scope = req.query.scope === "public" ? "public" : "school";
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const match = scope === "public" || !decoded
    ? { visibility: "public" }
    : { visibility: { $in: ["public", "school"] } };

  const posts = await Post.find(match)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate({ path: "author", select: "name school", populate: { path: "school", select: "name" } });
  res.json({ posts, page, limit });
});

// Like toggle
// Toggle like for student (and keep count in a dedicated collection)
router.post("/:id/like", requireUser, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Not found" });
  if (req.actor.userModel === 'Student' && String(post.author) === String(req.actor.userId)) {
    return res.status(400).json({ message: "Cannot like your own post" });
  }
  const key = { post: post._id, 'by.userId': req.actor.userId };
  const existing = await PostLike.findOne(key);
  if (existing) {
    await existing.deleteOne();
  } else {
    try { await PostLike.create({ post: post._id, by: { userId: req.actor.userId, userModel: req.actor.userModel } }); } catch (_) {}
  }
  const likeCount = await PostLike.countDocuments({ post: post._id });
  await Post.updateOne({ _id: post._id }, { $set: { likeCount } });
  res.json({ liked: !existing, likeCount });
});

// Get likes count
router.get('/:id/likes', async (req, res) => {
  const likeCount = await PostLike.countDocuments({ post: req.params.id });
  res.json({ likeCount });
});

// Update a post (author only). Body can include { caption, media }
router.patch("/:id", requireStudent, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Not found" });
  if (String(post.author) !== String(req.student.id)) {
    return res.status(403).json({ message: "Not your post" });
  }
  const { caption, media } = req.body || {};
  if (media && (!Array.isArray(media) || media.length === 0)) {
    return res.status(400).json({ message: "media must be a non-empty array" });
  }
  if (typeof caption === 'string') post.caption = caption;
  if (Array.isArray(media)) post.media = media;
  await post.save();
  const payload = await Post.findById(post._id).populate("author", "name school");
  res.json({ post: payload });
});

// Delete a post (author only)
router.delete("/:id", requireStudent, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Not found" });
  if (String(post.author) !== String(req.student.id)) {
    return res.status(403).json({ message: "Not your post" });
  }
  await post.deleteOne();
  res.json({ ok: true });
});

// Appreciations (comments)
router.get('/:id/appreciations', async (req, res) => {
  const list = await Appreciation.find({ post: req.params.id }).sort({ createdAt: 1 }).lean();
  res.json({ appreciations: list });
});

router.post('/:id/appreciations', requireUser, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ message: 'Text required' });
  if (text.length > 500) return res.status(400).json({ message: 'Too long' });
  const a = await Appreciation.create({ post: post._id, author: { userId: req.actor.userId, userModel: req.actor.userModel }, text });
  res.status(201).json({ appreciation: a });
});

// Mentor feed: show public posts and prioritize mentees' public posts
router.get('/mentor-feed', async (req, res) => {
  try {
    let actor = null;
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'MENTOR') actor = { userId: decoded.sub };
      }
    } catch (_) {}

    // Load public + school posts (we'll filter school posts by mentor's school)
    let posts = await Post.find({ visibility: { $in: ['public', 'school'] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({ path: 'author', select: 'name school', populate: { path: 'school', select: 'name' } });
    if (!actor) {
      // If no mentor token, show only public posts
      posts = posts.filter(p => p.visibility === 'public');
      return res.json({ posts });
    }

    // Mark posts authored by mentees as connected
    // We’ll compute mentee ids via Connection model but to avoid an import cycle, do a light query here
    const Connection = (await import('../models/Connection.js')).default;
    const Teacher = (await import('../models/Teacher.js')).default;
    // Determine mentor's school to allow school-only posts
    let mentorSchoolId = null;
    try {
      const t = await Teacher.findById(actor.userId).select('school');
      mentorSchoolId = t?.school ? String(t.school) : null;
    } catch(_) {}
    const conns = await Connection.find({ $or: [ { 'userA.userId': actor.userId }, { 'userB.userId': actor.userId } ] }).lean();
    const menteeIds = new Set();
    for (const c of conns) {
      const a = c.userA, b = c.userB;
      if (String(a.userModel) === 'Student' && String(b.userId) === String(actor.userId)) menteeIds.add(String(a.userId));
      if (String(b.userModel) === 'Student' && String(a.userId) === String(actor.userId)) menteeIds.add(String(b.userId));
    }
    const enriched = posts
      // Filter for visibility: all public; school-only only if same school
      .filter(p => p.visibility === 'public' || (
        p.visibility === 'school' && mentorSchoolId && String(p.author?.school?._id || p.author?.school) === mentorSchoolId
      ))
      .map(p => ({
      ...p.toObject(),
      connected: menteeIds.has(String(p.author?._id || p.author))
    }));
    res.json({ posts: enriched });
  } catch (e) {
    res.status(500).json({ message: 'Failed to load mentor feed' });
  }
});

// Get a single post by id (respect visibility)
router.get('/:id', async (req, res) => {
  // avoid conflicting with subroutes like /mentor-feed or /feed
  if (req.params.id === 'mentor-feed' || req.params.id === 'feed') return res.status(404).end();
  try {
    const post = await Post.findById(req.params.id)
      .populate({ path: 'author', select: 'name school', populate: { path: 'school', select: 'name' } });
    if (!post) return res.status(404).json({ message: 'Not found' });

    if (post.visibility === 'public') return res.json({ post });

    // school visibility: require a valid student token with same school
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (!token) return res.status(403).json({ message: 'Not allowed' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'STUDENT') return res.status(403).json({ message: 'Not allowed' });
      if (String(decoded.schoolId) !== String(post.author?.school)) return res.status(403).json({ message: 'Not allowed' });
      return res.json({ post });
    } catch (_) {
      return res.status(403).json({ message: 'Not allowed' });
    }
  } catch (e) {
    return res.status(500).json({ message: 'Failed to load post' });
  }
});

export default router;
