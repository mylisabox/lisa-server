import cacheManager from 'cache-manager';
import {cloneDeep, each, find, forEach, indexOf, isFunction, isPlainObject, merge, omit, sample} from 'lodash-es';
import * as uuid from 'uuid';
import config from '../../config/config.js';
import {PayloadError} from '../common/models/error.js';
import Service from '../common/models/service.js';
import Room from '../rooms/models/room.js';

import ChatBot from './models/chatbot.js';

const CUSTOM_BOT_ID = 'userCustom';
const mapParams = {
  'number': '([0-9]+)',
  'text': '([a-zA-Z]+)',
  'fulltext': '([0-9a-zA-Z ]+)',
  'acceptance': '^(ok|oui|yes|ouai|no problem|aucun problème|ça marche|it\'s ok|sure|volontier|let\'s do this)$',
};

class ChatBotService extends Service {
  constructor(services) {
    super(services);
    this.botCache = cacheManager.caching({
      name: 'chatbot',
      store: 'memory',
      max: 100,
      ttl: 0,
    });
  }

  _getUserChatBot() {
    return ChatBot.findOne({
      where: {name: CUSTOM_BOT_ID},
    });
  }

  async _prepareParam(key, value) {
    if (Array.isArray(value)) {
      mapParams[key] = `(${value.join('|')})`;
    } else if (isFunction(value)) {
      try {
        const result = await value(config);
        if (Array.isArray(result)) {
          mapParams[key] = `(${result.join('|')})`;
        } else {
          mapParams[key] = result;
        }
      } catch (e) {
        mapParams[key] = null;
      }
    } else if (isPlainObject(value)) {
      let keys = Object.keys(value);
      if (value[keys[0]].keywords) {
        let allKeywords = [];
        for (const keyParam of keys) {
          allKeywords = allKeywords.concat(value[keyParam].keywords);
        }
        keys = allKeywords;
      }

      mapParams[key] = `(${keys.join('|')})`;
    } else {
      mapParams[key] = value;
    }
    return Promise.resolve();
  }

  _prepareParams() {
    merge(mapParams, config.chatBot.params);
    const promises = [];
    each(mapParams, (value, key) => {
      promises.push(this._prepareParam(key, value));
    });
    return Promise.all(promises);
  }

  /**
     * Compile sentences to change fields into regexp
     * @param sentences to compile
     * @return {{}}
     * @private
     */
  _compileSentences(sentences) {
    const compiledSentences = {};
    each(sentences, (sentences, lang) => {
      compiledSentences[lang] = [];
      for (let i = 0; i < sentences.length; i++) {
        const paramsName = [];
        const sentence = sentences[i].replace(/(%[a-zA-Z_]+%)/gi, function(matched) {
          matched = matched.replace(/%/g, '');
          const parts = matched.split('_');
          if (parts.length > 1) {
            paramsName.push(parts[1]);
          } else {
            paramsName.push(parts[0]);
          }
          return mapParams[parts[0]] || '([a-zA-z]+)';
        });
        compiledSentences[lang][i] = {
          sentence: sentence,
          fields: paramsName,
        };
      }
    });
    return compiledSentences;
  }

  /**
     * Prepare chatBot data before saving in database
     * @param botId
     * @param botData
     * @private
     */
  _prepareChatBot(botId, botData) {
    let data;
    if (botData.originalData) {
      botData.data.links = botData.originalData.links;
      botData.data.freeStates = botData.originalData.freeStates;
      botData.data.nestedStates = botData.originalData.nestedStates;
      each(botData.data.links, (link) => {
        link.compiledSentences = this._compileSentences(link.sentences);
      });

      each(botData.data.freeStates, (dataState, id) => {
        dataState.id = id;
        dataState.compiledSentences = this._compileSentences(dataState.sentences);
        dataState.links = botData.data.links.filter((link) => {
          return link.from === id;
        });
      });

      each(botData.data.nestedStates, (dataState, id) => {
        dataState.id = id;
        dataState.links = botData.data.links.filter((link) => {
          return link.from === id;
        });
      });

      data = botData;
    } else {
      data = cloneDeep(botData);
      data.displayName = botData.name;
      data.name = botId;
      each(data.links, (link) => {
        link.compiledSentences = this._compileSentences(link.sentences);
      });

      each(data.freeStates, (dataState, id) => {
        dataState.id = id;
        dataState.compiledSentences = this._compileSentences(dataState.sentences);
        dataState.links = data.links.filter((link) => {
          return link.from === id;
        });
      });

      each(data.nestedStates, (dataState, id) => {
        dataState.id = id;
        dataState.links = data.links.filter((link) => {
          return link.from === id;
        });
      });
      data = merge({
        name: botId,
        displayName: botData.name,
        data: data,
        originalData: {
          links: botData.links,
          freeStates: botData.freeStates,
          nestedStates: botData.nestedStates,
        },
      }, omit(botData, ['name', 'links', 'freeStates', 'nestedStates']));
    }
    return data;
  }

