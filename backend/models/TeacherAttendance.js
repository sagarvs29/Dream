import mongoose from "mongoose";

const TeacherAttendanceSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  date: { type: Date, required: true }, // normalized to 00:00
  status: { type: String, enum: ["Present","Absent","Late","Excused"], required: true },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // School admin who marked
}, { timestamps: true });

TeacherAttendanceSchema.index({ school: 1, teacher: 1, date: 1 }, { unique: true });

export default mongoose.model("TeacherAttendance", TeacherAttendanceSchema);
