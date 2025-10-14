import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema({
  kind: { type: String, enum: ["image", "video"], required: true },
  url: { type: String, required: true },
  thumbUrl: { type: String },
  durationSec: { type: Number },
  width: { type: Number },
  height: { type: Number },
}, { _id: false });

const PostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  caption: { type: String, maxlength: 2200 },
  hashtags: [{ type: String, index: true }],
  media: { type: [MediaSchema], validate: v => v && v.length > 0 },
  visibility: { type: String, enum: ["public", "school"], default: "school", index: true },
  likeCount: { type: Number, default: 0 },
}, { timestamps: true });

PostSchema.index({ createdAt: -1 });

export default mongoose.model("Post", PostSchema);
