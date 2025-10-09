import express from "express";
import { makeStudentId } from "../utils/aadhaar.js";
import { audit } from "../utils/audit.js";

const router = express.Router();

// TODO: Replace with DB update
const approvals = new Map(); // userId -> uniqueStudentId

router.post("/approve", async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ message: "userId required" });

  const uniqueStudentId = makeStudentId();
  approvals.set(userId, uniqueStudentId);
  audit("School.Approve", { userId, uniqueStudentId });

  // TODO: update user record: status=APPROVED, lock school fields
  return res.json({ userId, status: "APPROVED", uniqueStudentId });
});

export default router;
