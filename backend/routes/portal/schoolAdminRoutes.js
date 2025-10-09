import express from "express";
import bcrypt from "bcryptjs";
import Student from "../../models/Student.js";
import Teacher from "../../models/Teacher.js";
import Approval from "../../models/Approval.js";
import AuditLog from "../../models/AuditLog.js";
import School from "../../models/School.js";
import { requireSchoolAdmin } from "../../middleware/adminAuth.js";
import multer from "multer";
import cloudinary from "../../utils/cloudinary.js";
import streamifier from "streamifier";
import ConnectionRequest from "../../models/ConnectionRequest.js";
import Connection from "../../models/Connection.js";
import Notification from "../../models/Notification.js";

const router = express.Router();
// Single multer instance reused across this router (5 MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Pending students
router.get("/pending-students", requireSchoolAdmin, async (req, res) => {
  const list = await Student.find({ school: req.admin.schoolId, status: "Pending" }).sort({ createdAt: -1 });
  res.json({ students: list });
});

// Generic list with status filter
router.get("/students", requireSchoolAdmin, async (req, res) => {
  const { status, q: search } = req.query;
  const q = { school: req.admin.schoolId };
  if (status) q.status = status;
  if (search) {
    const rx = new RegExp(search, "i");
    q.$or = [{ rollNumber: rx }, { email: rx }];
  }
  const list = await Student.find(q).sort({ createdAt: -1 });
  res.json({ students: list });
});

// Student detail view (school-scoped)
router.get("/students/:id", requireSchoolAdmin, async (req, res) => {
  const { id } = req.params;
  const s = await Student.findOne({ _id: id, school: req.admin.schoolId });
  if (!s) return res.status(404).json({ message: "Student not found" });
  res.json({ student: s });
});

// Approve
router.post("/students/:id/approve", requireSchoolAdmin, async (req, res) => {
  const { id } = req.params;
  const { remarks } = req.body || {};
  const s = await Student.findOne({ _id: id, school: req.admin.schoolId });
  if (!s) return res.status(404).json({ message: "Student not found" });
  s.status = "Approved";
  await s.save();
  await Approval.create({ student: s._id, admin: req.admin.sub, status: "Approved", remarks });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "ApproveStudent", entityType: "Student", entityId: String(s._id), meta: { remarks } });
  res.json({ ok: true });
});

// Reject
router.post("/students/:id/reject", requireSchoolAdmin, async (req, res) => {
  const { id } = req.params;
  const { remarks } = req.body || {};
  const s = await Student.findOne({ _id: id, school: req.admin.schoolId });
  if (!s) return res.status(404).json({ message: "Student not found" });
  s.status = "Rejected";
  await s.save();
  await Approval.create({ student: s._id, admin: req.admin.sub, status: "Rejected", remarks });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "RejectStudent", entityType: "Student", entityId: String(s._id), meta: { remarks } });
  res.json({ ok: true });
});

// ==================== TEACHER/MENTOR MANAGEMENT ====================

// Get all teachers/mentors for the school
router.get("/mentors", requireSchoolAdmin, async (req, res) => {
  try {
    const { q: search, status } = req.query;
    const query = {
      school: req.admin.schoolId,
      $or: [
        { role: "Mentor" },
        { mentorshipAreas: { $exists: true, $ne: [] } },
      ],
    };
    // Only apply status filter if provided by client
    if (status) query.status = status;

    if (search) {
      const rx = new RegExp(search, "i");
      query.$and = [
        {
          $or: [
            { name: rx },
            { email: rx },
            { employeeId: rx },
            { department: rx },
            { mentorshipAreas: rx },
          ],
        },
      ];
    }

    const mentors = await Teacher.find(query)
      .select("name email phone employeeId department designation role status subjects classes mentorshipAreas profilePictureUrl bio auth.username")
      .sort({ createdAt: -1 });

    res.json({ success: true, mentors });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch mentors", error: error.message });
  }
});

// Get all teachers for the school with optional filters/search
router.get("/teachers", requireSchoolAdmin, async (req, res) => {
  try {
    const { status, department, role, q: search } = req.query;
    const query = { school: req.admin.schoolId };
    if (status) query.status = status;
    if (department) query.department = department;
    if (role) query.role = role;
    if (search) {
      const rx = new RegExp(search, "i");
      query.$or = [
        { name: rx },
        { email: rx },
        { employeeId: rx },
        { department: rx },
        { subjects: rx },
      ];
    }
    const teachers = await Teacher.find(query)
      .populate("addedBy", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, teachers });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch teachers", error: error.message });
  }
});

