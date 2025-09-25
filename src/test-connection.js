#!/usr/bin/env node

import { ElevenLabsClient } from './websocket/elevenlabsClient.js';
import { AudioManager } from './audio/audioManager.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';

class ConnectionTester {
  constructor() {
    this.client = new ElevenLabsClient();
    this.audioManager = new AudioManager();
    this.testResults = {};
  }

  async runTests() {
    logger.info('🧪 Starting ElevenLabs Agent Connection Tests...');
    logger.info('Configuration Test:', {
      hasApiKey: !!config.elevenlabs.apiKey,
      hasAgentId: !!config.elevenlabs.agentId,
      wsUrl: config.elevenlabs.wsUrl
    });

    const tests = [
      { name: 'Configuration Validation', fn: () => this.testConfiguration() },
      { name: 'Audio System Check', fn: () => this.testAudioSystem() },
      { name: 'WebSocket Connection', fn: () => this.testWebSocketConnection() },
      { name: 'Agent Communication', fn: () => this.testAgentCommunication() }
    ];

    for (const test of tests) {
      try {
        logger.info(`\n🔍 Running: ${test.name}`);
        const result = await test.fn();
        this.testResults[test.name] = { status: 'PASS', result };
        logger.info(`✅ ${test.name}: PASSED`);
      } catch (error) {
        this.testResults[test.name] = { status: 'FAIL', error: error.message };
        logger.error(`❌ ${test.name}: FAILED - ${error.message}`);
      }
    }

    this.printSummary();
    await this.cleanup();
  }

  async testConfiguration() {
    if (!config.elevenlabs.apiKey) {
      throw new Error('ELEVENLABS_API_KEY not found in environment');
    }

    if (!config.elevenlabs.agentId) {
      throw new Error('AGENT_ID not found in environment');
    }

    if (config.elevenlabs.apiKey.length < 10) {
      throw new Error('API key appears to be invalid (too short)');
    }

    return {
      apiKeyLength: config.elevenlabs.apiKey.length,
      agentId: config.elevenlabs.agentId,
      wsUrl: config.elevenlabs.wsUrl
    };
  }

  async testAudioSystem() {
    try {
      await this.audioManager.checkAudioDevices();
      
      // Audio manager is already initialized in constructor
      
      return {
        sampleRate: config.audio.sampleRate,
        channels: config.audio.channels,
        deviceName: config.audio.deviceName,
        speakerInitialized: true
      };
    } catch (error) {
      throw new Error(`Audio system error: ${error.message}`);
    }
  }

