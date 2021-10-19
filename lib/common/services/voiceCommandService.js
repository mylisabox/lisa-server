import fs from 'fs';
import config from '../../../config/config.js';
import Service from '../models/service.js';

class VoiceCommandService extends Service {
  async startVoiceCommands() {
    if (this.voiceCommand) {
      this.voiceCommand.stop();
    }

    // advertise an HTTP server on configured port
    const os = await import('os');
    const polly = (await import('lisa-speaker-polly')).default;
    const VoiceCommand = (await import('lisa-standalone-voice-command')).default;
    const pico = (await import('lisa-standalone-voice-command/lib/speaker.js')).default;

    // app.serialPort = serialPort

    const language = (process.env.LANG || 'en-US').substring(0, 5).replace('_', '-');
    this.log.info('set lang to ' + language);
    const isPollyCredentialsPresent = fs.existsSync(os.homedir() + '/.aws/credentials');
    let voiceId;
    switch (language) {
      case 'fr-FR':
        voiceId = 'Celine';
        break;
      case 'ru-RU':
        voiceId = 'Tatyana';
        break;
      default:
        voiceId = 'Kimberly';
    }

    const hotwords = [{
      file: './node_modules/lisa-standalone-voice-command/speech/hey_lisa.pmdl',
      hotword: 'hey lisa',
    }];

    fs.readdirSync('./config/speech').forEach((file) => {
      if (file.endsWith('.pmdl')) {
        hotwords.push({
          file: './config/speech/' + file,
          hotword: file.replace('.pmdl', ''),
        });
      }
    });

    if (hotwords.length > 1) {
      hotwords.shift();
    }

    const voiceCommand = new VoiceCommand({
      matrix: {
        ip: '127.0.0.1',
        idleMode: {
          brightness: 0.02
        }
      },
      log: this.log,
      speaker: {
        module: isPollyCredentialsPresent ? polly : pico,
        options: {
          voiceId: voiceId, // see http://docs.aws.amazon.com/polly/latest/dg/voicelist.html for other voices
        },
      },
      url: (config.web.ssl == null ? 'http' : 'https') + '://127.0.0.1:' + config.web.port,
      gSpeech: './config/speech/LISA-gfile.json',
      hotwords: hotwords,
      language: language,
    });
    voiceCommand.on('hotword', () => this.log.debug('hey lisa detected'));
    voiceCommand.on('error', (error) => this.log.error(JSON.stringify(error)));
    voiceCommand.on('final-result', (sentence) => this.log.debug(sentence + ' detected'));
    voiceCommand.on('bot-result', (result) => this.log.debug(result));
    this.voiceCommand = voiceCommand;
  }
}

export default VoiceCommandService;
