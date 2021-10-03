import {createRequire} from 'module';
const require = createRequire(import.meta.url);

export default {
  personality: require('./personality.json'),
  mediacenter: require('./mediacenter.json'),
  lights: require('./lights.json'),
  devices: require('./devices.json'),
  ir: require('./ir.json'),
};
