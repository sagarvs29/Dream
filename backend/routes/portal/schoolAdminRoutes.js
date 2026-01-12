import express from "express";
import bcrypt from "bcryptjs";
import Student from "../../models/Student.js";
import Teacher from "../../models/Teacher.js";
import TeacherAttendance from "../../models/TeacherAttendance.js";
import TeacherFeedback from "../../models/TeacherFeedback.js";
import Approval from "../../models/Approval.js";
import Blacklist from "../../models/Blacklist.js";
import AttendanceLog from "../../models/AttendanceLog.js";
import ReportCard from "../../models/ReportCard.js";
import { buildRoll, classCodeFor } from "../../utils/rollNumber.js";
import AuditLog from "../../models/AuditLog.js";
import School from "../../models/School.js";
import { requireSchoolAdmin } from "../../middleware/adminAuth.js";
import multer from "multer";
import cloudinary from "../../utils/cloudinary.js";
import streamifier from "streamifier";
import ConnectionRequest from "../../models/ConnectionRequest.js";
import Connection from "../../models/Connection.js";
import Notification from "../../models/Notification.js";
import { buildStudentAttendanceCsv, buildTeacherAttendanceCsv, buildStudentAttendancePdf, buildTeacherAttendancePdf } from "../../utils/attendanceReport.js";
import Contribution from "../../models/Contribution.js";
import Timetable from "../../models/Timetable.js";

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
  // Generate roll number if not already assigned
  if (!s.rollNumber) {
    const school = await School.findById(req.admin.schoolId).lean();
    const prefix = school?.schoolRollPrefix || "SCH";
    const startYear = s.admissionYear;
    const clsCode = classCodeFor(s.classLevel || s.department);
    // Determine next sequence for year+class within school
    const rx = new RegExp(`^${prefix}-\\d{4}-${clsCode}-(\\d{3})$`);
    const existing = await Student.find({ school: req.admin.schoolId, admissionYear: startYear, classLevel: s.classLevel, rollNumber: { $regex: rx } })
      .select("rollNumber").lean();
    let maxSeq = 0;
    for (const r of existing) {
      const m = String(r.rollNumber||'').match(/(\d{3})$/);
      if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
    }
    const nextSeq = maxSeq + 1;
    s.rollNumber = buildRoll(prefix, startYear, s.classLevel || clsCode, nextSeq);
  }
  s.status = "Approved";
  await s.save();
  await Approval.create({ student: s._id, admin: req.admin.sub, status: "Approved", remarks });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "ApproveStudent", entityType: "Student", entityId: String(s._id), meta: { remarks } });
  res.json({ ok: true });
});
// Remove student permanently and blacklist credentials
router.delete("/students/:id", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const s = await Student.findOne({ _id: id, school: req.admin.schoolId });
    if (!s) return res.status(404).json({ message: "Student not found" });
    // Blacklist email/phone
    await Blacklist.updateOne(
      { school: req.admin.schoolId, $or: [{ email: s.email }, { phone: s.phone }] },
      { $set: { school: req.admin.schoolId, email: s.email, phone: s.phone, reason: "Removed by admin" } },
      { upsert: true }
    );
    // Remove attendance records referencing this student
    await AttendanceLog.updateMany(
      { school: req.admin.schoolId, "records.student": s._id },
      { $pull: { records: { student: s._id } } }
    );
    // Remove report cards
    await ReportCard.deleteMany({ school: req.admin.schoolId, student: s._id });
    // TODO: fees cleanup when integrated
    await Student.deleteOne({ _id: s._id });
    await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "DeleteStudent", entityType: "Student", entityId: String(s._id) });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to remove student", error: e.message });
  }
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

// Payroll list (basic summary)
router.get("/teachers/payroll", requireSchoolAdmin, async (req, res) => {
  try {
    const list = await Teacher.find({ school: req.admin.schoolId })
      .select("name email employeeId department designation classes subjects joiningDate backgroundVerified salary")
      .sort({ name: 1 });
    const rows = list.map(t => ({
      id: t._id,
      name: t.name,
      employeeId: t.employeeId,
      department: t.department,
      subjects: t.subjects || [],
      classes: t.classes || [],
      joiningDate: t.joiningDate,
      backgroundVerified: !!t.backgroundVerified,
      salary: {
        monthlySalary: Number(t.salary?.monthlySalary || 0),
        paidAmount: Number(t.salary?.paidAmount || 0),
        status: t.salary?.status || "Pending",
        lastPaymentDate: t.salary?.lastPaymentDate || null,
      },
    }));
    res.json({ teachers: rows });
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch payroll", error: e.message });
  }
});

// Record salary payment
router.post("/teachers/:id/payments", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method, receiptNo, notes, month, year, date } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "amount must be > 0" });
    const t = await Teacher.findOne({ _id: id, school: req.admin.schoolId });
    if (!t) return res.status(404).json({ message: "Teacher not found" });
    t.salary = t.salary || {};
    const payment = {
      amount: Number(amount),
      method: method || "Cash",
      receiptNo,
      notes,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      date: date ? new Date(date) : new Date(),
    };
    t.salary.payments = Array.isArray(t.salary.payments) ? t.salary.payments : [];
    t.salary.payments.push(payment);
    t.salary.paidAmount = Number(t.salary.paidAmount || 0) + Number(amount);
    t.salary.lastPaymentDate = payment.date;
    const monthly = Number(t.salary.monthlySalary || 0);
    if (t.salary.paidAmount <= 0 && monthly > 0) t.salary.status = "Pending";
    else if (t.salary.paidAmount > 0 && t.salary.paidAmount < monthly) t.salary.status = "Partial";
    else if (t.salary.paidAmount >= monthly && monthly > 0) t.salary.status = "Paid";
    await t.save();
    res.status(201).json({ ok: true, payment, teacher: t });
  } catch (e) {
    res.status(500).json({ message: "Failed to record payment", error: e.message });
  }
});