// Get single teacher details
router.get("/teachers/:id", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await Teacher.findOne({ _id: id, school: req.admin.schoolId })
      .populate("school", "name code address")
      .populate("addedBy", "name email")
      .populate("lastUpdatedBy", "name email");
    
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    
    res.json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch teacher", error: error.message });
  }
});

// Add new teacher/mentor
router.post("/teachers", requireSchoolAdmin, async (req, res) => {
  try {
    const {
      name, email, phone, employeeId, department, designation,
      subjects, classes, experience, qualifications, specializations,
      address, dateOfBirth, joiningDate, role, mentorshipAreas,
      achievements, bio, status,
      auth, password
    } = req.body;

    // Check if teacher with same email or employeeId exists in this school
    const existingTeacher = await Teacher.findOne({
      school: req.admin.schoolId,
      $or: [{ email }, { employeeId }]
    });

    if (existingTeacher) {
      return res.status(400).json({ 
        message: "Teacher with this email or employee ID already exists in your school" 
      });
    }

    // If creating a Mentor, both username and password are required
    if (role === 'Mentor') {
      const hasUsername = auth && typeof auth.username === 'string' && auth.username.trim().length > 0;
      const hasPassword = typeof password === 'string' && password.trim().length > 0;
      if (!hasUsername || !hasPassword) {
        return res.status(400).json({ message: "Mentor login requires both username and password" });
      }
    }

    const teacher = new Teacher({
      name, email, phone, employeeId, department, designation,
      subjects: Array.isArray(subjects) ? subjects : [subjects].filter(Boolean),
      classes: Array.isArray(classes) ? classes : [classes].filter(Boolean),
      experience, 
      qualifications: Array.isArray(qualifications) ? qualifications : [qualifications].filter(Boolean),
      specializations: Array.isArray(specializations) ? specializations : [specializations].filter(Boolean),
      address, dateOfBirth, joiningDate, role,
      mentorshipAreas: Array.isArray(mentorshipAreas) ? mentorshipAreas : [mentorshipAreas].filter(Boolean),
      achievements: Array.isArray(achievements) ? achievements : [achievements].filter(Boolean),
      bio,
      status: status || "Active",
      school: req.admin.schoolId,
      addedBy: req.admin.sub,
      lastUpdatedBy: req.admin.sub
    });

    // Optional mentor login
    if (auth && typeof auth.username === 'string' && auth.username.trim()) {
      const username = String(auth.username).trim();
      // ensure unique per school
      const dupUsername = await Teacher.findOne({ school: req.admin.schoolId, "auth.username": username });
      if (dupUsername) return res.status(400).json({ message: "Username already in use in this school" });
      teacher.auth = { username };
    }
    if (password) {
      try { teacher.passwordHash = await bcrypt.hash(String(password), 10); } catch (_) {}
    }

    await teacher.save();

    // Log this action
    await AuditLog.create({
      actorId: req.admin.sub,
      actorRole: "SCHOOL",
      action: "AddTeacher",
      entityType: "Teacher",
      entityId: String(teacher._id),
      meta: { teacherName: name, department, role, username: teacher?.auth?.username ? true : false }
    });

    res.status(201).json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ message: "Failed to add teacher", error: error.message });
  }
});

