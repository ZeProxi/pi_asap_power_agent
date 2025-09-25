import recorder from 'node-record-lpcm16';
import { config } from './config.js';
import { logger } from './utils/logger.js';

export class VoiceActivationDetector {
  constructor(onSpeechStart, onSpeechEnd) {
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    
    this.isListening = false;
    this.isSpeechDetected = false;
    this.recordingStream = null;
    this.silenceTimer = null;
    this.speechTimer = null;
    
    // Voice detection parameters
    this.silenceThreshold = 500; // RMS threshold for silence
    this.speechDuration = 500; // ms of speech needed to trigger
    this.silenceDuration = 3000; // ms of silence before ending speech
    this.inactivityTimeout = 20000; // 20 seconds of no speech = disconnect
    this.inactivityTimer = null;
    
    this.recordingOptions = {
      sampleRate: config.audio.sampleRate,
      channels: config.audio.channels,
      threshold: 0.1, // Lower threshold for VAD
      silence: '0.5s',
      device: 'plughw:1,0', // ATR USB microphone
      recordProgram: 'arecord',
      verbose: config.debug.enabled
    };
  }

  async startListening() {
    if (this.isListening) {
      return;
    }

    logger.info('🎤 Starting voice activation listening...');
    logger.info('Speak to activate the agent connection');
    
    try {
      this.recordingStream = recorder.record(this.recordingOptions);
      this.isListening = true;
      this.isSpeechDetected = false;
      
      // Start inactivity timer
      this.startInactivityTimer();

      this.recordingStream.stream().on('data', (chunk) => {
        this.processAudioChunk(chunk);
      });

      this.recordingStream.stream().on('error', (error) => {
        logger.error('Voice detection error:', error);
        this.stopListening();
      });

    } catch (error) {
      logger.error('Failed to start voice detection:', error);
      throw error;
    }
  }

  stopListening() {
    if (!this.isListening) {
      return;
    }

    logger.info('🔇 Stopping voice activation listening');
    
    this.isListening = false;
    this.isSpeechDetected = false;
    
    // Clear all timers
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
    
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    
    if (this.recordingStream) {
      try {
        this.recordingStream.stop();
      } catch (error) {
        logger.debug('Error stopping voice detection stream:', error);
      }
      this.recordingStream = null;
    }
  }

  processAudioChunk(chunk) {
    // Calculate RMS (Root Mean Square) for volume detection
    const rms = this.calculateRMS(chunk);
    const isSpeech = rms > this.silenceThreshold;
    
    if (config.debug.enabled && Math.random() < 0.01) { // Log 1% of samples to avoid spam
      logger.debug(`Voice level: ${rms.toFixed(0)} (threshold: ${this.silenceThreshold})`);
    }

    if (isSpeech) {
      this.handleSpeechDetected();
    } else {
      this.handleSilenceDetected();
    }
  }

  calculateRMS(buffer) {
    let sum = 0;
    const samples = buffer.length / 2; // 16-bit samples = 2 bytes each
    
    for (let i = 0; i < buffer.length; i += 2) {
      const sample = buffer.readInt16LE(i);
      sum += sample * sample;
    }
    
    return Math.sqrt(sum / samples);
  }

  handleSpeechDetected() {
    // Reset inactivity timer when speech is detected
    this.resetInactivityTimer();
    
    // Clear silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // If not currently in speech state, start speech timer
    if (!this.isSpeechDetected) {
      if (!this.speechTimer) {
        this.speechTimer = setTimeout(() => {
          logger.info('🗣️  Speech detected - activating agent connection');
          this.isSpeechDetected = true;
          this.speechTimer = null;
          
          if (this.onSpeechStart) {
            this.onSpeechStart();
          }
        }, this.speechDuration);
      }
    }
  }

  handleSilenceDetected() {
    // Clear speech timer if we detect silence
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }

    // If currently in speech state, start silence timer
    if (this.isSpeechDetected) {
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          logger.info('🤫 Silence detected - speech ended');
          this.isSpeechDetected = false;
          this.silenceTimer = null;
          
          if (this.onSpeechEnd) {
            this.onSpeechEnd();
          }
        }, this.silenceDuration);
      }
    }
  }

  startInactivityTimer() {
    this.inactivityTimer = setTimeout(() => {
      logger.info('⏰ Inactivity timeout - no speech detected for 20 seconds');
      if (this.onSpeechEnd) {
        this.onSpeechEnd();
      }
    }, this.inactivityTimeout);
  }

  resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    this.startInactivityTimer();
  }

  // Public method to check if currently detecting speech
  isSpeaking() {
    return this.isSpeechDetected;
  }

  // Public method to get current voice level (for debugging)
  getCurrentLevel() {
    return this.lastRMS || 0;
  }
}