// Toggle background verification
router.post("/teachers/:id/background-verify", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { verified, notes } = req.body || {};
    const t = await Teacher.findOne({ _id: id, school: req.admin.schoolId });
    if (!t) return res.status(404).json({ message: "Teacher not found" });
    if (typeof verified === 'boolean') t.backgroundVerified = verified;
    if (notes !== undefined) t.verificationNotes = notes;
    t.lastUpdatedBy = req.admin.sub;
    await t.save();
    res.json({ ok: true, teacher: t });
  } catch (e) {
    res.status(500).json({ message: "Failed to update verification", error: e.message });
  }
});

// Record teacher attendance for a date
router.post("/teachers/:id/attendance", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status } = req.body || {};
    if (!status) return res.status(400).json({ message: "status is required" });
    const t = await Teacher.findOne({ _id: id, school: req.admin.schoolId });
    if (!t) return res.status(404).json({ message: "Teacher not found" });
    const d = date ? new Date(date) : new Date();
    const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    await TeacherAttendance.updateOne(
      { school: req.admin.schoolId, teacher: t._id, date: norm },
      { $set: { status, markedBy: req.admin.sub } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to record attendance", error: e.message });
  }
});

// Monthly attendance summary
router.get("/teachers/:id/attendance-summary", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);
    const t = await Teacher.findOne({ _id: id, school: req.admin.schoolId });
    if (!t) return res.status(404).json({ message: "Teacher not found" });
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const agg = await TeacherAttendance.aggregate([
      { $match: { school: req.admin.schoolId, teacher: t._id, date: { $gte: start, $lte: end } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const summary = { Present: 0, Absent: 0, Late: 0, Excused: 0 };
    for (const r of agg) summary[r._id] = r.count;
    res.json({ year, month, summary });
  } catch (e) {
    res.status(500).json({ message: "Failed to load summary", error: e.message });
  }
});

// Feedback list
router.get("/teachers/:id/feedback", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const t = await Teacher.findOne({ _id: id, school: req.admin.schoolId }).select("_id");
    if (!t) return res.status(404).json({ message: "Teacher not found" });
    const list = await TeacherFeedback.find({ school: req.admin.schoolId, teacher: t._id }).sort({ createdAt: -1 }).lean();
    res.json({ feedback: list });
  } catch (e) {
    res.status(500).json({ message: "Failed to load feedback", error: e.message });
  }
});

// ==================== STUDENT ATTENDANCE ====================
// Helper: build classCode from classLevel-section
function getClassCodeFromStudent(s) {
  const cls = s.classLevel || "Unassigned";
  const sec = s.section || "NA";
  return `${cls}-${sec}`;
}

// List class attendance log for a date
// GET /api/school/attendance/class/:classCode?date=YYYY-MM-DD
router.get("/attendance/class/:classCode", requireSchoolAdmin, async (req, res) => {
  try {
    const { classCode } = req.params;
    const d = req.query.date ? new Date(req.query.date) : new Date();
    const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let log = await AttendanceLog.findOne({ school: req.admin.schoolId, classCode, date: norm }).lean();
    // If no log yet, prefill students of this class
    if (!log) {
      const [cls, sec] = classCode.split("-");
      const students = await Student.find({ school: req.admin.schoolId, status: "Approved", classLevel: cls, section: sec === 'NA' ? undefined : sec })
        .select("name rollNumber classLevel section")
        .sort({ rollNumber: 1 })
        .lean();
      const rows = students.map(s => ({ id: s._id, name: s.name, rollNumber: s.rollNumber, status: "Present" }));
      return res.json({ date: norm.toISOString().slice(0,10), finalized: false, records: rows });
    }
    const ids = (log.records || []).map(r => r.student);
    const students = await Student.find({ _id: { $in: ids } }).select("name rollNumber").lean();
    const m = new Map(students.map(s => [String(s._id), s]));
    const rows = (log.records || []).map(r => ({ id: r.student, name: m.get(String(r.student))?.name || "", rollNumber: m.get(String(r.student))?.rollNumber || "", status: r.status }));
    res.json({ date: norm.toISOString().slice(0,10), finalized: !!log.finalized, records: rows });
  } catch (e) {
    res.status(500).json({ message: "Failed to load class attendance", error: e.message });
  }
});

