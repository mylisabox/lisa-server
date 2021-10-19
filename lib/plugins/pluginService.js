import download from 'download';
import npm from 'enpeem';
import fs from 'fs/promises';
import _ from 'lodash-es';
import {createRequire} from 'module';
import path from 'path';
import pkg from 'sequelize';
import config from '../../config/config.js';
import lisa from '../../lisa.js';
import ChatBot from '../chatbots/models/chatbot.js';
import {NotFoundError, PayloadError} from '../common/models/error.js';
import Service from '../common/models/service.js';
import Device from '../devices/models/device.js';
import Plugin from '../plugins/models/plugin.js';
import Room from '../rooms/models/room.js';

const {Op} = pkg;

const require = createRequire(import.meta.url);

class PluginService extends Service {
    constructor(services) {
        super(services);
        this.plugins = {};
    }

    _getPluginInstance(pluginName) {
        let plugin;
        if (pluginName) {
            plugin = this.plugins[this._getPluginName(pluginName)];
        }
        return plugin;
    }

    _getPluginName(pluginName) {
        return pluginName.replace(/lisa-/, '').replace(/plugin-/, '').toCamelCase();
    }

    _getPluginPath(pluginName) {
        return `${global.appRoot}/plugins/${pluginName}/index.js`;
    }

    _translatePlugin(lang, plugins) {
        const results = [];
        for (let plugin of plugins) {
            plugin = plugin.toJSON();
            const infos = plugin.infos;

            const image = this._translateField(lang, infos.image);

            const pluginData = {
                id: plugin.name,
                name: this._translateField(lang, infos.name),
                description: this._translateField(lang, infos.description),
                image: image,
                settings: this._translateSettings(lang, plugin.settings),
                devicesSettings: this._translateDevices(lang, plugin, plugin.devicesSettings),
            };
            results.push(pluginData);
        }
        return results;
    }

    _translateDevices(lang, plugin, devices) {
        const translatedDevices = [];
        for (const device of devices) {
            const image = this._translateField(lang, device.image);
            const imageOn = this._translateField(lang, device.imageOn);
            const imageOff = this._translateField(lang, device.imageOff);
            const defaultAction = this._translateField(lang, device.defaultAction);
            const settings = this._translateSettings(lang, device.settings);
            translatedDevices.push({
                name: this._translateField(lang, device.name),
                description: this._translateField(lang, device.description),
                template: device.template,
                driver: device.driver,
                pluginName: plugin.name,
                type: device.type,
                image: image,
                defaultAction: defaultAction,
                imageOff: imageOff,
                imageOn: imageOn,
                settings: settings,
                pairing: device.pairing,
            });
        }
        return translatedDevices;
    }

    _translateSettings(lang, settings) {
        const translatedSettings = [
            'labelText',
            'text',
            'hintText',
            'errorText',
            'counterText',
            'helperText',
            'prefixText',
            'suffixText',
        ];
        if (settings) {
            for (const setting in settings) {
                if (typeof settings[setting] === 'object') {
                    settings[setting] = this._translateSettings(lang, settings[setting]);
                }
                else {
                    if (translatedSettings.includes(setting)) {
                        settings[setting] = this._translateField(lang, settings[setting]);
                    }
                }
            }
        }
        return settings;
    }

    _translateField(lang, field) {
        let result;
        if (field) {
            if (_.isString(field)) {
                result = field;
            }
            else if (field[lang]) {
                result = field[lang];
            }
            else {
                result = field['en'];
            }
        }
        return result;
    }

    async find(lang, query) {
        let options = {};
        if (query) {
            options = {
                where: {
                    name: {
                        [Op.like]: `%${query}%`
                    }
                }
            };
        }

        const plugins = await Plugin.findAll(options);
        return this._translatePlugin(lang, plugins);
    }