  /**
     * Compile and save chatBot into DB
     * @param initialData
     * @return {Promise}
     */
  async init(initialData) {
    initialData = cloneDeep(initialData);
    this.chatBots = [];
    await this._prepareParams();
    const results = await ChatBot.findAll({
      where: {
        enabled: true,
      },
    });

    const bots = [];
    forEach(initialData, (botData, botId) => {
      bots.push(this._prepareChatBot(botId, botData));
    });

    if (!results || results.length === 0) {
      const results = await ChatBot.bulkCreate(bots);
      this.chatBots = results || [];
      return results;
    } else {
      const updates = [];
      for (const bot of bots) {
        if (results.filter((result) => result.name === bot.name.toLowerCase()).length > 0) {
          updates.push(ChatBot.update(bot, {where: {name: bot.name}}));
        } else {
          updates.push(ChatBot.create(bot));
        }
      }
      await Promise.all(updates);
      return this.reloadBots();
    }
  }

  async executeUserActions(requestId, lang, context, result) {
    const bot = await this._getUserChatBot();

    const index = this._findExistingDataIndex(bot.context, {name: result.action});
    const commands = bot.context[index].data.commands;
    const actions = [];

    for (const command of commands) {
      actions.push(this.interact(requestId, lang, command, undefined, context).catch((err) => Promise.resolve()));
    }
    await Promise.all(actions);
    return result;
  }

  /**
     * Add a new bot into DB
     * @param botId
     * @param botData
     * @return {Promise.<ChatBot>}
     */
  async addBot(botId, botData) {
    await this._prepareParams();
    const result = await ChatBot.create(this._prepareChatBot(botId, botData));
    this.chatBots.push(result);
    return result;
  }

  /**
     * Delete a bot in DB
     * @param botId
     * @return {Promise.<void>}
     */
  async deleteBot(botId) {
    await ChatBot.destroy({where: {name: botId}});
    const index = indexOf(this.chatBots, find(this.chatBots, {name: botId}));
    this.chatBots.splice(index, 1);
  }

  /**
     * Update a bot in DB
     * @param botId
     * @param botData
     * @return {Promise.<void>}
     */
  async updateBot(botId, botData) {
    await ChatBot.update(this._prepareChatBot(botId, botData), {where: {name: botId}});
    await this.reloadBot(botId);
  }

  /**
     * Reload a specific bot
     * @param botId
     * @return {Promise.<ChatBot>}
     */
  async reloadBot(botId) {
    const result = await ChatBot.findByPk(botId);
    if (result) {
      // Find item index using indexOf+find
      const index = indexOf(this.chatBots, find(this.chatBots, {name: botId}));
      this.chatBots.splice(index, 1, result);
    }
    return result;
  }

  async reloadBots() {
    await this._prepareParams();
    const results = await ChatBot.findAll({
      where: {
        enabled: true,
      },
    });
    if (results) {
      const bots = [];
      forEach(results, (botData) => {
        const data = this._prepareChatBot(botData.name, botData.toJSON());
        bots.push(ChatBot.update(
            data,
            {
              where: {
                name: botData.name,
              },
            },
        ));
      });
      await Promise.all(bots);
      const botRefresh = await ChatBot.findAll({
        where: {
          enabled: true,
        },
      });
      this.chatBots = botRefresh || [];
      return this.chatBots;
    }
    return results;
  }