// Mark attendance for a student
// POST /api/school/attendance/class/:classCode/mark { date, studentId, status }
router.post("/attendance/class/:classCode/mark", requireSchoolAdmin, async (req, res) => {
  try {
    const { classCode } = req.params;
    const { date, studentId, status } = req.body || {};
    if (!studentId || !status) return res.status(400).json({ message: "studentId and status are required" });
    const d = date ? new Date(date) : new Date();
    const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const s = await Student.findOne({ _id: studentId, school: req.admin.schoolId });
    if (!s) return res.status(404).json({ message: "Student not found" });
    // Create or update log
    let log = await AttendanceLog.findOne({ school: req.admin.schoolId, classCode, date: norm });
    if (!log) {
      log = await AttendanceLog.create({ school: req.admin.schoolId, classCode, date: norm, records: [] });
    }
    const idx = (log.records || []).findIndex(r => String(r.student) === String(studentId));
    if (idx >= 0) {
      log.records[idx].status = status;
    } else {
      log.records.push({ student: s._id, status, markedAt: new Date(), markedBy: req.admin.sub });
    }
    await log.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to mark", error: e.message });
  }
});

// Finalize attendance for a class/date
router.post("/attendance/class/:classCode/finalize", requireSchoolAdmin, async (req, res) => {
  try {
    const { classCode } = req.params;
    const d = req.body?.date ? new Date(req.body.date) : new Date();
    const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const log = await AttendanceLog.findOne({ school: req.admin.schoolId, classCode, date: norm });
    if (!log) return res.status(404).json({ message: "Log not found" });
    log.finalized = true;
    log.finalizedAt = new Date();
    log.finalizedBy = req.admin.sub;
    await log.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to finalize", error: e.message });
  }
});

// Monthly summary for students per class
// GET /api/school/attendance/students/monthly-summary?classCode=&year=&month=
router.get("/attendance/students/monthly-summary", requireSchoolAdmin, async (req, res) => {
  try {
    const { classCode } = req.query;
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const logs = await AttendanceLog.aggregate([
      { $match: { school: req.admin.schoolId, classCode, date: { $gte: start, $lte: end } } },
      { $unwind: "$records" },
      { $group: { _id: { student: "$records.student" }, Present: { $sum: { $cond: [{ $eq: ["$records.status", "Present"] }, 1, 0] } }, Absent: { $sum: { $cond: [{ $eq: ["$records.status", "Absent"] }, 1, 0] } }, Late: { $sum: { $cond: [{ $eq: ["$records.status", "Late"] }, 1, 0] } }, Excused: { $sum: { $cond: [{ $eq: ["$records.status", "Excused"] }, 1, 0] } } } },
      { $sort: { "_id.student": 1 } }
    ]);
    const ids = logs.map(x => x._id.student);
    const students = await Student.find({ _id: { $in: ids } }).select("name rollNumber").lean();
    const m = new Map(students.map(s => [String(s._id), s]));
    const summary = logs.map(x => ({ id: x._id.student, name: m.get(String(x._id.student))?.name || "", rollNumber: m.get(String(x._id.student))?.rollNumber || "", Present: x.Present, Absent: x.Absent, Late: x.Late, Excused: x.Excused }));
    res.json({ year, month, summary });
  } catch (e) {
    res.status(500).json({ message: "Failed to load monthly summary", error: e.message });
  }
});

// Export attendance sheets
// Students CSV/PDF
router.get("/attendance/export/students", requireSchoolAdmin, async (req, res) => {
  try {
    const { classCode, date, format } = req.query;
    if (!classCode || !date) return res.status(400).json({ message: "classCode and date are required" });
    if (format === 'pdf') {
      const doc = await buildStudentAttendancePdf(req.admin.schoolId, classCode, date);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=attendance-${classCode}-${date}.pdf`);
      doc.pipe(res);
    } else {
      const csv = await buildStudentAttendanceCsv(req.admin.schoolId, classCode, date);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=attendance-${classCode}-${date}.csv`);
      res.status(200).send(csv);
    }
  } catch (e) {
    res.status(500).json({ message: "Failed to export", error: e.message });
  }
});

// Teachers CSV/PDF
router.get("/attendance/export/teachers", requireSchoolAdmin, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);
    const format = req.query.format;
    if (format === 'pdf') {
      const doc = await buildTeacherAttendancePdf(req.admin.schoolId, year, month);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=teacher-attendance-${month}-${year}.pdf`);
      doc.pipe(res);
    } else {
      const csv = await buildTeacherAttendanceCsv(req.admin.schoolId, year, month);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=teacher-attendance-${month}-${year}.csv`);
      res.status(200).send(csv);
    }
  } catch (e) {
    res.status(500).json({ message: "Failed to export", error: e.message });
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
      teacher.passwordChangedAt = new Date();
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
      teacher.passwordChangedAt = new Date();
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

// ==================== TRUSTEES & CONTRIBUTIONS ====================
// Trustees CRUD (embedded in School)
router.get("/trustees", requireSchoolAdmin, async (req, res) => {
  const s = await School.findById(req.admin.schoolId).select("trustees");
  if (!s) return res.status(404).json({ message: "School not found" });
  res.json({ trustees: s.trustees || [] });
});

router.post("/trustees", requireSchoolAdmin, async (req, res) => {
  const s = await School.findById(req.admin.schoolId).select("trustees");
  if (!s) return res.status(404).json({ message: "School not found" });
  const t = {
    name: req.body?.name,
    title: req.body?.title,
    photoUrl: req.body?.photoUrl,
    bio: req.body?.bio,
    sinceYear: req.body?.sinceYear ? Number(req.body.sinceYear) : undefined,
    contactEmail: req.body?.contactEmail,
    contactPhone: req.body?.contactPhone,
    notes: req.body?.notes,
    involvement: req.body?.involvement || {},
  };
  s.trustees = Array.isArray(s.trustees) ? s.trustees : [];
  s.trustees.push(t);
  await s.save();
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "AddTrustee", entityType: "School", entityId: String(s._id), meta: { name: t.name } });
  res.status(201).json({ trustee: s.trustees[s.trustees.length - 1] });
});

