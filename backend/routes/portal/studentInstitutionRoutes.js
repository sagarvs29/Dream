import express from "express";
import jwt from "jsonwebtoken";
import Student from "../../models/Student.js";
import Homework from "../../models/Homework.js";
import Quiz from "../../models/Quiz.js";
import Teacher from "../../models/Teacher.js";

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

// GET /api/student/dashboard
router.get("/dashboard", requireStudent, async (req, res) => {
  try {
    const s = req.student;
    const schoolId = s.school;
    const classCode = classCodeOf(s);
    const classLevel = (s.classLevel || "").trim();

    // Try to determine a class teacher/primary contact for this class level
    function normalizeClassLabel(label) {
      if (!label) return "";
      const str = String(label).trim();
      if (/^lkg$/i.test(str)) return "LKG";
      if (/^ukg$/i.test(str)) return "UKG";
      const m = str.match(/\b(\d{1,2})\b/);
      if (m) return m[1];
      return str;
    }
    const want = normalizeClassLabel(classLevel);
    let classTeacherName = "";
    if (want) {
      const t = await Teacher.findOne({ school: schoolId, classes: { $elemMatch: { $regex: new RegExp(`^${want}$`, "i") } } }).select("name").lean();
      classTeacherName = t?.name || "";
    }

    // Date ranges
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const in7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    const last7Days = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    // Today's homework: due today
    const todaysHomework = await Homework.find({ school: schoolId, classCode, deadline: { $gte: startOfToday, $lt: endOfToday }, status: "Active" })
      .sort({ deadline: 1 })
      .limit(50)
      .lean();

    // Upcoming deadlines: due next 7 days
    const upcomingDeadlines = await Homework.find({ school: schoolId, classCode, deadline: { $gte: endOfToday, $lte: in7Days }, status: "Active" })
      .sort({ deadline: 1 })
      .limit(50)
      .lean();

    // Quiz notifications: newly published quizzes in last 7 days for the class
    const quizNotifications = await Quiz.find({ school: schoolId, classCode, status: "Published", createdAt: { $gte: last7Days } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      classLevel: s.classLevel || "",
      section: s.section || "",
      classCode,
      classTeacherName,
      student: {
        name: s.name || "",
        rollNumber: s.rollNumber || "",
        email: s.email || "",
        phone: s.phone || "",
      },
      todaysHomework,
      upcomingDeadlines,
      quizNotifications,
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load dashboard", error: e.message });
  }
});

export default router;
