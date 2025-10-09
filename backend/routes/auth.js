import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import User from "../models/User.js";
import { mockAadhaarDB } from "../data/mockAadhaarDB.js";

const router = express.Router();

// ✅ Register with Aadhaar verification
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
      realName: aadhaarRecord.realName,  // ✅ name from Aadhaar DB
      fancyName: "",                     // empty for now, can add later
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
        uniqueStudentId: user.uniqueStudentId,
        schoolName: user.schoolName,
        schoolLocation: user.schoolLocation,
      },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
