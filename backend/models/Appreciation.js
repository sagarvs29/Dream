import mongoose from 'mongoose';

const AppreciationSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  author: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userModel: { type: String, enum: ['Student','Teacher'], required: true },
  },
  text: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

export default mongoose.model('Appreciation', AppreciationSchema);