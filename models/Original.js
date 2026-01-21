import mongoose from 'mongoose';

const originalSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    filename: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    filePath: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true,
        min: 0,
        max: 10 * 1024 * 1024 // 10MB max
    },
    mimeType: {
        type: String,
        required: true,
        enum: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Validation: filePath must start with /uploads/originals/
originalSchema.pre('validate', function(next) {
    if (this.filePath && !this.filePath.startsWith('/uploads/originals/')) {
        return next(new Error('filePath must start with /uploads/originals/'));
    }
    next();
});

export default mongoose.model('Original', originalSchema);

