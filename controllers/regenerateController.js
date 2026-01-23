import axios from 'axios';
import mongoose from 'mongoose';
import FormData from 'form-data';
import Original from '../models/Original.js';
import RegeneratedCartoon from '../models/RegeneratedCartoon.js';
import { getOrCreateDevice } from './deviceController.js';
import {
    readFile,
    saveFile,
    generateFilename,
    getRelativePath,
    getFileUrl
} from '../utils/fileStorage.js';

export const regenerateCartoon = async (req, res, next) => {
    try {
        const { deviceId } = req;
        const { originalId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(originalId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid originalId format'
            });
        }

        // Ensure device exists
        await getOrCreateDevice(deviceId);

        // Find original by ID and deviceId
        const original = await Original.findOne({
            _id: originalId,
            deviceId
        });

        if (!original) {
            return res.status(404).json({
                success: false,
                error: 'Original not found'
            });
        }

        // Read original image file from local storage
        let originalImageBuffer;
        try {
            originalImageBuffer = await readFile('originals', original.filename);
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: 'Failed to read original image file'
            });
        }

        // Send image file to Python AI Server
        const formData = new FormData();
        formData.append('image', originalImageBuffer, {
            filename: original.filename,
            contentType: original.mimeType
        });

        const aiServerUrl = process.env.AI_SERVER_URL || 'http://localhost:8000';

        let aiResponse;
        try {
            aiResponse = await axios.post(
                `${aiServerUrl}/generate-cartoon`,
                formData,
                {
                    headers: formData.getHeaders(),
                    responseType: 'arraybuffer', // Expect binary image data (PNG)
                    timeout: 180000 // 3 minutes timeout (matching Python server)
                }
            );
        } catch (error) {
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

        // Python server returns image file buffer
        const cartoonImageBuffer = Buffer.from(aiResponse.data);

        if (!cartoonImageBuffer || cartoonImageBuffer.length === 0) {
            return res.status(500).json({
                success: false,
                error: 'AI server returned empty image'
            });
        }

        // Save cartoon image file (temporary)
        const cartoonFilename = generateFilename(originalId);
        await saveFile(cartoonImageBuffer, 'temp', cartoonFilename);
        const cartoonFilePath = getRelativePath('temp', cartoonFilename);

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const cartoonUrl = getFileUrl('temp', cartoonFilename, baseUrl);

        // Create new RegeneratedCartoon document (temporary)
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

        // Get all regenerated cartoons for this original (including the one just created)
        const allCartoons = await RegeneratedCartoon.find({
            originalId: original._id,
            deviceId
        })
            .sort({ createdAt: -1 }) // Most recent first
            .select('_id imageUrl createdAt fileSize');

        res.status(201).json({
            success: true,
            data: {
                original: {
                    id: original._id,
                    imageUrl: original.imageUrl,
                    fileSize: original.fileSize,
                    createdAt: original.createdAt
                },
                cartoons: allCartoons.map(cartoon => ({
                    id: cartoon._id,
                    imageUrl: cartoon.imageUrl,
                    fileSize: cartoon.fileSize,
                    createdAt: cartoon.createdAt
                })),
                count: allCartoons.length
            }
        });
    } catch (error) {
        next(error);
    }
};

