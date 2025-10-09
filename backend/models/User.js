import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Deprecated: raw Aadhaar. Keep optional for backward compatibility.
  aadhaar: { type: String, required: false, unique: true, sparse: true },

  // Privacy-safe identity
  aadhaarToken: { type: String, index: true }, // hashed token
  aadhaarLast4: { type: String },

  realName: { type: String, required: true, immutable: true },   // Aadhaar-verified, locked
  address: { type: String, required: false, immutable: true },   // Optional; consider storing only district/state
  dob: { type: String },

  // Academic
  grade: { type: String },
  schoolName: { type: String, required: true },
  schoolLocation: { type: String, required: true },
  status: { type: String, enum: ["PENDING_SCHOOL_VERIFICATION", "APPROVED"], default: "PENDING_SCHOOL_VERIFICATION" },

  // Guardian for minors
  guardian: {
    consent: { type: Boolean, default: false },
    phone: String,
    email: String,
  },

  referralCode: { type: String },
  uniqueStudentId: { type: String, unique: true, sparse: true }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
export default User;
