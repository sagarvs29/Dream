import express from "express";
import Timetable from "../models/Timetable.js";
import AttendanceLog from "../models/AttendanceLog.js";
import ReportCard from "../models/ReportCard.js";
import Announcement from "../models/Announcement.js";
import Homework from "../models/Homework.js";
import Quiz from "../models/Quiz.js";
import QuizSubmission from "../models/QuizSubmission.js";
import Teacher from "../models/Teacher.js";
import { requireMentor } from "../middleware/mentorAuth.js";
import { requireClassAccess, getClassLevelFromCode } from "../middleware/mentorAccess.js";

const router = express.Router();

// Helper: ensure resource belongs to mentor.school
function ensureSchool(doc, schoolId) {
  if (!doc) return false;
  return String(doc.school) === String(schoolId);
}

// --- Timetable Endpoints ---
router.get("/timetable/:classCode", requireMentor, requireClassAccess, async (req, res) => {
  const { classCode } = req.params;
  const tt = await Timetable.findOne({ school: req.mentor.school, classCode });
  if (!tt) return res.json({ classCode, entries: [] });
  res.json(tt);
});

router.post("/timetable/:classCode/entry", requireMentor, requireClassAccess, async (req, res) => {
  const { classCode } = req.params;
  const { dayOfWeek, period, subject, room, teacher, notes } = req.body || {};
  if (dayOfWeek == null || !period || !subject) return res.status(400).json({ message: "dayOfWeek, period, subject required" });
  const tt = await Timetable.findOneAndUpdate(
    { school: req.mentor.school, classCode },
    { $push: { entries: { dayOfWeek, period, subject, room, teacher, notes, lastUpdatedBy: req.mentor._id } } },
    { upsert: true, new: true }
  );
  res.json(tt);
});

router.patch("/timetable/:classCode/entry/:entryId", requireMentor, requireClassAccess, async (req, res) => {
  const { classCode, entryId } = req.params;
  const update = Object.fromEntries(Object.entries(req.body || {}).filter(([k,v]) => ["subject","room","teacher","notes","dayOfWeek","period"].includes(k)));
  const tt = await Timetable.findOne({ school: req.mentor.school, classCode });
  if (!tt) return res.status(404).json({ message: "Timetable not found" });
  const entry = tt.entries.id(entryId);
  if (!entry) return res.status(404).json({ message: "Entry not found" });
  Object.assign(entry, update, { lastUpdatedBy: req.mentor._id });
  await tt.save();
  res.json(tt);
});

router.delete("/timetable/:classCode/entry/:entryId", requireMentor, requireClassAccess, async (req, res) => {
  const { classCode, entryId } = req.params;
  const tt = await Timetable.findOne({ school: req.mentor.school, classCode });
  if (!tt) return res.status(404).json({ message: "Timetable not found" });
  tt.entries.id(entryId)?.deleteOne();
  await tt.save();
  res.json({ ok: true });
});

// --- Attendance Endpoints ---
router.post("/attendance/:classCode/:date/mark", requireMentor, requireClassAccess, async (req, res) => {
  const { classCode, date } = req.params; // date as YYYY-MM-DD
  const { records } = req.body || {}; // [{ student, status }]
  if (!Array.isArray(records) || records.length === 0) return res.status(400).json({ message: "records array required" });
  const day = new Date(date + "T00:00:00Z");
  const log = await AttendanceLog.findOneAndUpdate(
    { school: req.mentor.school, classCode, date: day },
    { $setOnInsert: { finalized: false }, $push: { records: records.map(r => ({ ...r, markedBy: req.mentor._id })) } },
    { upsert: true, new: true }
  );
  res.json(log);
});

router.get("/attendance/:classCode/:date", requireMentor, requireClassAccess, async (req, res) => {
  const { classCode, date } = req.params;
  const day = new Date(date + "T00:00:00Z");
  const log = await AttendanceLog.findOne({ school: req.mentor.school, classCode, date: day });
  res.json(log || { classCode, date, records: [] });
});

