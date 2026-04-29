const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true
    },
    targetType: {
        type: String,
        required: true
    },
    targetId: {
        type: String
    },
    details: {
        type: Object
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('AdminLog', adminLogSchema);
