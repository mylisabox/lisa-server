import express from 'express';
import services from '../common/services/manager.js';
import Plugin from '../plugins/models/plugin.js';
import path from 'path';
const __dirname = path.resolve();
const router = new express.Router();

router.get('/search', async function(req, res, next) {
  try {
    const data = await req.services.pluginService.find(req.user.lang);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/store', async function(req, res, next) {
  const installedPlugins = await Plugin.findAll();
  const plugins = [
    {
      id: 'lisa-plugin-hue',
      name: 'HUE Philips',
      image: 'lisa-plugin-hue.png',
      description: 'Manage HUE Philips devices from L.I.S.A. and voice commands',
    },
    {
      id: 'lisa-plugin-kodi',
      name: 'Kodi, XBMC',
      image: 'lisa-plugin-kodi.png',
      description: 'Manage Kodi instance from voice commands',
    },
    {
      id: 'lisa-plugin-sony-vpl',
      name: 'Sony VPL Projector',
      description: 'Manage video projector from L.I.S.A. and voice commands',
    },
    {
      id: 'lisa-plugin-ir',
      name: 'Infra red',
      description: 'Launch infra red signals from L.I.S.A. if the server has IR emitter',
    },
    {
      id: 'lisa-plugin-voice',
      name: 'L.I.S.A. voice',
      description: 'Add additional voice command devices if you have some',
    },
    {
      id: 'lisa-plugin-cam-mjpeg',
      name: 'IP Cam',
      description: 'Add IP camera with mjpeg streams to your L.I.S.A.',
    },
    {
      id: 'lisa-plugin-bose-soundtouch',
      name: 'Bose Soundtouch',
      image: 'lisa-plugin-bose-soundtouch.png',
      description: 'Manage Bose Soundtouch devices from L.I.S.A.',
    },
  ];

  plugins.forEach((plugin) => {
    plugin.installed = installedPlugins.find((installedPlugin) => plugin.id === installedPlugin.name) != null;
  });

  res.json(plugins);
});

router.post('/install', async function(req, res, next) {
  try {
    const plugin = req.body.id;
    const from = req.body.from || 'github';
    const version = req.body.version || 'master';

    const data = await services.pluginService.installPlugin(plugin, version, from);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id/uninstall', async function(req, res, next) {
  try {
    const plugin = req.params.id;
    await services.pluginService.uninstallPlugin(plugin);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.post('/:id/drivers/:driver/pairing', async function(req, res, next) {
  try {
    const plugin = req.params.id;
    const driver = req.params.driver;
    const data = req.body;

    const results = await services.pluginService.pairing(plugin, driver, data);
    res.json(results);
  } catch (e) {
    next(e);
  }
});

router.get('/:id/drivers/:driver/devices', async function(req, res, next) {
  try {
    const plugin = req.params.id;
    const driver = req.params.driver;
    const data = await services.pluginService.getDevicesForPairing(plugin, driver);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/images/:id/:name/:subname?', async function(req, res, next) {
  let filePath = path.resolve(__dirname + '/plugins/' + req.params.id + '/assets/images/' + req.params.name);
  if (req.params['subname']) {
    filePath += '/' + req.params['subname'];
  }
  res.sendFile(filePath);
});

export default router;
