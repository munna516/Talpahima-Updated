import Original from '../models/Original.js';
import { getOrCreateDevice } from './deviceController.js';

export const getAllOriginals = async (req, res, next) => {
    try {
        const { deviceId } = req;

        await getOrCreateDevice(deviceId);

        const originals = await Original.find({ deviceId })
            .sort({ createdAt: -1 })
            .select('_id imageUrl fileSize createdAt');

        res.json({
            success: true,
            data: {
                originals: originals.map(original => ({
                    id: original._id,
                    imageUrl: original.imageUrl,
                    fileSize: original.fileSize,
                    createdAt: original.createdAt
                })),
                count: originals.length
            }
        });
    } catch (error) {
        next(error);
    }
};

