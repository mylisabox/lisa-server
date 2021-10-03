import pkg from 'sequelize';
import logger from "./utils/logger.js";
const {Sequelize} = pkg;

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'lisa.sqlite',
  logging: (message) => logger.verbose(message),
});

export default sequelize;
