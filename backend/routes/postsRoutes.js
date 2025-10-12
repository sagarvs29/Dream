import express from "express";
import jwt from "jsonwebtoken";
import Post from "../models/Post.js";
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

// ===== Upload media (image/video) for posts =====
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

router.post("/upload", requireStudent, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
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
  const { media, caption = "", hashtags = [], visibility } = req.body || {};
  if (!Array.isArray(media) || media.length === 0) return res.status(400).json({ message: "media required" });
  const vis = visibility === "public" ? "public" : "school";
  const post = await Post.create({ author: req.student.id, media, caption, hashtags, visibility: vis });
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
    .populate("author", "name school");
  res.json({ posts, page, limit });
});

// Like toggle
router.post("/:id/like", requireStudent, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Not found" });
  // naive toggle stored in memory map per request - replace with Like model if needed
  const key = `liked:${req.student.id}`;
  const likedByMe = (post._doc[key] === true);
  if (likedByMe) {
    post.likeCount = Math.max(0, (post.likeCount || 0) - 1);
    post._doc[key] = false;
  } else {
    post.likeCount = (post.likeCount || 0) + 1;
    post._doc[key] = true;
  }
  await post.save();
  res.json({ liked: !likedByMe, likeCount: post.likeCount });
});

export default router;
