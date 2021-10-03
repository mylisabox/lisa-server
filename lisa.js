'use strict';
import bonjourFactory from 'bonjour';
import EventEmitter from 'events';
import mdns from 'mdns-js';
import {isEqual, differenceWith, differenceBy, difference} from 'lodash-es';
import ChatBot from './lib/chatbots/models/chatbot.js';
import Preference from './lib/common/models/preference.js';
import services from './lib/common/services/manager.js';
import {DEVICE_TYPE, NOTIFICATION_TYPE} from './lib/common/utils/enums.js';
import logger from './lib/common/utils/logger.js';
import Device from './lib/devices/models/device.js';
import Room from './lib/rooms/models/room.js';

const bonjour = bonjourFactory();
const LISA = (function() {
  /**
   * Get native stack
   * @return array of javascript calls
   */
  const getStack = function() {
    // Save original Error.prepareStackTrace
    const origPrepareStackTrace = Error.prepareStackTrace;
    // Override with function that just returns `stack`
    Error.prepareStackTrace = (_, stack) => stack;

    // Create a new `Error`, which automatically gets `stack`
    const err = new Error();
    // Evaluate `err.stack`, which calls our new `Error.prepareStackTrace`
    const stack = err.stack;
    // Restore original `Error.prepareStackTrace`
    Error.prepareStackTrace = origPrepareStackTrace;
    // Remove superfluous function call on stack
    stack.shift(); // getStack --> Error
    return stack;
  };

  /**
   * Get path of the current plugin
   * @return path
   */
  const getCaller = () => {
    const stack = getStack();
    stack.shift();
    let obj;
    for (let i = 0; i < stack.length; i++) {
      obj = stack[i];
      if (obj.getFileName().toLowerCase().indexOf('plugin-') !== -1) {
        break;
      }
    }
    // Return caller's caller
    return obj.getFileName();
  };

  /**
   * Get name of the current plugin
   * @return string name
   */
  const getCurrentPlugin = () => {
    const pathString = getCaller();
    const parts = pathString.split('/');
    let part = parts.find((part) => part.indexOf('lisa-plugin') !== -1);
    if (!part) {
      part = 'unknown';
    }
    const name = part.replace(/lisa\-/, '').replace(/plugin\-/, '').toCamelCase();
    return services.pluginService.plugins[name] ? services.pluginService.plugins[name].fullName : 'unknown';
  };

  return class LISA extends EventEmitter {
    get NOTIFICATION_TYPE() {
      return NOTIFICATION_TYPE;
    }

    get DEVICE_TYPE() {
      return DEVICE_TYPE;
    }

    constructor() {
      super();
    }

    toCamelCase(input) {
      return input.toCamelCase();
    }

    getRooms() {
      return Room.findAll().then((rooms) => {
        return Promise.resolve(rooms.map((room) => room.toJSON()));
      });
    }

    createRoom(name) {
      return Room.create({name: name}).then((room) => {
        return Promise.resolve(room.toJSON());
      });
    }

    async createOrUpdateDevices(device, criteria) {
      const plugin = getCurrentPlugin();
      // logger.debug(plugin)
      let promise;

      if (Array.isArray(device)) {
        const toCreate = device.filter((element) => !element.id).map((device) => {
          device.pluginName = plugin;
          return device;
        });
        const toUpdate = device.filter((element) => element.id);
        const todo = [];

        if (toCreate.length > 0) {
          todo.push(Device.bulkCreate(toCreate));
        }
        if (toUpdate.length > 0) {
          for (const deviceToUpdate of toUpdate) {
            todo.push(this.createOrUpdateDevices(deviceToUpdate));
          }
        }
        promise = Promise.all(todo);
      }
      else {
        device.pluginName = plugin;
        if (device.id) {
          const existingDevice = (await Device.findByPk(device.id)).toRawData();
          delete existingDevice.createdAt;
          delete existingDevice.updatedAt;
          device.data = {...device.data}; // transform class instance like Light to plain object to compare later

          //update only if there is different with what's on database to avoid unnecessary websocket events
          if (isEqual(existingDevice, device)) {
            promise = Promise.resolve(existingDevice);
          } else{
            promise = Device.update(device, {
              where: {
                id: device.id,
              },
              individualHooks: true,
            });
          }
        }
        else if (criteria) {
          criteria.pluginName = plugin;
          promise = Device.update(device, {
            where: criteria,
            individualHooks: true,
          });
        }
        else {
          promise = Device.create(device);
        }
      }

      return promise.then((device) => {
        if (Array.isArray(device)) {
          return device.map((item) => {
            if (item.toRawData) {
              return item.toRawData();
            }
            return item;
          });
        }
        else {
          if (device.toRawData) {
            return device.toRawData();
          }
          return device;
        }
      });
    }

    /**
     *
     * @param criteria to retrieve specific devices
     * @return Promise
     */
    findDevices(criteria) {
      criteria = criteria || {};
      // logger.debug(plugin)
      criteria.pluginName = getCurrentPlugin();

      const promise = criteria.id ? Device.find({
        where: criteria,
      }) : Device.findAll({
        where: criteria,
      });

      return promise.then((devices) => {
        if (Array.isArray(devices)) {
          return devices.map((device) => device.toRawData());
        } else {
          return devices.toRawData();
        }
      });
    }

    /**
     * Send notification to the user(s)
     * @param to @optional user id to send the notif to
     * @param title of the notif
     * @param type
     * @param desc of the notif
     * @param image of the notif
     * @param defaultAction of the notif
     * @param action of the notif
     * @param lang of the notif
     * @return Promise - notif data
     */
    sendNotification(to, title, type, desc, image, defaultAction, action, lang) {
      const plugin = getCurrentPlugin();
      return services.notificationService.sendNotification(to, plugin, title, type, desc, image, defaultAction,
          action, lang, 'default').then((notification) => notification.toJSON());
    }

    /**
     * Retrieve plugin preferences
     * @return {Promise} preferences or error
     */
    getPreferences() {
      const plugin = getCurrentPlugin();
      logger.debug(plugin);
      return Preference.findByPk(plugin + '_prefs').then((preferences) => {
        return preferences ? preferences.value : {};
      });
    }

    /**
     * Set plugin preferences
     * @param preferences to save
     * @return {Promise} saved preferences or error
     */
    setPreferences(preferences) {
      const plugin = getCurrentPlugin();
      logger.debug(plugin);
      return Preference.upsert({
        key: plugin + '_prefs',
        value: preferences,
      }).then(() => {
        return preferences;
      });
    }

    addChatBot(botId, botData) {
      botData.pluginName = getCurrentPlugin();
      return services.chatBotService.addBot(botId, botData).then((chatBot) => Promise.resolve(chatBot.toJSON()));
    }

    getChatBot(botId = null) {
      const plugin = getCurrentPlugin();
      const where = {
        pluginName: plugin,
      };
      if (botId) {
        where.name = botId;
      }
      return ChatBot.findAll({
        where: where,
      }).then((chatBots) => Promise.resolve(chatBots.map((bot) => bot.toJSON())));
    }

    updateChatBot(botId, botData) {
      botData.pluginName = getCurrentPlugin();
      return services.chatBotService.updateBot(botId, botData).then((_) => Promise.resolve());
    }

    deleteChatBot(botId) {
      // const plugin = getCurrentPlugin()
      return services.chatBotService.deleteBot(botId).then((_) => Promise.resolve());
    }

    get log() {
      const getArguments = (args) => {
        const plugin = getCurrentPlugin();
        const mainArguments = Array.prototype.slice.call(args);
        return [plugin + ':'].concat(mainArguments);
      };

      return {
        debug: function() {
          logger.debug(JSON.stringify(getArguments(arguments)));
        },
        info: function() {
          logger.info(JSON.stringify(getArguments(arguments)));
        },
        error: function() {
          logger.error(JSON.stringify(getArguments(arguments)));
        },
        silly: function() {
          logger.silly(JSON.stringify(getArguments(arguments)));
        },
        verbose: function() {
          logger.verbose(JSON.stringify(getArguments(arguments)));
        },
        warn: function() {
          logger.warn(JSON.stringify(getArguments(arguments)));
        },
      };
    }

    get bonjour() {
      return bonjour;
    }

    get mdns() {
      return mdns;
    }

    get ir() {
      return {
        send: (remote, action) => {
          return services.irService.send(remote, action);
        },
      };
    }
  };
})();

export default new LISA();
