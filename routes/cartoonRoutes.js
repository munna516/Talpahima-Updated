import express from 'express';
import { validateDeviceId } from '../middleware/deviceValidator.js';
import { getAllCartoons } from '../controllers/cartoonController.js';

const router = express.Router();

router.get(
    '/',
    validateDeviceId,
    getAllCartoons
);

export default router;

