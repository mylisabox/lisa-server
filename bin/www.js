#!/usr/bin/env node

/**
 * Module dependencies.
 */

import debug from 'debug'; // ('lisa-server:server')
import http from 'http';
import app from '../app.js';
import config from '../config/config.js';
import database from '../lib/common/database.js';
import services from '../lib/common/services/manager.js';
import logger from '../lib/common/utils/logger.js';

/**
 * Get port from environment and store in Express.
 */

const port = config.web.port;
app.set('port', port);

/**
 * Create HTTP server.
 */
const server = http.createServer(app);
app.server = server;

(async () => {
  try {
    logger.info('Setting up database..');
    await database.sync({force: false});
    logger.info('Database is setup.');
    logger.info('Setting up chatbots..');
    await services.chatBotService.init(config.chatBot.bots);
    logger.info('Chat bots are loaded.');
    logger.info('Setting up plugins..');
    //await services.pluginService.refreshPlugins();
    await services.pluginService.loadPlugins();
    logger.info('Plugins are loaded.');

  } catch (e) {
    logger.error(e.toString());
    return;
  }

  /**
     * Listen on provided port, on all network interfaces.
     */
  server.listen(port);
  services.websocketService.init(server);
  logger.info('Websockets are setup.');
  server.on('error', onError);
  server.on('listening', onListening);
})();

/**
 * Event listener for HTTP server "error" event.
 */

process.on('uncaughtException', function(err) {
  console.log('Caught exception: ' + err);
  console.log(err.stack);
});


function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ?
        'Pipe ' + port :
        'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function getArgs() {
  const args = {};
  process.argv
      .slice(2, process.argv.length)
      .forEach( (arg) => {
        // long arg
        if (arg.slice(0, 2) === '--') {
          const longArg = arg.split('=');
          const longArgFlag = longArg[0].slice(2, longArg[0].length);
          args[longArgFlag] = longArg.length > 1 ? longArg[1] : true;
        }
        // flags
        else if (arg[0] === '-') {
          const flags = arg.slice(1, arg.length).split('');
          flags.forEach((flag) => {
            args[flag] = true;
          });
        }
      });
  return args;
}

async function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ?
        'pipe ' + addr :
        'port ' + addr.port;
  debug('Listening on ' + bind);
  const args = getArgs();
  if (args['enable-voice-commands']) {
    await services.voiceCommandService.startVoiceCommands();
    logger.info('Voice command started.');
  }
  await services.discoveryService.init();
  logger.info('Discovery service started.');
}
