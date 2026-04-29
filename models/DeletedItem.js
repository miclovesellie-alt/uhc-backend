const mongoose = require("mongoose");

const deletedItemSchema = new mongoose.Schema(
  {
    originalId: { type: String, required: true },
    type: { type: String, enum: ["Question", "Book", "Feed"], required: true },
    data: { type: Object, required: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    expiresAt: { 
      type: Date, 
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      index: { expires: 0 } // TTL index
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeletedItem", deletedItemSchema);
