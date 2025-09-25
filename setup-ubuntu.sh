#!/bin/bash

# ElevenLabs Agent Setup Script for Ubuntu 24 LTS Server (Raspberry Pi)
# This script installs all necessary dependencies for the ElevenLabs Agent

set -e  # Exit on any error

echo "🚀 Setting up ElevenLabs Agent on Ubuntu 24 LTS Server..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Update system packages
log_info "Updating system packages..."
sudo apt update && sudo apt upgrade -y
log_success "System packages updated"

# Install Node.js and npm
log_info "Installing Node.js and npm..."
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log_success "Node.js installed: $NODE_VERSION"
log_success "npm installed: $NPM_VERSION"

# Install audio system dependencies
log_info "Installing audio system dependencies..."
sudo apt install -y \
    pulseaudio \
    pulseaudio-utils \
    alsa-utils \
    libasound2-dev \
    build-essential \
    python3 \
    python3-dev

log_success "Audio system dependencies installed"

# Install additional build tools for native modules
log_info "Installing build tools for native Node.js modules..."
sudo apt install -y \
    build-essential \
    libasound2-dev \
    sox \
    libsox-fmt-all

log_success "Build tools installed"

# Configure audio system
log_info "Configuring audio system..."

# Start PulseAudio if not running
if ! pgrep -x "pulseaudio" > /dev/null; then
    log_info "Starting PulseAudio..."
    pulseaudio --start
    log_success "PulseAudio started"
else
    log_info "PulseAudio is already running"
fi

# Add user to audio group
sudo usermod -a -G audio $USER
log_success "User added to audio group"

# Set up USB audio device permissions
sudo tee /etc/udev/rules.d/99-usb-audio.rules > /dev/null << EOF
# USB Audio devices
SUBSYSTEM=="usb", ATTR{idVendor}=="2040", ATTR{idProduct}=="*", GROUP="audio", MODE="0664"
SUBSYSTEM=="sound", GROUP="audio", MODE="0664"
KERNEL=="controlC[0-9]*", GROUP="audio", MODE="0664"
EOF

sudo udevadm control --reload-rules
log_success "USB audio device permissions configured"

# Install global npm packages that might be needed
log_info "Installing global npm packages..."
sudo npm install -g npm@latest
log_success "npm updated to latest version"

# Create project directory if it doesn't exist
if [ ! -d "elevenlabs-pi-agent" ]; then
    log_info "Project directory not found. Please clone your repository first."
else
    log_info "Entering project directory..."
    cd elevenlabs-pi-agent
    
    # Install project dependencies
    log_info "Installing project dependencies..."
    npm install
    log_success "Project dependencies installed"
fi

# Check audio devices
log_info "Checking available audio devices..."
echo "=== Playback Devices ==="
aplay -l || log_warning "Could not list playback devices"
echo ""
echo "=== Recording Devices ==="
arecord -l || log_warning "Could not list recording devices"
echo ""

# Test audio recording capability
log_info "Testing audio recording capability..."
if command -v arecord &> /dev/null; then
    log_success "arecord is available for audio recording"
else
    log_error "arecord is not available"
fi

# Create systemd service file for auto-start (optional)
log_info "Creating systemd service file..."
sudo tee /etc/systemd/system/elevenlabs-agent.service > /dev/null << EOF
[Unit]
Description=ElevenLabs Agent Service
After=network.target sound.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/elevenlabs-pi-agent
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
log_success "Systemd service created (not enabled by default)"

# Set up Git if not already configured
if ! git config --global user.name > /dev/null 2>&1; then
    log_info "Git user not configured. Setting up Git..."
    read -p "Enter your Git username: " git_username
    read -p "Enter your Git email: " git_email
    git config --global user.name "$git_username"
    git config --global user.email "$git_email"
    log_success "Git configured"
fi

# Final system information
log_info "System Information:"
echo "==================="
echo "OS: $(lsb_release -d | cut -f2)"
echo "Kernel: $(uname -r)"
echo "Architecture: $(uname -m)"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "User: $USER"
echo "Audio Groups: $(groups | grep -o audio || echo 'Not in audio group - reboot required')"

log_success "Setup completed successfully!"
echo ""
echo "🎉 ElevenLabs Agent setup is complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Reboot your Raspberry Pi to apply audio group changes:"
echo "   sudo reboot"
echo ""
echo "2. After reboot, clone your project repository:"
echo "   git clone <your-repository-url>"
echo "   cd elevenlabs-pi-agent"
echo ""
echo "3. Install project dependencies:"
echo "   npm install"
echo ""
echo "4. Copy and configure your environment file:"
echo "   cp .env.example .env"
echo "   # Edit .env with your API keys"
echo ""
echo "5. Test the connection:"
echo "   npm test"
echo ""
echo "6. Start the agent:"
echo "   npm start"
echo ""
echo "📚 Useful Commands:"
echo "• List audio devices: aplay -l && arecord -l"
echo "• Test microphone: arecord -f cd -t wav -d 5 test.wav"
echo "• Test speakers: aplay test.wav"
echo "• Enable auto-start: sudo systemctl enable elevenlabs-agent"
echo "• View logs: journalctl -u elevenlabs-agent -f"
echo ""
log_warning "IMPORTANT: You must reboot after running this script for audio group changes to take effect!"
