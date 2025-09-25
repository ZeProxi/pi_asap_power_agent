#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { config } from './config.js';

class TestAudioGenerator {
  constructor() {
    this.sampleRate = config.audio.sampleRate;
    this.channels = config.audio.channels;
  }

  generateTone(frequency, duration, amplitude = 0.5) {
    const samples = this.sampleRate * duration;
    const buffer = Buffer.alloc(samples * 2 * this.channels); // 16-bit = 2 bytes per sample
    
    for (let i = 0; i < samples; i++) {
      const time = i / this.sampleRate;
      const sample = Math.sin(2 * Math.PI * frequency * time) * amplitude * 32767;
      
      // Write sample for each channel
      for (let channel = 0; channel < this.channels; channel++) {
        const offset = (i * this.channels + channel) * 2;
        buffer.writeInt16LE(Math.round(sample), offset);
      }
    }
    
    return buffer;
  }

  generateBeep(duration = 0.5, frequency = 1000) {
    return this.generateTone(frequency, duration, 0.3);
  }

  generateChime() {
    // Generate a pleasant chime sound (C major chord)
    const duration = 1.0;
    const samples = this.sampleRate * duration;
    const buffer = Buffer.alloc(samples * 2 * this.channels);
    
    const frequencies = [261.63, 329.63, 392.00]; // C, E, G
    
    for (let i = 0; i < samples; i++) {
      const time = i / this.sampleRate;
      let sample = 0;
      
      // Add each frequency with decay envelope
      frequencies.forEach(freq => {
        const envelope = Math.exp(-time * 2); // Exponential decay
        sample += Math.sin(2 * Math.PI * freq * time) * envelope;
      });
      
      sample = sample * 0.2 * 32767; // Scale and convert to 16-bit
      
      for (let channel = 0; channel < this.channels; channel++) {
        const offset = (i * this.channels + channel) * 2;
        buffer.writeInt16LE(Math.round(sample), offset);
      }
    }
    
    return buffer;
  }

  generateSweep(startFreq = 200, endFreq = 2000, duration = 2) {
    const samples = this.sampleRate * duration;
    const buffer = Buffer.alloc(samples * 2 * this.channels);
    
    for (let i = 0; i < samples; i++) {
      const time = i / this.sampleRate;
      const progress = time / duration;
      const frequency = startFreq + (endFreq - startFreq) * progress;
      const sample = Math.sin(2 * Math.PI * frequency * time) * 0.3 * 32767;
      
      for (let channel = 0; channel < this.channels; channel++) {
        const offset = (i * this.channels + channel) * 2;
        buffer.writeInt16LE(Math.round(sample), offset);
      }
    }
    
    return buffer;
  }

  generateTestSuite() {
    console.log('🎵 Generating test audio files...');
    
    const testFiles = [
      {
        name: 'test-beep.raw',
        description: 'Simple 1kHz beep (0.5s)',
        generator: () => this.generateBeep()
      },
      {
        name: 'test-chime.raw',
        description: 'Pleasant chime sound (1s)',
        generator: () => this.generateChime()
      },
      {
        name: 'test-sweep.raw',
        description: 'Frequency sweep 200Hz-2kHz (2s)',
        generator: () => this.generateSweep()
      },
      {
        name: 'test-low-tone.raw',
        description: 'Low 220Hz tone (1s)',
        generator: () => this.generateTone(220, 1, 0.4)
      },
      {
        name: 'test-high-tone.raw',
        description: 'High 880Hz tone (1s)',
        generator: () => this.generateTone(880, 1, 0.4)
      }
    ];

    testFiles.forEach(file => {
      console.log(`Generating ${file.name}: ${file.description}`);
      const audioData = file.generator();
      writeFileSync(file.name, audioData);
      console.log(`✅ Created ${file.name} (${audioData.length} bytes)`);
    });

    console.log('\n🎧 To play any test file:');
    console.log('aplay -f S16_LE -c 1 -r 16000 <filename>');
    
    console.log('\n📝 Test files created:');
    testFiles.forEach(file => {
      console.log(`• ${file.name} - ${file.description}`);
    });

    return testFiles.map(f => f.name);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new TestAudioGenerator();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'beep':
      console.log('Generating test beep...');
      writeFileSync('test-beep.raw', generator.generateBeep());
      console.log('✅ Created test-beep.raw');
      console.log('Play with: aplay -f S16_LE -c 1 -r 16000 test-beep.raw');
      break;
      
    case 'chime':
      console.log('Generating test chime...');
      writeFileSync('test-chime.raw', generator.generateChime());
      console.log('✅ Created test-chime.raw');
      console.log('Play with: aplay -f S16_LE -c 1 -r 16000 test-chime.raw');
      break;
      
    case 'all':
    default:
      generator.generateTestSuite();
      break;
  }
}

export { TestAudioGenerator };
