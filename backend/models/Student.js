import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  rollNumber: { type: String, required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  department: { type: String, required: true },
  admissionYear: { type: Number, required: true },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  aadhaarNumber: { type: String },
  address: { type: String },
  profilePictureUrl: { type: String }, // URL of the profile picture
  profilePicturePublicId: { type: String }, // Cloudinary public ID for deletion
  // Controls if this student's profile is discoverable across schools
  profileVisibility: {
    type: String,
    enum: ["Public", "Private"],
    default: "Private",
  },
}, { timestamps: true });

StudentSchema.index({ school: 1, rollNumber: 1 }, { unique: false });
StudentSchema.index({ school: 1, profileVisibility: 1 });

export default mongoose.model("Student", StudentSchema);