    async _managePluginBots(pluginName, bots) {
        if (!bots) {
            bots = {};
        }
        const botIds = Object.keys(bots);

        if (botIds.length === 0) {
            return Promise.resolve();
        }
        const promises = [];
        try {
            const chatBots = await ChatBot.findAll({
                where: {
                    pluginName: pluginName,
                },
            });

            botIds.forEach((botId) => {
                const bot = chatBots.find((item) => botId === item.name);
                bots[botId].pluginName = pluginName;
                if (bot) {
                    promises.push(this.services.chatBotService.updateBot(botId, bots[botId]));
                }
                else {
                    promises.push(this.services.chatBotService.addBot(botId, bots[botId]));
                }
            });
        } catch (err) {
            this.log.error(err);
        }

        return Promise.all(promises);
    }

    /**
     *
     * @param pluginRealName
     * @private
     */
    async _loadPlugin(pluginRealName) {
        //console.time('loadPlugin'+ pluginRealName);
        this.log.info('load plugin ' + pluginRealName);
        const PluginClass = (await import(this._getPluginPath(pluginRealName))).default;//require(this._getPluginPath(pluginRealName));
        this.log.info('instanciate plugin ' + pluginRealName);
        const pluginInstance = new PluginClass(lisa);
        this.plugins[pluginInstance.name] = pluginInstance;
        await this._managePluginBots(pluginRealName, pluginInstance.bots);
        //console.timeEnd('loadPlugin'+ pluginRealName);
        return pluginInstance;
    }

    callOnPlugins(toCall, args = []) {
        const promises = [];

        _.each(this.plugins, (value, key) => {
            promises.push(this.plugins[key][toCall](...args));
        });

        return Promise.all(promises);
    }

    callOnPlugin(toCall, pluginName, args = []) {
        const plugin = this._getPluginInstance(pluginName);
        return plugin[toCall](...args);
    }

    callOnPluginDriver(toCall, pluginName, driver, args = []) {
        const plugin = this._getPluginInstance(pluginName);

        if (!plugin) {
            throw new NotFoundError(`${pluginName} can't be found`);
        }

        if (!plugin.drivers || !plugin.drivers[driver]) {
            throw new NotFoundError(`${driver} can't be found on ${pluginName}`);
        }

        if (!plugin.drivers[driver][toCall]) {
            throw new PayloadError(`${toCall} can't be call on ${pluginName}:${driver}`);
        }

        return plugin.drivers[driver][toCall](...args);
    }

    setDeviceValue(pluginName, args) {
        const plugin = this._getPluginInstance(pluginName);
        const driver = args[0].driver;

        if (!plugin) {
            throw new NotFoundError(`${pluginName} can't be found`);
        }

        if (!plugin.drivers || !plugin.drivers[driver]) {
            throw new NotFoundError(`${driver} can't be found on ${pluginName}`);
        }

        return plugin.drivers[driver].setDeviceValue(...args);
    }

    setDevicesValue(pluginName, args) {
        const plugin = this._getPluginInstance(pluginName);
        const devices = args[0];
        const driver = devices.length > 0 ? devices[0].driver : null;


        if (!plugin) {
            throw new NotFoundError(`${pluginName} can't be found`);
        }

        if (!plugin.drivers || !plugin.drivers[driver]) {
            throw new NotFoundError(`${driver} can't be found on ${pluginName}`);
        }

        return plugin.drivers[driver].setDevicesValue(...args);
    }

    /**
     *
     */
    async refreshPlugins() {
        const plugins = await Plugin.findAll({
            where: {
                activated: true,
            },
        });
        const promises = [];
        plugins.forEach((plugin) => {
            promises.push(this._addOrRefreshPlugin(plugin.name));
        });
        return Promise.all(promises);
    }

    /**
     *
     */
    async loadPlugins() {
        const plugins = await Plugin.findAll({
            where: {
                activated: true,
            },
        });
        const promises = [];
        plugins.forEach((plugin) => {
            promises.push(this._loadPlugin(plugin.name).then(() => {
                this.log.info('init plugin ' + plugin.name);
                return this.plugins[plugin.internalName].init();
            }));
        });
        return Promise.all(promises);
    }

    /**
     *
     */
    unloadPlugins() {
        // this.pluginsManager
    }

    async enablePlugin(pluginName) {
        await this._loadPlugin(pluginName);
        pluginName = this._getPluginName(pluginName);

        await this.plugins[pluginName].init();
        await Plugin.update({
            activated: true,
        }, {
            where: {
                internalName: pluginName,
            },
        });
    }

