import mongoose from "mongoose";

const SchoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  address: { type: String },
  contactEmail: { type: String },
  logoUrl: { type: String },
  logoPublicId: { type: String },
  isVerified: { type: Boolean, default: false },
  // Management details
  principalName: { type: String },
  principalEmail: { type: String },
  principalPhone: { type: String },
  heads: [{
    department: { type: String },
    name: { type: String },
    email: { type: String },
    phone: { type: String },
  }],
  website: { type: String },
  about: { type: String },
}, { timestamps: true });

export default mongoose.model("School", SchoolSchema);
