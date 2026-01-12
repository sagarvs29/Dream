import mongoose from "mongoose";

const TeacherSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  employeeId: { type: String, required: true }, // Unique within school
  
  // School Association
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  
  // Professional Details
  department: { type: String, required: true }, // e.g., "Mathematics", "Science", "English"
  designation: { type: String, required: true }, // e.g., "Teacher", "Senior Teacher", "HOD", "Principal"
  subjects: [{ type: String }], // Array of subjects they teach
  classes: [{ type: String }], // Array of classes they handle (e.g., ["Class 6", "Class 7"])
  
  // Experience and Qualifications
  experience: { type: Number }, // Years of experience
  qualifications: [{ type: String }], // e.g., ["B.Ed", "M.A. Mathematics", "Ph.D"]
  specializations: [{ type: String }], // Special skills or areas of expertise
  
  // Contact and Personal
  address: { type: String },
  dateOfBirth: { type: Date },
  joiningDate: { type: Date, default: Date.now },
  // Verification
  backgroundVerified: { type: Boolean, default: false },
  verificationNotes: { type: String },
  
  // Status and Role
  status: { 
    type: String, 
    enum: ["Active", "Inactive", "On Leave", "Retired"], 
    default: "Active" 
  },
  role: { 
    type: String, 
    enum: ["Teacher", "Mentor", "Coordinator", "HOD", "Principal", "Vice Principal"], 
    default: "Teacher" 
  },
  // Auth & access (for mentor/teacher login)
  passwordHash: { type: String },
  // Track when password was last changed (for audit/UI)
  passwordChangedAt: { type: Date },
  auth: {
    username: { type: String }, // unique within a school
  },
  lastLoginAt: { type: Date },
  active: { type: Boolean, default: true },
  
  // Profile and Media
  profilePictureUrl: { type: String },
  profilePicturePublicId: { type: String },
  
  // Additional Information
  mentorshipAreas: [{ type: String }], // Areas where they provide mentorship
  achievements: [{ type: String }], // Awards, recognitions, etc.
  bio: { type: String, maxlength: 500 }, // Short biography
  // Payroll
  salary: {
    monthlySalary: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["Pending","Partial","Paid"], default: "Pending" },
    lastPaymentDate: { type: Date },
    payments: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number, required: true },
        method: { type: String, enum: ["Cash","UPI","Bank","Cheque","Other"], default: "Cash" },
        receiptNo: { type: String },
        notes: { type: String },
        month: { type: Number }, // 1-12
        year: { type: Number },
      }
    ],
  },
  
  // Administrative
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // School admin who added this teacher
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  
}, { timestamps: true });

// Indexes for better performance
TeacherSchema.index({ school: 1, employeeId: 1 }, { unique: true }); // Unique employee ID per school
TeacherSchema.index({ school: 1, email: 1 }, { unique: true }); // Unique email per school
TeacherSchema.index({ school: 1, status: 1 }); // Query active teachers by school
TeacherSchema.index({ school: 1, department: 1 }); // Query teachers by department
TeacherSchema.index({ school: 1, role: 1 }); // Query by role (mentors, teachers, etc.)
TeacherSchema.index({ school: 1, "auth.username": 1 }, { unique: true, sparse: true });
TeacherSchema.index({ active: 1, status: 1 });
// Text index for search
TeacherSchema.index({ name: "text", department: "text", designation: "text" });

// Virtual: salaryPendingBalance (monthlySalary*monthsDue - paidAmount) is complex; keep simple pending as monthly - last month payment impact
TeacherSchema.virtual("salaryPendingBalance").get(function () {
  const monthly = Number(this?.salary?.monthlySalary || 0);
  // Not exact arrears calc; shows current month's payable
  const lastPaid = Number(this?.salary?.paidAmount || 0);
  const pending = monthly - (lastPaid > monthly ? monthly : lastPaid);
  return pending < 0 ? 0 : pending;
});

TeacherSchema.set("toJSON", { virtuals: true });
TeacherSchema.set("toObject", { virtuals: true });

export default mongoose.model("Teacher", TeacherSchema);