// Update teacher details
router.put("/teachers/:id", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const teacher = await Teacher.findOne({ _id: id, school: req.admin.schoolId });
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Handle setting password (optional)
    if (updateData.password) {
      try {
        teacher.passwordHash = await bcrypt.hash(String(updateData.password), 10);
      } catch (_) {}
      delete updateData.password;
    }

    // Handle auth.username update (optional)
    if (updateData.auth && typeof updateData.auth.username === 'string') {
      const newUser = String(updateData.auth.username).trim();
      if (teacher.role === 'Mentor' && !newUser) {
        return res.status(400).json({ message: 'Mentor must have a username' });
      }
      teacher.auth = teacher.auth || {};
      teacher.auth.username = newUser || undefined;
      delete updateData.auth;
    }

    // Handle array fields properly
    if (updateData.subjects && !Array.isArray(updateData.subjects)) {
      updateData.subjects = [updateData.subjects].filter(Boolean);
    }
    if (updateData.classes && !Array.isArray(updateData.classes)) {
      updateData.classes = [updateData.classes].filter(Boolean);
    }
    if (updateData.qualifications && !Array.isArray(updateData.qualifications)) {
      updateData.qualifications = [updateData.qualifications].filter(Boolean);
    }
    if (updateData.specializations && !Array.isArray(updateData.specializations)) {
      updateData.specializations = [updateData.specializations].filter(Boolean);
    }
    if (updateData.mentorshipAreas && !Array.isArray(updateData.mentorshipAreas)) {
      updateData.mentorshipAreas = [updateData.mentorshipAreas].filter(Boolean);
    }
    if (updateData.achievements && !Array.isArray(updateData.achievements)) {
      updateData.achievements = [updateData.achievements].filter(Boolean);
    }

    // Update lastUpdatedBy
    updateData.lastUpdatedBy = req.admin.sub;

    Object.assign(teacher, updateData);
    await teacher.save();

    // Log this action
    await AuditLog.create({
      actorId: req.admin.sub,
      actorRole: "SCHOOL",
      action: "UpdateTeacher",
      entityType: "Teacher",
      entityId: String(teacher._id),
      meta: { teacherName: teacher.name, updatedFields: Object.keys(updateData) }
    });

    res.json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ message: "Failed to update teacher", error: error.message });
  }
});

// Delete teacher
router.delete("/teachers/:id", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await Teacher.findOne({ _id: id, school: req.admin.schoolId });
    
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Delete profile picture from cloudinary if exists
    if (teacher.profilePicturePublicId) {
      try {
        await cloudinary.uploader.destroy(teacher.profilePicturePublicId);
      } catch (_) {
        // Ignore cleanup errors
      }
    }

    await Teacher.findByIdAndDelete(id);

    // Log this action
    await AuditLog.create({
      actorId: req.admin.sub,
      actorRole: "SCHOOL",
      action: "DeleteTeacher",
      entityType: "Teacher",
      entityId: String(teacher._id),
      meta: { teacherName: teacher.name, department: teacher.department }
    });

    res.json({ success: true, message: "Teacher deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete teacher", error: error.message });
  }
});

// Upload teacher profile picture
router.post("/teachers/:id/picture", requireSchoolAdmin, upload.single("profilePicture"), async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await Teacher.findOne({ _id: id, school: req.admin.schoolId });
    
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        folder: "teacher-profiles",
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
        if (teacher.profilePicturePublicId) {
          try { 
            await cloudinary.uploader.destroy(teacher.profilePicturePublicId); 
          } catch (_) {
            // Ignore cleanup errors
          }
        }

        // Update teacher with new profile picture
        teacher.profilePictureUrl = result.secure_url;
        teacher.profilePicturePublicId = result.public_id;
        teacher.lastUpdatedBy = req.admin.sub;
        await teacher.save();

        // Log this action
        await AuditLog.create({
          actorId: req.admin.sub,
          actorRole: "SCHOOL",
          action: "UpdateTeacherPicture",
          entityType: "Teacher",
          entityId: String(teacher._id),
          meta: { teacherName: teacher.name }
        });

        res.json({ 
          success: true, 
          profilePictureUrl: result.secure_url,
          message: "Profile picture updated successfully"
        });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (error) {
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
});

// Get teachers by department
router.get("/teachers/by-department/:department", requireSchoolAdmin, async (req, res) => {
  try {
    const { department } = req.params;
    const teachers = await Teacher.find({ 
      school: req.admin.schoolId, 
      department,
      status: "Active"
    }).select("name email role designation profilePictureUrl");
    
    res.json({ success: true, teachers });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch teachers", error: error.message });
  }
});

