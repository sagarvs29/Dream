import express from "express";
import jwt from "jsonwebtoken";
import Student from "../../models/Student.js";
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

function sanitizeQuizForStudent(quiz) {
  // Hide correctAnswer to prevent cheating
  const q = quiz.toObject ? quiz.toObject() : quiz;
  const questions = (q.questions || []).map((qq) => ({
    _id: qq._id,
    type: qq.type,
    text: qq.text,
    options: qq.options,
    points: qq.points,
  }));
  return {
    _id: q._id,
    school: q.school,
    classCode: q.classCode,
    subject: q.subject,
    title: q.title,
    description: q.description,
    timeLimitMinutes: q.timeLimitMinutes,
    totalPoints: q.totalPoints,
    status: q.status,
    createdAt: q.createdAt,
    questions,
  };
}

// GET /api/student/quizzes/active -> list published quizzes for student's class
router.get("/quizzes/active", requireStudent, async (req, res) => {
  try {
    const s = req.student;
    const schoolId = s.school;
    const classCode = classCodeOf(s);
    const classLevel = String(s.classLevel || '').trim();
    const subject = req.query.subject || undefined;

    const q = { school: schoolId, status: "Published", classCode: { $in: [classCode, classLevel] } };
    if (subject) {
      const esc = String(subject).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      q.subject = new RegExp(`^${esc}$`, 'i');
    }

    const list = await Quiz.find(q).sort({ createdAt: -1 }).limit(200).lean();
    // Basic fields only
    const result = list.map((qq) => ({
      _id: qq._id,
      title: qq.title,
      subject: qq.subject,
      classCode: qq.classCode,
      totalPoints: qq.totalPoints,
      timeLimitMinutes: qq.timeLimitMinutes,
      createdAt: qq.createdAt,
      status: qq.status,
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: "Failed to load quizzes", error: e.message });
  }
});

// GET /api/student/quizzes/:id -> quiz details (sanitized)
router.get("/quizzes/:id", requireStudent, async (req, res) => {
  try {
    const s = req.student;
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (String(quiz.school) !== String(s.school)) return res.status(403).json({ message: "Wrong school" });
    const classCode = classCodeOf(s);
    const classLevel = String(s.classLevel || '').trim();
    if (quiz.classCode !== classCode && quiz.classCode !== classLevel) return res.status(403).json({ message: "Quiz not for your class" });
    if (quiz.status !== "Published") return res.status(403).json({ message: "Quiz not active" });
    res.json(sanitizeQuizForStudent(quiz));
  } catch (e) {
    res.status(500).json({ message: "Failed to load quiz", error: e.message });
  }
});

// Helper: score answers for MCQs; Short answers remain 0 and pending
function autoScore(quiz, answers) {
  let total = 0;
  const scoredAnswers = (answers || []).map((ans) => {
    const qi = Number(ans.questionIndex);
    const q = quiz.questions[qi];
    if (!q) return { questionIndex: qi, answer: ans.answer || "", pointsAwarded: 0 };
    if (q.type === "MCQ") {
      const pts = Number(q.points || 0);
      const awarded = (String(ans.answer || "") === String(q.correctAnswer || "")) ? pts : 0;
      total += awarded;
      return { questionIndex: qi, answer: ans.answer || "", pointsAwarded: awarded };
    }
    // Short answer
    return { questionIndex: qi, answer: ans.answer || "", pointsAwarded: 0 };
  });
  return { total, scoredAnswers };
}

// POST /api/student/quizzes/:id/attempt -> submit answers
// body: { answers: [{ questionIndex, answer }] }
router.post("/quizzes/:id/attempt", requireStudent, async (req, res) => {
  try {
    const s = req.student;
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (String(quiz.school) !== String(s.school)) return res.status(403).json({ message: "Wrong school" });
    const classCode = classCodeOf(s);
    const classLevel = String(s.classLevel || '').trim();
    if (quiz.classCode !== classCode && quiz.classCode !== classLevel) return res.status(403).json({ message: "Quiz not for your class" });
    if (quiz.status !== "Published") return res.status(403).json({ message: "Quiz not active" });

    // Prevent duplicate submissions
    const existing = await QuizSubmission.findOne({ school: s.school, quiz: quiz._id, student: s._id });
    if (existing) return res.status(409).json({ message: "You have already submitted this quiz" });

    const { answers } = req.body || {};
    if (!Array.isArray(answers)) return res.status(400).json({ message: "Invalid answers" });

    const { total, scoredAnswers } = autoScore(quiz, answers);
    // Determine status: if any Short questions present, keep Submitted; otherwise Graded
    const hasShort = (quiz.questions || []).some((q) => q.type === "Short");
    const status = hasShort ? "Submitted" : "Graded";

    const sub = await QuizSubmission.create({
      school: s.school,
      quiz: quiz._id,
      student: s._id,
      answers: scoredAnswers,
      totalScore: total,
      status,
    });

    // Award points for total score; add badge for perfect score
    const updates = { $inc: { pointsTotal: Number(total) || 0 } };
    const isPerfect = Number(total) === Number(quiz.totalPoints || 0) && Number(total) > 0;
    if (isPerfect) {
      updates.$push = { badges: { name: "Perfect Score", reason: `Scored ${total}/${quiz.totalPoints} on ${quiz.title}`, earnedAt: new Date() } };
    }
    await Student.findByIdAndUpdate(s._id, updates);

    // Build per-question feedback for response
    const feedback = scoredAnswers.map((a) => {
      const q = quiz.questions[a.questionIndex];
      if (!q) return { questionIndex: a.questionIndex, feedback: "Invalid question", pointsAwarded: a.pointsAwarded };
      if (q.type === "MCQ") {
        const ok = String(a.answer || "") === String(q.correctAnswer || "");
        return { questionIndex: a.questionIndex, feedback: ok ? "Correct" : "Incorrect", pointsAwarded: a.pointsAwarded };
      }
      return { questionIndex: a.questionIndex, feedback: "Pending grading", pointsAwarded: a.pointsAwarded };
    });

    res.status(201).json({
      submissionId: sub._id,
      totalScore: sub.totalScore,
      status: sub.status,
      feedback,
      pointsEarned: total,
      badgeAwarded: isPerfect ? { name: "Perfect Score" } : null,
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to submit quiz", error: e.message });
  }
});

// GET /api/student/quizzes/:id/submission -> view own submission summary
router.get("/quizzes/:id/submission", requireStudent, async (req, res) => {
  try {
    const s = req.student;
    const sub = await QuizSubmission.findOne({ school: s.school, quiz: req.params.id, student: s._id }).populate("quiz");
    if (!sub) return res.status(404).json({ message: "Submission not found" });

    const quiz = sub.quiz;
    const feedback = (sub.answers || []).map((a) => {
      const q = quiz?.questions?.[a.questionIndex];
      if (!q) return { questionIndex: a.questionIndex, feedback: "Invalid question", pointsAwarded: a.pointsAwarded };
      if (q.type === "MCQ") {
        const ok = String(a.answer || "") === String(q.correctAnswer || "");
        return { questionIndex: a.questionIndex, feedback: ok ? "Correct" : "Incorrect", pointsAwarded: a.pointsAwarded };
      }
      return { questionIndex: a.questionIndex, feedback: "Pending grading", pointsAwarded: a.pointsAwarded };
    });

    res.json({
      submissionId: sub._id,
      totalScore: sub.totalScore,
      status: sub.status,
      feedback,
      quiz: { _id: quiz?._id, title: quiz?.title, totalPoints: quiz?.totalPoints },
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load submission", error: e.message });
  }
});

export default router;
