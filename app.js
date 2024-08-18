require('dotenv').config();
require('colors');


const express = require('express');
const ExpressWs = require('express-ws');

const i18next = require('i18next');
const fs = require('fs');

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { recordingService } = require('./services/recording-service');

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const path = require('path');

// Define the path to the MP3 file
const filePath = path.join(__dirname, 'assets', 'listen-start.ulaw');

const processingFilePath = path.join(__dirname, 'assets', 'short192.ulaw');


// Read the MP3 file into a buffer
// Read the MP3 file into a buffer
const audioBuffer = fs.readFileSync(filePath);

// Convert the audio buffer to a base64 string
const audioBase64 = audioBuffer.toString('base64');

const processingAudioBuffer = fs.readFileSync(processingFilePath);

// Convert the audio buffer to a base64 string
const processingAudioBase64 = processingAudioBuffer.toString('base64');

// Convert the buffer to a base64 string

// Optional: Create a data URI for the audio file
//const audioDataUri = `data:audio/wav;base64,${audioBase64}`;

// Initialize i18next
i18next.init({
  lng: process.env.LANGUAGE, // default language
  resources: {
    en: {
      translation: JSON.parse(fs.readFileSync('./locales/en.json'))
    },
    nl: {
      translation: JSON.parse(fs.readFileSync('./locales/nl.json'))
    },
    uk: {
      translation: JSON.parse(fs.readFileSync('./locales/uk.json'))
    },
    pl: {
      translation: JSON.parse(fs.readFileSync('./locales/pl.json'))
    }
  }
}, (err, t) => {
  if (err) return console.error(err);
});

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 3000;

app.post('/incoming', (req, res) => {
  try {
    const response = new VoiceResponse();
    const connect = response.connect();
    connect.stream({ url: `wss://${process.env.SERVER}/connection` });
  
    res.type('text/xml');
    res.end(response.toString());
  } catch (err) {
    console.log(err);
  }
});

app.ws('/connection', (ws) => {
  try {
    ws.on('error', console.error);
    // Filled in from start message
    let streamSid;
    let callSid;

    const gptService = new GptService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});
  
    let marks = [];
    let interactionCount = 0;
  
    // Incoming from MediaStream
    ws.on('message', function message(data) {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        
        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);

        // Set RECORDING_ENABLED='true' in .env to record calls
        recordingService(ttsService, callSid).then(() => {
          console.log(`Twilio -> Starting Media Stream for ${streamSid}`.underline.red);
          console.log('file should play')

          ttsService.generate({partialResponseIndex: null, partialResponse: i18next.t('greeting')}, 0);
        });
      } else if (msg.event === 'media') {
        transcriptionService.send(msg.media.payload);
      } else if (msg.event === 'mark') {
        const label = msg.mark.name;
        console.log(`Twilio -> Audio completed mark (${msg.sequenceNumber}): ${label}`.red);
        marks = marks.filter(m => m !== msg.mark.name);
      } else if (msg.event === 'stop') {
        console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);
      }
    });
  
    transcriptionService.on('utterance', async (text) => {
      // This is a bit of a hack to filter out empty utterances
      if(marks.length > 0 && text?.length > 5) {
        console.log('Twilio -> Interruption, Clearing stream'.red);
        ws.send(
          JSON.stringify({
            streamSid,
            event: 'clear',
          })
        );
      }
    });

    let processingInterval;
  
    transcriptionService.on('transcription', async (text) => {
      streamService.sendCue(audioBase64);

      // processingInterval = setInterval(() => {
      //   streamService.sendCue(processingAudioBase64);
      // }, 1000); // Adjust the interval time as needed

      if (!text) { return; }

      console.log(`Interaction ${interactionCount} – STT -> GPT: ${text}`.yellow);
      gptService.completion(text, interactionCount);
      interactionCount += 1;
    });
    
    gptService.on('gptreply', async (gptReply, icount) => {
      console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green );
      clearInterval(processingInterval);

      ttsService.generate(gptReply, icount);
    });
  
    ttsService.on('speech', (responseIndex, audio, label, icount) => {
      console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`.blue);
  
      streamService.buffer(responseIndex, audio);
    });
  
    streamService.on('audiosent', (markLabel) => {
      marks.push(markLabel);
    });
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);
