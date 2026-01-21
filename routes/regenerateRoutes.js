import express from 'express';
import { validateDeviceId } from '../middleware/deviceValidator.js';
import { regenerateCartoon } from '../controllers/regenerateController.js';

const router = express.Router();

router.post(
    '/:originalId',
    validateDeviceId,
    regenerateCartoon
);

export default router;

