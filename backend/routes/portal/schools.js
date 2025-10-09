import express from "express";
import School from "../../models/School.js";

const router = express.Router();

// List schools for dropdown
router.get("/", async (req, res) => {
  try {
    const schools = await School.find({}, { name: 1, code: 1 }).sort({ name: 1 });
    res.json({ schools });
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch schools" });
  }
});

export default router;
