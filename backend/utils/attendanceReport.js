import AttendanceLog from "../models/AttendanceLog.js";
import TeacherAttendance from "../models/TeacherAttendance.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import PDFDocument from "pdfkit";

function toCsv(rows, headers) {
  const h = headers || Object.keys(rows[0] || {});
  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [];
  lines.push(h.join(","));
  for (const row of rows) {
    lines.push(h.map(k => escape(row[k])).join(","));
  }
  return lines.join("\n");
}

async function buildStudentAttendanceCsv(schoolId, classCode, date) {
  const d = date ? new Date(date) : new Date();
  const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const log = await AttendanceLog.findOne({ school: schoolId, classCode, date: norm }).lean();
  if (!log) return toCsv([], ["Roll","Name","Status"]);
  const studentIds = (log.records || []).map(r => r.student);
  const students = await Student.find({ _id: { $in: studentIds } }).select("rollNumber name").lean();
  const map = new Map(students.map(s => [String(s._id), s]));
  const rows = (log.records || []).map(r => ({ Roll: map.get(String(r.student))?.rollNumber || "", Name: map.get(String(r.student))?.name || "", Status: r.status }));
  return toCsv(rows, ["Roll","Name","Status"]);
}

async function buildTeacherAttendanceCsv(schoolId, year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  const records = await TeacherAttendance.find({ school: schoolId, date: { $gte: start, $lte: end } }).lean();
  const teacherIds = [...new Set(records.map(r => String(r.teacher)))];
  const teachers = await Teacher.find({ _id: { $in: teacherIds } }).select("name employeeId department").lean();
  const tMap = new Map(teachers.map(t => [String(t._id), t]));
  const summary = {};
  for (const r of records) {
    const key = String(r.teacher);
    summary[key] = summary[key] || { Present: 0, Absent: 0, Late: 0, Excused: 0 };
    summary[key][r.status]++;
  }
  const rows = Object.entries(summary).map(([tid, s]) => ({
    EmployeeId: tMap.get(tid)?.employeeId || "",
    Name: tMap.get(tid)?.name || "",
    Department: tMap.get(tid)?.department || "",
    Present: s.Present || 0,
    Absent: s.Absent || 0,
    Late: s.Late || 0,
    Excused: s.Excused || 0,
  }));
  return toCsv(rows, ["EmployeeId","Name","Department","Present","Absent","Late","Excused"]);
}

async function buildStudentAttendancePdf(schoolId, classCode, date) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const d = date ? new Date(date) : new Date();
  const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const log = await AttendanceLog.findOne({ school: schoolId, classCode, date: norm }).lean();
  doc.fontSize(16).text(`Attendance Sheet - ${classCode}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Date: ${norm.toISOString().slice(0,10)}`, { align: 'center' });
  doc.moveDown();
  const studentIds = (log?.records || []).map(r => r.student);
  const students = await Student.find({ _id: { $in: studentIds } }).select("rollNumber name").lean();
  const map = new Map(students.map(s => [String(s._id), s]));
  const rows = (log?.records || []).map(r => ({ roll: map.get(String(r.student))?.rollNumber || "", name: map.get(String(r.student))?.name || "", status: r.status }));
  const colX = [40, 140, 360];
  doc.fontSize(11).text("Roll", colX[0], doc.y);
  doc.text("Name", colX[1], doc.y);
  doc.text("Status", colX[2], doc.y);
  doc.moveDown(0.5);
  for (const row of rows) {
    doc.text(String(row.roll), colX[0], doc.y);
    doc.text(row.name, colX[1], doc.y);
    doc.text(row.status, colX[2], doc.y);
    doc.moveDown(0.2);
  }
  doc.end();
  return doc;
}

async function buildTeacherAttendancePdf(schoolId, year, month) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.fontSize(16).text(`Teacher Attendance Summary - ${month}/${year}`, { align: 'center' });
  doc.moveDown();
  const csv = await buildTeacherAttendanceCsv(schoolId, year, month);
  const lines = csv.split("\n");
  const headers = lines.shift()?.split(",") || [];
  const colX = [40, 160, 300, 420, 480, 540];
  // headers
  headers.forEach((h, i) => doc.fontSize(11).text(h, colX[i] || (40 + i*100), doc.y));
  doc.moveDown(0.5);
  for (const ln of lines) {
    const parts = ln.split(",");
    parts.forEach((p, i) => doc.text(p, colX[i] || (40 + i*100), doc.y));
    doc.moveDown(0.2);
  }
  doc.end();
  return doc;
}

export { toCsv, buildStudentAttendanceCsv, buildTeacherAttendanceCsv, buildStudentAttendancePdf, buildTeacherAttendancePdf };
