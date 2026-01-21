import express from 'express';
import { validateDeviceId } from '../middleware/deviceValidator.js';
import { getAllOriginals } from '../controllers/originalController.js';

const router = express.Router();

router.get(
    '/',
    validateDeviceId,
    getAllOriginals
);

export default router;

