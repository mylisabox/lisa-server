import {NotFoundError, PayloadError} from '../common/models/error.js';
import Service from '../common/models/service.js';
import crypto from "../common/utils/crypto.js";
import User from './models/user.js';

class UserService extends Service {
  async get(id) {
    const user = await User.findByPk(id);
    if (!user) {
      throw new NotFoundError();
    }
    return user;
  }

  async save(id, data) {
    if (data.password !== undefined && data.password !== null && data.password.length < 6) {
      throw new PayloadError('Password should be at least 6 length long');
    }
    if (data.password) {
      const salt = crypto.salt();
      data.password = await crypto.getHash(data.password, salt);
    }
    await User.update(data, {
      where: {
        id: id,
      },
    });
    return this.get(id);
  }
}

export default UserService;
