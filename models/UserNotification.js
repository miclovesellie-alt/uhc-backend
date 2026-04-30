const mongoose = require('mongoose');

const UserNotificationSchema = new mongoose.Schema({
    recipient: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true,
        index: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    type: { 
        type: String, 
        default: 'INFO',
        enum: ['INFO', 'SUCCESS', 'WARNING', 'MESSAGE', 'POST']
    },
    actionLink: {
        type: String // Optional frontend route to navigate when clicked
    },
    read: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

module.exports = mongoose.model('UserNotification', UserNotificationSchema);
