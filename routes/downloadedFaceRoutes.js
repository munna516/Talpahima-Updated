import express from 'express';
import { validateDeviceId } from '../middleware/deviceValidator.js';
import { getAllDownloadedFaces } from '../controllers/downloadedFaceController.js';

const router = express.Router();

router.get(
    '/',
    validateDeviceId,
    getAllDownloadedFaces
);

export default router;
