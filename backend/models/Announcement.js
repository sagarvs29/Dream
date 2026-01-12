import mongoose from "mongoose";

const AnnouncementSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  scope: { type: String, enum: ["School", "Class"], default: "School" },
  classCode: { type: String },
  title: { type: String, required: true },
  body: { type: String, required: true },
  urgent: { type: Boolean, default: false },
  audience: { type: String, enum: ["Students", "Parents", "Both"], default: "Both" },
  status: { type: String, enum: ["Draft", "Scheduled", "Published"], default: "Draft" },
  publishAt: { type: Date }, // future scheduling
  publishedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
}, { timestamps: true });

AnnouncementSchema.index({ school: 1, scope: 1, classCode: 1, status: 1 });
AnnouncementSchema.index({ school: 1, urgent: 1, status: 1 });

export default mongoose.model("Announcement", AnnouncementSchema);
