import { validate as uuidValidate } from 'uuid';

export const validateDeviceId = (req, res, next) => {
    const deviceId = req.headers['x-device-id'];

    if (!deviceId) {
        return res.status(400).json({
            success: false,
            error: 'Missing x-device-id header'
        });
    }

    req.deviceId = deviceId;
    next();
};

