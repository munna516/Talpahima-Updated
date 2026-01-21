import express from 'express';
import { validateDeviceId } from '../middleware/deviceValidator.js';
import { downloadCartoon } from '../controllers/downloadController.js';

const router = express.Router();

router.post(
    '/:cartoonId',
    validateDeviceId,
    downloadCartoon
);

export default router;

