import mongoose from "mongoose";

const BlacklistSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  email: { type: String },
  phone: { type: String },
  reason: { type: String },
  removedAt: { type: Date },
}, { timestamps: true });

BlacklistSchema.index({ school: 1, email: 1 }, { unique: true, sparse: true });
BlacklistSchema.index({ school: 1, phone: 1 }, { unique: true, sparse: true });

export default mongoose.model("Blacklist", BlacklistSchema);
