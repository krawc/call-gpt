require('colors');
const { Buffer } = require('node:buffer');
const EventEmitter = require('events');
const WebSocket = require('ws');

class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    const gladiaApiKey = process.env.GLADIA_API_KEY;
    if (!gladiaApiKey) {
      throw new Error(
        'Required variable GLADIA_API_KEY is not defined in the .env file.'
      );
    }

    this.gladiaUrl = "wss://api.gladia.io/audio/text/audio-transcription";
    this.gladiaSocket = new WebSocket(this.gladiaUrl);
    this.finalResult = '';
    this.speechFinal = false;
    this.fisrtGladiaMessage = false;

    this.gladiaSocket.on('open', () => {
      console.log('STT -> Gladia connection opened'.green);
      const configuration = {
        x_gladia_key: gladiaApiKey,
        language_behaviour: 'manual',
        language: 'polish',
        sample_rate: 8000,
        endpointing: 100,
        encoding: 'wav/ulaw',
        bit_depth: 16,
      };
      this.gladiaSocket.send(JSON.stringify(configuration));
      console.log('STT -> Configuration sent to Gladia'.cyan);
    });

    this.gladiaSocket.on('message', (event) => {
      const gladiaMsg = JSON.parse(event.toString());
      if (gladiaMsg.hasOwnProperty('transcription') && gladiaMsg.type === 'final') {
        const text = gladiaMsg.transcription;

        console.log(gladiaMsg)

        if (gladiaMsg.confidence > 0.54) {
          this.finalResult += ` ${text}`;
          this.speechFinal = true;
          console.log(`STT -> Final transcription: ${this.finalResult.trim()}`.yellow);
          this.emit('transcription', this.finalResult.trim());
          this.finalResult = '';
        }
      }
    });

    // this.gladiaSocket.on("message", async (event) => {
    //   const gladiaMsg = JSON.parse(event.toString());
    //   if (!this.fisrtGladiaMessage) {
    //     console.log(`Gladia web socket connection id: ${gladiaMsg.request_id}`);
    //     this.fisrtGladiaMessage = true;
    //   } else if (
    //     gladiaMsg.hasOwnProperty("transcription") &&
    //     gladiaMsg.type === "final"
    //   ) {
    //     console.log(
    //       `${callerNumber}: ${gladiaMsg.transcription} (${gladiaMsg.language}) [confidence: ${gladiaMsg.confidence}]`
    //     );
    //   }
    // });

    this.gladiaSocket.on('error', (error) => {
      console.error('STT -> Gladia error'.red);
      console.error(error);
    });

    this.gladiaSocket.on('close', (code, reason) => {
      console.log(`STT -> Gladia connection closed with code: ${code}, reason: ${reason}`.yellow);
    });
  }

  /**
   * Send the payload to Gladia
   * @param {String} payload A base64 MULAW/8000 audio stream
   */
  send(payload) {
    if (this.gladiaSocket.readyState !== 0) {
      this.gladiaSocket.send(JSON.stringify({ frames: payload }));
    }
  }
}

module.exports = { TranscriptionService };
