const EventEmitter = require('events');
const uuid = require('uuid');

class StreamService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    this.streamSid = '';
    this.currentAudioPlaying = null; // Flag to track the current audio playing
  }

  setStreamSid(streamSid) {
    this.streamSid = streamSid;
  }

  buffer(index, audio) {
    // Escape hatch for intro message, which doesn't have an index
    // console.log(audio)
    if (index === null) {
      this.stopCurrentAudio(); // Stop current audio if new audio is received
      this.sendAudio(audio);
    } else if (index === this.expectedAudioIndex) {
      this.stopCurrentAudio(); // Stop current audio if new audio is received
      this.sendAudio(audio);
      this.expectedAudioIndex++;

      while (Object.prototype.hasOwnProperty.call(this.audioBuffer, this.expectedAudioIndex)) {
        const bufferedAudio = this.audioBuffer[this.expectedAudioIndex];
        this.sendAudio(bufferedAudio);
        this.expectedAudioIndex++;
      }
    } else {
      this.audioBuffer[index] = audio;
    }
  }

  sendAudio(audio) {
    this.currentAudioPlaying = uuid.v4(); // Set the current audio identifier

    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: 'media',
        media: {
          payload: audio,
        },
      })
    );

    // When the media completes you will receive a `mark` message with the label
    const markLabel = this.currentAudioPlaying; // Use the current audio identifier
    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: 'mark',
        mark: {
          name: markLabel,
        },
      })
    );
    this.emit('audiosent', markLabel);
  }

  stopCurrentAudio() {
    if (this.currentAudioPlaying) {
      this.ws.send(
        JSON.stringify({
          streamSid: this.streamSid,
          event: 'stop', // Custom event to signal stopping of the current audio
          mark: {
            name: this.currentAudioPlaying,
          },
        })
      );
      this.currentAudioPlaying = null; // Reset the current audio flag
    }
  }

  sendCue(audio) {
    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: 'media',
        media: {
          payload: audio,
        },
      })
    );
  }
}

module.exports = { StreamService };
