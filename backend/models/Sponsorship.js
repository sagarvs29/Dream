import mongoose from "mongoose";

const SponsorshipSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  sponsor: { type: mongoose.Schema.Types.ObjectId, ref: "Sponsor", required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR" },
  message: { type: String },
  status: { type: String, enum: ["Pledged", "Active", "Completed", "Cancelled"], default: "Active" },
}, { timestamps: true });

SponsorshipSchema.index({ student: 1, sponsor: 1 });

export default mongoose.model("Sponsorship", SponsorshipSchema);
