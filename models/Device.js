import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActiveAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Device', deviceSchema);

