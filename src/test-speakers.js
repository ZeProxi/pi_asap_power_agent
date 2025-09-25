#!/usr/bin/env node

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { config } from './config.js';
import { logger } from './utils/logger.js';

class SpeakerTest {
  constructor() {
    this.playbackDevice = 'plughw:0,0'; // bcm2835 Headphones for Marshall amp
    this.playbackOptions = [
      '-D', this.playbackDevice,
      '-f', 'S16_LE',
      '-c', config.audio.channels.toString(),
      '-r', config.audio.sampleRate.toString()
    ];
  }

  async testSpeakers() {
    console.log('🔊 Testing Speaker Output to Marshall Amp...');
    console.log('Configuration:', {
      device: this.playbackDevice,
      sampleRate: config.audio.sampleRate,
      channels: config.audio.channels
    });

    console.log('\n🎵 Running audio output tests...\n');

    // Test 1: System beep
    await this.testSystemBeep();
    
    // Test 2: Generated tone
    await this.testGeneratedTone();
    
    // Test 3: Test if microphone recording exists, play it back
    await this.testPlaybackRecording();
    
    console.log('\n✅ Speaker tests completed!');
  }

  async testSystemBeep() {
    console.log('📢 Test 1: System beep test');
    console.log('You should hear a beep through your Marshall amp...');
    
    return new Promise((resolve) => {
      const beep = spawn('speaker-test', ['-D', this.playbackDevice, '-t', 'sine', '-f', '1000', '-l', '1']);
      
      beep.on('close', (code) => {
        if (code === 0) {
          console.log('✅ System beep test completed');
        } else {
          console.log('⚠️  System beep failed, trying alternative...');
          // Fallback: try with aplay and a generated tone
          this.fallbackBeep().then(() => {
            console.log('✅ Fallback beep test completed');
            resolve();
          });
        }
        resolve();
      });

      beep.on('error', () => {
        console.log('⚠️  speaker-test not available, using fallback...');
        this.fallbackBeep().then(resolve);
      });

      // Timeout after 3 seconds
      setTimeout(() => {
        beep.kill();
        resolve();
      }, 3000);
    });
  }

  async fallbackBeep() {
    // Generate a simple tone
    const sampleRate = config.audio.sampleRate;
    const duration = 1; // 1 second
    const frequency = 1000; // 1kHz tone
    const samples = sampleRate * duration;
    
    const buffer = Buffer.alloc(samples * 2); // 16-bit = 2 bytes per sample
    
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 32767;
      buffer.writeInt16LE(sample, i * 2);
    }
    
    const tempFile = '/tmp/test-tone.raw';
    writeFileSync(tempFile, buffer);
    
    return new Promise((resolve) => {
      const aplay = spawn('aplay', [...this.playbackOptions, tempFile]);
      
      aplay.on('close', () => {
        try {
          unlinkSync(tempFile);
        } catch (e) {}
        resolve();
      });
      
      aplay.on('error', () => {
        console.log('❌ Audio playback failed');
        resolve();
      });
    });
  }

  async testGeneratedTone() {
    console.log('\n🎶 Test 2: Generated tone test (440Hz for 2 seconds)');
    console.log('You should hear a musical A note through your Marshall amp...');
    
    const sampleRate = config.audio.sampleRate;
    const duration = 2; // 2 seconds
    const frequency = 440; // A note
    const samples = sampleRate * duration;
    
    const buffer = Buffer.alloc(samples * 2);
    
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16383; // Lower volume
      buffer.writeInt16LE(sample, i * 2);
    }
    
    const tempFile = '/tmp/test-tone-440.raw';
    writeFileSync(tempFile, buffer);
    
    return new Promise((resolve) => {
      const aplay = spawn('aplay', [...this.playbackOptions, tempFile]);
      
      aplay.stdout.on('data', (data) => {
        process.stdout.write('♪');
      });
      
      aplay.on('close', (code) => {
        try {
          unlinkSync(tempFile);
        } catch (e) {}
        
        if (code === 0) {
          console.log('\n✅ Generated tone test completed successfully');
        } else {
          console.log(`\n❌ Generated tone test failed with code ${code}`);
        }
        resolve();
      });
      
      aplay.on('error', (error) => {
        console.log('\n❌ Tone playback error:', error.message);
        resolve();
      });
    });
  }

  async testPlaybackRecording() {
    console.log('\n🎙️  Test 3: Playback microphone recording (if available)');
    
    try {
      const fs = await import('fs');
      if (fs.existsSync('microphone-test.raw')) {
        console.log('Found microphone recording, playing it back...');
        console.log('You should hear your recorded voice through the Marshall amp...');
        
        return new Promise((resolve) => {
          const aplay = spawn('aplay', [...this.playbackOptions, 'microphone-test.raw']);
          
          aplay.on('close', (code) => {
            if (code === 0) {
              console.log('✅ Microphone playback test completed');
            } else {
              console.log('❌ Microphone playback failed');
            }
            resolve();
          });
          
          aplay.on('error', (error) => {
            console.log('❌ Playback error:', error.message);
            resolve();
          });
        });
      } else {
        console.log('⚠️  No microphone recording found. Run "node src/test-microphone.js" first.');
      }
    } catch (error) {
      console.log('⚠️  Could not test microphone playback:', error.message);
    }
  }

  printTroubleshooting() {
    console.log('\n🔧 TROUBLESHOOTING TIPS:');
    console.log('1. Check audio devices: aplay -l');
    console.log('2. Test manually: aplay -D plughw:0,0 /usr/share/sounds/alsa/Front_Left.wav');
    console.log('3. Check volume: alsamixer');
    console.log('4. Verify Marshall amp is connected to Pi aux jack');
    console.log('5. Try different audio output: raspi-config > Advanced Options > Audio');
    console.log('6. Check if aux jack is working: aplay -D plughw:0,0 <audio-file>');
  }
}

// Run test
const test = new SpeakerTest();
test.testSpeakers().catch((error) => {
  console.error('Speaker test failed:', error);
  test.printTroubleshooting();
});
