import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import { ensureUploadDirs } from './utils/fileStorage.js';
import uploadRoutes from './routes/uploadRoutes.js';
import regenerateRoutes from './routes/regenerateRoutes.js';
import cartoonRoutes from './routes/cartoonRoutes.js';
import originalRoutes from './routes/originalRoutes.js';
import downloadRoutes from './routes/downloadRoutes.js';
import downloadedFaceRoutes from './routes/downloadedFaceRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '1d', // Cache for 1 day
    etag: true,
    lastModified: true
}));

// Root route
app.get('/', (req, res) => {
    res.send('Toon App Cartoon Generator Server is Running');
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is online' });
});

// API Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/regenerate', regenerateRoutes);
app.use('/api/cartoons', cartoonRoutes);
app.use('/api/originals', originalRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/downloaded-faces', downloadedFaceRoutes);

// Error handling middleware
app.use(errorHandler);

// Connect to database, ensure upload directories, and start server
connectDB()
    .then(async () => {
        // Ensure upload directories exist
        await ensureUploadDirs();


        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);

        });
    })
    .catch((error) => {
        console.error('Failed to start server:', error);

    });

