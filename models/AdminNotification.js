const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // null means broadcast to all admins
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['INFO', 'WARNING', 'DANGER', 'SUCCESS'],
        default: 'INFO'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);
