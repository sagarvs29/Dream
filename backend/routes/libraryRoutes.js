import express from "express";
import Resource from "../models/Resource.js";

const router = express.Router();

// GET /api/library/resources
// Filters: q (text), subject, tag, grade, page, limit
router.get("/resources", async (req, res) => {
	try {
		const { q = "", subject = "", tag = "", grade = "", page = 1, limit = 12 } = req.query || {};
		const find = {};

		if (q) {
			find.$text = { $search: String(q) };
		}
		if (subject) find.subject = subject;
		if (tag) find.tags = { $in: [String(tag)] };
		if (grade) find.gradeLevels = { $in: [String(grade)] };

		const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
		const [items, total] = await Promise.all([
			Resource.find(find)
				.sort({ popularity: -1, createdAt: -1 })
				.skip(skip)
				.limit(Math.max(1, Number(limit))),
			Resource.countDocuments(find),
		]);

		res.json({ ok: true, total, items });
	} catch (e) {
		res.status(500).json({ ok: false, message: e?.message || "Failed to load resources" });
	}
});

// GET /api/library/recommendations
// Optional params: grade, tag. If not provided, return popular resources.
router.get("/recommendations", async (req, res) => {
	try {
		const { grade = "", tag = "", limit = 8 } = req.query || {};
		const find = {};
		if (grade) find.gradeLevels = { $in: [String(grade)] };
		if (tag) find.tags = { $in: [String(tag)] };

		const items = await Resource.find(find)
			.sort({ popularity: -1, createdAt: -1 })
			.limit(Math.max(1, Number(limit)));

		res.json({ ok: true, recommendations: items });
	} catch (e) {
		res.status(500).json({ ok: false, message: e?.message || "Failed to load recommendations" });
	}
});

export default router;