// ==================== MENTOR REQUESTS (School Admin view) ====================
// List pending connection requests to mentors of this school
router.get("/mentor-requests", requireSchoolAdmin, async (req, res) => {
  try {
    // Find mentor IDs in this school
    const mentors = await Teacher.find({ school: req.admin.schoolId, $or: [{ role: "Mentor" }, { mentorshipAreas: { $exists: true, $ne: [] } }] }).select("_id");
    const mentorIds = mentors.map(m => m._id);
    if (mentorIds.length === 0) return res.json({ requests: [] });

    const list = await ConnectionRequest.find({ "target.userId": { $in: mentorIds }, "target.userModel": "Teacher" })
      .sort({ createdAt: -1 })
      .lean();

    // Join student and mentor details
    const studentIds = [...new Set(list.filter(r => r.requester.userModel === 'Student').map(r => String(r.requester.userId)))]
      .map(id => id);
    const teacherIds = [...new Set(list.map(r => String(r.target.userId)))];
    const [students, teachers] = await Promise.all([
      Student.find({ _id: { $in: studentIds } }).select('name email rollNumber department status').lean(),
      Teacher.find({ _id: { $in: teacherIds } }).select('name email department designation').lean()
    ]);
    const sMap = new Map(students.map(s => [String(s._id), s]));
    const tMap = new Map(teachers.map(t => [String(t._id), t]));
    const payload = list.map(r => ({
      _id: r._id,
      status: r.status,
      createdAt: r.createdAt,
      requester: {
        userId: r.requester.userId,
        userModel: r.requester.userModel,
        student: r.requester.userModel === 'Student' ? sMap.get(String(r.requester.userId)) : null,
      },
      target: {
        userId: r.target.userId,
        userModel: r.target.userModel,
        mentor: tMap.get(String(r.target.userId)) || null,
      },
      message: r.message || null,
    }));
    res.json({ requests: payload });
  } catch (e) {
    res.status(500).json({ message: "Failed to load mentor requests", error: e.message });
  }
});

// Approve a mentor request (by School Admin)
router.post("/mentor-requests/:id/approve", requireSchoolAdmin, async (_req, res) => {
  // School Admin can view mentor requests, but final decision must be made by the mentor.
  return res.status(403).json({ message: "Mentor must accept/reject this request in their portal" });
});

// Reject a mentor request (by School Admin)
router.post("/mentor-requests/:id/reject", requireSchoolAdmin, async (_req, res) => {
  // School Admin can view mentor requests, but final decision must be made by the mentor.
  return res.status(403).json({ message: "Mentor must accept/reject this request in their portal" });
});

// School info
router.get("/me", requireSchoolAdmin, async (req, res) => {
  const s = await School.findById(req.admin.schoolId);
  if (!s) return res.status(404).json({ message: "School not found" });
  res.json({ school: s });
});

router.put("/update", requireSchoolAdmin, async (req, res) => {
  const { name, address, contactEmail, logoUrl,
    principalName, principalEmail, principalPhone, heads, website, about } = req.body || {};
  const s = await School.findById(req.admin.schoolId);
  if (!s) return res.status(404).json({ message: "School not found" });
  if (name !== undefined) s.name = name;
  if (address !== undefined) s.address = address;
  if (contactEmail !== undefined) s.contactEmail = contactEmail;
  if (logoUrl !== undefined) s.logoUrl = logoUrl;
  if (principalName !== undefined) s.principalName = principalName;
  if (principalEmail !== undefined) s.principalEmail = principalEmail;
  if (principalPhone !== undefined) s.principalPhone = principalPhone;
  if (heads !== undefined) s.heads = Array.isArray(heads) ? heads : [heads].filter(Boolean);
  if (website !== undefined) s.website = website;
  if (about !== undefined) s.about = about;
  await s.save();
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "UpdateSchool", entityType: "School", entityId: String(s._id), meta: { name, address, contactEmail, principalName } });
  res.json({ school: s });
});

// Upload logo for current school
// Reuse the existing `upload` instance defined above for multer
router.post("/logo-upload", requireSchoolAdmin, upload.single("file"), async (req, res) => {
  try {
    const s = await School.findById(req.admin.schoolId);
    if (!s) return res.status(404).json({ message: "School not found" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const uploadStream = cloudinary.uploader.upload_stream({ folder: "schools" }, async (err, result) => {
      if (err) return res.status(500).json({ message: "Upload failed" });
      if (s.logoPublicId) {
        try { await cloudinary.uploader.destroy(s.logoPublicId); } catch (_) {}
      }
      s.logoUrl = result.secure_url;
      s.logoPublicId = result.public_id;
      await s.save();
      res.json({ ok: true, logoUrl: result.secure_url });
    });
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (e) {
    res.status(500).json({ message: "Upload failed" });
  }
});

// Delete current school's logo
router.delete("/logo", requireSchoolAdmin, async (req, res) => {
  try {
    const s = await School.findById(req.admin.schoolId);
    if (!s) return res.status(404).json({ message: "School not found" });
    if (s.logoPublicId) {
      await cloudinary.uploader.destroy(s.logoPublicId);
    }
    s.logoUrl = undefined;
    s.logoPublicId = undefined;
    await s.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Delete failed" });
  }
});


export default router;
