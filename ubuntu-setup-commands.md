# Ubuntu Setup Commands for Raspberry Pi

## Professional Directory Setup Options

### Option 1: Home Directory (Recommended for development)
```bash
# Connect to your Pi
ssh ubuntu@YOUR_PI_IP

# Navigate to home directory
cd ~

# Clone repository
git clone https://github.com/ZeProxi/pi_asap_power_agent.git
cd pi_asap_power_agent

# Run setup script
chmod +x setup-ubuntu.sh
./setup-ubuntu.sh

# Reboot (required for audio group changes)
sudo reboot
```

### Option 2: /opt Directory (Production/System-wide)
```bash
# Connect to your Pi
ssh ubuntu@YOUR_PI_IP

# Create professional directory structure
sudo mkdir -p /opt/elevenlabs
sudo chown ubuntu:ubuntu /opt/elevenlabs
cd /opt/elevenlabs

# Clone repository
git clone https://github.com/ZeProxi/pi_asap_power_agent.git pi-agent
cd pi-agent

# Run setup script
chmod +x setup-ubuntu.sh
./setup-ubuntu.sh

# Reboot (required for audio group changes)
sudo reboot
```

## Post-Reboot Setup

```bash
# Reconnect after reboot
ssh ubuntu@YOUR_PI_IP

# Navigate to project directory
cd ~/pi_asap_power_agent  # or /opt/elevenlabs/pi-agent

# Install Node.js dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Add your API keys

# Test the setup
npm test

# Start the agent
npm start
```

## Environment Configuration (.env)

```env
# ElevenLabs API Configuration
ELEVENLABS_API_KEY=your_actual_api_key_here
AGENT_ID=agent_8701k5jm02g2ek4s8za1j9c3efvp

# Audio Configuration
AUDIO_SAMPLE_RATE=16000
AUDIO_CHANNELS=1
AUDIO_DEVICE_NAME=ATR2100-USB

# WebSocket Configuration
WS_URL=wss://api.elevenlabs.io/v1/convai/conversation
CONNECTION_TIMEOUT=30000
PING_INTERVAL=30000

# Debug Settings
DEBUG=true
LOG_LEVEL=info
```

## Systemd Service Setup (Optional - for auto-start)

```bash
# The setup script already creates the service file
# To enable auto-start:
sudo systemctl enable elevenlabs-agent

# To start the service:
sudo systemctl start elevenlabs-agent

# To check status:
sudo systemctl status elevenlabs-agent

# To view logs:
journalctl -u elevenlabs-agent -f
```

## Useful Commands

```bash
# Check audio devices
aplay -l && arecord -l

# Test microphone recording (5 seconds)
arecord -f cd -t wav -d 5 test.wav

# Test speaker playback
aplay test.wav

# Check USB devices
lsusb | grep -i audio

# Monitor system resources
htop

# Check network connectivity
ping google.com

# View real-time logs
tail -f ~/pi_asap_power_agent/agent.log  # or appropriate path
```

## Directory Structure After Setup

```
/home/ubuntu/pi_asap_power_agent/  (or /opt/elevenlabs/pi-agent/)
├── src/
│   ├── index.js                 # Main application
│   ├── config.js               # Configuration management
│   ├── audio/
│   │   └── audioManager.js     # Audio handling
│   ├── websocket/
│   │   └── elevenlabsClient.js # WebSocket client
│   ├── utils/
│   │   └── logger.js           # Logging system
│   └── test-connection.js      # Connection testing
├── documentation/              # ElevenLabs docs
├── package.json               # Node.js configuration
├── .env                      # Environment variables (you create this)
├── .env.example             # Environment template
├── setup-ubuntu.sh          # Ubuntu setup script
├── deploy-to-pi.ps1         # Windows deployment script
├── README.md               # Main documentation
├── DEPLOYMENT.md          # Deployment guide
└── .gitignore            # Git ignore rules
```

## Troubleshooting

### Audio Issues
```bash
# Restart audio services
sudo systemctl restart pulseaudio

# Check audio group membership
groups

# If not in audio group, add and reboot
sudo usermod -a -G audio ubuntu
sudo reboot
```

### Permission Issues
```bash
# Fix ownership
sudo chown -R ubuntu:ubuntu ~/pi_asap_power_agent

# Fix permissions
chmod +x setup-ubuntu.sh
chmod 600 .env  # Secure environment file
```

### Network Issues
```bash
# Test connectivity
ping api.elevenlabs.io

# Check firewall (Ubuntu usually doesn't block outgoing)
sudo ufw status
```