router.patch("/trustees/:id", requireSchoolAdmin, async (req, res) => {
  const s = await School.findById(req.admin.schoolId).select("trustees");
  if (!s) return res.status(404).json({ message: "School not found" });
  const { id } = req.params;
  const idx = (s.trustees || []).findIndex(x => String(x._id) === String(id));
  if (idx < 0) return res.status(404).json({ message: "Trustee not found" });
  const cur = s.trustees[idx];
  const payload = req.body || {};
  cur.name = payload.name ?? cur.name;
  cur.title = payload.title ?? cur.title;
  cur.photoUrl = payload.photoUrl ?? cur.photoUrl;
  cur.bio = payload.bio ?? cur.bio;
  cur.sinceYear = payload.sinceYear != null ? Number(payload.sinceYear) : cur.sinceYear;
  cur.contactEmail = payload.contactEmail ?? cur.contactEmail;
  cur.contactPhone = payload.contactPhone ?? cur.contactPhone;
  cur.notes = payload.notes ?? cur.notes;
  cur.involvement = payload.involvement ?? cur.involvement;
  await s.save();
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "UpdateTrustee", entityType: "School", entityId: String(s._id), meta: { trusteeId: id } });
  res.json({ trustee: s.trustees[idx] });
});

router.delete("/trustees/:id", requireSchoolAdmin, async (req, res) => {
  const s = await School.findById(req.admin.schoolId).select("trustees");
  if (!s) return res.status(404).json({ message: "School not found" });
  const { id } = req.params;
  const idx = (s.trustees || []).findIndex(x => String(x._id) === String(id));
  if (idx < 0) return res.status(404).json({ message: "Trustee not found" });
  s.trustees.splice(idx, 1);
  await s.save();
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "DeleteTrustee", entityType: "School", entityId: String(s._id), meta: { trusteeId: id } });
  res.json({ ok: true });
});

// Contributions CRUD
router.get("/contributions", requireSchoolAdmin, async (req, res) => {
  const { sourceType, type } = req.query;
  const q = { school: req.admin.schoolId };
  if (sourceType) q.sourceType = sourceType;
  if (type) q.type = type;
  const list = await Contribution.find(q).sort({ date: -1, createdAt: -1 }).lean();
  res.json({ contributions: list });
});

router.post("/contributions", requireSchoolAdmin, async (req, res) => {
  const { sourceType, sourceName, trusteeId, type, amount, resourceDescription, notes, date } = req.body || {};
  if (!sourceType || !type) return res.status(400).json({ message: "sourceType and type are required" });
  const c = await Contribution.create({
    school: req.admin.schoolId,
    sourceType,
    sourceName,
    trusteeId,
    type,
    amount: amount != null ? Number(amount) : undefined,
    resourceDescription,
    notes,
    date: date ? new Date(date) : new Date(),
    recordedBy: req.admin.sub,
  });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "AddContribution", entityType: "Contribution", entityId: String(c._id), meta: { sourceType, type, amount } });
  res.status(201).json({ contribution: c });
});

router.patch("/contributions/:id", requireSchoolAdmin, async (req, res) => {
  const { id } = req.params;
  const update = req.body || {};
  if (update.amount != null) update.amount = Number(update.amount);
  if (update.date) update.date = new Date(update.date);
  const c = await Contribution.findOneAndUpdate({ _id: id, school: req.admin.schoolId }, { $set: update }, { new: true });
  if (!c) return res.status(404).json({ message: "Contribution not found" });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "UpdateContribution", entityType: "Contribution", entityId: String(c._id) });
  res.json({ contribution: c });
});

router.delete("/contributions/:id", requireSchoolAdmin, async (req, res) => {
  const { id } = req.params;
  const c = await Contribution.findOne({ _id: id, school: req.admin.schoolId });
  if (!c) return res.status(404).json({ message: "Contribution not found" });
  await Contribution.deleteOne({ _id: id });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "DeleteContribution", entityType: "Contribution", entityId: String(id) });
  res.json({ ok: true });
});

