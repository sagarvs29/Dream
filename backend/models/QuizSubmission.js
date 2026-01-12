import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true },
  answer: { type: String },
  pointsAwarded: { type: Number, default: 0 },
}, { _id: false });

const QuizSubmissionSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  answers: [AnswerSchema],
  totalScore: { type: Number, default: 0 },
  status: { type: String, enum: ["Submitted", "Graded"], default: "Submitted" },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

QuizSubmissionSchema.index({ school: 1, quiz: 1, student: 1 }, { unique: true });

export default mongoose.model("QuizSubmission", QuizSubmissionSchema);
