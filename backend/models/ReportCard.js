import mongoose from "mongoose";

const SubjectGradeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  grade: { type: String }, // e.g., A,B,C or numeric
  score: { type: Number }, // optional numeric score
  remarks: { type: String, maxlength: 240 },
}, { _id: false });

const ReportCardSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  termId: { type: String, required: true }, // "Q1", "Q2", "TERM1" etc.
  subjects: [SubjectGradeSchema],
  aggregateScore: { type: Number },
  status: { type: String, enum: ["Draft", "Finalized", "Published"], default: "Draft" },
  publishedAt: { type: Date },
  finalizedAt: { type: Date },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
}, { timestamps: true });

ReportCardSchema.index({ school: 1, student: 1, termId: 1 }, { unique: true });
ReportCardSchema.index({ school: 1, termId: 1, status: 1 });

export default mongoose.model("ReportCard", ReportCardSchema);
