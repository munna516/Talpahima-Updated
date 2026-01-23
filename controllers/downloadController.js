import axios from 'axios';
import mongoose from 'mongoose';
import RegeneratedCartoon from '../models/RegeneratedCartoon.js';
import DownloadedFace from '../models/DownloadedFace.js';
import Original from '../models/Original.js';
import { getOrCreateDevice } from './deviceController.js';
import {
    saveFile,
    generateFilename,
    getRelativePath,
    getFileUrl,
    deleteFile,
    deleteTempFilesForOriginal
} from '../utils/fileStorage.js';

export const downloadCartoon = async (req, res, next) => {
    try {
        const { deviceId } = req;
        const { cartoonId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(cartoonId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid cartoonId format'
            });
        }

        await getOrCreateDevice(deviceId);

        // Find cartoon by ID and deviceId
        const cartoon = await RegeneratedCartoon.findOne({
            _id: cartoonId,
            deviceId
        }).populate('originalId');

        if (!cartoon) {
            return res.status(404).json({
                success: false,
                error: 'Cartoon not found'
            });
        }

        const original = cartoon.originalId;

        // Check if face-cut already exists for this original
        const existingFace = await DownloadedFace.findOne({
            originalId: original._id,
            deviceId
        });

        if (existingFace) {
            return res.status(400).json({
                success: false,
                error: 'Face-cut already exists for this original image'
            });
        }

        // Send cartoon image URL to Python AI Server for face-cut processing
        const aiServerUrl = process.env.AI_FACE_SEGMENT_URL
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const cartoonImageUrl = cartoon.imageUrl.startsWith('http')
            ? cartoon.imageUrl
            : `${baseUrl}${cartoon.imageUrl}`;

        let aiResponse;
        try {
            aiResponse = await axios.post(
                `${aiServerUrl}/segment-head`,
                {
                    image_url: cartoonImageUrl
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    responseType: 'arraybuffer', // Expect binary image data
                    timeout: 180000 // 60 seconds timeout
                }
            );
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: 'AI server error: ' + (error.response?.data?.toString() || error.message)
            });
        }

        // Python server returns face-cut image file buffer
        const faceCutBuffer = Buffer.from(aiResponse.data);

        if (!faceCutBuffer || faceCutBuffer.length === 0) {
            return res.status(500).json({
                success: false,
                error: 'AI server returned empty face-cut image'
            });
        }

        // Save face-cut image file (permanent)
        const faceFilename = generateFilename(original._id.toString());
        await saveFile(faceCutBuffer, 'downloaded', faceFilename);
        const faceFilePath = getRelativePath('downloaded', faceFilename);
        const faceUrl = getFileUrl('downloaded', faceFilename, baseUrl);

        // Create DownloadedFace document (permanent)
        const downloadedFace = await DownloadedFace.create({
            deviceId,
            originalId: original._id,
            filename: faceFilename,
            filePath: faceFilePath,
            faceUrl: faceUrl,
            fileSize: faceCutBuffer.length,
            mimeType: 'image/jpeg', // Python server returns JPEG
            sourceCartoonId: cartoon._id,
            createdAt: new Date()
        });

        // Delete ALL temporary regenerated cartoons for this original
        const tempCartoons = await RegeneratedCartoon.find({
            originalId: original._id,
            deviceId
        });

        // Delete database documents
        await RegeneratedCartoon.deleteMany({
            originalId: original._id,
            deviceId
        });

        // Delete files from disk
        for (const tempCartoon of tempCartoons) {
            try {
                await deleteFile('temp', tempCartoon.filename);
            } catch (error) {
                console.error(`Error deleting temp file ${tempCartoon.filename}:`, error);
            }
        }

        res.status(201).json({
            success: true,
            data: {
                downloadedFace: {
                    id: downloadedFace._id,
                    faceUrl: downloadedFace.faceUrl,
                    originalId: downloadedFace.originalId,
                    fileSize: downloadedFace.fileSize,
                    createdAt: downloadedFace.createdAt
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

