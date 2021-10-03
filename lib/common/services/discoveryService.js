import LisaDiscovery from 'lisa-discovery';
import Service from '../models/service.js';
import config from '../../../config/config.js';

class DiscoveryService extends Service {
  init() {
    const serviceDiscovery = new LisaDiscovery({
      multicastAddress: '238.9.9.9',
      multicastPort: 5544,
      trigger: 'lisa-server-search',
      callback: (input, address) => {
        console.log(input, address);
        let data = 'lisa-server-response ';
        data += JSON.stringify({port: config.web.port, isSecure: !(!config.web.ssl)});
        return data;
      },
    });
    serviceDiscovery.start();
  }
}

export default DiscoveryService;
