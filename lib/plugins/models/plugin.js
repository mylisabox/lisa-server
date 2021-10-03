import pkg from 'sequelize';
const {Model, TEXT, BOOLEAN, STRING} = pkg;

import sequelize from '../../common/database.js';

class Plugin extends Model {
}

Plugin.init({
  internalName: {
    type: STRING,
    allowNull: false,
  },
  name: {
    type: STRING,
    primaryKey: true,
    allowNull: false,
  },
  camelName: {
    type: STRING,
    uniq: true,
    allowNull: false,
  },
  version: {
    type: STRING,
    allowNull: false,
  },
  activated: {
    type: BOOLEAN,
    defaultValue: false,
  },
  settings: {
    type: TEXT,
    get: function() {
      const settings = this.getDataValue('settings');
      if (!settings) {
        return null;
      }
      return JSON.parse(settings);
    },
    set: function(value) {
      if (value) {
        this.setDataValue<String>('settings', JSON.stringify(value));
      } else {
        this.setDataValue<String>('settings', null);
      }
    },
  },
  devicesSettings: {
    type: TEXT,
    get: function() {
      const data = this.getDataValue('devicesSettings');
      if (!data) {
        return null;
      }
      return JSON.parse(data);
    },
    set: function(value) {
      if (value) {
        this.setDataValue('devicesSettings', JSON.stringify(value));
      } else {
        this.setDataValue('devicesSettings', null);
      }
    },
  },
  infos: {
    type: TEXT,
    allowNull: false,
    get: function() {
      const data = this.getDataValue('infos');
      if (!data) {
        return null;
      }
      return JSON.parse(data);
    },
    set: function(value) {
      if (value) {
        this.setDataValue('infos', JSON.stringify(value));
      } else {
        this.setDataValue('infos', null);
      }
    },
  },
}, {
  hooks: {
    beforeValidate: async (room, options) => {
      // if not provided let's put a default
      if (!room.sortOrder) {
        room.sortOrder = 100;
      }
    },
  },
  sequelize,
  modelName: 'plugin',
});

export default Plugin;
