import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import Original from '../models/Original.js';
import RegeneratedCartoon from '../models/RegeneratedCartoon.js';
import { getOrCreateDevice } from './deviceController.js';
import {
    saveFile,
    generateFilename,
    getRelativePath,
    getFileUrl,
    deleteFile
} from '../utils/fileStorage.js';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB lim
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            console.log("upload done");
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (JPEG, PNG, WebP)'), false);
        }
    }
});

export const uploadMiddleware = upload.single('image');

export const uploadImage = async (req, res, next) => {
    try {
        const { deviceId } = req;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }

        // Ensure device exists
        await getOrCreateDevice(deviceId);

        // Save original image file
        const originalFilename = generateFilename(deviceId);
        await saveFile(file.buffer, 'originals', originalFilename);
        const originalFilePath = getRelativePath('originals', originalFilename);

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const originalUrl = getFileUrl('originals', originalFilename, baseUrl);

        // Send image file to Python AI Server
        const formData = new FormData();
        formData.append('image', file.buffer, {
            filename: file.originalname || 'image.jpg',
            contentType: file.mimetype
        });


        const aiServerUrl = process.env.AI_SERVER_URL || 'http://localhost:8000';

        let aiResponse;
        console.log("Node backend")
        try {
            console.log("AI is called here....")
            aiResponse = await axios.post(
                `${aiServerUrl}/generate-cartoon`,
                formData,
                {
                    headers: formData.getHeaders(),
                    responseType: 'arraybuffer', // Expect binary image data (PNG)
                    timeout: 180000 // 3 minutes timeout (matching Python server)
                }
            );
            console.log("AI is finishes")
        } catch (error) {
            // If Python server fails, clean up saved original file
            try {
                await deleteFile('originals', originalFilename);
            } catch (cleanupError) {
                console.error('Error cleaning up original file:', cleanupError);
            }

            // Better error message handling
            let errorMessage = 'AI server error';
            if (error.response) {
                // Try to parse error response
                if (error.response.data) {
                    try {
                        let errorData = error.response.data;

                        // If it's a buffer, convert to string
                        if (Buffer.isBuffer(errorData)) {
                            errorData = errorData.toString('utf-8');
                        }

                        // If it's an object, try to extract message
                        if (typeof errorData === 'object' && errorData !== null) {
                            // FastAPI uses 'detail' field for errors
                            errorMessage = errorData.detail || errorData.error || errorData.message || JSON.stringify(errorData);
                        }
                        // If it's a string, check if it's JSON
                        else if (typeof errorData === 'string') {
                            if (errorData.startsWith('{') || errorData.startsWith('[')) {
                                try {
                                    const parsed = JSON.parse(errorData);
                                    errorMessage = parsed.detail || parsed.error || parsed.message || errorData;
                                } catch {
                                    errorMessage = errorData;
                                }
                            } else {
                                errorMessage = errorData;
                            }
                        } else {
                            errorMessage = String(errorData);
                        }
                    } catch (parseError) {
                        errorMessage = error.response.statusText || error.message || 'Unknown error';
                    }
                } else {
                    errorMessage = error.response.statusText || error.message || 'Unknown error';
                }
            } else if (error.request) {
                errorMessage = 'Failed to connect to AI server. Please check if the AI server is running.';
            } else {
                errorMessage = error.message || 'Unknown error occurred';
            }

            // Provide more helpful error message for 404 errors
            if (error.response?.status === 404) {
                return res.status(500).json({
                    success: false,
                    error: `AI server endpoint not found. Please check if the endpoint '/generate-cartoon' exists on the Python server at ${aiServerUrl}. Error: ${errorMessage}`
                });
            }

            return res.status(500).json({
                success: false,
                error: `AI server error: ${errorMessage}`
            });
        }

        // Python server returns PNG image file buffer via StreamingResponse
        const cartoonImageBuffer = Buffer.from(aiResponse.data);

        // Extract image_id from response headers (if provided by Python server)
        const imageId = aiResponse.headers['x-image-id'] || null;

        if (!cartoonImageBuffer || cartoonImageBuffer.length === 0) {
            // Clean up original file
            try {
                await deleteFile('originals', originalFilename);
            } catch (cleanupError) {
                console.error('Error cleaning up original file:', cleanupError);
            }

            return res.status(500).json({
                success: false,
                error: 'AI server returned empty image'
            });
        }

        // Create Original document
        const original = await Original.create({
            deviceId,
            filename: originalFilename,
            filePath: originalFilePath,
            imageUrl: originalUrl,
            fileSize: file.buffer.length,
            mimeType: file.mimetype,
            createdAt: new Date()
        });

        // Save cartoon image file (temporary)
        const cartoonFilename = generateFilename(original._id.toString());
        await saveFile(cartoonImageBuffer, 'temp', cartoonFilename);
        const cartoonFilePath = getRelativePath('temp', cartoonFilename);
        const cartoonUrl = getFileUrl('temp', cartoonFilename, baseUrl);

        // Create RegeneratedCartoon document (temporary)
        const cartoon = await RegeneratedCartoon.create({
            deviceId,
            originalId: original._id,
            filename: cartoonFilename,
            filePath: cartoonFilePath,
            imageUrl: cartoonUrl,
            fileSize: cartoonImageBuffer.length,
            mimeType: 'image/png', // Python server returns PNG
            createdAt: new Date()
        });
        console.log("Node backend is finishing")
        res.status(201).json({
            success: true,
            data: {
                original: {
                    id: original._id,
                    imageUrl: original.imageUrl,
                    fileSize: original.fileSize,
                    createdAt: original.createdAt
                },
                cartoon: {
                    id: cartoon._id,
                    imageUrl: cartoon.imageUrl,
                    createdAt: cartoon.createdAt
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

