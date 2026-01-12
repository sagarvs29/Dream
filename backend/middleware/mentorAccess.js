import Timetable from "../models/Timetable.js";

// Normalize class labels so we can match teacher.classes against classCode
function normalizeClassLabel(label) {
  if (!label) return "";
  const s = String(label).trim();
  if (/^lkg$/i.test(s)) return "LKG";
  if (/^ukg$/i.test(s)) return "UKG";
  const m = s.match(/\b(\d{1,2})\b/);
  if (m) return m[1];
  return s; // fallback
}

// Extract classLevel from classCode like "9-A" -> "9"; "LKG-A" -> "LKG"
export function getClassLevelFromCode(classCode) {
  const base = String(classCode || "").split("-")[0];
  return normalizeClassLabel(base);
}

// Check if teacher has access to a given classLevel via their assigned classes
function teacherHasClass(teacher, classLevel) {
  const mine = Array.isArray(teacher.classes) ? teacher.classes : [];
  const want = normalizeClassLabel(classLevel);
  for (const c of mine) {
    const norm = normalizeClassLabel(c);
    if (norm === want) return true;
  }
  return false;
}

// Fallback: verify that timetable has this teacher on the requested classCode
async function timetableHasTeacher(teacherId, schoolId, classCode) {
  const tt = await Timetable.findOne({ school: schoolId, classCode, "entries.teacher": teacherId }).select("_id");
  return !!tt;
}

// Middleware: require mentor to have class access for the requested classCode (param or query)
export async function requireClassAccess(req, res, next) {
  try {
    const classCode = req.params.classCode || req.query.classCode || req.body?.classCode;
    if (!classCode) return res.status(400).json({ message: "classCode required" });
    const classLevel = getClassLevelFromCode(classCode);
    // Direct assignment check
    if (teacherHasClass(req.mentor, classLevel)) return next();
    // Timetable-based check
    const ok = await timetableHasTeacher(req.mentor._id, req.mentor.school, classCode);
    if (ok) return next();
    return res.status(403).json({ message: "Not authorized for this class" });
  } catch (e) {
    return res.status(500).json({ message: "Access check failed" });
  }
}

// Optional helper to restrict subject-specific actions
export function requireSubjectAccess(subjectKey) {
  return function(req, res, next) {
    const subject = (req.body?.[subjectKey] || req.query?.[subjectKey] || "").trim();
    if (!subject) return res.status(400).json({ message: `${subjectKey} required` });
    const subjects = Array.isArray(req.mentor.subjects) ? req.mentor.subjects : [];
    if (subjects.length && !subjects.some(s => String(s).toLowerCase() === subject.toLowerCase())) {
      return res.status(403).json({ message: "Not authorized for this subject" });
    }
    next();
  };
}
