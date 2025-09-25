import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // ElevenLabs API Configuration
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    agentId: process.env.AGENT_ID,
    wsUrl: process.env.WS_URL || 'wss://api.elevenlabs.io/v1/convai/conversation'
  },

  // Audio Configuration
  audio: {
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE) || 16000,
    channels: parseInt(process.env.AUDIO_CHANNELS) || 1,
    deviceName: process.env.AUDIO_DEVICE_NAME || 'ATR2100-USB',
    // PCM format for ElevenLabs (16-bit, little-endian)
    format: 'pcm_16000',
    bitDepth: 16,
    encoding: 'signed-integer'
  },

  // WebSocket Configuration
  websocket: {
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT) || 30000,
    pingInterval: parseInt(process.env.PING_INTERVAL) || 30000,
    maxReconnectAttempts: 5,
    reconnectDelay: 2000
  },

  // Debug and Logging
  debug: {
    enabled: process.env.DEBUG === 'true',
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Conversation Configuration
  conversation: {
    // Override agent settings if needed
    configOverride: {
      agent: {
        prompt: {
          prompt: "You are a helpful AI assistant running on a Raspberry Pi. Be concise and friendly."
        },
        language: "en"
      },
      tts: {
        voice_id: "21m00Tcm4TlvDq8ikWAM" // Default ElevenLabs voice
      }
    },
    
    // LLM parameters
    customLlmExtraBody: {
      temperature: 0.7,
      max_tokens: 150
    },

    // Dynamic variables for personalization
    dynamicVariables: {
      device_type: "raspberry_pi",
      microphone: "ATR2100-USB"
    }
  }
};

// Validation
export function validateConfig() {
  const errors = [];

  if (!config.elevenlabs.apiKey) {
    errors.push('ELEVENLABS_API_KEY is required');
  }

  if (!config.elevenlabs.agentId) {
    errors.push('AGENT_ID is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors: ${errors.join(', ')}`);
  }

  return true;
}
