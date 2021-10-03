import pkg from 'sequelize';
const {Model, STRING, TINYINT, TEXT, BOOLEAN} = pkg;

import sequelize from '../../common/database.js';
import services from '../../common/services/manager.js';
import {WebsocketMessage, WebsocketMessageType} from '../../common/services/websocketService.js';
import {DEVICE_TYPE} from '../../common/utils/enums.js';
import logger from '../../common/utils/logger.js';
import Room from '../../rooms/models/room.js';
import Plugin from '../../plugins/models/plugin.js';

class Device extends Model {
  toJSON() {
    const values = this.get();
    delete values.privateData;
    return values;
  }

  toRawData() {
    const privateData = this.privateData;
    const values = this.toJSON();
    values.privateData = privateData;
    return values;
  }

  toSmallRawData() {
    const values = this.get();
    delete values.privateData;
    delete values.template;
    delete values.data;
    return values;
  }
}

Device.init({
  name: {
    type: STRING,
    allowNull: false,
  },
  type: {
    type: STRING,
    allowNull: false,
    defaultValue: DEVICE_TYPE.OTHER,
  },
  driver: {
    type: STRING,
    allowNull: false,
  },
  powered: {
    type: BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  defaultAction: {
    type: STRING,
    allowNull: true,
  },
  imageOn: {
    type: STRING,
  },
  imageOff: {
    type: STRING,
  },
  sortOrder: {
    type: TINYINT,
    allowNull: false,
    defaultValue: 100,
  },
  template: {
    type: TEXT,
    allowNull: true,
    get: function() {
      let data = this.getDataValue('template');
      if (data) {
        data = JSON.parse(data);
      }
      return data;
    },
    set: function(value) {
      if (value) {
        this.setDataValue('template', JSON.stringify(value));
      } else {
        this.setDataValue('template', null);
      }
    },
  },
  data: {
    type: TEXT,
    get: function() {
      let data = this.getDataValue('data');
      if (data) {
        data = JSON.parse(data);
      }
      return data;
    },
    set: function(value) {
      if (value) {
        this.setDataValue('data', JSON.stringify(value));
      }
    },
  },
  privateData: {
    type: TEXT,
    get: function() {
      let data = this.getDataValue('privateData');
      if (data) {
        data = JSON.parse(data);
      }
      return data;
    },
    set: function(value) {
      if (value) {
        this.setDataValue('privateData', JSON.stringify(value));
      }
    },
  },
}, {
  hooks: {
    beforeValidate: async (device, options) => {
      // if not provided let's put a default
      if (!device.sortOrder) {
        device.sortOrder = 100;
      }
    },
    afterBulkCreate(devices, options) {
      logger.info('afterBulkCreate');
      logger.info(devices);
      for (const device of devices) {
        services.websocketService.broadcast(new WebsocketMessage(WebsocketMessageType.DEVICE_ADDED, device.toJSON()));
      }
    },
    afterCreate: async (device) => {
      logger.info('afterCreate');
      logger.info(device);
      services.websocketService.broadcast(new WebsocketMessage(WebsocketMessageType.DEVICE_ADDED, device.toJSON()));
    },
    afterDestroy(device) {
      logger.info('afterDestroy');
      services.websocketService.broadcast(new WebsocketMessage(WebsocketMessageType.DEVICE_DELETED, device.toJSON()));
    },
    afterSave(device) {
      logger.info('afterSave');
      logger.info(device);
      services.websocketService.broadcast(new WebsocketMessage(WebsocketMessageType.DEVICE_UPDATED, device.toJSON()));
    }
  },
  sequelize,
  modelName: 'device',
});

Device.belongsTo(Room, {
  as: 'room',
  foreignKey: {
    name: 'roomId',
    allowNull: true,
  },
});

Device.belongsTo(Plugin, {
  as: 'plugin',
  onDelete: 'CASCADE',
  foreignKey: {
    name: 'pluginName',
    allowNull: false,
  },
});

export default Device;
