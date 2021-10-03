import Service from '../models/service.js';
import LIRC from 'lisa-lirc';

class IrService extends Service {
  init() {
    return LIRC.init().catch((err) => this.log.error(err));
  }

  send(remote, action) {
    return new Promise((resolve, reject) => {
      LIRC.irsend.send_once(remote, action, () => {
        resolve();
      });
    });
  }
}

export default IrService;
