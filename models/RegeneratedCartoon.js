import mongoose from 'mongoose';

const regeneratedCartoonSchema = new mongoose.Schema({
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
        required: true
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

// Compound index for efficient queries
regeneratedCartoonSchema.index({ originalId: 1, createdAt: -1 });
regeneratedCartoonSchema.index({ deviceId: 1, createdAt: -1 });

// Validation: filePath must start with /uploads/temp/
regeneratedCartoonSchema.pre('validate', function (next) {
    if (this.filePath && !this.filePath.startsWith('/uploads/temp/')) {
        return next(new Error('filePath must start with /uploads/temp/'));
    }
    next();
});

export default mongoose.model('RegeneratedCartoon', regeneratedCartoonSchema);
