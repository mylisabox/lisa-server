import bcrypt from 'bcrypt';
import User from './models/user.js';
import {NotFoundError, PayloadError} from '../common/models/error.js';
import Service from '../common/models/service.js';

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
      const salt = await bcrypt.genSalt();
      data.password = await bcrypt.hash(data.password, salt);
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
