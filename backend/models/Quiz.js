import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema({
  type: { type: String, enum: ["MCQ", "Short"], required: true },
  text: { type: String, required: true },
  options: [{ type: String }], // MCQ
  correctAnswer: { type: String }, // MCQ single-answer for now
  points: { type: Number, default: 1 },
}, { _id: true });

const QuizSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  classCode: { type: String, required: true },
  subject: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  timeLimitMinutes: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  questions: [QuestionSchema],
  status: { type: String, enum: ["Draft", "Published", "Closed"], default: "Draft" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
}, { timestamps: true });

QuizSchema.index({ school: 1, classCode: 1, subject: 1, status: 1 });

export default mongoose.model("Quiz", QuizSchema);