// Academic Structure metrics for a given academic year
// GET /api/school/academic-structure?year=2026
router.get("/academic-structure", requireSchoolAdmin, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    // Define active students for the selected year
    const activeBase = {
      school: req.admin.schoolId,
      status: "Approved",
      admissionYear: { $lte: year },
      $or: [
        { exitStatus: { $exists: false } },
        { exitStatusYear: { $gt: year } },
      ],
    };

    const [totalStudents, newAdmissions, existingStudents] = await Promise.all([
      Student.countDocuments(activeBase),
      Student.countDocuments({ ...activeBase, admissionYear: year }),
      Student.countDocuments({ ...activeBase, admissionYear: { $lt: year } }),
    ]);

    // Year-isolated lifecycle metrics
    const [dropouts, transfers] = await Promise.all([
      Student.countDocuments({ school: req.admin.schoolId, exitStatus: "Dropout", exitStatusYear: year }),
      Student.countDocuments({ school: req.admin.schoolId, exitStatus: "Transfer", exitStatusYear: year }),
    ]);

    // Class-wise strength using optional classLevel; group unknowns under "Unassigned"
    const classAgg = await Student.aggregate([
      { $match: activeBase },
      // Find assignment for selected year if available
      { $addFields: { assignForYear: { $first: { $filter: { input: "$classAssignments", as: "a", cond: { $eq: ["$$a.year", year] } } } } } },
      { $group: { _id: { $ifNull: ["$assignForYear.classLevel", { $ifNull: ["$classLevel", { $ifNull: ["$department", "Unassigned"] }] }] }, count: { $sum: 1 } } },
    ]);
    const CLASS_ORDER = ["LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"]; // extendable later
    const classStrength = Object.fromEntries(CLASS_ORDER.map(k => [k, 0]));
    // Normalize common variants like "10th", "Class 10", "Std 10" to canonical numeric
    const normalizeClass = (key) => {
      const k = String(key || "").trim();
      if (k === "LKG" || k === "UKG") return k;
      const m = k.match(/(\d{1,2})/); // first number in the string
      if (m) return m[1];
      return k;
    };
    let unassignedCount = 0;
    for (const r of classAgg) {
      const rawKey = String(r._id);
      const key = normalizeClass(rawKey);
      if (CLASS_ORDER.includes(key)) classStrength[key] = (classStrength[key] || 0) + r.count;
      else if (key === "Unassigned") unassignedCount += r.count;
      else classStrength[key] = (classStrength[key] || 0) + r.count; // allow custom levels
    }
    if (unassignedCount > 0) classStrength["Unassigned"] = unassignedCount;

    // Section-wise breakup using optional section
    const sectionAgg = await Student.aggregate([
      { $match: activeBase },
      { $addFields: { assignForYear: { $first: { $filter: { input: "$classAssignments", as: "a", cond: { $eq: ["$$a.year", year] } } } } } },
      { $group: { _id: { $ifNull: ["$assignForYear.section", { $ifNull: ["$section", "Unassigned"] }] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const sections = sectionAgg.map(r => ({ section: r._id, count: r.count }));

    // Discrepancy warnings
    const classSum = Object.values(classStrength).reduce((s, v) => s + Number(v || 0), 0);
    const warnings = [];
    if (classSum !== totalStudents) {
      warnings.push({ severity: "warning", code: "COUNT_MISMATCH", message: `Class-wise sum (${classSum}) does not equal total students (${totalStudents}) for ${year}.` });
    }
    if (sections.find(s => s.section === "Unassigned")) {
      const unassigned = sections.find(s => s.section === "Unassigned").count;
      if (unassigned > 0) warnings.push({ severity: "info", code: "UNASSIGNED_SECTION", message: `${unassigned} students have no section for ${year}.` });
    }

    return res.json({
      year,
      totalStudents,
      newAdmissions,
      existingStudents,
      dropouts,
      transfers,
      classStrength,
      sections,
      warnings,
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load academic structure", error: e.message });
  }
});

// Academic configuration endpoints
router.get("/academic-config", requireSchoolAdmin, async (req, res) => {
  const school = await School.findById(req.admin.schoolId).lean();
  const defaultClasses = ["LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"];
  const defaultSections = ["A","B","C"];
  res.json({
    classes: Array.isArray(school?.classConfig) && school.classConfig.length ? school.classConfig : defaultClasses,
    sections: Array.isArray(school?.sectionsConfig) && school.sectionsConfig.length ? school.sectionsConfig : defaultSections,
    workflowState: school?.workflowState || {},
  });
});

router.patch("/academic-config", requireSchoolAdmin, async (req, res) => {
  const { classes, sections, workflowState, admissionsToggle } = req.body || {};
  const update = {};
  if (Array.isArray(classes)) update.classConfig = classes.filter(Boolean);
  if (Array.isArray(sections)) update.sectionsConfig = sections.filter(Boolean);
  if (workflowState && typeof workflowState === "object") update.workflowState = workflowState;
  if (admissionsToggle && typeof admissionsToggle === 'object') {
    // admissionsToggle: { year: 2026, enabled: true/false }
    const year = Number(admissionsToggle.year);
    if (Number.isFinite(year)) {
      const school = await School.findById(req.admin.schoolId);
      const arr = Array.isArray(school.admissionsByYear) ? school.admissionsByYear : [];
      const idx = arr.findIndex(a => Number(a.year) === year);
      if (idx >= 0) arr[idx].enabled = !!admissionsToggle.enabled; else arr.push({ year, enabled: !!admissionsToggle.enabled });
      update.admissionsByYear = arr;
    }
  }
  const school = await School.findOneAndUpdate({ _id: req.admin.schoolId }, { $set: update }, { new: true });
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "UpdateAcademicConfig", entityType: "School", entityId: String(req.admin.schoolId), meta: update });
  res.json({ ok: true });
});

// Drill-down list for a class/section
router.get("/academic-structure/drilldown", requireSchoolAdmin, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const { classLevel, section } = req.query;
    const activeBase = {
      school: req.admin.schoolId,
      status: "Approved",
      admissionYear: { $lte: year },
      $or: [
        { exitStatus: { $exists: false } },
        { exitStatusYear: { $gt: year } },
      ],
    };
    const pipeline = [
      { $match: activeBase },
      { $addFields: { assignForYear: { $first: { $filter: { input: "$classAssignments", as: "a", cond: { $eq: ["$$a.year", year] } } } } } },
    ];
    const filters = [];
    if (classLevel) {
      filters.push({ $or: [
        { "assignForYear.classLevel": classLevel },
        { classLevel },
        { department: classLevel },
      ] });
    }
    if (section) {
      filters.push({ $or: [
        { "assignForYear.section": section },
        { section },
      ] });
    }
    if (filters.length) pipeline.push({ $match: { $and: filters } });
    pipeline.push({ $project: { name: 1, rollNumber: 1, classLevel: 1, section: 1, assignForYear: 1 } });
    pipeline.push({ $sort: { name: 1 } });
    const list = await Student.aggregate(pipeline);
    res.json({ year, students: list });
  } catch (e) {
    res.status(500).json({ message: "Failed to load drilldown", error: e.message });
  }
});

// Students Management listing with metrics and filters
// GET /api/school/students/manage?year=2026&filter=pendingFees|lowAttendance|highPerformers&q=search
router.get("/students/manage", requireSchoolAdmin, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const { filter, q, classLevel: classLevelParam, section: sectionParam, status, roll } = req.query;
    const baseQuery = { school: req.admin.schoolId };
    if (status) baseQuery.status = status; else baseQuery.status = "Approved";
    if (q) {
      const rx = new RegExp(q, "i");
      baseQuery.$or = [{ name: rx }, { email: rx }, { rollNumber: rx }, { classLevel: rx }, { section: rx }];
    }
    if (roll) {
      baseQuery.rollNumber = new RegExp(String(roll), "i");
    }
    // Optional class-wise and section-wise filtering
    if (classLevelParam) {
      const cls = String(classLevelParam).trim();
      const orClauses = Array.isArray(baseQuery.$or) ? [...baseQuery.$or] : [];
      if (cls === "LKG" || cls === "UKG") {
        const exact = new RegExp(`^${cls}$`, "i");
        orClauses.push({ classLevel: exact });
        orClauses.push({ department: exact });
      } else {
        // Match common variants like "Class 10", "10th", "Std 10", or just "10"
        const digits = cls.match(/\d{1,2}/);
        const n = digits ? digits[0] : cls;
        const byNumber = new RegExp(`(^|[^\\d])${n}([^\\d]|$)`, "i");
        orClauses.push({ classLevel: byNumber });
        orClauses.push({ department: byNumber });
      }
      baseQuery.$or = orClauses;
    }
    if (sectionParam) {
      baseQuery.section = new RegExp(String(sectionParam).trim(), "i");
    }
    const students = await Student.find(baseQuery)
      .select("name email rollNumber classLevel section parentDetails admissionYear admissionDate fee attendancePct performanceScore teacherRemarks")
      .sort({ name: 1 })
      .limit(300);

    // Helper to compute attendance % from AttendanceLog
    async function computeAttendancePct(studentId) {
      const agg = await AttendanceLog.aggregate([
        { $match: { school: req.admin.schoolId } },
        { $unwind: "$records" },
        { $match: { "records.student": studentId } },
        { $group: { _id: null, total: { $sum: 1 }, absences: { $sum: { $cond: [{ $eq: ["$records.status", "Absent"] }, 1, 0] } } } },
      ]);
      const rec = agg[0];
      if (!rec || rec.total === 0) return undefined;
      const present = rec.total - rec.absences;
      return Math.round((present / rec.total) * 1000) / 10; // one decimal
    }

    // Helper to compute performance score from ReportCard
    async function computePerformanceScore(studentId) {
      const agg = await ReportCard.aggregate([
        { $match: { school: req.admin.schoolId, student: studentId } },
        { $group: { _id: "$student", avgScore: { $avg: "$aggregateScore" } } },
      ]);
      const rec = agg[0];
      if (!rec || rec.avgScore == null) return undefined;
      return Math.round(rec.avgScore * 10) / 10; // one decimal
    }

    // Enrich and apply filters
    const enriched = [];
    for (const s of students) {
      const attendancePct = typeof s.attendancePct === 'number' ? s.attendancePct : await computeAttendancePct(s._id);
      const performanceScore = typeof s.performanceScore === 'number' ? s.performanceScore : await computePerformanceScore(s._id);
      const feeStatus = s.fee?.status || "Pending";
      const due = Number(s.fee?.dueAmount || 0);
      const paid = Number(s.fee?.paidAmount || 0);
      const pendingFees = feeStatus !== "Paid" || due > paid;
      const lowAttendance = typeof attendancePct === 'number' ? attendancePct < 75 : false;
      const highPerformers = typeof performanceScore === 'number' ? performanceScore >= 85 : false;

      const item = {
        id: s._id,
        name: s.name,
        rollNumber: s.rollNumber,
        classLevel: s.classLevel,
        section: s.section,
        parentDetails: s.parentDetails || {},
        admissionYear: s.admissionYear,
        admissionDate: s.admissionDate,
        fee: s.fee || {},
        attendancePct,
        performanceScore,
        teacherRemarks: s.teacherRemarks || "",
        flags: { pendingFees, lowAttendance, highPerformers },
      };

      // Apply filter if requested
      if (filter === 'pendingFees' && !pendingFees) continue;
      if (filter === 'lowAttendance' && !lowAttendance) continue;
      if (filter === 'highPerformers' && !highPerformers) continue;
      enriched.push(item);
    }

    res.json({ year, students: enriched });
  } catch (e) {
    res.status(500).json({ message: "Failed to load students", error: e.message });
  }
});

