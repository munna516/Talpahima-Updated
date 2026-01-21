import mongoose from 'mongoose';

const downloadedFaceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    originalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Original',
        required: true
    },
    filename: {
        type: String,
        required: true,
        unique: true
    },
    filePath: {
        type: String,
        required: true
    },
    faceUrl: {
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
    sourceCartoonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RegeneratedCartoon',
        required: false // Optional for history tracking
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Compound index for efficient queries
downloadedFaceSchema.index({ deviceId: 1, createdAt: -1 });
downloadedFaceSchema.index({ originalId: 1 }, { unique: true }); // One face per original

// Validation: filePath must start with /uploads/downloaded/
downloadedFaceSchema.pre('validate', function (next) {
    if (this.filePath && !this.filePath.startsWith('/uploads/downloaded/')) {
        return next(new Error('filePath must start with /uploads/downloaded/'));
    }
    next();
});

export default mongoose.model('DownloadedFace', downloadedFaceSchema);
