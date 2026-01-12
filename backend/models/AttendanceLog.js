import mongoose from "mongoose";

const AttendanceRecordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  status: { type: String, enum: ["Present", "Absent", "Late", "Excused"], required: true },
  markedAt: { type: Date, default: Date.now },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
}, { _id: false });

const AttendanceLogSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  classCode: { type: String, required: true },
  date: { type: Date, required: true }, // normalized to 00:00
  records: [AttendanceRecordSchema],
  finalized: { type: Boolean, default: false },
  finalizedAt: { type: Date },
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
}, { timestamps: true });

AttendanceLogSchema.index({ school: 1, classCode: 1, date: 1 }, { unique: true });
AttendanceLogSchema.index({ school: 1, classCode: 1, finalized: 1 });

export default mongoose.model("AttendanceLog", AttendanceLogSchema);
