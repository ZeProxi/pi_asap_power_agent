# Deployment Guide: Windows → Raspberry Pi

This guide walks you through deploying your ElevenLabs Agent from Windows development to Raspberry Pi production.

## 🏗 Development Workflow

### Windows Development Environment
```powershell
# 1. Clone repository
git clone <your-repository-url>
cd pi_asap_power_agent

# 2. Install dependencies (optional for development)
npm install

# 3. Configure environment
copy .env.example .env
# Edit .env with your API keys

# 4. Make your changes
# Edit code as needed

# 5. Commit and push
git add .
git commit -m "Your changes"
git push origin main
```

## 🚀 Raspberry Pi Deployment

### Method 1: Automated PowerShell Deployment (Recommended)

```powershell
# First time setup
.\deploy-to-pi.ps1 -PiAddress "192.168.1.100" -Username "ubuntu" -FirstDeploy -RunSetup

# Regular deployments
.\deploy-to-pi.ps1 -PiAddress "192.168.1.100" -Username "ubuntu"

# Deploy and start agent
.\deploy-to-pi.ps1 -PiAddress "192.168.1.100" -Username "ubuntu" -StartAgent
```

### Method 2: Manual SSH Deployment

```bash
# 1. SSH to your Pi
ssh ubuntu@192.168.1.100

# 2. First time: Run setup script
wget https://raw.githubusercontent.com/yourusername/yourrepo/main/setup-ubuntu.sh
chmod +x setup-ubuntu.sh
./setup-ubuntu.sh
sudo reboot

# 3. Clone repository
git clone <your-repository-url>
cd pi_asap_power_agent

# 4. Install dependencies
npm install

# 5. Configure environment
cp .env.example .env
nano .env  # Add your API keys

# 6. Test and run
npm test
npm start
```

## 🔧 Prerequisites Setup

### Windows Prerequisites
- Git for Windows
- OpenSSH Client (Windows 10/11 built-in) or WSL
- PowerShell 5.1+ (for deployment script)

### SSH Key Setup (Recommended)
```powershell
# Generate SSH key (if you don't have one)
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Copy public key to Pi
type $env:USERPROFILE\.ssh\id_rsa.pub | ssh ubuntu@192.168.1.100 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### Raspberry Pi Prerequisites
The `setup-ubuntu.sh` script will install:
- Node.js 20.x
- npm
- Audio system (PulseAudio, ALSA)
- Build tools for native modules
- USB audio device permissions

## 🔄 Deployment Options

### PowerShell Deployment Script Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `-PiAddress` | Pi IP address | `"192.168.1.100"` |
| `-Username` | SSH username | `"ubuntu"` |
| `-FirstDeploy` | First time setup | Switch flag |
| `-RunSetup` | Run setup script | Switch flag |
| `-StartAgent` | Start agent after deploy | Switch flag |
| `-ProjectPath` | Local project path | `"."` (default) |
| `-RemotePath` | Remote project path | `"~/elevenlabs-pi-agent"` |

### Example Deployment Commands

```powershell
# Complete first deployment
.\deploy-to-pi.ps1 -PiAddress "192.168.1.100" -Username "ubuntu" -FirstDeploy

# Quick update deployment
.\deploy-to-pi.ps1 -PiAddress "192.168.1.100" -Username "ubuntu"

# Deploy with custom paths
.\deploy-to-pi.ps1 -PiAddress "192.168.1.100" -Username "ubuntu" -ProjectPath "C:\Projects\elevenlabs" -RemotePath "/opt/elevenlabs"
```

## 🔍 Troubleshooting Deployment

### SSH Connection Issues
```powershell
# Test SSH connection
ssh ubuntu@192.168.1.100 "echo 'Connection successful'"

# Check SSH service on Pi
ssh ubuntu@192.168.1.100 "sudo systemctl status ssh"
```

### Git Issues
```powershell
# Check Git configuration
git config --list

# Set up Git if needed
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Check remote URL
git remote -v
```

### Permission Issues
```bash
# On Pi: Fix file permissions
chmod +x setup-ubuntu.sh
sudo chown -R $USER:$USER ~/elevenlabs-pi-agent
```

## 📊 Monitoring Deployment

### Check Deployment Status
```bash
# On Pi: Check if files are updated
cd ~/elevenlabs-pi-agent
git log --oneline -5

# Check dependencies
npm list --depth=0

# Test connection
npm test
```

### View Logs
```bash
# Real-time logs
tail -f ~/elevenlabs-pi-agent/agent.log

# System service logs (if using systemd)
journalctl -u elevenlabs-agent -f
```

## 🔄 Continuous Deployment

### GitHub Actions (Optional)
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Raspberry Pi

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy to Pi
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.PI_HOST }}
        username: ${{ secrets.PI_USERNAME }}
        key: ${{ secrets.PI_SSH_KEY }}
        script: |
          cd ~/elevenlabs-pi-agent
          git pull origin main
          npm install
          npm test
          sudo systemctl restart elevenlabs-agent
```

### Environment Variables Management
```bash
# On Pi: Secure environment file
chmod 600 .env
chown $USER:$USER .env

# Backup environment
cp .env .env.backup
```

## 🎯 Best Practices

1. **Always test locally first** (if possible)
2. **Use SSH keys** instead of passwords
3. **Keep environment files secure** (never commit API keys)
4. **Test connection** after each deployment
5. **Monitor logs** for issues
6. **Use systemd service** for production
7. **Regular backups** of configuration

## 🆘 Emergency Recovery

### If Deployment Fails
```bash
# On Pi: Reset to last working state
cd ~/elevenlabs-pi-agent
git reset --hard HEAD~1
npm install
npm start
```

### If Agent Won't Start
```bash
# Check logs
npm test
tail -f agent.log

# Check audio devices
aplay -l && arecord -l

# Restart audio services
sudo systemctl restart pulseaudio
```

### Complete Reset
```bash
# Remove and re-clone
rm -rf ~/elevenlabs-pi-agent
git clone <your-repository-url> ~/elevenlabs-pi-agent
cd ~/elevenlabs-pi-agent
npm install
cp .env.backup .env  # Restore environment
npm start
```

---

**Note:** Replace `192.168.1.100` with your actual Raspberry Pi IP address and adjust usernames as needed.