router.patch("/attendance/:classCode/:date/finalize", requireMentor, requireClassAccess, async (req, res) => {
  const { classCode, date } = req.params;
  const day = new Date(date + "T00:00:00Z");
  const log = await AttendanceLog.findOne({ school: req.mentor.school, classCode, date: day });
  if (!log) return res.status(404).json({ message: "Log not found" });
  if (log.finalized) return res.status(400).json({ message: "Already finalized" });
  log.finalized = true;
  log.finalizedAt = new Date();
  log.finalizedBy = req.mentor._id;
  await log.save();
  res.json(log);
});

// Summary (simple monthly absentee list)
router.get("/attendance/summary", requireMentor, requireClassAccess, async (req, res) => {
  const { classCode, month } = req.query; // month = YYYY-MM
  if (!classCode || !month) return res.status(400).json({ message: "classCode & month required" });
  const start = new Date(month + "-01T00:00:00Z");
  const end = new Date(start); end.setMonth(end.getMonth() + 1);
  const logs = await AttendanceLog.find({ school: req.mentor.school, classCode, date: { $gte: start, $lt: end } });
  // Simple aggregate: count absences per student
  const absenceMap = new Map();
  for (const l of logs) {
    for (const r of l.records) {
      if (r.status === "Absent") absenceMap.set(r.student.toString(), (absenceMap.get(r.student.toString()) || 0) + 1);
    }
  }
  res.json({ classCode, month, absences: Array.from(absenceMap.entries()).map(([student, count]) => ({ student, count })) });
});

// --- Report Cards ---
router.post("/report-cards/:studentId/:termId", requireMentor, async (req, res) => {
  const { studentId, termId } = req.params;
  const { subjects, aggregateScore, status } = req.body || {};
  const rc = await ReportCard.findOneAndUpdate(
    { school: req.mentor.school, student: studentId, termId },
    { $set: { subjects, aggregateScore, status: status || "Draft", lastUpdatedBy: req.mentor._id } },
    { upsert: true, new: true }
  );
  res.json(rc);
});

router.get("/report-cards/class/:classCode", requireMentor, requireClassAccess, async (req, res) => {
  const { classCode } = req.params; const { termId } = req.query;
  if (!termId) return res.status(400).json({ message: "termId required" });
  const classLevel = getClassLevelFromCode(classCode);
  // Filter report cards by students in this class (using Student.classLevel + section)
  const studentsInClass = await (await import("../models/Student.js")).default.find({ school: req.mentor.school, classLevel: new RegExp(`^${classLevel}$`, "i") }).select("_id");
  const ids = studentsInClass.map(s => s._id);
  const cards = await ReportCard.find({ school: req.mentor.school, termId, student: { $in: ids } });
  res.json(cards);
});

router.post("/report-cards/:termId/publish", requireMentor, requireClassAccess, async (req, res) => {
  const { termId } = req.params; const { classCode } = req.query;
  const classLevel = getClassLevelFromCode(classCode);
  const studentsInClass = await (await import("../models/Student.js")).default.find({ school: req.mentor.school, classLevel: new RegExp(`^${classLevel}$`, "i") }).select("_id");
  const ids = studentsInClass.map(s => s._id);
  const draftCards = await ReportCard.updateMany({ school: req.mentor.school, termId, student: { $in: ids }, status: { $in: ["Draft","Finalized"] } }, { $set: { status: "Published", publishedAt: new Date() } });
  res.json({ termId, classCode, publishedCount: draftCards.modifiedCount });
});

router.get("/report-cards/status", requireMentor, requireClassAccess, async (req, res) => {
  const { termId, classCode } = req.query;
  if (!termId) return res.status(400).json({ message: "termId required" });
  const classLevel = getClassLevelFromCode(classCode || "");
  const studentsInClass = classCode ? await (await import("../models/Student.js")).default.find({ school: req.mentor.school, classLevel: new RegExp(`^${classLevel}$`, "i") }).select("_id") : [];
  const ids = studentsInClass.map(s => s._id);
  const match = { school: req.mentor.school, termId };
  if (ids.length) match.student = { $in: ids };
  const agg = await ReportCard.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  res.json({ termId, classCode, statusCounts: agg });
});

// --- Announcements ---
router.post("/announcements", requireMentor, async (req, res) => {
  const { scope, classCode, title, body, urgent, audience, publishAt } = req.body || {};
  if (!title || !body) return res.status(400).json({ message: "title & body required" });
  const ann = await Announcement.create({ school: req.mentor.school, scope, classCode, title, body, urgent, audience, publishAt, createdBy: req.mentor._id });
  res.json(ann);
});

