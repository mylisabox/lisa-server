import express from 'express';
import http from 'http';
import url from 'url';
import authRouter from '../auth/routes.js';
import chatBotsRouter from '../chatbots/routes.js';
import devicesRouter from '../devices/routes.js';
import pluginsRouter from '../plugins/routes.js';
import roomsRouter from '../rooms/routes.js';
import User from '../users/models/user.js';
import usersRouter from '../users/routes.js';
import jpegExtractor from './utils/jpegExtractor.js';

const router = new express.Router();

/* Auth router. */
router.use('/auth', authRouter);

/* User router. */
router.use('/users', usersRouter);

/* Room router. */
router.use('/rooms', roomsRouter);

/* Plugin router. */
router.use('/plugins', pluginsRouter);

/* ChatBot router. */
router.use('/chatBots', chatBotsRouter);

/* ChatBot router. */
router.use('/devices', devicesRouter);

router.get('/camera/snapshot', async function(req, res, next) {
  const connector = http.request(req.query.url, {
    headers: req.headers,
  }, (resp) => {
    resp.pipe(jpgExtractor);
  });
  const jpgExtractor = jpegExtractor().on('image', (image) => {
    connector.end();
    res.send(image);
  });

  req.pipe(connector);
});

router.get('/camera/stream', async function(req, res, next) {
  const connector = http.request(req.query.url, {
    headers: req.headers,
  }, (resp) => {
    resp.pipe(res);
  });

  req.socket.on('close', () => {
    connector.end();
  });
  req.pipe(connector);
});

router.get('/initialized', async function(req, res, next) {
  try {
    const users = await User.findAll();
    res.json({initialized: users && users.length > 0});
  } catch (e) {
    next(e);
  }
});

router.post('/setup/voiceCommand', async function(req, res, next) {
  req.storageVoiceConfig.single('config')(req, res, async (err) => {
    if (err) {
      next(err);
    } else {
      await req.services.voiceCommandService.startVoiceCommands();
      res.json({});
    }
  });
});

router.all('/proxy', async function(req, res, next) {
  const request = url.parse(req.query.url);

  const options = {
    host: request.hostname,
    port: request.port || (request.scheme === 'http' ? 80 : 443),
    path: request.path,
    method: req.method,
    headers: req.headers,
  };

  req.log.info(`${options.method} http://${options.host}${options.path}`);
  const backendReq = http.request(options, (backendRes) => {
    res.writeHead(backendRes.statusCode, backendRes.headers);

    backendRes.on('data', (chunk) => {
      res.write(chunk);
    });

    backendRes.on('end', () => {
      res.end();
    });
  });

  if (req.method.toLowerCase() !== 'get' && req.body) {
    backendReq.write(JSON.stringify(req.body));
  }

  req.on('end', () => {
    backendReq.end();
  });
  /* const connector = http.request(decodeURIComponent(req.query.url),
            {
                method: req.method,
                headers: req.headers,

            }, (resp) => {
                res.headers = resp.headers;
                resp.pipe(res);

            }
        );
        if (req.method.toLowerCase() !== 'get' && req.body) {
            connector.write(JSON.stringify(req.body));
        }
        req.socket.on('close', () => {
            connector.end();
        });
        req.pipe(connector);

         */
});

export default router;
