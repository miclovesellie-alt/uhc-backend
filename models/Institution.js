const mongoose = require("mongoose");

const institutionSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    type:       { type: String, enum: ["school", "hospital", "clinic", "other"], default: "school" },
    country:    { type: String, default: "Ghana" },
    city:       { type: String, default: "" },
    status:     { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    addedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    memberCount:{ type: Number, default: 0 },
  },
  { timestamps: true }
);

// Case-insensitive unique name index
institutionSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

module.exports = mongoose.model("Institution", institutionSchema);
