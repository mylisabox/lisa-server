import config from '../../../config/auth.js';
import {ForbiddenError} from '../models/error.js';

export default async (req, res, next) => {
  if (req.url.indexOf('/api/') === -1 ||
        req.url.indexOf('/api/v1/auth/') === 0 ||
        req.url.indexOf('/api/v1/plugins/images') === 0 ||
        req.url === '/api/v1/initialized' ||
        (req.url === '/api/v1/chatBots/interact' && req.headers['device-id'])
  ) {
    return next();
  }
  const token = req.body.token || req.query.token || req.headers['authorization']?.replace('Token ', '');
  // decode token
  if (token) {
    // verifies secret and checks exp
    req.user = await req.services.authService.verifyToken(token, config.secret);
    next();
  } else {
    return next(new ForbiddenError());
  }
};