// Update student management fields
// PATCH /api/school/students/:id/manage
router.patch("/students/:id/manage", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const s = await Student.findOne({ _id: id, school: req.admin.schoolId });
    if (!s) return res.status(404).json({ message: "Student not found" });

    const {
      classLevel, section,
      parentDetails,
      admissionDate,
      fee,
      teacherRemarks,
    } = req.body || {};

    // Validate parent contact when provided: must be exactly 10 digits
    if (parentDetails && parentDetails.contact !== undefined) {
      const justDigits = String(parentDetails.contact || "").replace(/\D/g, "");
      if (justDigits && justDigits.length !== 10) {
        return res.status(400).json({ message: "Parent contact must be a 10-digit number" });
      }
      // normalize to digits
      parentDetails.contact = justDigits || undefined;
    }

    if (classLevel !== undefined) s.classLevel = classLevel;
    if (section !== undefined) s.section = section;
    if (parentDetails !== undefined) s.parentDetails = parentDetails;
    if (admissionDate !== undefined) s.admissionDate = admissionDate ? new Date(admissionDate) : undefined;
    if (fee !== undefined) s.fee = {
      plan: fee?.plan,
      status: fee?.status,
      dueAmount: Number(fee?.dueAmount || 0),
      paidAmount: Number(fee?.paidAmount || 0),
    };
    if (teacherRemarks !== undefined) s.teacherRemarks = teacherRemarks;

    await s.save();
    res.json({ ok: true, student: s });
  } catch (e) {
    res.status(500).json({ message: "Failed to update", error: e.message });
  }
});

