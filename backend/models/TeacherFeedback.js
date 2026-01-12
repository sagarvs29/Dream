import mongoose from "mongoose";

const TeacherFeedbackSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  source: { type: String, enum: ["student","parent"], required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Student or Parent reference
  rating: { type: Number, min: 1, max: 5 },
  content: { type: String },
}, { timestamps: true });

TeacherFeedbackSchema.index({ school: 1, teacher: 1, source: 1 });

export default mongoose.model("TeacherFeedback", TeacherFeedbackSchema);
