import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  user: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userModel: { type: String, enum: ["Student", "Teacher"], required: true },
  },
  type: { type: String, enum: ["ConnectionRequest", "ConnectionAccepted", "ConnectionRejected", "Message", "PostTagged"], required: true },
  refId: { type: mongoose.Schema.Types.ObjectId },
  text: { type: String },
  read: { type: Boolean, default: false },
}, { timestamps: true });

NotificationSchema.index({ "user.userId": 1, read: 1, createdAt: -1 });

export default mongoose.model("Notification", NotificationSchema);
