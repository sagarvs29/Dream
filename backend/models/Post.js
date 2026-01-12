import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema({
  kind: { type: String, enum: ["image", "video"], required: true },
  url: { type: String, required: true },
  thumbUrl: { type: String },
  durationSec: { type: Number },
  width: { type: Number },
  height: { type: Number },
  // optional presentation metadata (client-side rendering)
  filter: { type: String }, // e.g., 'clarendon', 'lark', etc.
  crop: {
    aspect: { type: String }, // e.g., '1:1', '4:5', '16:9'
    x: { type: Number },
    y: { type: Number },
    zoom: { type: Number },
  }
}, { _id: false });

const PostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  caption: { type: String, maxlength: 2200 },
  hashtags: [{ type: String, index: true }],
  media: { type: [MediaSchema], validate: v => v && v.length > 0 },
  visibility: { type: String, enum: ["public", "school"], default: "school", index: true },
  tagged: [{
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userModel: { type: String, enum: ["Student", "Teacher"], required: true },
  }],
  location: { type: String },
  musicTitle: { type: String },
  musicArtist: { type: String },
  likeCount: { type: Number, default: 0 },
}, { timestamps: true });

PostSchema.index({ createdAt: -1 });
// Text index to search captions quickly; hashtags searched separately
PostSchema.index({ caption: "text" });

export default mongoose.model("Post", PostSchema);
