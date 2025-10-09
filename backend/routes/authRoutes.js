import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import User from "../models/User.js";
import { mockAadhaarDB } from "../data/mockAadhaarDB.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { audit } from "../utils/audit.js";


const router = express.Router();
// ✅ Aadhaar verification route
router.post("/verify-aadhaar", (req, res) => {
    const { aadhaar } = req.body;
  
    const aadhaarRecord = mockAadhaarDB.find((rec) => rec.aadhaar === aadhaar);
    if (!aadhaarRecord) {
      return res.status(400).json({ message: "Invalid Aadhaar number" });
    }
  
    // Return verified data (only what we want to auto-fill)
    res.json({
      realName: aadhaarRecord.realName,
      address: aadhaarRecord.address,
      phone: aadhaarRecord.phone
    });
  });
  

// ✅ Aadhaar-based register route
router.post("/register-aadhaar", async (req, res) => {
  try {
    const { email, phone, password, aadhaar, schoolName, schoolLocation, referralCode } = req.body;

    // 1. Aadhaar must exist in mock DB
    const aadhaarRecord = mockAadhaarDB.find((rec) => rec.aadhaar === aadhaar);
    if (!aadhaarRecord) {
      return res.status(400).json({ message: "Invalid Aadhaar number" });
    }

    // 2. Prevent duplicates
    if (await User.findOne({ aadhaar })) {
      return res.status(400).json({ message: "Aadhaar already registered" });
    }
    if (await User.findOne({ phone })) {
      return res.status(400).json({ message: "Phone already registered" });
    }
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Generate Unique Student ID (permanent)
    const uniqueStudentId = "SID-" + aadhaar.slice(-4) + "-" + uuidv4().slice(0, 6);

    // 5. Save user
    const user = new User({
      email,
      phone,
      password: hashedPassword,
      aadhaar,
      realName: aadhaarRecord.realName,  
      address: aadhaarRecord.address,    // ✅ save address too
      schoolName,
      schoolLocation,
      referralCode,
      uniqueStudentId,
    });

    await user.save();

    // 6. Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    // 7. Response
    res.status(201).json({
      message: "User registered successfully",
      user: {
        email: user.email,
        phone: user.phone,
        realName: user.realName,
        address: user.address,             // ✅ return address
        uniqueStudentId: user.uniqueStudentId,
        schoolName: user.schoolName,
        schoolLocation: user.schoolLocation
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// New: Provisional register after identity + contact verification
router.post("/register", async (req, res) => {
  try {
    const {
      aadhaarToken,
      aadhaarLast4,
      name,
      dob,
      email,
      phone,
      grade,
      schoolName,
      schoolLocation,
      password,
      isMinor,
      guardian,
      termsAccepted
    } = req.body || {};

    if (!termsAccepted) return res.status(400).json({ message: "Terms must be accepted" });
    if (!aadhaarToken || !aadhaarLast4) return res.status(400).json({ message: "Identity not verified" });
    if (!email || !phone || !grade || !schoolName || !schoolLocation) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (isMinor && !(guardian?.consent && guardian?.phone && guardian?.email)) {
      return res.status(400).json({ message: "Guardian consent required for minors" });
    }

    // Prevent duplicate accounts on email/phone
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "Email already registered" });
    }
    if (await User.findOne({ phone })) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const hashedPassword = await bcrypt.hash(String(password || ""), 10);

    const user = new User({
      email,
      phone,
      password: hashedPassword,
      aadhaarToken,
      aadhaarLast4,
      realName: name,
      dob,
      grade,
      schoolName,
      schoolLocation,
      status: "PENDING_SCHOOL_VERIFICATION",
      guardian: isMinor ? { consent: !!guardian?.consent, phone: guardian?.phone, email: guardian?.email } : undefined,
    });

    await user.save();

    audit("User.Register", { userId: user._id, schoolName, status: user.status });

    return res.json({ userId: user._id, status: user.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
});

// ✅ Login route
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password are required" });
    }

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Login successful",
      user: {
        email: user.email,
        phone: user.phone,
        realName: user.realName,
        address: user.address,
        uniqueStudentId: user.uniqueStudentId,
        schoolName: user.schoolName,
        schoolLocation: user.schoolLocation
      },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// ✅ Get current user profile
router.get("/me", authMiddleware, (req, res) => {
  res.json({
    email: req.user.email,
    phone: req.user.phone,
    realName: req.user.realName,
    address: req.user.address,
    uniqueStudentId: req.user.uniqueStudentId,
    schoolName: req.user.schoolName,
    schoolLocation: req.user.schoolLocation,
    referralCode: req.user.referralCode
  });
});

export default router;