router.patch("/announcements/:id", requireMentor, async (req, res) => {
  const { id } = req.params;
  const ann = await Announcement.findById(id);
  if (!ensureSchool(ann, req.mentor.school)) return res.status(404).json({ message: "Not found" });
  if (ann.status === "Published") return res.status(400).json({ message: "Cannot edit published announcement" });
  Object.assign(ann, Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => ["title","body","urgent","audience","publishAt"].includes(k))), { lastUpdatedBy: req.mentor._id });
  await ann.save();
  res.json(ann);
});

router.post("/announcements/:id/publish", requireMentor, async (req, res) => {
  const { id } = req.params;
  const ann = await Announcement.findById(id);
  if (!ensureSchool(ann, req.mentor.school)) return res.status(404).json({ message: "Not found" });
  if (ann.status === "Published") return res.status(400).json({ message: "Already published" });
  ann.status = "Published"; ann.publishedAt = new Date();
  await ann.save();
  res.json(ann);
});

router.get("/announcements", requireMentor, async (req, res) => {
  const { classCode, status } = req.query;
  const q = { school: req.mentor.school };
  if (classCode) q.classCode = classCode;
  if (status) q.status = status;
  const anns = await Announcement.find(q).sort({ createdAt: -1 }).limit(100);
  res.json(anns);
});

export default router;
// --- Homework & Daily Tasks ---
// Create homework for a class (only mentors with access to class)
router.post("/homework/:classCode", requireMentor, requireClassAccess, async (req, res) => {
  try {
    const { classCode } = req.params;
    const { subject, topic, description, deadline } = req.body || {};
    if (!subject || !topic || !deadline) return res.status(400).json({ message: "subject, topic, deadline required" });
    const dl = new Date(deadline);
    if (isNaN(dl.getTime())) return res.status(400).json({ message: "Invalid deadline" });
    const hw = await Homework.create({
      school: req.mentor.school,
      classCode,
      subject,
      topic,
      description: description || "",
      deadline: dl,
      createdBy: req.mentor._id,
      lastUpdatedBy: req.mentor._id,
    });
    res.json(hw);
  } catch (e) {
    res.status(500).json({ message: "Failed to create homework", error: e.message });
  }
});

// List homework for a class (authorized mentor only)
router.get("/homework", requireMentor, requireClassAccess, async (req, res) => {
  try {
    const { classCode, from, to, status } = req.query;
    if (!classCode) return res.status(400).json({ message: "classCode required" });
    const q = { school: req.mentor.school, classCode };
    if (status) q.status = status;
    if (from || to) {
      const range = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      q.deadline = range;
    }
    const list = await Homework.find(q).sort({ deadline: 1, createdAt: -1 }).limit(200);
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: "Failed to list homework", error: e.message });
  }
});

// Edit homework (only creator and only before deadline)
router.patch("/homework/:id", requireMentor, async (req, res) => {
  try {
    const { id } = req.params;
    const hw = await Homework.findById(id);
    if (!hw || String(hw.school) !== String(req.mentor.school)) return res.status(404).json({ message: "Not found" });
    if (String(hw.createdBy) !== String(req.mentor._id)) return res.status(403).json({ message: "Only creator can edit" });
    if (new Date() > new Date(hw.deadline)) return res.status(400).json({ message: "Cannot edit after deadline" });
    const allowed = ["subject","topic","description","deadline","status"];
    Object.assign(hw, Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k))), { lastUpdatedBy: req.mentor._id });
    await hw.save();
    res.json(hw);
  } catch (e) {
    res.status(500).json({ message: "Failed to edit homework", error: e.message });
  }
});

// Delete homework (only creator and only before deadline)
router.delete("/homework/:id", requireMentor, async (req, res) => {
  try {
    const { id } = req.params;
    const hw = await Homework.findById(id);
    if (!hw || String(hw.school) !== String(req.mentor.school)) return res.status(404).json({ message: "Not found" });
    if (String(hw.createdBy) !== String(req.mentor._id)) return res.status(403).json({ message: "Only creator can delete" });
    if (new Date() > new Date(hw.deadline)) return res.status(400).json({ message: "Cannot delete after deadline" });
    await hw.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to delete homework", error: e.message });
  }
});

