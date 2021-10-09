import express from 'express';
import services from "../common/services/manager.js";
import Device from "./models/device.js";

const router = new express.Router();

router.get('/:deviceId/trigger', async function(req, res, next) {
  try {
    const data = await req.services.pluginService.triggerDevice(req.params.deviceId);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/:deviceId/data', async function(req, res, next) {
  try {
    const data = await req.services.pluginService.getDeviceData(req.params.deviceId);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/data', async function(req, res, next) {
  try {
    const data = await req.services.pluginService.getDevicesData(req.query['deviceIds']);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/groups/:type', async function(req, res, next) {
  try {
    const data = await req.services.pluginService.setGroupValue(req.query.roomId, req.params.type, req.body);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/', async function(req, res, next) {
  try {
    const data = await services.pluginService.callOnPluginDriver('saveDevice', req.body.pluginName, req.body.driver, [req.body]);
    res.json(data.toJSON ? data.toJSON() : data);
  } catch (e) {
    next(e);
  }
});

router.post('/:deviceId', async function(req, res, next) {
  try {
    const data = await services.pluginService.setValue(req.params.deviceId, {
      key: req.body.key,
      value: req.body.value,
    });
    res.json(data.toJSON());
  } catch (e) {
    next(e);
  }
});

router.patch('/:deviceId', async function(req, res, next) {
  try {
    const device = await Device.findByPk(req.params.deviceId);
    device.name = req.body.name;
    device.roomId = req.body.roomId;
    await device.save();
    res.json(device.toJSON());
  } catch (e) {
    next(e);
  }
});

router.delete('/:deviceId', async function(req, res, next) {
  try {
    const device = await Device.findByPk(req.params.deviceId);
    await device.destroy();
    res.status(201).end();
  } catch (e) {
    next(e);
  }
});


export default router;
