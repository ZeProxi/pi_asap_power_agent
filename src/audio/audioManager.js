import recorder from 'node-record-lpcm16';
import Speaker from 'speaker';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export class AudioManager {
  constructor() {
    this.isRecording = false;
    this.recordingStream = null;
    this.speaker = null;
    this.audioQueue = [];
    this.isPlaying = false;
    
    // Audio configuration based on ElevenLabs requirements
    this.recordingOptions = {
      sampleRate: config.audio.sampleRate,
      channels: config.audio.channels,
      threshold: 0.5,
      silence: '1.0s',
      device: null, // Will be auto-detected or set via ALSA
      recordProgram: 'arecord', // Use ALSA for Raspberry Pi
      verbose: config.debug.enabled
    };

    this.speakerOptions = {
      channels: config.audio.channels,
      bitDepth: config.audio.bitDepth,
      sampleRate: config.audio.sampleRate,
      signed: true,
      float: false,
      bitOrder: 'LE' // Little Endian
    };

    this.initializeSpeaker();
  }

  initializeSpeaker() {
    try {
      this.speaker = new Speaker(this.speakerOptions);
      logger.audio('Speaker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize speaker:', error);
      throw error;
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
            // Convert PCM data to base64 for ElevenLabs
            const base64Audio = chunk.toString('base64');
            onAudioData(base64Audio);
            
            if (config.debug.enabled) {
              logger.audio(`Audio chunk captured: ${chunk.length} bytes`);
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
        
        // Create a new speaker instance for this playback
        const speaker = new Speaker(this.speakerOptions);
        
        speaker.on('close', () => {
          this.isPlaying = false;
          logger.audio('Audio playback completed');
          
          // Play next queued audio if available
          if (this.audioQueue.length > 0) {
            const nextBuffer = this.audioQueue.shift();
            this.playAudioBuffer(nextBuffer);
          }
          
          resolve();
        });

        speaker.on('error', (error) => {
          this.isPlaying = false;
          logger.error('Speaker error:', error);
          reject(error);
        });

        // Write audio data to speaker
        speaker.write(buffer);
        speaker.end();

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
      
      // This would typically use aplay -l and arecord -l on Linux
      // For now, we'll log the expected device
      logger.info(`Expected microphone device: ${config.audio.deviceName}`);
      logger.info('Use "aplay -l" and "arecord -l" to list available audio devices');
      
    } catch (error) {
      logger.error('Error checking audio devices:', error);
    }
  }

  // Cleanup method
  cleanup() {
    logger.audio('Cleaning up audio manager...');
    
    this.stopRecording();
    
    if (this.speaker) {
      try {
        this.speaker.close();
      } catch (error) {
        logger.error('Error closing speaker:', error);
      }
    }
    
    this.audioQueue = [];
    this.isPlaying = false;
  }
}