// --- Quizzes & Assessments ---
// Create quiz for a class (mentor must have class access; optionally subject access)
router.post("/quizzes/:classCode", requireMentor, requireClassAccess, async (req, res) => {
  try {
    const { classCode } = req.params;
    const { subject, title, description, timeLimitMinutes, totalPoints, questions } = req.body || {};
    if (!subject || !title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "subject, title, questions required" });
    }
    const quiz = await Quiz.create({
      school: req.mentor.school,
      classCode,
      subject,
      title,
      description: description || "",
      timeLimitMinutes: Number(timeLimitMinutes||0),
      totalPoints: Number(totalPoints||0),
      questions: questions.map(q => ({
        type: q.type,
        text: q.text,
        options: q.options || [],
        correctAnswer: q.correctAnswer || undefined,
        points: Number(q.points||1),
      })),
      createdBy: req.mentor._id,
      lastUpdatedBy: req.mentor._id,
    });
    res.json(quiz);
  } catch (e) {
    res.status(500).json({ message: "Failed to create quiz", error: e.message });
  }
});

// List quizzes by class (mentor must have class access)
router.get("/quizzes", requireMentor, requireClassAccess, async (req, res) => {
  try {
    const { classCode, subject, status } = req.query;
    if (!classCode) return res.status(400).json({ message: "classCode required" });
    const q = { school: req.mentor.school, classCode };
    if (subject) {
      // Case-insensitive exact match on subject to avoid mismatch issues
      const esc = String(subject).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      q.subject = new RegExp(`^${esc}$`, 'i');
    }
    if (status) q.status = status;
    const list = await Quiz.find(q).sort({ createdAt: -1 }).limit(200);
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: "Failed to list quizzes", error: e.message });
  }
});

// Get quiz details
router.get("/quizzes/:id", requireMentor, async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz || String(quiz.school) !== String(req.mentor.school)) return res.status(404).json({ message: "Not found" });
    // Class access enforcement via classCode
    req.query.classCode = quiz.classCode;
    await requireClassAccess(req, res, () => {});
    if (res.headersSent) return; // requireClassAccess may have responded
    res.json(quiz);
  } catch (e) {
    res.status(500).json({ message: "Failed to load quiz", error: e.message });
  }
});

// Edit quiz (creator-only, only when Draft)
router.patch("/quizzes/:id", requireMentor, async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz || String(quiz.school) !== String(req.mentor.school)) return res.status(404).json({ message: "Not found" });
    if (String(quiz.createdBy) !== String(req.mentor._id)) return res.status(403).json({ message: "Only creator can edit" });
    if (quiz.status !== "Draft") return res.status(400).json({ message: "Cannot edit non-draft quiz" });
    const allowed = ["subject","title","description","timeLimitMinutes","totalPoints","questions"];
    const update = Object.fromEntries(Object.entries(req.body||{}).filter(([k])=>allowed.includes(k)));
    if (Array.isArray(update.questions)) {
      update.questions = update.questions.map(q => ({
        type: q.type,
        text: q.text,
        options: q.options || [],
        correctAnswer: q.correctAnswer || undefined,
        points: Number(q.points||1),
      }));
    }
    Object.assign(quiz, update, { lastUpdatedBy: req.mentor._id });
    await quiz.save();
    res.json(quiz);
  } catch (e) {
    res.status(500).json({ message: "Failed to edit quiz", error: e.message });
  }
});

// Publish quiz
router.post("/quizzes/:id/publish", requireMentor, async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz || String(quiz.school) !== String(req.mentor.school)) return res.status(404).json({ message: "Not found" });
    if (String(quiz.createdBy) !== String(req.mentor._id)) return res.status(403).json({ message: "Only creator can publish" });
    if (quiz.status !== "Draft") return res.status(400).json({ message: "Only draft quizzes can be published" });
    quiz.status = "Published";
    await quiz.save();
    res.json(quiz);
  } catch (e) {
    res.status(500).json({ message: "Failed to publish quiz", error: e.message });
  }
});

