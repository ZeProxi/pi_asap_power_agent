# ElevenLabs Pi Agent

Real-time WebSocket integration with ElevenLabs agents for Raspberry Pi 4 running Ubuntu 24 LTS Server.

## 🎯 Overview

This project provides a robust, real-time voice conversation system using:
- **ElevenLabs Agents API** via WebSocket connections
- **Audio Technica ATR2100-USB** microphone for input
- **Raspberry Pi 4** running Ubuntu 24 LTS Server
- **Node.js** for optimal performance and real-time audio handling

## 📋 Prerequisites

### Hardware
- Raspberry Pi 4 with Ubuntu 24 LTS Server
- Audio Technica ATR2100-USB microphone
- Internet connection
- Audio output device (speakers/headphones)

### Software
- Node.js 18+ (installed via setup script)
- Git (for code deployment)
- ElevenLabs account with API access

### API Keys
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key
- `AGENT_ID` - Your specific ElevenLabs agent ID

## 🚀 Quick Start

### 1. Windows Development Setup

1. **Clone this repository on Windows:**
   ```powershell
   git clone <your-repository-url>
   cd pi_asap_power_agent
   ```

2. **Install dependencies (optional for development):**
   ```powershell
   npm install
   ```

3. **Configure environment:**
   ```powershell
   copy .env.example .env
   # Edit .env with your actual API keys
   ```

### 2. Raspberry Pi Setup

1. **Transfer the setup script to your Pi:**
   ```bash
   # On Pi: Download the setup script
   wget https://raw.githubusercontent.com/yourusername/yourrepo/main/setup-ubuntu.sh
   chmod +x setup-ubuntu.sh
   ```

2. **Run the setup script:**
   ```bash
   ./setup-ubuntu.sh
   ```

3. **Reboot the Pi (required for audio group changes):**
   ```bash
   sudo reboot
   ```

4. **Clone the repository on Pi:**
   ```bash
   git clone <your-repository-url>
   cd pi_asap_power_agent
   ```

5. **Install project dependencies:**
   ```bash
   npm install
   ```

6. **Configure environment:**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your API keys
   ```

## 🔧 Configuration

Edit the `.env` file with your specific settings:

```env
# ElevenLabs API Configuration
ELEVENLABS_API_KEY=your_api_key_here
AGENT_ID=agent_8701k5jm02g2ek4s8za1j9c3efvp

# Audio Configuration
AUDIO_SAMPLE_RATE=16000
AUDIO_CHANNELS=1
AUDIO_DEVICE_NAME=ATR2100-USB

# Debug Settings
DEBUG=true
LOG_LEVEL=info
```

## 🎮 Usage

### Testing Connection
```bash
npm test
```

### Starting the Agent
```bash
npm start
```

### Development Mode (with auto-restart)
```bash
npm run dev
```

## 🔊 Audio Setup

### Check Audio Devices
```bash
# List playback devices
aplay -l

# List recording devices  
arecord -l
```

### Test Audio
```bash
# Test recording (5 seconds)
arecord -f cd -t wav -d 5 test.wav

# Test playback
aplay test.wav
```

## 🔄 Development Workflow

### Windows → Raspberry Pi Deployment

1. **Develop on Windows:**
   ```powershell
   # Make your changes
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Deploy to Pi:**
   ```bash
   # On Pi
   git pull origin main
   npm install  # If dependencies changed
   npm start
   ```

## 🛠 Troubleshooting

### Common Issues

**Audio Device Not Found:**
```bash
# Check USB devices
lsusb | grep -i audio

# Restart audio services
sudo systemctl restart pulseaudio
```

**WebSocket Connection Failed:**
- Verify API key and Agent ID
- Check internet connectivity
- Ensure firewall allows WebSocket connections

**Permission Denied (Audio):**
```bash
# Add user to audio group
sudo usermod -a -G audio $USER
# Reboot required after this change
```

### Debug Mode
Set `DEBUG=true` in `.env` for verbose logging.

## 📊 System Service (Optional)

To run the agent as a system service:

```bash
# Enable auto-start
sudo systemctl enable elevenlabs-agent

# Start service
sudo systemctl start elevenlabs-agent

# View logs
journalctl -u elevenlabs-agent -f
```

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Microphone    │───▶│  Raspberry Pi   │───▶│  ElevenLabs     │
│  ATR2100-USB    │    │   Node.js App   │    │    Agent API    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Speakers/     │
                       │   Headphones    │
                       └─────────────────┘
```

## 📚 API Features Implemented

- ✅ Real-time WebSocket communication
- ✅ Audio streaming (PCM 16kHz)
- ✅ Voice Activity Detection (VAD)
- ✅ Agent response handling
- ✅ Tool call support
- ✅ Automatic reconnection
- ✅ Conversation state management
- ✅ Audio playback with queue management
- ✅ Comprehensive error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on Raspberry Pi
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs with debug mode enabled
3. Create an issue in the repository

---

**Note:** This project is optimized for Raspberry Pi 4 with Ubuntu 24 LTS Server and the Audio Technica ATR2100-USB microphone. Other configurations may require adjustments.