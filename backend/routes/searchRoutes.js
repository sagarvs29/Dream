import express from "express";
import jwt from "jsonwebtoken";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Post from "../models/Post.js";
import School from "../models/School.js";
import Sponsor from "../models/Sponsor.js";

const router = express.Router();

function getViewer(req) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded; // { sub, role, schoolId }
  } catch (_) { return null; }
}

function buildRegex(q) {
  const safe = String(q || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!safe) return null;
  return new RegExp(safe, "i");
}

function parseHashtags(input, tagsParam) {
  const fromTags = String(tagsParam || "").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  const fromQ = (String(input||"").match(/#([\p{L}0-9_]+)/giu) || []).map(h => h.replace(/^#/, "").toLowerCase());
  // Also allow plain words if no # provided
  if (fromQ.length === 0 && input) {
    String(input).split(/[,\s]+/).forEach(w => { const t = w.trim().toLowerCase(); if (t) fromQ.push(t.replace(/^#/, "")); });
  }
  const set = new Set([...fromTags, ...fromQ]);
  return Array.from(set).slice(0, 10);
}

router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const type = String(req.query.type || "all");
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "10", 10)));
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const skip = (page - 1) * limit;
    const viewer = getViewer(req);

    const rx = buildRegex(q);
    const hasQ = q.length > 0;

    // posts visibility
    let postMatch = { visibility: "public" };
    if (viewer && viewer.role === "STUDENT") {
      postMatch = { visibility: { $in: ["public", "school"] } };
    }

    const results = {};

    async function searchPeople() {
      if (!hasQ) return { students: [], mentors: [] };
      const studentQuery = rx ? { $or: [ { name: rx }, { email: rx } ] } : {};
      const mentorQuery = rx ? { $or: [ { name: rx }, { department: rx }, { designation: rx } ] } : {};
      const [students, mentors] = await Promise.all([
        Student.find(studentQuery).select("name email profilePictureUrl school").limit(limit).skip(skip).lean(),
        Teacher.find(mentorQuery).select("name department designation profilePictureUrl school role").limit(limit).skip(skip).lean(),
      ]);
      return { students, mentors };
    }

    async function searchPosts() {
      const match = hasQ ? {
        $and: [ postMatch, { $or: [ { $text: { $search: q } }, { hashtags: rx } ] } ],
      } : postMatch;
      const posts = await Post.find(match)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate("author", "name school")
        .lean();
      return { posts };
    }

    async function searchByHashtags() {
      const tags = parseHashtags(q, req.query.tags);
      if (tags.length === 0) return { posts: [] };
      const posts = await Post.find({ ...postMatch, hashtags: { $in: tags } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate("author", "name school")
        .lean();
      return { posts, tags };
    }

    async function searchSchools() {
      if (!hasQ) {
        const schools = await School.find({})
          .select("name code address logoUrl website")
          .sort({ name: 1 })
          .limit(limit).skip(skip).lean();
        return { schools };
      }
      const schools = await School.find({ $or: [ { name: rx }, { code: rx }, { address: rx } ] })
        .select("name code address logoUrl website")
        .limit(limit).skip(skip).lean();
      return { schools };
    }

    async function searchSponsors() {
      if (!hasQ) return { sponsors: [] };
      const sponsors = await Sponsor.find({ $or: [ { name: rx }, { description: rx } ] })
        .select("name tier logoUrl website")
        .limit(limit).skip(skip).lean();
      return { sponsors };
    }

    if (type === "people") results.people = await searchPeople();
    else if (type === "posts") results.posts = await searchPosts();
    else if (type === "schools") results.schools = await searchSchools();
    else if (type === "sponsors") results.sponsors = await searchSponsors();
    else if (type === "hashtags") results.posts = await searchByHashtags();
    else {
      const [people, posts, schools, sponsors] = await Promise.all([
        searchPeople(), searchPosts(), searchSchools(), searchSponsors()
      ]);
      results.people = people; results.posts = posts; results.schools = schools; results.sponsors = sponsors;
    }

    res.json({ ok: true, q, type, page, limit, results });
  } catch (e) {
    res.status(500).json({ message: "Search failed", error: e.message });
  }
});

export default router;
