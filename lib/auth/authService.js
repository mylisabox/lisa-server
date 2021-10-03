import jwt from 'jsonwebtoken';
import config from '../../config/auth.js';
import {ForbiddenError, ServiceError, UnauthorizedError} from '../common/models/error.js';
import Service from '../common/models/service.js';
import User from '../users/models/user.js';

class AuthService extends Service {
  async register(data) {
    if (await User.count() > 0) {
      throw new ServiceError(403, '403', 'Max admin user reach');
    }
    const user = await User.create(data);
    const tokens = this._getTokens(user);
    return {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
    };
  }

  _getTokens(user) {
    const tokenData = user.toJSON();
    delete tokenData.email;
    delete tokenData.mobile;
    delete tokenData.avatar;
    const token = jwt.sign(tokenData, config.secret, {expiresIn: config.tokenLife});
    const refreshToken = jwt.sign(tokenData, config.refreshTokenSecret, {expiresIn: config.refreshTokenLife});
    return {token, refreshToken};
  }

  async login(data) {
    const user = await User.findOne({
      where: {
        email: data.email,
      },
    });
    if (!user) {
      throw new UnauthorizedError('email or password incorrect');
    }

    if (await user.validPassword(data.password)) {
      const tokens = this._getTokens(user);
      return {
        token: tokens.token,
        refreshToken: tokens.refreshToken,
      };
    } else {
      throw new UnauthorizedError('email or password incorrect');
    }
  }

  verifyToken(token, secret) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, function(err, decoded) {
        if (err) {
          reject(new UnauthorizedError(null, err));
        } else {
          resolve(decoded);
        }
      });
    });
  }

  async getToken(data) {
    if (data.refreshToken) {
      const decoded = await this.verifyToken(data.refreshToken, config.refreshTokenSecret);
      delete decoded.exp;
      delete decoded.iat;
      const token = jwt.sign(decoded, config.secret, {expiresIn: config.refreshTokenLife});
      return {
        'token': token,
        'refreshToken': data.refreshToken,
      };
    } else {
      throw new ForbiddenError();
    }
  }
}

export default AuthService;