  /**
     * Search if the user sentence match a sentence from the state
     * @param bot
     * @param stateData
     * @param lang
     * @param userSentence
     * @param sentences
     * @return {*}
     * @private
     */
  _searchMatch(bot, stateData, lang, userSentence, sentences) {
    let results = null;
    if (sentences[lang]) {
      for (let j = 0; j < sentences[lang].length; j++) {
        const sentenceData = sentences[lang][j];
        const reg = new RegExp(sentenceData.sentence, 'gi');

        const matches = reg.exec(userSentence);
        if (matches) {
          const fields = {};
          if (matches.length > 1) {
            for (let i = 1; i < matches.length; i++) {
              let value = matches[i];
              const type = sentenceData.fields[i - 1];
              const param = config.chatBot.params[type];
              if (type.indexOf('number') !== -1) {
                value = parseInt(value);
              } else if (isPlainObject(param)) {
                const keys = Object.keys(param);
                if (param[keys[0]].keywords) {
                  for (const key of keys) {
                    const filteredParam = param[key].keywords.filter((keyword) => keyword === value);
                    if (filteredParam.length === 1) {
                      value = key;
                      break;
                    }
                  }
                } else {
                  value = param[value];
                }
              }
              fields[type] = value;
            }
          }
          results = {
            botId: bot.name,
            bot: bot.toJSON ? bot.toJSON() : bot,
            action: stateData ? stateData.id : null,
            state: stateData,
            responses: stateData && stateData.responses ? stateData.responses[lang] : [],
            response: stateData && stateData.responses ? sample(stateData.responses[lang]) : '',
            lang: lang,
            userSentence: userSentence,
            match: matches,
            fields: fields,
          };
          break;
        }
      }
    }
    return results;
  }

  /**
     * Search if the sentence match a sentence from the free states of the bot
     * @param bot
     * @param lang
     * @param userSentence
     * @return {*}
     * @private
     */
  _searchMatchForFreeStates(bot, lang, userSentence) {
    const keys = Object.keys(bot.data['freeStates']);
    let results = null;
    for (let i = 0; i < keys.length; i++) {
      const stateId = keys[i];
      const stateData = bot.data.freeStates[stateId];
      stateData.id = stateId;

      results = this._searchMatch(bot, stateData, lang, userSentence, stateData.compiledSentences);

      if (results) {
        break;
      }
    }
    return results;
  }

  /**
     * Ask to process user sentence
     * @param userId
     * @param lang
     * @param userSentence
     * @param chatBotId - optional - search into a specific bot only
     * @param context - optional - context of the request, like the room
     * @return {Promise} processed data if found
     */
  async interact(userId, lang, userSentence, chatBotId, context) {
    let before;
    if (context.roomId) {
      before = Room.findByPk(context.roomId);
    } else {
      before = Promise.resolve();
    }

    const room = await before;

    const results = await this._interact(userId, lang, userSentence, chatBotId);
    context.room = room || context.room;
    results.context = context || {};
    if (results.botId === CUSTOM_BOT_ID) {
      return this.executeUserActions(userId, lang, context, results);
    } else {
      return this.services.pluginService.interact(results);
    }
  }

