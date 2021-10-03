import ejs from 'ejs';
import path from 'path';
import config from '../../../config/config.js';
import Service from '../models/service.js';
import {NOTIFICATION_TYPE} from '../utils/enums.js';

class NotificationService extends Service {
  _buildTemplate(type, templateName, data) {
    return new Promise((resolve, reject) => {
      ejs.renderFile(path.join(config.paths.templates, type, templateName + '.ejs'), data, {}, (err, str) => {
        // str => Rendered HTML string
        if (err) {
          return reject(err);
        } else {
          return resolve(str);
        }
      });
    });
  }

  async dispatchNotification(notif) {
    const notification = await Notification.create(notif);

    this.sendWebNotification(notification);

    if (notification.userId) {
      const user = await notification.getUser();
      // Should send an sms
      if (user.mobile &&
                (
                  notification.type === NOTIFICATION_TYPE.AUTO ||
                    notification.type === NOTIFICATION_TYPE.SMS
                )) {
        const str = await this._buildTemplate(NOTIFICATION_TYPE.SMS, notification.template, {
          user: user,
          notification: notification,
        });
        await this.services.twilioService.sendSMSTo(user.mobile, str);
      } else {
        // Send an email
        const str = await this._buildTemplate(NOTIFICATION_TYPE.EMAIL, notification.template, {
          user: user,
          notification: notification,
        });
        await this.services.emailService.send({
          to: user.email,
          subject: notification.subject,
          html: str,
        });
      }
    }
    return notification;
  }

  sendWebNotification(notification) {
    if (notification.userId) {
      this.app.sockets.room('user_' + notification.userId).send('notification', notification);
    } else {
      this.app.sockets.room('admins').send('notification', notification);
    }
  }

  /**
     * Send notification to the user(s)
     * @param to @optional associate user id to send the notif to
     * @param pluginName @optional associate plugin with the notif
     * @param title of the notif
     * @param type of the notification
     * @param description of the notif
     * @param image of the notif
     * @param defaultAction of the notif
     * @param action of the notif
     * @param lang of the notif
     * @param templateName of the notif not supported now
     * @return Promise - notif data
     */
  sendNotification(to, pluginName, title, type, description, image, defaultAction, action, lang, templateName) {
    if (typeof to === 'object' && to !== null) {
      to = to.id;
    }

    return this.dispatchNotification({
      title: title,
      description: description,
      icon: image,
      lang: lang,
      type: type,
      defaultAction: defaultAction,
      addAction: action,
      userId: to,
      pluginName: pluginName,
      template: templateName,
    });
  }
}

export default NotificationService;
