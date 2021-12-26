import pkg from 'sequelize';
import sequelize from '../../common/database.js';
import crypto from "../../common/utils/crypto.js";

const {Model, STRING} = pkg;

const PROTECTED_ATTRIBUTES = ['password'];

class User extends Model {
  async validPassword(password) {
    return await crypto.compare(password, this.password);
  }

  toJSON() {
    // hide protected fields
    const attributes = Object.assign({}, this.get());
    for (const a of PROTECTED_ATTRIBUTES) {
      delete attributes[a];
    }
    return attributes;
  }
}

User.init({
  email: {
    type: STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: {
        msg: 'email_incorrect',
      },
    },
  },
  password: {
    type: STRING,
    allowNull: false,
  },
  firstName: {
    type: STRING,
    allowNull: false,
  },
  lang: {
    type: STRING,
    allowNull: false,
    defaultValue: 'en',
  },
  lastName: {
    type: STRING,
    allowNull: false,
  },
  mobile: {
    type: STRING,
  },
  avatar: {
    type: STRING,
  },
}, {
  hooks: {
    beforeCreate: async (user, options) => {
      const salt = crypto.salt();
      user.password = await crypto.getHash(user.password, salt);
    },
  },
  sequelize,
  modelName: 'user',
});

export default User;