  /**
     * Ask to process user sentence
     * @param userId
     * @param lang
     * @param userSentence
     * @param chatBotId - optional - search into a specific bot only
     * @return {Promise} processed data if found
     */
  _interact(userId, lang, userSentence, chatBotId) {
    if (!userId && !config.chatBot.allowAnonymousUsers) {
      return Promise.reject(new PayloadError('No user provided'));
    }

    return new Promise((resolve, reject) => {
      this.botCache.get(userId + '_data', (err, data) => {
        if (err) {
          reject(err);
        } else {
          let result;
          // if previous data exist, we search for nested states first
          if (data) {
            const bot = data.bot;

            for (let i = 0; i < data.state.links.length; i++) {
              const link = data.state.links[i];

              result = this._searchMatch(bot, null, lang, userSentence, link.compiledSentences);

              if (result) {
                result.state = bot.data.nestedStates[link.to];
                result.action = result.state.id;
                break;
              }
            }
          }

          // no result in nested data or we want to test free states
          if (!result) {
            if (chatBotId) {
              const bot = find(this.chatBots, {name: chatBotId});
              if (bot) {
                result = this._searchMatchForFreeStates(bot, lang, userSentence);
              } else {
                reject(new Error('unknow bot ' + chatBotId));
              }
            } else {
              for (let i = 0; i < this.chatBots.length; i++) {
                const bot = this.chatBots[i];
                result = this._searchMatchForFreeStates(bot, lang, userSentence);
                if (result) {
                  break;
                }
              }
            }
          }

          if (result) {
            const hook = config.chatBot.hooks[result.action];
            const publicResult = omit(result, ['bot', 'state', 'match']);
            if (userId) {
              this.botCache.set(userId + '_data', result, (err) => {
                if (err) {
                  reject(err);
                } else {
                  if (hook) {
                    hook(this.app, publicResult).then(resolve).catch(reject);
                  } else {
                    resolve(publicResult);
                  }
                }
              });
            } else {
              if (hook) {
                hook(this.app, publicResult).then(resolve).catch(reject);
              } else {
                resolve(publicResult);
              }
            }
          } else {
            const defaultAnswer = config.chatBot.defaultAnswer;
            if (defaultAnswer) {
              defaultAnswer(this.app, {
                userId: userId,
                userSentence: userSentence,
                botId: chatBotId,
                lang: lang,
              }).then(resolve).catch(reject);
            } else {
              resolve({
                action: 'UNKNOWN',
                userId: userId,
                userSentence: userSentence,
                botId: chatBotId,
                lang: lang,
              });
            }
          }
        }
      });
    });
  }

  async getUserBot() {
    const bot = await this._getUserChatBot();
    let data = [];
    if (bot && bot.context) {
      data = bot.context;
    }
    return data;
  }

  async deleteUserBot(lang, actionId) {
    const bot = await this._getUserChatBot();
    const index = this._findExistingDataIndex(bot.context, {name: actionId});
    const context = bot.context;
    context.splice(index, 1);
    const states = this._buildCustomBotFromContext(lang, context);

    return this.updateBot(CUSTOM_BOT_ID, {
      'name': 'User custom command',
      'freeStates': states,
      'nestedStates': {},
      'links': [],
      'context': context,
    });
  }

  async setUserBot(lang, data) {
    const bot = await this._getUserChatBot();
    const context = this._buildContext(bot, data);
    const states = this._buildCustomBotFromData(lang, bot, data);
    if (bot) {
      return this.updateBot(CUSTOM_BOT_ID, {
        'name': 'User custom command',
        'freeStates': states,
        'nestedStates': {},
        'links': [],
        'context': context,
      });
    } else {
      return this.addBot(CUSTOM_BOT_ID, {
        'name': 'User custom command',
        'freeStates': states,
        'nestedStates': {},
        'links': [],
        'context': context,
      });
    }
  }

  _buildCustomBotFromContext(lang, context) {
    const states = {};
    for (const entry of context) {
      const sentences = {};
      sentences[lang.substr(0, 2)] = entry.data.sentences;
      const responses = {};
      responses[lang.substr(0, 2)] = entry.data.responses;
      states[entry.name] = {
        'name': entry.displayName,
        'sentences': sentences,
        'responses': responses,
      };
    }
    return states;
  }

  _buildCustomBotFromData(lang, bot, data) {
    const context = this._buildContext(bot, data);
    return this._buildCustomBotFromContext(lang, context);
  }

  _findExistingDataIndex(botContext, data) {
    return botContext.findIndex((entry) => data.name === entry.name);
  }

  _buildContext(bot, data) {
    const context = bot && bot.context || [];
    const dataIndex = this._findExistingDataIndex(context, data);
    if (dataIndex === -1) {
      if (!data.name || data.name === '') {
        data.name = uuid.v4();
      }
      context.push(data);
    } else {
      context[dataIndex] = data;
    }
    return context;
  }
}

export default ChatBotService;
