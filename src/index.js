#!/usr/bin/env node

import { ElevenLabsClient } from './websocket/elevenlabsClient.js';
import { AudioManager } from './audio/audioManager.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';

class ElevenLabsAgent {
  constructor() {
    this.client = new ElevenLabsClient();
    this.audioManager = new AudioManager();
    this.isRunning = false;
    this.conversationActive = false;
    
    // Bind event handlers
    this.setupEventHandlers();
    this.setupSignalHandlers();
  }

  setupEventHandlers() {
    this.client.setEventHandlers({
      onConnect: () => this.handleConnect(),
      onDisconnect: () => this.handleDisconnect(),
      onError: (error) => this.handleError(error),
      onAudioReceived: (audioData, eventId) => this.handleAudioReceived(audioData, eventId),
      onTranscriptReceived: (transcript) => this.handleTranscriptReceived(transcript),
      onAgentResponse: (response, isCorrection = false) => this.handleAgentResponse(response, isCorrection),
      onToolCall: (toolCall) => this.handleToolCall(toolCall),
      onVadScore: (vadScore) => this.handleVadScore(vadScore),
      onPing: (pingEvent) => this.handlePing(pingEvent)
    });
  }

  setupSignalHandlers() {
    // Graceful shutdown handlers
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection:', { reason, promise });
      this.shutdown('unhandledRejection');
    });
  }

  async start() {
    try {
      logger.info('Starting ElevenLabs Agent on Raspberry Pi...');
      logger.info('Configuration:', {
        agentId: config.elevenlabs.agentId,
        audioDevice: config.audio.deviceName,
        sampleRate: config.audio.sampleRate,
        debugEnabled: config.debug.enabled
      });

      this.isRunning = true;

      // Check audio devices
      await this.audioManager.checkAudioDevices();

      // Connect to ElevenLabs WebSocket
      await this.client.connect();

      logger.info('ElevenLabs Agent is ready! Speak into your microphone...');

    } catch (error) {
      logger.error('Failed to start ElevenLabs Agent:', error);
      await this.shutdown('startup_error');
      process.exit(1);
    }
  }

  handleConnect() {
    logger.connection('Connected to ElevenLabs Agent');
    this.startConversation();
  }

  handleDisconnect() {
    logger.connection('Disconnected from ElevenLabs Agent');
    this.stopConversation();
  }

  handleError(error) {
    logger.error('ElevenLabs Client Error:', error);
    
    // Handle specific error types
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      logger.error('Network connectivity issue. Check internet connection.');
    } else if (error.code === 401) {
      logger.error('Authentication failed. Check your API key.');
    } else if (error.code === 404) {
      logger.error('Agent not found. Check your Agent ID.');
    }
  }

  async handleAudioReceived(audioData, eventId) {
    try {
      logger.audio(`Playing audio response (event_id: ${eventId})`);
      
      // Stop recording while playing agent response to avoid feedback
      if (this.conversationActive) {
        this.audioManager.stopRecording();
      }

      await this.audioManager.playAudio(audioData);

      // Resume recording after playback
      if (this.conversationActive && this.isRunning) {
        setTimeout(() => {
          this.startRecording();
        }, 500); // Small delay to ensure clean audio
      }

    } catch (error) {
      logger.error('Error handling audio response:', error);
    }
  }

  handleTranscriptReceived(transcript) {
    logger.info(`👤 User: "${transcript}"`);
    
    // Send user activity signal
    this.client.sendUserActivity();
  }

  handleAgentResponse(response, isCorrection = false) {
    const prefix = isCorrection ? '🔄 Agent (corrected)' : '🤖 Agent';
    logger.info(`${prefix}: "${response}"`);
  }

  handleToolCall(toolCall) {
    logger.agent('Tool call requested:', toolCall);
    
    // Handle different tool types
    this.executeToolCall(toolCall);
  }

  async executeToolCall(toolCall) {
    const { tool_name, tool_call_id, parameters } = toolCall;
    
    try {
      let result = '';
      let isError = false;

      switch (tool_name) {
        case 'get_device_status':
          result = await this.getDeviceStatus();
          break;
          
        case 'get_system_info':
          result = await this.getSystemInfo();
          break;
          
        case 'check_audio_devices':
          result = await this.checkAudioDevicesInfo();
          break;

        default:
          result = `Tool '${tool_name}' is not implemented on this device.`;
          isError = true;
          logger.warn(`Unhandled tool call: ${tool_name}`, parameters);
      }

      // Send result back to agent
      this.client.sendToolResult(tool_call_id, result, isError);

    } catch (error) {
      logger.error(`Error executing tool '${tool_name}':`, error);
      this.client.sendToolResult(tool_call_id, error.message, true);
    }
  }

  async getDeviceStatus() {
    return JSON.stringify({
      device: 'Raspberry Pi 4',
      os: 'Ubuntu 24 LTS Server',
      microphone: config.audio.deviceName,
      status: 'online',
      timestamp: new Date().toISOString()
    });
  }

  async getSystemInfo() {
    const os = await import('os');
    return JSON.stringify({
      platform: os.platform(),
      arch: os.arch(),
      memory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
      uptime: `${Math.round(os.uptime() / 3600)}h`,
      loadavg: os.loadavg()
    });
  }

  async checkAudioDevicesInfo() {
    return JSON.stringify({
      configured_microphone: config.audio.deviceName,
      sample_rate: config.audio.sampleRate,
      channels: config.audio.channels,
      note: 'Use "aplay -l" and "arecord -l" to list available devices'
    });
  }

  handleVadScore(vadScore) {
    // Voice Activity Detection - you can use this for visual feedback
    if (config.debug.enabled && vadScore > 0.7) {
      logger.debug(`🎤 Voice activity detected (${vadScore.toFixed(2)})`);
    }
  }

  handlePing(pingEvent) {
    // Ping/pong is handled automatically by the client
    if (config.debug.enabled) {
      logger.debug('Connection health check completed');
    }
  }

  async startConversation() {
    if (this.conversationActive) {
      return;
    }

    try {
      logger.info('Starting conversation...');
      this.conversationActive = true;

      // Send contextual update about the device
      this.client.sendContextualUpdate(
        'User is now connected via Raspberry Pi with Audio Technica ATR2100-USB microphone'
      );

      // Start audio recording
      await this.startRecording();

    } catch (error) {
      logger.error('Error starting conversation:', error);
      this.conversationActive = false;
    }
  }

  async startRecording() {
    try {
      await this.audioManager.startRecording((base64Audio) => {
        // Send audio chunks to ElevenLabs
        this.client.sendAudioChunk(base64Audio);
      });
    } catch (error) {
      logger.error('Error starting audio recording:', error);
    }
  }

  stopConversation() {
    if (!this.conversationActive) {
      return;
    }

    logger.info('Stopping conversation...');
    this.conversationActive = false;
    this.audioManager.stopRecording();
  }

  async shutdown(signal) {
    logger.info(`Shutting down ElevenLabs Agent (${signal})...`);
    
    this.isRunning = false;
    
    // Stop conversation
    this.stopConversation();
    
    // Cleanup audio
    this.audioManager.cleanup();
    
    // Disconnect WebSocket
    this.client.disconnect();
    
    logger.info('ElevenLabs Agent shutdown complete');
    
    // Give time for cleanup
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Main execution
async function main() {
  try {
    const agent = new ElevenLabsAgent();
    await agent.start();
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