    async disablePlugin(name) {
        name = this._getPluginName(name);
        await this.plugins[name].unload();
        delete this.plugins[name];
        await Plugin.update({
            activated: false,
        }, {
            where: {
                internalName: name,
            },
        });
    }

    /**
     *
     */
    async installPlugin(name, version = 'master', from = 'github') {
        let url;

        switch (from) {
            case 'npm':
                url = `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`;
                break;
            default:
                url = `https://github.com/mylisabox/${name}/archive/${version}.zip`;
        }
        this.log.silly('download plugin from ' + url);
        await download(url, config.pluginManager.dist, {
            extract: true,
        });
        await new Promise((resolve, reject) => {
            const dirPath = path.dirname(this._getPluginPath(name));
            const fromPath = from === 'npm' ? this._getPluginPath('package') : dirPath + '-' + version;

            this.log.silly('npm install to ' + fromPath);
            npm.install({
                dir: fromPath,
                loglevel: 'silent',
                production: true,
            }, async (err) => {
                this.log.silly('npm install finished, error: ' + err);
                if (err) return reject(err);

                try {
                    await fs.access(dirPath, fs.R_OK);
                } catch (err) {
                    this.log.silly('delete existing ' + dirPath);
                    await this._deleteFolderRecursive(dirPath);
                }

                this.log.silly('rename ' + fromPath + ' to ' + dirPath);
                await fs.rename(fromPath, dirPath);
                resolve();
            });
        });
        try {
            await this._addOrRefreshPlugin(name);
            await this.enablePlugin(name);
        } catch (e) {
            this.log.error('Can\'t add plugin '+ e);
        }

    }

    async _deleteFolderRecursive(path) {
        let files = [];
        const scope = this;
        if (await fs.exists(path)) {
            files = await fs.readdir(path);
            for (const file of files) {
                const curPath = path + '/' + file;
                if ((await fs.lstat(curPath)).isDirectory()) { // recurse
                    await scope._deleteFolderRecursive(curPath);
                }
                else { // delete file
                    await fs.unlink(curPath);
                }
            }
            await fs.rmdir(path);
        }
    };

    async _updatePlugin(pluginName) {
        const plugin = require(`${this._getPluginPath(pluginName)}/package.json`);
        const pluginConfig = require(`${this._getPluginPath(pluginName)}/config`);
        await Plugin.update({
            version: plugin.version,
            settings: pluginConfig.settings,
            devicesSettings: pluginConfig.devices,
            infos: pluginConfig.infos,
        }, {where: {name: plugin.name}});

        await this._loadPlugin(pluginName);
    }

    async _addOrRefreshPlugin(pluginName) {
        const pluginDir = path.dirname(this._getPluginPath(pluginName));
        const plugin = require(`${pluginDir}/package.json`);
        const pluginConfig = (await import(`${pluginDir}/config/index.js`)).default;
        const name = this._getPluginName(plugin.name);
        await Plugin.upsert({
            name: plugin.name,
            internalName: name,
            camelName: name.toCamelCase(),
            version: plugin.version,
            settings: pluginConfig.settings,
            devicesSettings: pluginConfig.devices,
            infos: pluginConfig.infos,
        });
    }

    /**
     *
     */
    async uninstallPlugin(name) {
        await this.disablePlugin(name);

        await Plugin.destroy({
            where: {
                name: name,
            },
        });

        const path = this._getPluginPath(name);
        await fs.access(path, fs.R_OK | fs.W_OK);
        await this._deleteFolderRecursive(path);
    }

    async pairing(plugin, driver, data) {
        try {
            return await this.services.pluginService.callOnPluginDriver('pairing', plugin, driver, [data]);
        } catch (err) {
            if (err.step) {
                return Promise.resolve(err);
            }
            return Promise.reject(err);
        }
    }

    getDevicesForPairing(plugin, driver) {
        return this.services.pluginService.callOnPluginDriver('getDevices', plugin, driver, []).then((results) => {
            return Promise.resolve(results);
        }).catch((err) => {
            return Promise.reject(err);
        });
    }

