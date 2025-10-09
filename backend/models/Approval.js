import mongoose from "mongoose";

const ApprovalSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  remarks: { type: String },
}, { timestamps: true });

export default mongoose.model("Approval", ApprovalSchema);
