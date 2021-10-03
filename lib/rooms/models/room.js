import pkg from 'sequelize';
import sequelize from '../../common/database.js';
import services from '../../common/services/manager.js';
import {WebsocketMessage, WebsocketMessageType} from '../../common/services/websocketService.js';
import logger from '../../common/utils/logger.js';

const {Model, TINYINT, STRING} = pkg;

class Room extends Model {
}

Room.init({
  name: {
    type: STRING,
    allowNull: false,
  },
  sortOrder: {
    type: TINYINT,
    allowNull: false,
    defaultValue: 100,
  },
}, {
  hooks: {
    afterBulkCreate(rooms, options) {
      logger.info('afterBulkCreate');
      logger.info(rooms);
      for (const room of rooms) {
        services.websocketService.broadcast(new WebsocketMessage(WebsocketMessageType.ROOM_ADDED, room));
      }
    },
    afterCreate: async (room) => {
      logger.info('afterCreate');
      services.websocketService.broadcast(new WebsocketMessage(WebsocketMessageType.ROOM_ADDED, room));
      logger.info(room.toJSON().toString());
    },
    afterDestroy(room) {
      logger.info('afterDestroy');
      services.websocketService.broadcast(new WebsocketMessage(WebsocketMessageType.ROOM_DELETED, room));
    },
    afterSave(room) {
      logger.info('afterSave');
      logger.info(JSON.stringify(room.toJSON()));
      services.websocketService.broadcast(new WebsocketMessage(WebsocketMessageType.ROOM_UPDATED, room));
    },
    afterUpdate(room) {
      logger.info('afterUpdate');
      logger.info(JSON.stringify(room.toJSON()));
    },
  },
  sequelize,
  modelName: 'room',
});

export default Room;
