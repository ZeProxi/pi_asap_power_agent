import { config } from '../config.js';

class Logger {
  constructor() {
    this.logLevel = config.debug.logLevel;
    this.debugEnabled = config.debug.enabled;
    
    // Log levels in order of severity
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  getCurrentTimestamp() {
    return new Date().toISOString();
  }

  shouldLog(level) {
    const currentLevelValue = this.levels[this.logLevel] || 2;
    const messageLevelValue = this.levels[level] || 2;
    return messageLevelValue <= currentLevelValue;
  }

  formatMessage(level, message, data = null) {
    const timestamp = this.getCurrentTimestamp();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  error(message, data = null) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  info(message, data = null) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  debug(message, data = null) {
    if (this.debugEnabled && this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  // Specialized logging methods
  websocket(message, data = null) {
    this.debug(`[WebSocket] ${message}`, data);
  }

  audio(message, data = null) {
    this.debug(`[Audio] ${message}`, data);
  }

  agent(message, data = null) {
    this.info(`[Agent] ${message}`, data);
  }

  connection(message, data = null) {
    this.info(`[Connection] ${message}`, data);
  }
}

export const logger = new Logger();
