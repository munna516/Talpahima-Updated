import Replicate from "replicate";
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

        console.log(originalUrl)

    
        const replicate = new Replicate({
            auth: process.env.REPLICATE_API_TOKEN,
        });

        const imageBuffer = file.buffer.toString('base64');
        const dataURI = `data:${file.mimetype};base64,${imageBuffer}`;


        const input = {
            input_image: dataURI,
        };

        const output = await replicate.run("flux-kontext-apps/cartoonify", { input });

        // To access the file URL:
        console.log("Replicate output:", output);

        // Convert Replicate output stream to buffer
        const chunks = [];
        for await (const chunk of output) {
            chunks.push(chunk);
        }
        const cartoonImageBuffer = Buffer.concat(chunks);

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

