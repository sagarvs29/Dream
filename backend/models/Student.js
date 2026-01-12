import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  // Assigned only after admin approval; immutable once set
  rollNumber: { type: String },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  // Optional department (legacy); class-wise placement used instead
  department: { type: String },
  // Academic year label like "2024-25" and numeric start year for reporting
  academicYear: { type: String },
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
  // Optional academic placement (future-friendly; not required by existing flows)
  classLevel: { type: String }, // e.g., 'LKG','UKG','1'..'12'
  section: { type: String },    // e.g., 'A','B','C'
  // Per-year academic placement (future-proof for promotions and isolation by year)
  classAssignments: [{
    year: { type: Number, required: true },
    classLevel: { type: String },
    section: { type: String },
  }],
  // Optional lifecycle/exit tracking for academic stats
  exitStatus: { type: String, enum: ["Dropout","Transfer"], required: false },
  exitStatusYear: { type: Number },
  // Parent/guardian details
  parentDetails: {
    name: { type: String },
    occupation: { type: String },
    contact: { type: String }, // phone/email free-form
  },
  // Admission date (more precise than year)
  admissionDate: { type: Date },
  // Fee tracking (enhanced)
  fee: {
    // Reference plan name or ID (string for flexibility; can store FeePlan _id as string)
    plan: { type: String },
    // Aggregate totals for quick reads (kept consistent when recording payments)
    totalFee: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["Pending","Partial","Paid"], default: "Pending" },
    lastPaymentDate: { type: Date },
    // Individual payments for history
    payments: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number, required: true },
        method: { type: String, enum: ["Cash","UPI","Bank","Cheque","Other"], default: "Cash" },
        receiptNo: { type: String },
        notes: { type: String },
      }
    ],
    // Reminder controls (future automation)
    remindersEnabled: { type: Boolean, default: false },
    nextReminderDate: { type: Date },
  },
  // Cached/derived metrics (optional)
  attendancePct: { type: Number }, // 0-100
  performanceScore: { type: Number }, // 0-100
  teacherRemarks: { type: String },
  // Gamification: cumulative points and earned badges
  pointsTotal: { type: Number, default: 0 },
  badges: [
    {
      name: { type: String },
      earnedAt: { type: Date, default: Date.now },
      reason: { type: String },
    }
  ],
}, { timestamps: true });

// Ensure roll numbers are unique per school; sparse because not set until approval
StudentSchema.index({ school: 1, rollNumber: 1 }, { unique: true, sparse: true });
StudentSchema.index({ school: 1, profileVisibility: 1 });
// Text index for search
StudentSchema.index({ name: "text", email: "text" });

// Virtual: pending balance derived from totalFee - paidAmount
StudentSchema.virtual("feePendingBalance").get(function () {
  const total = Number(this?.fee?.totalFee || 0);
  const paid = Number(this?.fee?.paidAmount || 0);
  const pending = total - paid;
  return pending < 0 ? 0 : pending;
});

// Ensure virtuals are included when toJSON/toObject are called
StudentSchema.set("toJSON", { virtuals: true });
StudentSchema.set("toObject", { virtuals: true });

export default mongoose.model("Student", StudentSchema);
