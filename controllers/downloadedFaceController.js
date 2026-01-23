import DownloadedFace from '../models/DownloadedFace.js';
import { getOrCreateDevice } from './deviceController.js';

export const getAllDownloadedFaces = async (req, res, next) => {
    try {
        const { deviceId } = req;

        await getOrCreateDevice(deviceId);

        const downloadedFaces = await DownloadedFace.find({ deviceId })
            .populate('originalId', '_id imageUrl createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await DownloadedFace.countDocuments({ deviceId });
        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: {
                downloadedFaces: downloadedFaces.map(face => ({
                    id: face._id,
                    faceUrl: face.faceUrl,
                    fileSize: face.fileSize,
                    original: {
                        id: face.originalId._id,
                        imageUrl: face.originalId.imageUrl,
                        createdAt: face.originalId.createdAt
                    },
                    createdAt: face.createdAt
                })),

            }
        });
    } catch (error) {
        next(error);
    }
};
