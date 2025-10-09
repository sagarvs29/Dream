// routes/enhancedProfileRoutes.js
import express from "express";
import User from "../models/User.js";
import Student from "../models/Student.js";
import School from "../models/School.js";
import { mockAadhaarDB } from "../data/mockAadhaarDB.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Enhanced profile endpoint with school and Aadhaar details
router.get("/profile/enhanced", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user data
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Initialize response object
    let profileData = {
      id: user._id,
      email: user.email,
      phone: user.phone,
      realName: user.realName, // Aadhaar verified name
      address: user.address,
      dob: user.dob,
      grade: user.grade,
      schoolName: user.schoolName,
      schoolLocation: user.schoolLocation,
      status: user.status,
      uniqueStudentId: user.uniqueStudentId,
      aadhaarLast4: user.aadhaarLast4,
      guardian: user.guardian,
      createdAt: user.createdAt,
      source: "user_model"
    };

    // Try to find more detailed school information if user is also in Student model
    const studentRecord = await Student.findOne({ 
      $or: [
        { email: user.email },
        { phone: user.phone }
      ]
    }).populate("school");

    if (studentRecord && studentRecord.school) {
      // Override with more detailed school information
      profileData.schoolDetails = {
        id: studentRecord.school._id,
        name: studentRecord.school.name,
        code: studentRecord.school.code,
        address: studentRecord.school.address,
        contactEmail: studentRecord.school.contactEmail,
        logoUrl: studentRecord.school.logoUrl,
        isVerified: studentRecord.school.isVerified
      };
      
      // Add student-specific info
      profileData.rollNumber = studentRecord.rollNumber;
      profileData.department = studentRecord.department;
      profileData.admissionYear = studentRecord.admissionYear;
      profileData.studentStatus = studentRecord.status;
      profileData.source = "both_models";
    } else {
      // Try to find school by name for basic info
      const school = await School.findOne({ name: user.schoolName });
      if (school) {
        profileData.schoolDetails = {
          id: school._id,
          name: school.name,
          code: school.code,
          address: school.address,
          contactEmail: school.contactEmail,
          logoUrl: school.logoUrl,
          isVerified: school.isVerified
        };
      }
    }

    // Get original Aadhaar details from mock database for verification
    if (user.aadhaar) {
      const aadhaarRecord = mockAadhaarDB.find(record => record.aadhaar === user.aadhaar);
      if (aadhaarRecord) {
        profileData.aadhaarVerifiedDetails = {
          realName: aadhaarRecord.realName,
          phone: aadhaarRecord.phone,
          address: aadhaarRecord.address,
          verified: true
        };
      }
    } else if (user.aadhaarLast4) {
      // Try to find by last 4 digits
      const aadhaarRecord = mockAadhaarDB.find(record => 
        record.aadhaar.slice(-4) === user.aadhaarLast4
      );
      if (aadhaarRecord) {
        profileData.aadhaarVerifiedDetails = {
          realName: aadhaarRecord.realName,
          phone: aadhaarRecord.phone,
          address: aadhaarRecord.address,
          verified: true,
          maskedAadhaar: "XXXX-XXXX-" + user.aadhaarLast4
        };
      }
    }

    res.json({
      success: true,
      profile: profileData
    });

  } catch (error) {
    console.error("Enhanced profile fetch error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch enhanced profile",
      error: error.message 
    });
  }
});

export default router;