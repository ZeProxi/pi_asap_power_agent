import recorder from 'node-record-lpcm16';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export class AudioManager {
  constructor() {
    this.isRecording = false;
    this.recordingStream = null;
    this.audioQueue = [];
    this.isPlaying = false;
    this.tempAudioFiles = [];
    
    // Audio configuration based on ElevenLabs requirements
    this.recordingOptions = {
      sampleRate: config.audio.sampleRate, // 48000 Hz for ATR2100-USB
      channels: config.audio.channels, // 2 channels (stereo) for ATR2100-USB
      threshold: 0.5,
      silence: '1.0s',
      device: 'plughw:1,0', // ATR USB microphone (card 1, device 0)
      recordProgram: 'arecord', // Use ALSA for Raspberry Pi (not sox)
      verbose: config.debug.enabled
    };

    // ALSA playback options (ElevenLabs sends 16kHz mono PCM)
    this.playbackDevice = 'plughw:0,0'; // bcm2835 Headphones (aux jack for Marshall amp)
    this.playbackOptions = [
      '-D', this.playbackDevice,
      '-f', 'S16_LE',
      '-c', '1', // ElevenLabs audio is mono
      '-r', '16000' // ElevenLabs audio is 16kHz
    ];
  }

  // Convert 48kHz stereo to 16kHz mono for ElevenLabs
  convertAudioFormat(inputBuffer) {
    try {
      // Input: 48kHz stereo (2 channels), 16-bit samples
      // Output: 16kHz mono (1 channel), 16-bit samples
      
      const inputSampleRate = 48000;
      const outputSampleRate = 16000;
      const inputChannels = 2;
      const outputChannels = 1;
      
      // Calculate decimation factor (3:1 for 48kHz to 16kHz)
      const decimationFactor = inputSampleRate / outputSampleRate;
      
      // Convert buffer to 16-bit signed integers
      const inputSamples = [];
      for (let i = 0; i < inputBuffer.length; i += 2) {
        inputSamples.push(inputBuffer.readInt16LE(i));
      }
      
      // Convert stereo to mono by averaging channels
      const monoSamples = [];
      for (let i = 0; i < inputSamples.length; i += inputChannels) {
        const left = inputSamples[i] || 0;
        const right = inputSamples[i + 1] || 0;
        monoSamples.push(Math.round((left + right) / 2));
      }
      
      // Downsample by taking every nth sample
      const outputSamples = [];
      for (let i = 0; i < monoSamples.length; i += decimationFactor) {
        outputSamples.push(monoSamples[Math.floor(i)]);
      }
      
      // Convert back to buffer
      const outputBuffer = Buffer.alloc(outputSamples.length * 2);
      for (let i = 0; i < outputSamples.length; i++) {
        outputBuffer.writeInt16LE(outputSamples[i] || 0, i * 2);
      }
      
      return outputBuffer;
    } catch (error) {
      logger.error('Audio format conversion error:', error);
      return inputBuffer; // Return original if conversion fails
    }
  }

  startRecording(onAudioData) {
    return new Promise((resolve, reject) => {
      if (this.isRecording) {
        logger.warn('Recording already in progress');
        return resolve();
      }

      try {
        logger.audio('Starting audio recording...');
        
        this.recordingStream = recorder.record(this.recordingOptions);
        this.isRecording = true;

        // Handle audio data chunks
        this.recordingStream.stream().on('data', (chunk) => {
          if (onAudioData && chunk.length > 0) {
            // Convert from 48kHz stereo to 16kHz mono for ElevenLabs
            const convertedChunk = this.convertAudioFormat(chunk);
            
            // Convert PCM data to base64 for ElevenLabs
            const base64Audio = convertedChunk.toString('base64');
            onAudioData(base64Audio);
            
            if (config.debug.enabled) {
              logger.audio(`Audio chunk: ${chunk.length}→${convertedChunk.length} bytes`);
            }
          }
        });

        this.recordingStream.stream().on('error', (error) => {
          logger.error('Recording stream error:', error);
          this.stopRecording();
          reject(error);
        });

        logger.audio('Audio recording started successfully');
        resolve();

      } catch (error) {
        logger.error('Failed to start recording:', error);
        this.isRecording = false;
        reject(error);
      }
    });
  }

  stopRecording() {
    if (!this.isRecording) {
      return;
    }

    try {
      logger.audio('Stopping audio recording...');
      
      if (this.recordingStream) {
        this.recordingStream.stop();
        this.recordingStream = null;
      }
      
      this.isRecording = false;
      logger.audio('Audio recording stopped');
      
    } catch (error) {
      logger.error('Error stopping recording:', error);
    }
  }

  async playAudio(base64AudioData) {
    try {
      if (!base64AudioData) {
        logger.warn('No audio data provided for playback');
        return;
      }

      // Decode base64 audio data
      const audioBuffer = Buffer.from(base64AudioData, 'base64');
      
      logger.audio(`Playing audio chunk: ${audioBuffer.length} bytes`);

      // Add to queue if currently playing
      if (this.isPlaying) {
        this.audioQueue.push(audioBuffer);
        return;
      }

      await this.playAudioBuffer(audioBuffer);

    } catch (error) {
      logger.error('Error playing audio:', error);
    }
  }

  async playAudioBuffer(buffer) {
    return new Promise((resolve, reject) => {
      try {
        this.isPlaying = true;
        
        // Create temporary file for audio data
        const tempFile = `/tmp/audio_${Date.now()}.raw`;
        this.tempAudioFiles.push(tempFile);
        
        // Write PCM data to temporary file
        writeFileSync(tempFile, buffer);
        
        // Use aplay to play the audio
        const aplay = spawn('aplay', [...this.playbackOptions, tempFile]);
        
        aplay.on('close', (code) => {
          this.isPlaying = false;
          
          // Clean up temporary file
          try {
            unlinkSync(tempFile);
            const index = this.tempAudioFiles.indexOf(tempFile);
            if (index > -1) {
              this.tempAudioFiles.splice(index, 1);
            }
          } catch (cleanupError) {
            logger.warn('Failed to cleanup temp audio file:', cleanupError);
          }
          
          if (code === 0) {
            logger.audio('Audio playback completed');
            
            // Play next queued audio if available
            if (this.audioQueue.length > 0) {
              const nextBuffer = this.audioQueue.shift();
              this.playAudioBuffer(nextBuffer);
            }
            
            resolve();
          } else {
            logger.error(`aplay exited with code ${code}`);
            reject(new Error(`Audio playback failed with code ${code}`));
          }
        });

        aplay.on('error', (error) => {
          this.isPlaying = false;
          logger.error('aplay error:', error);
          reject(error);
        });

        aplay.stderr.on('data', (data) => {
          logger.debug('aplay stderr:', data.toString());
        });

      } catch (error) {
        this.isPlaying = false;
        logger.error('Error in playAudioBuffer:', error);
        reject(error);
      }
    });
  }

  // Utility method to check audio devices
  async checkAudioDevices() {
    try {
      logger.info('Checking available audio devices...');
      
      logger.info('Audio Device Configuration:');
      logger.info(`• Microphone: ATR USB microphone (card 1, device 0)`);
      logger.info(`• Output: bcm2835 Headphones → Marshall amp (card 0, device 0)`);
      logger.info(`• Recording device: ${this.recordingOptions.device}`);
      logger.info(`• Playback device: ${this.playbackDevice}`);
      logger.info(`• Using native aplay for audio output (more reliable on Pi)`);
      logger.info('');
      logger.info('To verify devices, run: aplay -l && arecord -l');
      
    } catch (error) {
      logger.error('Error checking audio devices:', error);
    }
  }

  // Cleanup method
  cleanup() {
    logger.audio('Cleaning up audio manager...');
    
    this.stopRecording();
    
    // Clean up any remaining temporary audio files
    this.tempAudioFiles.forEach(file => {
      try {
        unlinkSync(file);
      } catch (error) {
        logger.debug(`Failed to cleanup temp file ${file}:`, error);
      }
    });
    
    this.audioQueue = [];
    this.tempAudioFiles = [];
    this.isPlaying = false;
  }
}
