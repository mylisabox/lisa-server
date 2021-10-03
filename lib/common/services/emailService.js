import {defaultsDeep} from 'lodash-es';

import Service from '../models/service.js';
import config from '../../../config/config.js';
import nodemailer from 'nodemailer';

class EmailService extends Service {
  send(data) {
    const emailConfig = config.email;
    const transporter = nodemailer.createTransport(emailConfig.smtp);
    data = defaultsDeep(data, emailConfig.defaultData);
    return transporter.sendMail(data);
  }
}

export default EmailService;
