import pkg from 'sequelize';
const {Model, STRING, BOOLEAN} = pkg;

import sequelize from '../../common/database.js';
import Plugin from '../../plugins/models/plugin.js';

class ChatBot extends Model {
}

ChatBot.init(
    {
      name: {
        type: STRING,
        primaryKey: true,
        allowNull: false,
      },
      displayName: {
        type: STRING,
        allowNull: false,
      },
      enabled: {
        type: BOOLEAN,
        defaultValue: true,
      },
      data: {
        type: STRING,
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
          } else {
            this.setDataValue('data', null);
          }
        },
        allowNull: false,
      },
      originalData: {
        type: STRING,
        get: function() {
          let data = this.getDataValue('originalData');
          if (data) {
            data = JSON.parse(data);
          }
          return data;
        },
        set: function(value) {
          if (value) {
            this.setDataValue('originalData', JSON.stringify(value));
          } else {
            this.setDataValue('originalData', null);
          }
        },
        allowNull: false,
      },
      context: {
        type: STRING,
        get: function() {
          let data = this.getDataValue('context');
          if (data) {
            data = JSON.parse(data);
          }
          return data;
        },
        set: function(value) {
          if (value) {
            this.setDataValue('context', JSON.stringify(value));
          } else {
            this.setDataValue('context', null);
          }
        },
        allowNull: true,
      },

    }, {
      hooks: {

      },
      sequelize,
      modelName: 'chatbot',
    });

ChatBot.belongsTo(Plugin, {
  as: 'plugin',
  onDelete: 'CASCADE',
  allowNull: true,
  foreignKey: {
    name: 'pluginName',
    allowNull: true,
  },
});

export default ChatBot;
