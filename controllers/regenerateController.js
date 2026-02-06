import Replicate from "replicate";
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

        const replicate = new Replicate({
            auth: process.env.REPLICATE_API_TOKEN,
        });

        const imageBuffer = originalImageBuffer.toString('base64');
        const dataURI = `data:${original.mimeType};base64,${imageBuffer}`;


        const input = {
            input_image: dataURI,
        };

        const output = await replicate.run("flux-kontext-apps/cartoonify", { input });

        // Convert Replicate output stream to buffer
        const chunks = [];
        for await (const chunk of output) {
            chunks.push(chunk);
        }

        // Python server returns image file buffer
        const cartoonImageBuffer = Buffer.concat(chunks);

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

