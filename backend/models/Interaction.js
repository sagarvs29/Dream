import mongoose from "mongoose";

const InteractionSchema = new mongoose.Schema(
	{
		actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
		actorModel: { type: String, enum: ["Student", "Teacher", "User", "SponsorUser"], required: true },
		targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
		targetModel: { type: String, enum: ["Student", "Teacher", "Post", "Resource", "User"], required: true },
		type: {
			type: String,
			enum: [
				"follow",
				"profile_view",
				"like",
				"comment",
				"message",
				"resource_view",
				"resource_like",
			],
			required: true,
		},
		meta: { type: Object },
	},
	{ timestamps: true }
);

InteractionSchema.index({ actorId: 1, targetId: 1, type: 1 });
InteractionSchema.index({ targetModel: 1, targetId: 1, createdAt: -1 });

const Interaction = mongoose.model("Interaction", InteractionSchema);
export default Interaction;

