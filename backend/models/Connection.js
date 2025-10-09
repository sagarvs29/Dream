import mongoose from "mongoose";

const ConnectionSchema = new mongoose.Schema({
  userA: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userModel: { type: String, enum: ["Student", "Teacher"], required: true },
  },
  userB: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userModel: { type: String, enum: ["Student", "Teacher"], required: true },
  },
}, { timestamps: true });

ConnectionSchema.index({ "userA.userId": 1, "userB.userId": 1 }, { unique: true });
ConnectionSchema.index({ "userB.userId": 1, "userA.userId": 1 });

export default mongoose.model("Connection", ConnectionSchema);
