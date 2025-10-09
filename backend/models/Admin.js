import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["SERVER", "SCHOOL"], required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null }, // null when SERVER
  isTempPassword: { type: Boolean, default: false },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model("Admin", AdminSchema);
