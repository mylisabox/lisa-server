import logger from '../utils/logger.js';

class Service {
  constructor(services) {
    this.services = services;
    this.log = logger;
  }
}

export default Service;
