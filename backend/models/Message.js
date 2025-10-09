import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  from: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userModel: { type: String, enum: ["Student", "Teacher"], required: true },
  },
  to: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userModel: { type: String, enum: ["Student", "Teacher"], required: true },
  },
  text: { type: String, required: true, maxlength: 2000 },
  readAt: { type: Date },
}, { timestamps: true });

MessageSchema.index({ conversation: 1, createdAt: 1 });
MessageSchema.index({ "to.userId": 1, readAt: 1 });

export default mongoose.model("Message", MessageSchema);
