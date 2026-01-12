import mongoose from "mongoose";

const SponsorUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  sponsor: { type: mongoose.Schema.Types.ObjectId, ref: "Sponsor", required: true },
  active: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
  // Temporary password stored only until user changes it; do NOT use for auth, only display.
  tempPasswordPlain: { type: String },
  isTempPassword: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("SponsorUser", SponsorUserSchema);
