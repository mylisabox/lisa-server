import express from 'express';
import config from '../../config/config.js';
import {UnauthorizedError} from '../common/models/error.js';
import services from '../common/services/manager.js';
import Device from '../devices/models/device.js';
import Room from '../rooms/models/room.js';

const router = new express.Router();

router.post('/interact', async function(req, res, next) {
  if (req.headers['device-id'] === undefined) {
    next(); //no device id so auth was provided by token
  }
  const header = req.headers['device-id'];
  const devices = await Device.findAll({
    where: {
      pluginName: 'lisa-plugin-voice',
    },
  });
  const results = devices.filter((device) => device.privateData.identifier === header);
  if (results.length === 0) {
    // if device not known but coming form localhost we authorized it
    if (req.socket.remoteAddress === '127.0.0.1' ||
            req.socket.remoteAddress === '::ffff:127.0.0.1' ||
            req.socket.remoteAddress === '::1') {
      next();
    } else {
      next(new UnauthorizedError());
    }
  } else {
    if (!req.body.context) {
      req.body.context = {};
    }
    // Device associated with a room, by default set the context to this room
    if (req.body.context.room) {
      next();
    } else {
      const room = await Room.findByPk(results[0].roomId);
      req.body.context.room = room ? room.toJSON() : undefined;
      next();
    }
  }
}, async function(req, res, next) {
  try {
    const data = await services.chatBotService.interact(req.user ? req.user.id : req.headers['device-id'],
        req.body.lang || req.params.lang || config.chatBot.defaultLang,
        req.body.sentence, req.body.id || req.params.id, req.body.context || {});
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/userBot', async function(req, res, next) {
  try {
    const data = await services.chatBotService.getUserBot();
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/userBot', async function(req, res, next) {
  try {
    const data = await services.chatBotService.setUserBot(req.user.lang, req.body);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.delete('/userBot/:id', async function(req, res, next) {
  try {
    await services.chatBotService.deleteUserBot(req.user.lang, req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