    async setGroupValue(roomId, type, data) {
        const criteria = {
            where: {
                type: type,
            },
        };

        if (roomId) {
            criteria.where.roomId = roomId;
        }

        const devices = await Device.findAll(criteria);
        const pluginFilteredDevices = {};
        devices.forEach((device) => {
            const pluginName = device.pluginName;
            if (pluginFilteredDevices[pluginName]) {
                pluginFilteredDevices[pluginName].push(device);
            }
            else {
                pluginFilteredDevices[pluginName] = [device];
            }
        });
        const key = data.key;
        const value = data.value || false;
        const promises = [];
        _.forEach(pluginFilteredDevices, (devices, pluginName) => {
            promises.push(this.setDevicesValue(pluginName, [devices.map((device) => device.toRawData()), key, value]));
        });
        return Promise.all(promises);
    }

    async setValue(deviceId, data) {
        const device = await Device.findByPk(deviceId);
        if (device) {
            const key = data.key;
            let value = data.value || false;

            if (!isNaN(value)) {
                value = +value;
            }
            if (value === 'true') {
                value = true;
            }
            if (value === 'false') {
                value = false;
            }
            device.data[key] = value;
            if (process.env.DEMO_MODE) {
                await device.save();
            }
            else {
                await this.setDeviceValue(device.pluginName, [device.toRawData(), key, value]);
            }
            return (await Device.findByPk(deviceId));
        }
        else {
            throw new NotFoundError('device not found');
        }
    }

    interact(infos) {
        if (infos.action === 'UNKNOWN') {
            return Promise.resolve(infos);
        }
        else {
            const roomPromise = [];

            const keys = Object.keys(_.omit(infos.fields, ['room']));

            if (infos.fields.room) {
                roomPromise.push(Room.findOne({
                    where: {
                        name: {
                            [Op.like]: infos.fields.room,
                        },
                    },
                }));
            }
            else {
                roomPromise.push(Promise.resolve());
            }
            if (infos.fields.device) {
                roomPromise.push(Device.findOne({
                        where: {
                            name: {
                                [Op.like]: infos.fields.device,
                            },
                        },
                    }),
                );
            }
            else {
                roomPromise.push(Promise.resolve());
            }
            keys.forEach((key) => {
                const param = config.chatBot.params[key];
                if (param) {
                    if (_.isPlainObject(param)) {
                        roomPromise.push(new Promise((resolve, reject) => {
                            infos.fields[key] = param[infos.fields[key]];
                            resolve();
                        }));
                    }
                    else if (_.isFunction(param)) {
                        roomPromise.push(param(this.app).then((result) => {
                                if (_.isPlainObject(param)) {
                                    infos.fields[key] = {
                                        name: infos.fields[key],
                                        value: result[infos.fields[key]],
                                    };
                                }
                            }),
                        );
                    }
                }
            });

            return Promise.all(roomPromise).then((results) => {
                const room = results[0];
                if (room) {
                    infos.fields.room = room.toJSON();
                }
                else {
                    infos.fields.room = null;
                }
                const device = results[1];
                if (device) {
                    infos.fields.device = device.toRawData();
                }
                else {
                    infos.fields.device = null;
                }
                return this.callOnPlugins('interact', [infos.action, infos])
                    .then((results) => {
                            return Promise.resolve(results.action ? results : infos);
                        },
                    );
            });
        }
    }

    async triggerDevice(deviceId) {
        const device = await Device.findByPk(deviceId);
        return this.callOnPluginDriver('triggerDevice', device.pluginName, device.driver, [device.toRawData()]);
    }

    async getDeviceData(deviceId) {
        const device = await Device.findByPk(deviceId);
        return this.callOnPluginDriver('getDeviceData', device.pluginName, device.driver, [device.toRawData()]);
    }

    async getDevicesData(deviceIds) {
        if (typeof deviceIds === 'string') {
            deviceIds = [deviceIds];
        }
        const devices = await Device.findAll({
            where: {
                id: {[Op.in]: deviceIds}
            }
        });
        const data = [];
        for (const device of devices) {
            data.push(await this.callOnPluginDriver('getDeviceData', device.pluginName, device.driver, [device.toRawData()]));
        }
        return data;
    }
}

export default PluginService;
