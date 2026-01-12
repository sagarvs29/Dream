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
  // Overview
  establishmentYear: { type: Number },
  vision: { type: String },
  history: { type: String },
  founders: [{
    name: { type: String },
    title: { type: String },
    photoUrl: { type: String },
    bio: { type: String },
  }],
  trustees: [{
    name: { type: String },
    title: { type: String },
    photoUrl: { type: String },
    bio: { type: String },
    sinceYear: { type: Number },
    contactEmail: { type: String },
    contactPhone: { type: String },
    notes: { type: String },
    involvement: {
      district: { type: Boolean, default: false },
      districtName: { type: String },
      ngo: { type: Boolean, default: false },
      ngoName: { type: String },
      orgName: { type: String },
      remarks: { type: String },
    },
  }],
  photos: [{
    url: { type: String },
    caption: { type: String },
  }],
  alumni: [{
    name: { type: String },
    year: { type: Number },
    achievement: { type: String },
    photoUrl: { type: String },
  }],
  recognitions: [{
    title: { type: String },
    issuer: { type: String },
    level: { type: String, enum: ["District","State","National","International"], default: "District" },
    year: { type: Number },
    description: { type: String },
  }],
  // Roll number prefix, immutable after first approval
  schoolRollPrefix: { type: String },
  // Academic configuration (admin-defined)
  classConfig: [{ type: String }], // e.g., ["LKG","UKG","1","2",...]
  sectionsConfig: [{ type: String }], // e.g., ["A","B","C"]
  // Optional workflow gating state
  workflowState: {
    academicYearSetup: { type: Boolean, default: false },
    classesDefined: { type: Boolean, default: false },
    sectionsDefined: { type: Boolean, default: false },
    teachersAssigned: { type: Boolean, default: false },
    studentAdmissionEnabled: { type: Boolean, default: false },
  },
  // Admissions toggle per academic year (year-specific enable/disable)
  admissionsByYear: [
    {
      year: { type: Number, required: true },
      enabled: { type: Boolean, default: true },
    }
  ],
}, { timestamps: true });
// Text index for search
SchoolSchema.index({ name: "text", code: "text", address: "text" });

export default mongoose.model("School", SchoolSchema);
