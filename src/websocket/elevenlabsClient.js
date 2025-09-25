import WebSocket from 'ws';
import { config, validateConfig } from '../config.js';
import { logger } from '../utils/logger.js';

export class ElevenLabsClient {
  constructor() {
    validateConfig();
    
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.websocket.maxReconnectAttempts;
    this.reconnectDelay = config.websocket.reconnectDelay;
    this.pingInterval = null;
    this.conversationId = null;
    
    // Event handlers
    this.eventHandlers = {
      onConnect: null,
      onDisconnect: null,
      onError: null,
      onAudioReceived: null,
      onTranscriptReceived: null,
      onAgentResponse: null,
      onPing: null,
      onToolCall: null,
      onVadScore: null
    };
  }

  // Set event handlers
  setEventHandlers(handlers) {
    Object.assign(this.eventHandlers, handlers);
  }

  // Connect to ElevenLabs WebSocket
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${config.elevenlabs.wsUrl}?agent_id=${config.elevenlabs.agentId}`;
        
        logger.connection('Connecting to ElevenLabs WebSocket...', { url: wsUrl });

        this.ws = new WebSocket(wsUrl, {
          headers: {
            'Authorization': `Bearer ${config.elevenlabs.apiKey}`,
            'User-Agent': 'ElevenLabs-Pi-Agent/1.0.0'
          },
          timeout: config.websocket.connectionTimeout
        });

        this.ws.on('open', () => {
          logger.connection('WebSocket connection established');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.setupPingInterval();
          this.initializeConversation();
          
          if (this.eventHandlers.onConnect) {
            this.eventHandlers.onConnect();
          }
          
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          logger.error('WebSocket error:', error);
          
          if (this.eventHandlers.onError) {
            this.eventHandlers.onError(error);
          }
          
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.ws.on('close', (code, reason) => {
          logger.connection('WebSocket connection closed', { code, reason: reason.toString() });
          this.handleDisconnection();
        });

      } catch (error) {
        logger.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  // Initialize conversation with ElevenLabs
  initializeConversation() {
    const initMessage = {
      type: 'conversation_initiation_client_data'
    };

    // Only add non-null configuration
    if (config.conversation.configOverride) {
      initMessage.conversation_config_override = config.conversation.configOverride;
    }
    
    if (config.conversation.customLlmExtraBody) {
      initMessage.custom_llm_extra_body = config.conversation.customLlmExtraBody;
    }
    
    if (config.conversation.dynamicVariables) {
      initMessage.dynamic_variables = config.conversation.dynamicVariables;
    }

    logger.websocket('Sending conversation initialization', initMessage);
    this.sendMessage(initMessage);
  }

  // Handle incoming WebSocket messages
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      logger.websocket('Received message', { type: message.type });

      switch (message.type) {
        case 'conversation_initiation_metadata':
          this.handleInitializationMetadata(message);
          break;

        case 'audio':
          this.handleAudioMessage(message);
          break;

        case 'user_transcript':
          this.handleTranscriptMessage(message);
          break;

        case 'agent_response':
          this.handleAgentResponse(message);
          break;

        case 'agent_response_correction':
          this.handleAgentResponseCorrection(message);
          break;

        case 'ping':
          this.handlePing(message);
          break;

        case 'client_tool_call':
          this.handleToolCall(message);
          break;

        case 'vad_score':
          this.handleVadScore(message);
          break;

        case 'interruption':
          this.handleInterruption(message);
          break;

        case 'internal_tentative_agent_response':
          this.handleTentativeResponse(message);
          break;

        default:
          logger.websocket('Unknown message type received', message);
      }

    } catch (error) {
      logger.error('Error parsing WebSocket message:', error);
    }
  }

  // Handle conversation initialization metadata
  handleInitializationMetadata(message) {
    const metadata = message.conversation_initiation_metadata_event;
    this.conversationId = metadata.conversation_id;
    
    logger.agent('Conversation initialized', {
      conversationId: this.conversationId,
      agentOutputFormat: metadata.agent_output_audio_format,
      userInputFormat: metadata.user_input_audio_format
    });
  }

  // Handle audio messages from agent
  handleAudioMessage(message) {
    const audioEvent = message.audio_event;
    const audioData = audioEvent.audio_base_64;
    const eventId = audioEvent.event_id;

    logger.audio(`Received audio chunk (event_id: ${eventId})`);

    if (this.eventHandlers.onAudioReceived) {
      this.eventHandlers.onAudioReceived(audioData, eventId);
    }
  }

  // Handle user transcript messages
  handleTranscriptMessage(message) {
    const transcript = message.user_transcription_event.user_transcript;
    logger.agent('User transcript received', { transcript });

    if (this.eventHandlers.onTranscriptReceived) {
      this.eventHandlers.onTranscriptReceived(transcript);
    }
  }

  // Handle agent response messages
  handleAgentResponse(message) {
    const response = message.agent_response_event.agent_response;
    logger.agent('Agent response received', { response });

    if (this.eventHandlers.onAgentResponse) {
      this.eventHandlers.onAgentResponse(response);
    }
  }

  // Handle agent response corrections (after interruptions)
  handleAgentResponseCorrection(message) {
    const correctionEvent = message.agent_response_correction_event;
    const correctedResponse = correctionEvent.corrected_agent_response;
    
    logger.agent('Agent response corrected', { correctedResponse });

    if (this.eventHandlers.onAgentResponse) {
      this.eventHandlers.onAgentResponse(correctedResponse, true);
    }
  }

  // Handle ping messages
  handlePing(message) {
    const pingEvent = message.ping_event;
    const eventId = pingEvent.event_id;
    
    logger.websocket(`Received ping (event_id: ${eventId})`);

    // Send pong response
    this.sendMessage({
      type: 'pong',
      event_id: eventId
    });

    if (this.eventHandlers.onPing) {
      this.eventHandlers.onPing(pingEvent);
    }
  }

  // Handle tool call requests
  handleToolCall(message) {
    const toolCall = message.client_tool_call;
    logger.agent('Tool call requested', toolCall);

    if (this.eventHandlers.onToolCall) {
      this.eventHandlers.onToolCall(toolCall);
    }
  }

  // Handle VAD (Voice Activity Detection) scores
  handleVadScore(message) {
    const vadScore = message.vad_score_event.vad_score;
    
    if (config.debug.enabled) {
      logger.debug(`VAD Score: ${vadScore}`);
    }

    if (this.eventHandlers.onVadScore) {
      this.eventHandlers.onVadScore(vadScore);
    }
  }

  // Handle interruption events
  handleInterruption(message) {
    logger.agent('Interruption detected');
    // Handle interruption logic if needed
  }

  // Handle tentative responses (internal)
  handleTentativeResponse(message) {
    const tentativeResponse = message.tentative_agent_response_internal_event.tentative_agent_response;
    logger.debug('Tentative agent response', { tentativeResponse });
  }

  // Send audio data to the agent
  sendAudioChunk(base64AudioData) {
    if (!this.isConnected || !base64AudioData) {
      return;
    }

    const audioMessage = {
      user_audio_chunk: base64AudioData
    };

    this.sendMessage(audioMessage);
  }

  // Send text message to the agent
  sendTextMessage(text) {
    if (!this.isConnected || !text) {
      return;
    }

    const textMessage = {
      type: 'user_message',
      text: text
    };

    logger.agent('Sending text message', { text });
    this.sendMessage(textMessage);
  }

  // Send tool call result
  sendToolResult(toolCallId, result, isError = false) {
    const toolResult = {
      type: 'client_tool_result',
      tool_call_id: toolCallId,
      result: result,
      is_error: isError
    };

    logger.agent('Sending tool result', toolResult);
    this.sendMessage(toolResult);
  }

  // Send contextual update
  sendContextualUpdate(text) {
    const contextUpdate = {
      type: 'contextual_update',
      text: text
    };

    logger.agent('Sending contextual update', { text });
    this.sendMessage(contextUpdate);
  }

  // Send user activity signal
  sendUserActivity() {
    this.sendMessage({
      type: 'user_activity'
    });
  }

  // Generic message sender
  sendMessage(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.error('Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      
      if (config.debug.enabled && message.type !== 'pong') {
        logger.websocket('Sent message', { type: message.type });
      }
      
      return true;
    } catch (error) {
      logger.error('Error sending message:', error);
      return false;
    }
  }

  // Setup ping interval
  setupPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Note: ElevenLabs sends pings to us, we respond with pongs
    // This is just for connection monitoring
    this.pingInterval = setInterval(() => {
      if (!this.isConnected) {
        clearInterval(this.pingInterval);
      }
    }, config.websocket.pingInterval);
  }

  // Handle disconnection
  handleDisconnection() {
    this.isConnected = false;
    this.conversationId = null;
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.eventHandlers.onDisconnect) {
      this.eventHandlers.onDisconnect();
    }

    // Attempt reconnection if within limits
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.attemptReconnect();
    } else {
      logger.error('Max reconnection attempts reached');
    }
  }

  // Attempt to reconnect
  async attemptReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    logger.connection(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnection failed:', error);
      }
    }, delay);
  }

  // Disconnect and cleanup
  disconnect() {
    logger.connection('Disconnecting from ElevenLabs WebSocket');

    this.isConnected = false;
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      conversationId: this.conversationId,
      reconnectAttempts: this.reconnectAttempts,
      wsState: this.ws ? this.ws.readyState : null
    };
  }
}
