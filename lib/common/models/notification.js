const {Model, STRING, ENUM} = require('sequelize');
const sequelize = require('../../common/database');
const services = require('../../common/services/manager');
const Plugin = require('../../plugins/models/plugin');
const {NOTIFICATION_TYPE} = require('../utils/enums');
const User = require('../../users/models/user');
const logger = require('../utils/logger');

class Notification extends Model {
}

Notification.init({
  title: {
    type: STRING,
    allowNull: false,
  },
  description: {
    type: STRING,
    allowNull: true,
  },
  icon: {
    type: STRING,
    allowNull: true,
  },
  defaultAction: {
    type: STRING,
    allowNull: true,
  },
  addAction: {
    type: STRING,
    allowNull: true,
  },
  lang: {
    type: STRING,
    allowNull: false,
  },
  state: {
    type: new ENUM('UNREAD', 'READ'),
    defaultValue: 'UNREAD',
    allowNull: false,
  },
  type: {
    type: ENUM,
    values: _.values(NOTIFICATION_TYPE),
    defaultValue: NOTIFICATION_TYPE.AUTO,
  },
  pluginNotificationId: {
    type: STRING,
    allowNull: true,
  },
  template: {
    type: STRING,
    defaultValue: 'default',
    allowNull: false,
  },
}, {
  hooks: {
    afterCreate: (values, options, fn) => {
      services.notificationService
          .sendNotification(values)
          .catch((err) => logger.error(err));
      fn();
    },
  },
  sequelize,
  modelName: 'notification',
});


Notification.belongsTo(User, {
  as: 'user',
  onDelete: 'CASCADE',
});

Notification.belongsTo(Plugin, {
  as: 'plugin',
  foreignKey: {
    name: 'pluginName',
    allowNull: true,
  },
  onDelete: 'CASCADE',
});

export default Notification;
