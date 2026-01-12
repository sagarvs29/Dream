import mongoose from "mongoose";

const ResourceSchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		description: { type: String, default: "" },
		subject: { type: String, index: true },
		tags: { type: [String], index: true, default: [] },
		gradeLevels: { type: [String], index: true, default: [] }, // e.g., ["Class 8","Class 9","Class 10"]
		url: { type: String, required: true },
		thumbnail: { type: String },
		popularity: { type: Number, default: 0 },
	},
	{ timestamps: true }
);

// Text index for search queries
ResourceSchema.index({ title: "text", description: "text", tags: "text" });

const Resource = mongoose.model("Resource", ResourceSchema);
export default Resource;

