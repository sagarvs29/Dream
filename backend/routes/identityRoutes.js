import express from "express";
import { hashAadhaar } from "../utils/aadhaar.js";
import { audit } from "../utils/audit.js";
import { aadhaarVerifyLimiter } from "../middleware/rateLimiters.js";
import { mockAadhaarDB } from "../data/mockAadhaarDB.js";

const router = express.Router();

// POST /api/identity/verifyAadhaar
router.post("/verifyAadhaar", aadhaarVerifyLimiter, async (req, res) => {
  try {
    const { aadhaarNumber } = req.body || {};
    if (!/^\d{12}$/.test(aadhaarNumber || "")) {
      return res.status(400).json({ message: "Invalid Aadhaar" });
    }

    // Mock verification via local DB for now
    const rec = mockAadhaarDB.find((r) => r.aadhaar === aadhaarNumber);
    if (!rec) return res.status(400).json({ message: "Aadhaar not found" });

    const name = rec.realName;
    // Mocked DOB; in real life, get from DigiLocker/UIDAI
    const dob = "2008-01-15";

    const aadhaarToken = hashAadhaar(aadhaarNumber);
    const last4 = String(aadhaarNumber).slice(-4);

    audit("Identity.AadhaarVerified", { method: "mock-db", token: aadhaarToken, last4, ip: req.ip });

    return res.json({ name, dob, aadhaarToken, last4 });
  } catch (e) {
    return res.status(502).json({ message: "Verification service unavailable" });
  }
});

// Optional: DigiLocker start (placeholder)
router.get("/digilocker/start", (req, res) => {
  res.status(501).send("DigiLocker integration not implemented");
});

export default router;
