import express from "express";
import jwt from "jsonwebtoken";
import Student from "../../models/Student.js";
import AttendanceLog from "../../models/AttendanceLog.js";
import Homework from "../../models/Homework.js";
import HomeworkSubmission from "../../models/HomeworkSubmission.js";
import Quiz from "../../models/Quiz.js";
import QuizSubmission from "../../models/QuizSubmission.js";

const router = express.Router();

// Minimal student auth using JWT (accepts 'student' or 'STUDENT')
async function requireStudent(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ message: "Missing token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const role = String(decoded.role || "").toUpperCase();
    if (role !== "STUDENT") return res.status(403).json({ message: "Not a student token" });
    const me = await Student.findById(decoded.sub);
    if (!me) return res.status(404).json({ message: "Student not found" });
    req.student = me;
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid token", error: e.message });
  }
}

function classCodeOf(student) {
  const cls = (student.classLevel || "").trim();
  const sec = (student.section || "").trim();
  return sec ? `${cls}-${sec}` : cls;
}

// GET /api/student/progress - submission status, quiz scores, attendance (current month)
router.get("/progress", requireStudent, async (req, res) => {
  try {
    const s = req.student;
    const schoolId = s.school;
    const classCode = classCodeOf(s);

    // Attendance summary for current month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const logs = await AttendanceLog.find({ school: schoolId, classCode, date: { $gte: start, $lt: end } }).lean();
    let att = { Present: 0, Absent: 0, Late: 0, Excused: 0 };
    for (const log of logs) {
      for (const r of (log.records || [])) {
        if (String(r.student) === String(s._id)) {
          att[r.status] = (att[r.status] || 0) + 1;
        }
      }
    }
    const totalDays = att.Present + att.Absent + att.Late + att.Excused;
    const attendancePct = totalDays > 0 ? Math.round(((att.Present + att.Excused) / totalDays) * 100) : null;

    // Homework submission status (recent 60 days)
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const homeworks = await Homework.find({ school: schoolId, classCode, deadline: { $gte: since } }).sort({ deadline: 1 }).limit(100).lean();
    const hwIds = homeworks.map(h => h._id);
    const hwSubs = hwIds.length ? await HomeworkSubmission.find({ school: schoolId, student: s._id, homework: { $in: hwIds } }).lean() : [];
    const hwMap = new Map(hwSubs.map(x => [String(x.homework), x]));
    const submissions = homeworks.map(h => ({
      id: h._id,
      topic: h.topic,
      subject: h.subject,
      deadline: h.deadline,
      status: hwMap.has(String(h._id)) ? (hwMap.get(String(h._id)).status || "Submitted") : "Pending",
      submittedAt: hwMap.get(String(h._id))?.submittedAt || null,
    }));

    // Quiz scores for this student
    const quizSubs = await QuizSubmission.find({ school: schoolId, student: s._id }).sort({ createdAt: -1 }).limit(100).lean();
    const quizIds = quizSubs.map(qs => qs.quiz);
    const quizzes = quizIds.length ? await Quiz.find({ _id: { $in: quizIds } }).select("title subject classCode totalPoints").lean() : [];
    const qMap = new Map(quizzes.map(q => [String(q._id), q]));
    const quizScores = quizSubs.map(qs => ({
      id: qs._id,
      quizId: qs.quiz,
      title: qMap.get(String(qs.quiz))?.title || "",
      subject: qMap.get(String(qs.quiz))?.subject || "",
      classCode: qMap.get(String(qs.quiz))?.classCode || classCode,
      totalPoints: qMap.get(String(qs.quiz))?.totalPoints || null,
      score: qs.totalScore,
      status: qs.status,
      submittedAt: qs.submittedAt,
    }));

    res.json({
      attendance: { ...att, totalDays, attendancePct },
      submissions,
      quizScores,
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load progress", error: e.message });
  }
});

export default router;
