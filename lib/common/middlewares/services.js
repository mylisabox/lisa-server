import services from '../../common/services/manager.js';
import logger from '../utils/logger.js';

export default function() {
  return (req, res, next) => {
    req.log = logger;
    req.services = services;
    next();
  };
}
