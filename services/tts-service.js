require('dotenv').config();
const { Buffer } = require('node:buffer');
const EventEmitter = require('events');
const fetch = require('node-fetch');

class TextToSpeechService extends EventEmitter {
  constructor() {
    super();
    this.nextExpectedIndex = 0;
    this.speechBuffer = {};
  }

  async generate(gptReply, interactionCount) {
    const { partialResponseIndex, partialResponse } = gptReply;

    if (!partialResponse) { return; }

    try {

      let sanitizedResponse = partialResponse
      .replace(/[\"\'\[\]\{\}]/g, '') // Remove quotes, brackets, and braces
      .replace(/\\/g, ''); // Remove backslashes

      const obj = {
        method: 'POST',
        headers: {
          'xi-api-key': 'sk_5972256afa14f2025135817ad6a0150f05d68dc734061dc1',
          'Content-Type': 'application/json',
          accept: 'audio/wav',
        },
        body: JSON.stringify({
          model_id: 'eleven_turbo_v2_5',
          text: sanitizedResponse,
          voice_settings: {
            stability: 0.3, // Controls the consistency of the voice
            similarity_boost: 0.8, // Controls how much it tries to maintain the voice tone
          },
        }),
      }
      console.log(obj)
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/XrExE9yKIg1WjnnlVkGX/stream?output_format=ulaw_8000&optimize_streaming_latency=3`,
        obj
      );
      
      if (response.status === 200) {
        const audioArrayBuffer = await response.arrayBuffer();

        this.emit('speech', partialResponseIndex, Buffer.from(audioArrayBuffer).toString('base64'), sanitizedResponse, interactionCount);
      } else {
        console.log('Eleven Labs Error:');
        console.log(JSON.stringify(response));
      }
    } catch (err) {
      console.error('Error occurred in XI LabsTextToSpeech service');
      console.error(err);
    }
  }
}

module.exports = { TextToSpeechService };