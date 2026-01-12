import mongoose from "mongoose";

const HomeworkSubmissionSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  homework: { type: mongoose.Schema.Types.ObjectId, ref: "Homework", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  status: { type: String, enum: ["Submitted", "Checked"], default: "Submitted" },
  submittedAt: { type: Date, default: Date.now },
  notes: { type: String },
}, { timestamps: true });

HomeworkSubmissionSchema.index({ school: 1, homework: 1, student: 1 }, { unique: true });

export default mongoose.model("HomeworkSubmission", HomeworkSubmissionSchema);
