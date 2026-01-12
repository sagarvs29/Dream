import mongoose from "mongoose";

const ContributionSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  sourceType: { type: String, enum: ["Trustee","District","NGO","Other"], required: true },
  sourceName: { type: String },
  trusteeId: { type: mongoose.Schema.Types.ObjectId }, // optional reference to School.trustees subdoc _id
  type: { type: String, enum: ["Financial","Resource"], required: true },
  amount: { type: Number }, // for financial
  resourceDescription: { type: String }, // for resource contributions
  notes: { type: String },
  date: { type: Date, default: () => new Date() },
  recordedBy: { type: String }, // admin id
}, { timestamps: true });

ContributionSchema.index({ school: 1, date: -1 });

export default mongoose.model("Contribution", ContributionSchema);
