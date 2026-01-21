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
                    responseType: 'arraybuffer', // Expect binary image data
                    timeout: 60000 // 60 seconds timeout
                }
            );
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: 'AI server error: ' + (error.response?.data?.toString() || error.message)
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
            mimeType: 'image/jpeg', // Python server returns JPEG
            createdAt: new Date()
        });

        res.status(201).json({
            success: true,
            data: {
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

