import express from 'express';
import { validateDeviceId } from '../middleware/deviceValidator.js';
import { uploadMiddleware, uploadImage } from '../controllers/uploadController.js';

const router = express.Router();

router.post(
    '/',
    validateDeviceId,
    uploadMiddleware,
    uploadImage
);

export default router;