// Quiz summary: participants and scores
router.get("/quizzes/:id/summary", requireMentor, async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz || String(quiz.school) !== String(req.mentor.school)) return res.status(404).json({ message: "Not found" });
    // Access: creator can view; otherwise require teacher to appear in timetable for this class
    if (String(quiz.createdBy) !== String(req.mentor._id)) {
      const has = await Timetable.findOne({ school: req.mentor.school, classCode: quiz.classCode, "entries.teacher": req.mentor._id }).select("_id");
      if (!has) return res.status(403).json({ message: "Not authorized for this class" });
    }

    const subs = await QuizSubmission.find({ school: req.mentor.school, quiz: quiz._id })
      .populate({ path: "student", select: "name rollNumber" })
      .sort({ submittedAt: -1 })
      .lean();

    const participants = subs.map(s => ({
      studentId: String(s.student?._id || s.student),
      name: s.student?.name || "",
      rollNumber: s.student?.rollNumber || "",
      totalScore: Number(s.totalScore||0),
      status: s.status,
      submittedAt: s.submittedAt,
    }));

    res.json({
      quiz: { _id: quiz._id, title: quiz.title, subject: quiz.subject, classCode: quiz.classCode, totalPoints: quiz.totalPoints, status: quiz.status },
      count: participants.length,
      participants,
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load summary", error: e.message });
  }
});

// Close quiz (end)
router.post("/quizzes/:id/close", requireMentor, async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz || String(quiz.school) !== String(req.mentor.school)) return res.status(404).json({ message: "Not found" });
    if (String(quiz.createdBy) !== String(req.mentor._id)) return res.status(403).json({ message: "Only creator can close" });
    if (quiz.status !== "Published") return res.status(400).json({ message: "Only published quizzes can be closed" });
    quiz.status = "Closed";
    await quiz.save();
    res.json(quiz);
  } catch (e) {
    res.status(500).json({ message: "Failed to close quiz", error: e.message });
  }
});

// --- Teacher Dashboard ---
router.get("/teacher/dashboard", requireMentor, async (req, res) => {
  try {
    const teacherId = req.mentor._id;
    const schoolId = req.mentor.school;

    const t = await Teacher.findOne({ _id: teacherId, school: schoolId }).select("_id name subjects classes department designation").lean();
    const today = new Date();
    const dow = today.getDay(); // 0=Sun
    const dateStr = today.toISOString().slice(0,10);

    // Timetables where this teacher appears (all days)
    const allTts = await Timetable.find({ school: schoolId, "entries.teacher": teacherId }).lean();
    const assignedClassCodes = new Set();
    const todaySchedule = [];
    for (const tt of allTts) {
      for (const e of (tt.entries||[])) {
        if (String(e.teacher) === String(teacherId)) {
          assignedClassCodes.add(tt.classCode);
          if (e.dayOfWeek === dow) {
            todaySchedule.push({ classCode: tt.classCode, period: e.period, subject: e.subject, room: e.room });
          }
        }
      }
    }

    // Pending tasks
  const attendanceLogs = await AttendanceLog.find({ school: schoolId, classCode: { $in: Array.from(assignedClassCodes) }, date: new Date(dateStr+"T00:00:00Z"), finalized: { $ne: true } }).select("classCode date finalized").lean();
    const announcementsDraft = await Announcement.countDocuments({ school: schoolId, createdBy: teacherId, status: { $in: ["Draft", "Finalized"] } });
    const reportCardsDraft = await ReportCard.countDocuments({ school: schoolId, status: { $in: ["Draft", "Finalized"] } });

    const pending = {
      attendanceToFinalize: attendanceLogs.length,
      announcementsToPublish: announcementsDraft,
      reportCardsToPublish: reportCardsDraft,
    };

    res.json({
      teacher: t || {},
      assigned: {
        classes: Array.from(new Set([...(t?.classes||[]), ...Array.from(assignedClassCodes)])),
        subjects: Array.from(new Set([...(t?.subjects||[]), ...todaySchedule.map(s=>s.subject)])),
      },
      todaySchedule: todaySchedule.sort((a,b)=>String(a.period).localeCompare(String(b.period))),
      pending,
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load teacher dashboard", error: e.message });
  }
});