  async testWebSocketConnection() {
    return new Promise((resolve, reject) => {
      let connectionTimeout;
      let isResolved = false;

      const resolveTest = (result) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(connectionTimeout);
        resolve(result);
      };

      const rejectTest = (error) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(connectionTimeout);
        reject(error);
      };

      // Set connection timeout
      connectionTimeout = setTimeout(() => {
        rejectTest(new Error('Connection timeout (30 seconds)'));
      }, 30000);

      this.client.setEventHandlers({
        onConnect: () => {
          resolveTest({
            connected: true,
            timestamp: new Date().toISOString()
          });
        },
        onError: (error) => {
          rejectTest(new Error(`WebSocket error: ${error.message}`));
        },
        onDisconnect: () => {
          if (!isResolved) {
            rejectTest(new Error('Unexpected disconnection'));
          }
        }
      });

      this.client.connect().catch(rejectTest);
    });
  }

  async testAgentCommunication() {
    return new Promise((resolve, reject) => {
      let communicationTimeout;
      let isResolved = false;
      let conversationInitialized = false;

      const resolveTest = (result) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(communicationTimeout);
        resolve(result);
      };

      const rejectTest = (error) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(communicationTimeout);
        reject(error);
      };

      // Set communication timeout
      communicationTimeout = setTimeout(() => {
        rejectTest(new Error('Agent communication timeout (20 seconds)'));
      }, 20000);

      this.client.setEventHandlers({
        onConnect: () => {
          logger.info('WebSocket connected, waiting for conversation initialization...');
        },
        onAudioReceived: (audioData, eventId) => {
          logger.info(`Received audio response (event_id: ${eventId})`);
          if (conversationInitialized) {
            resolveTest({
              conversationActive: true,
              audioReceived: true,
              eventId: eventId,
              audioDataLength: audioData.length
            });
          }
        },
        onAgentResponse: (response) => {
          logger.info(`Agent response: "${response}"`);
          conversationInitialized = true;
        },
        onError: (error) => {
          rejectTest(new Error(`Communication error: ${error.message}`));
        }
      });

      // If not already connected, connect first
      if (!this.client.isConnected) {
        this.client.connect()
          .then(() => {
            // Wait a moment for initialization, then send a test message
            setTimeout(() => {
              logger.info('Sending test message to agent...');
              this.client.sendTextMessage('Hello, this is a connection test from Raspberry Pi.');
            }, 2000);
          })
          .catch(rejectTest);
      } else {
        // Send test message immediately
        setTimeout(() => {
          logger.info('Sending test message to agent...');
          this.client.sendTextMessage('Hello, this is a connection test from Raspberry Pi.');
        }, 1000);
      }
    });
  }

  printSummary() {
    logger.info('\n📊 TEST SUMMARY');
    logger.info('================');

    let passCount = 0;
    let failCount = 0;

    Object.entries(this.testResults).forEach(([testName, result]) => {
      const status = result.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
      logger.info(`${status} - ${testName}`);
      
      if (result.status === 'PASS') {
        passCount++;
        if (result.result && typeof result.result === 'object') {
          Object.entries(result.result).forEach(([key, value]) => {
            logger.info(`    ${key}: ${value}`);
          });
        }
      } else {
        failCount++;
        logger.error(`    Error: ${result.error}`);
      }
    });

    logger.info(`\nTotal: ${passCount + failCount} tests`);
    logger.info(`Passed: ${passCount}`);
    logger.info(`Failed: ${failCount}`);

    if (failCount === 0) {
      logger.info('\n🎉 All tests passed! Your ElevenLabs Agent is ready to use.');
      logger.info('Run "npm start" to start the agent.');
    } else {
      logger.error('\n⚠️  Some tests failed. Please check the configuration and try again.');
      this.printTroubleshootingTips();
    }
  }

  printTroubleshootingTips() {
    logger.info('\n🔧 TROUBLESHOOTING TIPS:');
    logger.info('========================');
    
    if (this.testResults['Configuration Validation']?.status === 'FAIL') {
      logger.info('• Check your .env file and ensure ELEVENLABS_API_KEY and AGENT_ID are set');
      logger.info('• Verify your API key is correct in the ElevenLabs dashboard');
    }
    
    if (this.testResults['Audio System Check']?.status === 'FAIL') {
      logger.info('• Run "aplay -l" and "arecord -l" to check available audio devices');
      logger.info('• Install audio dependencies: sudo apt install pulseaudio alsa-utils');
      logger.info('• Check if your ATR2100-USB microphone is connected and recognized');
    }
    
    if (this.testResults['WebSocket Connection']?.status === 'FAIL') {
      logger.info('• Check internet connectivity');
      logger.info('• Verify firewall settings allow WebSocket connections');
      logger.info('• Ensure your API key has the correct permissions');
    }
    
    if (this.testResults['Agent Communication']?.status === 'FAIL') {
      logger.info('• Verify your AGENT_ID is correct and the agent exists');
      logger.info('• Check if the agent is properly configured in ElevenLabs dashboard');
      logger.info('• Ensure your account has sufficient credits');
    }
  }

  async cleanup() {
    logger.info('\n🧹 Cleaning up test resources...');
    
    if (this.client) {
      this.client.disconnect();
    }
    
    if (this.audioManager) {
      this.audioManager.cleanup();
    }
    
    logger.info('Cleanup complete.');
  }
}

// Main execution
async function main() {
  const tester = new ConnectionTester();
  
  try {
    await tester.runTests();
  } catch (error) {
    logger.error('Test runner error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('\nTest interrupted by user');
  process.exit(0);
});

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
