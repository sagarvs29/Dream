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

export default mongoose.model("Teacher", TeacherSchema);