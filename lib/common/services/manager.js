import AuthService from '../../auth/authService.js';
import UserService from '../../users/UserService.js';
import RoomService from '../../rooms/RoomService.js';

import PluginService from '../../plugins/pluginService.js';
import NotificationService from './notificationService.js';
import ChatBotService from '../../chatbots/chatbotService.js';
import VoiceCommandService from './voiceCommandService.js';
import IrService from './irService.js';
import EmailService from './emailService.js';
import WebsocketService from './websocketService.js';
import DiscoveryService from './discoveryService.js';

const services = {};

services.authService = new AuthService(services);
services.notificationService = new NotificationService(services);
services.chatBotService = new ChatBotService(services);
services.userService = new UserService(services);
services.roomService = new RoomService(services);
services.pluginService = new PluginService(services);
services.websocketService = new WebsocketService(services);
services.irService = new IrService(services);
services.voiceCommandService = new VoiceCommandService(services);
services.discoveryService = new DiscoveryService(services);
services.emailService = new EmailService(services);

export default services;