router.put("/update", requireSchoolAdmin, async (req, res) => {
  const { name, address, contactEmail, logoUrl,
    principalName, principalEmail, principalPhone, heads, website, about,
    establishmentYear, vision, history, founders, trustees, photos, alumni, recognitions } = req.body || {};
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
  if (establishmentYear !== undefined) s.establishmentYear = Number(establishmentYear) || undefined;
  if (vision !== undefined) s.vision = vision;
  if (history !== undefined) s.history = history;
  if (founders !== undefined) s.founders = Array.isArray(founders) ? founders : [founders].filter(Boolean);
  if (trustees !== undefined) s.trustees = Array.isArray(trustees) ? trustees : [trustees].filter(Boolean);
  if (photos !== undefined) s.photos = Array.isArray(photos) ? photos : [photos].filter(Boolean);
  if (alumni !== undefined) s.alumni = Array.isArray(alumni) ? alumni : [alumni].filter(Boolean);
  if (recognitions !== undefined) s.recognitions = Array.isArray(recognitions) ? recognitions : [recognitions].filter(Boolean);
  await s.save();
  await AuditLog.create({ actorId: req.admin.sub, actorRole: "SCHOOL", action: "UpdateSchool", entityType: "School", entityId: String(s._id), meta: { name, address, contactEmail, principalName, establishmentYear: s.establishmentYear } });
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


// ==================== REPORTS & INSIGHTS (AI-ready) ====================
// GET /api/school/reports/insights?year=2026
router.get("/reports/insights", requireSchoolAdmin, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const schoolId = req.admin.schoolId;
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    // 1) Class performance using ReportCard.aggregateScore (fallback handled on UI if empty)
    const classPerformance = await ReportCard.aggregate([
      { $match: { school: schoolId, createdAt: { $gte: start, $lte: end } } },
      { $lookup: { from: "students", localField: "student", foreignField: "_id", as: "stu" } },
      { $unwind: "$stu" },
      { $match: { "stu.school": schoolId } },
      {
        $project: {
          aggregateScore: 1,
          classCode: {
            $concat: [
              { $ifNull: ["$stu.classLevel", "Unassigned"] },
              "-",
              { $ifNull: ["$stu.section", "NA"] }
            ]
          }
        }
      },
      { $group: { _id: "$classCode", avgScore: { $avg: "$aggregateScore" }, count: { $sum: 1 } } },
      { $project: { _id: 0, classCode: "$_id", avgScore: { $round: ["$avgScore", 1] }, count: 1 } },
      { $sort: { avgScore: -1 } }
    ]);

    // 2) Attendance per class (students) for the year
    const classAttendance = await AttendanceLog.aggregate([
      { $match: { school: schoolId, date: { $gte: start, $lte: end } } },
      { $unwind: "$records" },
      { $group: { _id: "$classCode", total: { $sum: 1 }, absences: { $sum: { $cond: [{ $eq: ["$records.status", "Absent"] }, 1, 0] } } } },
      { $project: { _id: 0, classCode: "$_id", attendancePct: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $multiply: [{ $divide: [{ $subtract: ["$total", "$absences"] }, "$total"] }, 100] }, 1] }, null] } } },
      { $sort: { classCode: 1 } }
    ]);

    // 3) Fee collection trends
    // 3a) Monthly totals for the year
    const monthlyFees = await Student.aggregate([
      { $match: { school: schoolId, status: "Approved" } },
      { $unwind: { path: "$fee.payments", preserveNullAndEmptyArrays: true } },
      { $match: { "fee.payments.date": { $gte: start, $lte: end } } },
      { $group: { _id: { month: { $month: "$fee.payments.date" }, year: { $year: "$fee.payments.date" } }, paidTotal: { $sum: "$fee.payments.amount" }, paymentsCount: { $sum: 1 } } },
      { $project: { _id: 0, month: "$_id.month", year: "$_id.year", paidTotal: { $round: ["$paidTotal", 2] }, paymentsCount: 1 } },
      { $sort: { month: 1 } }
    ]);

    // 3b) By class aggregated totals & pending across all students
    const feesByClass = await Student.aggregate([
      { $match: { school: schoolId, status: "Approved" } },
      {
        $project: {
          classCode: {
            $concat: [
              { $ifNull: ["$classLevel", "Unassigned"] },
              "-",
              { $ifNull: ["$section", "NA"] }
            ]
          },
          totalFee: { $ifNull: ["$fee.totalFee", 0] },
          paidAmount: { $ifNull: ["$fee.paidAmount", 0] },
          status: { $ifNull: ["$fee.status", "Pending"] }
        }
      },
      { $group: { _id: "$classCode", totalFee: { $sum: "$totalFee" }, paidAmount: { $sum: "$paidAmount" }, students: { $sum: 1 }, fullyPaid: { $sum: { $cond: [{ $eq: ["$status", "Paid"] }, 1, 0] } } } },
      { $project: { _id: 0, classCode: "$_id", totalFee: 1, paidAmount: 1, pendingAmount: { $subtract: ["$totalFee", "$paidAmount"] }, students: 1, fullyPaid: 1 } },
      { $sort: { classCode: 1 } }
    ]);

    // Join attendance + performance for correlation view
    const attMap = new Map(classAttendance.map(a => [a.classCode, a]));
    const perfMap = new Map(classPerformance.map(p => [p.classCode, p]));
    const allClassCodes = Array.from(new Set([
      ...classAttendance.map(a => a.classCode),
      ...classPerformance.map(p => p.classCode),
      ...feesByClass.map(f => f.classCode)
    ]));
    const correlation = allClassCodes.map(cc => ({
      classCode: cc,
      attendancePct: attMap.get(cc)?.attendancePct ?? null,
      performanceScore: perfMap.get(cc)?.avgScore ?? null,
    })).sort((a, b) => (Number(b.performanceScore||0) - Number(a.performanceScore||0)) || (Number(b.attendancePct||0) - Number(a.attendancePct||0)));

    // Slice best and improvement-needed classes (top/bottom 3 by performance)
    const sortedPerf = [...classPerformance].sort((a,b)=>Number(b.avgScore||0)-Number(a.avgScore||0));
    const bestPerforming = sortedPerf.slice(0, 3);
    const improvementNeeded = sortedPerf.slice(-3).reverse();

    res.json({
      year,
      bestPerforming,
      improvementNeeded,
      attendanceVsPerformance: correlation,
      feeTrends: { monthly: monthlyFees, byClass: feesByClass },
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load insights", error: e.message });
  }
});

