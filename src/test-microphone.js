#!/usr/bin/env node

import recorder from 'node-record-lpcm16';
import { writeFileSync } from 'fs';
import { config } from './config.js';
import { logger } from './utils/logger.js';

class MicrophoneTest {
  constructor() {
    this.isRecording = false;
    this.recordingStream = null;
    this.audioData = [];
    
    this.recordingOptions = {
      sampleRate: config.audio.sampleRate,
      channels: config.audio.channels,
      threshold: 0.5,
      silence: '1.0s',
      device: 'plughw:1,0', // ATR USB microphone
      recordProgram: 'arecord',
      verbose: true
    };
  }

  async testMicrophone() {
    console.log('🎤 Testing ATR2100-USB Microphone...');
    console.log('Configuration:', {
      device: this.recordingOptions.device,
      sampleRate: this.recordingOptions.sampleRate,
      channels: this.recordingOptions.channels
    });
    
    console.log('\n📡 Starting 5-second recording test...');
    console.log('Speak into your microphone now!');
    
    try {
      await this.startRecording();
      
      // Record for 5 seconds
      setTimeout(() => {
        this.stopRecording();
        this.analyzeResults();
      }, 5000);
      
    } catch (error) {
      console.error('❌ Microphone test failed:', error);
      this.printTroubleshooting();
    }
  }

  async startRecording() {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔴 Recording started - speak now...');
        
        this.recordingStream = recorder.record(this.recordingOptions);
        this.isRecording = true;
        this.audioData = [];

        this.recordingStream.stream().on('data', (chunk) => {
          this.audioData.push(chunk);
          process.stdout.write('.');
        });

        this.recordingStream.stream().on('error', (error) => {
          console.error('\n❌ Recording error:', error);
          reject(error);
        });

        resolve();

      } catch (error) {
        console.error('❌ Failed to start recording:', error);
        reject(error);
      }
    });
  }

  stopRecording() {
    if (!this.isRecording) return;

    console.log('\n⏹️  Recording stopped');
    
    try {
      if (this.recordingStream) {
        this.recordingStream.stop();
        this.recordingStream = null;
      }
      this.isRecording = false;
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }

  analyzeResults() {
    console.log('\n📊 Analysis Results:');
    
    if (this.audioData.length === 0) {
      console.log('❌ No audio data captured');
      this.printTroubleshooting();
      return;
    }

    const totalBytes = this.audioData.reduce((sum, chunk) => sum + chunk.length, 0);
    const durationSeconds = 5;
    const expectedBytes = config.audio.sampleRate * config.audio.channels * 2 * durationSeconds; // 16-bit = 2 bytes
    
    console.log(`✅ Audio data captured: ${totalBytes} bytes`);
    console.log(`📈 Expected: ${expectedBytes} bytes`);
    console.log(`📊 Capture ratio: ${((totalBytes / expectedBytes) * 100).toFixed(1)}%`);
    
    // Save audio data for manual verification
    const combinedBuffer = Buffer.concat(this.audioData);
    writeFileSync('microphone-test.raw', combinedBuffer);
    
    console.log('\n💾 Audio saved as: microphone-test.raw');
    console.log('🎧 To play back: aplay -f S16_LE -c 1 -r 16000 microphone-test.raw');
    
    if (totalBytes > expectedBytes * 0.8) {
      console.log('✅ Microphone test PASSED - Good audio capture!');
    } else if (totalBytes > 0) {
      console.log('⚠️  Microphone test PARTIAL - Some audio captured but may be low');
    } else {
      console.log('❌ Microphone test FAILED - No audio captured');
      this.printTroubleshooting();
    }
  }

  printTroubleshooting() {
    console.log('\n🔧 TROUBLESHOOTING TIPS:');
    console.log('1. Check microphone connection: lsusb | grep -i audio');
    console.log('2. Verify audio devices: arecord -l');
    console.log('3. Test with system command: arecord -f cd -t wav -d 3 -D plughw:1,0 test.wav');
    console.log('4. Check audio group: groups (should include "audio")');
    console.log('5. Install missing packages: sudo apt install sox libsox-fmt-all');
    console.log('6. Check microphone volume/gain settings');
  }
}

// Run test
const test = new MicrophoneTest();
test.testMicrophone();
