import mongoose from "mongoose";

const ParticipantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userModel: { type: String, enum: ["Student", "Teacher"], required: true },
}, { _id: false });

const ConversationSchema = new mongoose.Schema({
  participants: { type: [ParticipantSchema], validate: v => Array.isArray(v) && v.length === 2 },
  lastMessageAt: { type: Date },
}, { timestamps: true });

ConversationSchema.index({ "participants.userId": 1 });
ConversationSchema.index({ lastMessageAt: -1 });

export default mongoose.model("Conversation", ConversationSchema);
