// routes/studentProfileRoutes.js
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import streamifier from "streamifier";
import Student from "../models/Student.js";
import School from "../models/School.js";
import User from "../models/User.js";
import cloudinary from "../utils/cloudinary.js";

const router = express.Router();

// Middleware to verify student token
const verifyStudentToken = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's a student token
    if (decoded.role === "STUDENT") {
      // Fetch from Students collection
      const student = await Student.findById(decoded.sub).populate("school");
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      req.student = student;
      req.userType = "student";
    } else if (decoded.id) {
      // Fallback to User collection for regular users
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      req.user = user;
      req.userType = "user";
    } else {
      return res.status(401).json({ message: "Invalid token format" });
    }

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Get student profile - fetches REAL data from Students collection
router.get("/profile", verifyStudentToken, async (req, res) => {
  try {
    if (req.userType === "student") {
      // Real student data from Students collection
      const student = req.student;
      
      const profileData = {
        id: student._id,
        realName: student.name, // Map student.name to realName for frontend
        name: student.name,
        email: student.email,
        phone: student.phone,
        rollNumber: student.rollNumber,
        department: student.department,
        admissionYear: student.admissionYear,
        grade: student.department || `Year ${student.admissionYear}`, // Map to grade
        status: student.status,
        uniqueStudentId: student.rollNumber || student._id.toString().slice(-8),
        schoolName: student.school?.name || "School Not Found", // Map school name
        schoolLocation: student.school?.address || "Location Not Available", // Map school address
        profilePictureUrl: student.profilePictureUrl || null, // Add profile picture
        aadhaarNumber: student.aadhaarNumber ? 
          `XXXX-XXXX-${student.aadhaarNumber.slice(-4)}` : null,
        aadhaarLast4: student.aadhaarNumber?.slice(-4) || null,
        address: student.address,
        schoolDetails: student.school ? {
          id: student.school._id,
          name: student.school.name,
          code: student.school.code,
          address: student.school.address,
          contactEmail: student.school.contactEmail,
          logoUrl: student.school.logoUrl,
          isVerified: student.school.isVerified
        } : null,
        profileVisibility: student.profileVisibility || "Private",
        source: "students_collection",
        createdAt: student.createdAt,
        updatedAt: student.updatedAt
      };

      return res.json({
        success: true,
        student: profileData, // Frontend expects .student property
        profile: profileData, // Also provide .profile for compatibility
        message: "Real student data from Students collection"
      });

    } else if (req.userType === "user") {
      // Fallback for User collection
      const user = req.user;
      
      const profileData = {
        id: user._id,
        realName: user.realName,
        email: user.email,
        phone: user.phone,
        grade: user.grade,
        schoolName: user.schoolName,
        schoolLocation: user.schoolLocation,
        status: user.status,
        uniqueStudentId: user.uniqueStudentId,
        aadhaarLast4: user.aadhaarLast4,
        address: user.address,
        dob: user.dob,
        source: "users_collection",
        createdAt: user.createdAt
      };

      return res.json({
        success: true,
        profile: profileData,
        message: "Data from Users collection"
      });
    }

  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch student profile",
      error: error.message 
    });
  }
});

// Simple /me endpoint for quick access to current student basics including visibility
router.get("/me", verifyStudentToken, async (req, res) => {
  try {
    if (req.userType !== "student") return res.status(403).json({ message: "Only students supported" });
    const s = await Student.findById(req.student._id).select("name email school profileVisibility").populate("school", "name code");
    if (!s) return res.status(404).json({ message: "Student not found" });
    res.json({ student: s });
  } catch (e) {
    res.status(500).json({ message: "Failed to load", error: e.message });
  }
});

// Toggle profile visibility
router.patch("/me/visibility", verifyStudentToken, async (req, res) => {
  try {
    if (req.userType !== "student") return res.status(403).json({ message: "Only students supported" });
    const { profileVisibility } = req.body || {};
    if (!['Public','Private'].includes(profileVisibility)) {
      return res.status(400).json({ message: "Invalid visibility" });
    }
    // Update only the visibility field to avoid triggering validation on unrelated fields
    const updated = await Student.findByIdAndUpdate(
      req.student._id,
      { $set: { profileVisibility } },
      { new: true, runValidators: true, context: 'query' }
    ).select('profileVisibility');
    if (!updated) return res.status(404).json({ message: "Student not found" });
    res.json({ ok: true, profileVisibility: updated.profileVisibility });
  } catch (e) {
    res.status(500).json({ message: "Failed to update visibility", error: e.message });
  }
});

// Upload profile picture for student
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.post("/profile/picture", verifyStudentToken, upload.single("profilePicture"), async (req, res) => {
  try {
    if (req.userType !== "student") {
      return res.status(403).json({ message: "Only students can update profile pictures" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const student = req.student;
    
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        folder: "student-profiles",
        transformation: [
          { width: 200, height: 200, crop: "fill", gravity: "face" },
          { quality: "auto", format: "auto" }
        ]
      }, 
      async (err, result) => {
        if (err) {
          return res.status(500).json({ message: "Upload failed", error: err.message });
        }

        // Cleanup old profile picture if exists
        if (student.profilePicturePublicId) {
          try { 
            await cloudinary.uploader.destroy(student.profilePicturePublicId); 
          } catch (_) {
            // Ignore cleanup errors
          }
        }

        // Update student with new profile picture
        student.profilePictureUrl = result.secure_url;
        student.profilePicturePublicId = result.public_id;
        await student.save();

        res.json({ 
          success: true, 
          profilePictureUrl: result.secure_url,
          message: "Profile picture updated successfully"
        });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (e) {
    res.status(500).json({ message: "Upload failed", error: e.message });
  }
});

// Alternative endpoint for backward compatibility
router.get("/profile/student", verifyStudentToken, async (req, res) => {
  // Redirect to the main endpoint
  return req.url = "/student/profile";
});

export default router;