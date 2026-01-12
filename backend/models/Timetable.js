import mongoose from "mongoose";

const TimetableEntrySchema = new mongoose.Schema({
  dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=Sunday
  period: { type: String, required: true }, // e.g., "P1", "P2"
  subject: { type: String, required: true },
  room: { type: String },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  notes: { type: String, maxlength: 240 },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
}, { _id: true });

const TimetableSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  classCode: { type: String, required: true }, // e.g., "6A"
  entries: [TimetableEntrySchema],
  version: { type: Number, default: 1 },
}, { timestamps: true });

TimetableSchema.index({ school: 1, classCode: 1 }, { unique: true });
TimetableSchema.index({ school: 1, classCode: 1, "entries.dayOfWeek": 1 });

export default mongoose.model("Timetable", TimetableSchema);