// ==================== CLASS TIMETABLE (School Admin) ====================
// Mirrors institution timetable endpoints but scoped to school admin
router.get("/timetable/:classCode", requireSchoolAdmin, async (req, res) => {
  try {
    const { classCode } = req.params;
    const tt = await Timetable.findOne({ school: req.admin.schoolId, classCode });
    if (!tt) return res.json({ classCode, entries: [] });
    res.json(tt);
  } catch (e) {
    res.status(500).json({ message: "Failed to load timetable", error: e.message });
  }
});

router.post("/timetable/:classCode/entry", requireSchoolAdmin, async (req, res) => {
  try {
    const { classCode } = req.params;
    const { dayOfWeek, period, subject, room, teacher, notes } = req.body || {};
    if (dayOfWeek == null || !period || !subject) return res.status(400).json({ message: "dayOfWeek, period, subject required" });
    const tt = await Timetable.findOneAndUpdate(
      { school: req.admin.schoolId, classCode },
      { $push: { entries: { dayOfWeek, period, subject, room, teacher, notes, lastUpdatedBy: req.admin.sub } } },
      { upsert: true, new: true }
    );
    res.json(tt);
  } catch (e) {
    res.status(500).json({ message: "Failed to add entry", error: e.message });
  }
});

router.patch("/timetable/:classCode/entry/:entryId", requireSchoolAdmin, async (req, res) => {
  try {
    const { classCode, entryId } = req.params;
    const update = Object.fromEntries(Object.entries(req.body || {}).filter(([k,v]) => ["subject","room","teacher","notes","dayOfWeek","period"].includes(k)));
    const tt = await Timetable.findOne({ school: req.admin.schoolId, classCode });
    if (!tt) return res.status(404).json({ message: "Timetable not found" });
    const entry = tt.entries.id(entryId);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    Object.assign(entry, update, { lastUpdatedBy: req.admin.sub });
    await tt.save();
    res.json(tt);
  } catch (e) {
    res.status(500).json({ message: "Failed to update entry", error: e.message });
  }
});

router.delete("/timetable/:classCode/entry/:entryId", requireSchoolAdmin, async (req, res) => {
  try {
    const { classCode, entryId } = req.params;
    const tt = await Timetable.findOne({ school: req.admin.schoolId, classCode });
    if (!tt) return res.status(404).json({ message: "Timetable not found" });
    tt.entries.id(entryId)?.deleteOne();
    await tt.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to delete entry", error: e.message });
  }
});

export default router;
