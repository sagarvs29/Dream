import mongoose from "mongoose";

const HomeworkSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  classCode: { type: String, required: true }, // e.g., "9-A"
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  description: { type: String, default: "" },
  deadline: { type: Date, required: true },
  status: { type: String, enum: ["Active", "Closed"], default: "Active" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
}, { timestamps: true });

HomeworkSchema.index({ school: 1, classCode: 1, deadline: 1 });
HomeworkSchema.index({ school: 1, status: 1 });

export default mongoose.model("Homework", HomeworkSchema);
