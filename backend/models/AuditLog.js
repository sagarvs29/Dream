import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema({
  actorId: { type: String },
  actorRole: { type: String },
  action: { type: String, required: true },
  entityType: { type: String },
  entityId: { type: String },
  meta: { type: Object },
  ip: { type: String },
}, { timestamps: { createdAt: 'ts', updatedAt: false } });

export default mongoose.model("AuditLog", AuditLogSchema);
