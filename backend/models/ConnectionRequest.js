import mongoose from "mongoose";

const ConnectionRequestSchema = new mongoose.Schema({
  requester: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userModel: { type: String, enum: ["Student", "Teacher"], required: true },
  },
  target: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userModel: { type: String, enum: ["Student", "Teacher"], required: true },
  },
  status: { type: String, enum: ["Pending", "Accepted", "Rejected"], default: "Pending" },
  message: { type: String, maxlength: 280 },
}, { timestamps: true });

ConnectionRequestSchema.index({ "requester.userId": 1, status: 1 });
ConnectionRequestSchema.index({ "target.userId": 1, status: 1 });
ConnectionRequestSchema.index({ "requester.userId": 1, "target.userId": 1, status: 1 }, { unique: false });

export default mongoose.model("ConnectionRequest", ConnectionRequestSchema);
