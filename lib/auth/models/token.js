const {Model, STRING} = require('sequelize');
const sequelize = require('../../common/database');

class RefreshToken extends Model {}

RefreshToken.init({
  token: {
    type: STRING,
    allowNull: false,
    unique: true,
  },
}, {
  sequelize,
  modelName: 'refresh_token',
});

export default RefreshToken;
