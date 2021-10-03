import bcrypt from 'bcrypt';
import pkg from 'sequelize';
import sequelize from '../../common/database.js';

const {Model, STRING} = pkg;

const PROTECTED_ATTRIBUTES = ['password'];

class User extends Model {
  async validPassword(password) {
    return await bcrypt.compare(password, this.password);
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
      const salt = await bcrypt.genSalt();
      user.password = await bcrypt.hash(user.password, salt);
    },
  },
  sequelize,
  modelName: 'user',
});

export default User;
