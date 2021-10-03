import queryString from 'query-string';
import WebSocket, {WebSocketServer} from 'ws';
import config from '../../../config/auth.js';
import {NotFoundError} from '../models/error.js';
import Service from '../models/service.js';
import logger from '../utils/logger.js';
import removeNull from "../utils/stripedJSON.js";

class WebsocketService extends Service {
  constructor(services) {
    super(services);
    this.websocketServer = new WebSocketServer({
      noServer: true,
    });
  }

  init(expressServer) {
    const scope = this;
    /*
function heartbeat() {
clearTimeout(this.pingTimeout);

// Use `WebSocket#terminate()`, which immediately destroys the connection,
// instead of `WebSocket#close()`, which waits for the close timer.
// Delay should be equal to the interval at which your server
// sends out pings plus a conservative assumption of the latency.
this.pingTimeout = setTimeout(() => {
  this.terminate();
}, 1000);
}*/

    this.websocketServer.on(
        'connection',
        async function connection(socket, connectionRequest) {
          const ip = connectionRequest.socket.remoteAddress;
          logger.info(ip + ' is connected');
          const params = connectionRequest?.url?.split('?');
          const connectionParams = queryString.parse(params[1]);

          if (connectionParams.token) {
            try {
              socket.user = await scope.services.authService.verifyToken(connectionParams.token, config.secret);
            } catch (ex) {
              socket.send(JSON.stringify({message: 'Unauthorized', errorCode: '401'}));
              socket.terminate();
            }
          } else {
            socket.send(JSON.stringify({message: 'Forbidden', errorCode: '403'}));
            socket.terminate();
          }

          /*
          // TODO make ping pong works
          socket.on('ping', heartbeat);
          socket.on('close', function clear() {
            logger.info(ip + ' is disconnected');
            clearTimeout(this.pingTimeout);
          });

                socket.on("message", (message) => {
                    logger.info(message);
                    const parsedMessage = JSON.parse(message);
                    //socket.send(JSON.stringify({message: 'There be gold in them thar hills.'}));
                    scope.broadcast(JSON.stringify({message: 'There be gold in them thar hills.'}));
                });
                 */
        });

    expressServer.on('upgrade', (request, socket, head) => {
      this.websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        this.websocketServer.emit('connection', websocket, request);
      });
    });
  }

  broadcast(data) {
    this.websocketServer.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(removeNull(data)));
      }
    });
  }

  sendToUser(userId, data) {
    let sent = false;
    this.websocketServer.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN && client.user.id === userId) {
        sent = true;
        client.send(JSON.stringify(removeNull(data)));
      }
    });
    if (!sent) {
      throw new NotFoundError('No socket opened for that user');
    }
  }
}

class WebsocketMessage {
  constructor(type, message) {
    this.type = type;
    this.message = message;
  }
}

const WebsocketMessageType = {
  DEVICE_ADDED: 'device_added',
  DEVICE_UPDATED: 'device_updated',
  DEVICE_DELETED: 'device_deleted',
  NOTIFICATION_ADDED: 'notif_added',
  NOTIFICATION_UPDATED: 'notif_updated',
  NOTIFICATION_DELETED: 'notif_deleted',
  ROOM_ADDED: 'room_added',
  ROOM_DELETED: 'room_deleted',
  ROOM_UPDATED: 'room_updated',
};

export {WebsocketMessage, WebsocketMessageType};

export default WebsocketService;
