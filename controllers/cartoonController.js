import mongoose from 'mongoose';
import RegeneratedCartoon from '../models/RegeneratedCartoon.js';
import { getOrCreateDevice } from './deviceController.js';

export const getAllCartoons = async (req, res, next) => {
    try {
        const { deviceId } = req;
        const { originalId } = req.query;

        await getOrCreateDevice(deviceId);

        const query = { deviceId };
        if (originalId && mongoose.Types.ObjectId.isValid(originalId)) {
            query.originalId = originalId;
        }

        const cartoons = await RegeneratedCartoon.find(query)
            .populate('originalId', '_id imageUrl createdAt')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: {
                cartoons: cartoons.map(cartoon => ({
                    id: cartoon._id,
                    imageUrl: cartoon.imageUrl,
                    createdAt: cartoon.createdAt,
                    original: {
                        id: cartoon.originalId._id,
                        imageUrl: cartoon.originalId.imageUrl,
                        createdAt: cartoon.originalId.createdAt
                    }
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

