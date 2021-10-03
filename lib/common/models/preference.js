import pkg from 'sequelize';
const {Model, STRING} = pkg;

import sequelize from '../../common/database.js';

class Preference extends Model {
}

Preference.init({
  key: {
    primaryKey: true,
    type: STRING,
    allowNull: false,
  },
  value: {
    type: STRING,
    get: function() {
      let data = this.getDataValue('value');
      if (data) {
        data = JSON.parse(data);
      }
      return data ? data : {};
    },
    set: function(value) {
      if (!value) {
        value = {};
      }
      this.setDataValue('value', JSON.stringify(value));
    },
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'preference',
});

export default Preference;
