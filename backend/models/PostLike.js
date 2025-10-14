import mongoose from 'mongoose';

const PostLikeSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  by: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userModel: { type: String, enum: ['Student','Teacher'], required: true },
  },
}, { timestamps: true });

PostLikeSchema.index({ post: 1, 'by.userId': 1 }, { unique: true });

export default mongoose.model('PostLike', PostLikeSchema);