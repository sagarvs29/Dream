import mongoose from "mongoose";

const FeeComponentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
}, { _id: false });

const FeePlanSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  academicYear: { type: Number, required: true },
  classLevel: { type: String, required: true }, // e.g., 'LKG','UKG','1'..'12'
  section: { type: String }, // optional section-specific plan
  title: { type: String }, // optional name for plan
  frequency: { type: String, enum: ["Annual","Term","Monthly"], default: "Annual" },
  components: { type: [FeeComponentSchema], default: [] },
  dueDates: { type: [Date], default: [] },
}, { timestamps: true });

// Indexes for quick lookup per school/year/class/section
FeePlanSchema.index({ school: 1, academicYear: 1, classLevel: 1, section: 1 }, { unique: false });

// Virtual: total amount from components
FeePlanSchema.virtual("total").get(function () {
  return (this.components || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
});

// Include virtuals
FeePlanSchema.set("toJSON", { virtuals: true });
FeePlanSchema.set("toObject", { virtuals: true });

export default mongoose.model("FeePlan", FeePlanSchema);
