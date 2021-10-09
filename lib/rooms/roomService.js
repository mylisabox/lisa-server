import sequelize from "../common/database.js";
import {NotFoundError} from '../common/models/error.js';
import Service from '../common/models/service.js';
import Device from '../devices/models/device.js';
import Room from './models/room.js';

class RoomService extends Service {
    async reorder(order) {
        let i = 0;
        const t = await sequelize.transaction();
        try {
            for (const id of order) {
                await Room.update({sortOrder: i}, {
                    where: {id: id},
                    transaction: t
                });
                i++;
            }
            await t.commit();
        } catch (error) {
            // If the execution reaches this line, an error was thrown.
            // We rollback the transaction.
            await t.rollback();
            throw error;
        }
    }

    async getAll() {
        const rooms = await Room.findAll({
            order: [
                ['sortOrder', 'ASC'],
                ['id', 'ASC'],
            ],
        });
        const devices = await Device.findAll({
            order: [
                ['sortOrder', 'ASC'],
                ['id', 'ASC'],
            ],
        });
        const roomsWithDevices = [];
        for (const room of rooms) {
            const roomWithDevices = {
                id: room.id,
                name: room.name,
                devices: [],
                sortOrder: room.sortOrder,
            };
            for (const device of devices) {
                if (device.roomId === room.id) {
                    roomWithDevices.devices.push(device.toSmallRawData());
                }
            }
            roomsWithDevices.push(roomWithDevices);
        }
        const orphanRoom = {
            id: -1,
            name: 'Orphans',
            devices: [],
            sortOrder: 200,
        };

        for (const device of devices) {
            if (device.roomId === null) {
                orphanRoom.devices.push(device.toSmallRawData());
            }
        }
        roomsWithDevices.push(orphanRoom);
        return roomsWithDevices;
    }

    delete(id) {
        return Room.destroy({
            where: {
                id: id,
            },
            individualHooks: true,
        });
    }

    async save(data) {
        if (data.id) {
            const result = await Room.update(data, {
                where: {
                    id: data.id,
                },
                individualHooks: true,
            });
            if (result[0] === 0) {
                throw new NotFoundError('Room not found');
            }
            return Room.findByPk(data.id);
        }
        else {
            return Room.create(data);
        }
    }
}

export default RoomService;
