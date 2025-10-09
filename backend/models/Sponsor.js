import mongoose from "mongoose";

const SponsorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  logoUrl: { type: String },
  logoPublicId: { type: String },
  website: { type: String },
  description: { type: String },
  tier: { type: String, enum: ["Platinum", "Gold", "Silver", "Bronze", "Partner", "Supporter"], default: "Supporter" },
  contactEmail: { type: String },
  contactPhone: { type: String },
  active: { type: Boolean, default: true },
}, { timestamps: true });

SponsorSchema.index({ active: 1, tier: 1, name: 1 });

export default mongoose.model("Sponsor", SponsorSchema);
