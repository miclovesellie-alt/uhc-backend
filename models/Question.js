const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    course: {
      type: String,
      required: true,
    },

    question: {
      type: String,
      required: true,
    },

    options: {
      type: [String],
      required: true,
      validate: [
        (arr) => Array.isArray(arr) && arr.length >= 3 && arr.length <= 4,
        "Question must have 3 or 4 options",
      ],
    },

    answer: {
      type: Number,
      required: true, // index of correct option (0-2 for 3 options, 0-3 for 4 options)
      min: 0,
      max: 3,
      validate: {
        validator: function (val) {
          if (this.options && Array.isArray(this.options) && this.options.length > 0) {
            return val >= 0 && val < this.options.length;
          }
          return val >= 0 && val <= 3;
        },
        message: "Answer index must be a valid option index",
      },
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    isReported: {
      type: Boolean,
      default: false,
    },

    reportReason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);