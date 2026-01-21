import Device from '../models/Device.js';

export const getOrCreateDevice = async (deviceId) => {
    let device = await Device.findOne({ deviceId });

    if (!device) {
        device = await Device.create({
            deviceId,
            createdAt: new Date(),
            lastActiveAt: new Date()
        });
    } else {
        device.lastActiveAt = new Date();
        await device.save();
    }

    return device;
};

