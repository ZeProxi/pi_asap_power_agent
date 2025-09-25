# PowerShell script for deploying ElevenLabs Agent to Raspberry Pi
# Usage: .\deploy-to-pi.ps1 -PiAddress "192.168.1.100" -Username "ubuntu"

param(
    [Parameter(Mandatory=$true)]
    [string]$PiAddress,
    
    [Parameter(Mandatory=$true)]
    [string]$Username,
    
    [string]$ProjectPath = ".",
    [string]$RemotePath = "~/elevenlabs-pi-agent",
    [switch]$FirstDeploy,
    [switch]$RunSetup,
    [switch]$StartAgent
)

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-Info {
    param([string]$Message)
    Write-Host "${Blue}[INFO]${Reset} $Message"
}

function Write-Success {
    param([string]$Message)
    Write-Host "${Green}[SUCCESS]${Reset} $Message"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "${Yellow}[WARNING]${Reset} $Message"
}

function Write-Error {
    param([string]$Message)
    Write-Host "${Red}[ERROR]${Reset} $Message"
}

# Check if Git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is not installed or not in PATH"
    exit 1
}

# Check if SSH is available
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Error "SSH is not available. Please install OpenSSH client or use WSL"
    exit 1
}

Write-Info "Starting deployment to Raspberry Pi..."
Write-Info "Target: $Username@$PiAddress"
Write-Info "Remote Path: $RemotePath"

# Test SSH connection
Write-Info "Testing SSH connection..."
$sshTest = ssh -o ConnectTimeout=10 -o BatchMode=yes "$Username@$PiAddress" "echo 'SSH connection successful'"
if ($LASTEXITCODE -ne 0) {
    Write-Error "SSH connection failed. Please check:"
    Write-Host "  1. Pi IP address: $PiAddress"
    Write-Host "  2. Username: $Username"
    Write-Host "  3. SSH key authentication is set up"
    Write-Host "  4. Pi is powered on and connected to network"
    exit 1
}
Write-Success "SSH connection verified"

# Check if this is a Git repository
if (-not (Test-Path ".git")) {
    Write-Error "Current directory is not a Git repository"
    exit 1
}

# Check for uncommitted changes
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Warning "You have uncommitted changes:"
    git status --short
    $response = Read-Host "Continue deployment? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Info "Deployment cancelled"
        exit 0
    }
}

# Get current Git branch and commit
$currentBranch = git rev-parse --abbrev-ref HEAD
$currentCommit = git rev-parse --short HEAD
Write-Info "Current branch: $currentBranch ($currentCommit)"

# Push changes to remote repository
Write-Info "Pushing changes to remote repository..."
try {
    git push origin $currentBranch
    Write-Success "Changes pushed to remote repository"
} catch {
    Write-Error "Failed to push changes to remote repository"
    Write-Host "Please ensure your changes are committed and the remote repository is accessible"
    exit 1
}

# First deployment setup
if ($FirstDeploy) {
    Write-Info "Performing first-time deployment setup..."
    
    # Run setup script
    Write-Info "Running Ubuntu setup script on Pi..."
    $setupCommand = @"
cd ~ && 
if [ ! -f setup-ubuntu.sh ]; then 
    wget -O setup-ubuntu.sh 'https://raw.githubusercontent.com/yourusername/yourrepo/main/setup-ubuntu.sh' || 
    curl -o setup-ubuntu.sh 'https://raw.githubusercontent.com/yourusername/yourrepo/main/setup-ubuntu.sh'
fi &&
chmod +x setup-ubuntu.sh &&
./setup-ubuntu.sh
"@
    
    ssh "$Username@$PiAddress" $setupCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Setup script completed"
        Write-Warning "Pi needs to reboot for audio group changes to take effect"
        $reboot = Read-Host "Reboot Pi now? (Y/n)"
        if ($reboot -ne "n" -and $reboot -ne "N") {
            Write-Info "Rebooting Pi..."
            ssh "$Username@$PiAddress" "sudo reboot"
            Write-Info "Waiting for Pi to reboot (30 seconds)..."
            Start-Sleep -Seconds 30
        }
    } else {
        Write-Error "Setup script failed"
        exit 1
    }
}

# Clone or update repository on Pi
Write-Info "Updating code on Pi..."
$gitUrl = git config --get remote.origin.url
$deployCommand = @"
if [ -d '$RemotePath' ]; then
    echo 'Updating existing repository...'
    cd '$RemotePath'
    git fetch origin
    git reset --hard origin/$currentBranch
else
    echo 'Cloning repository...'
    git clone '$gitUrl' '$RemotePath'
    cd '$RemotePath'
fi
"@

ssh "$Username@$PiAddress" $deployCommand

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to clone/update repository on Pi"
    exit 1
}
Write-Success "Code updated on Pi"

# Install/update dependencies
Write-Info "Installing dependencies on Pi..."
ssh "$Username@$PiAddress" "cd '$RemotePath' && npm install"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install dependencies"
    exit 1
}
Write-Success "Dependencies installed"

# Check if .env file exists
Write-Info "Checking environment configuration..."
$envCheck = ssh "$Username@$PiAddress" "cd '$RemotePath' && test -f .env && echo 'exists' || echo 'missing'"

if ($envCheck -eq "missing") {
    Write-Warning ".env file not found on Pi"
    Write-Info "Creating .env file from template..."
    ssh "$Username@$PiAddress" "cd '$RemotePath' && cp .env.example .env"
    Write-Warning "Please edit the .env file on Pi with your API keys:"
    Write-Host "  ssh $Username@$PiAddress"
    Write-Host "  cd $RemotePath"
    Write-Host "  nano .env"
} else {
    Write-Success ".env file exists"
}

# Test the connection
Write-Info "Testing ElevenLabs connection..."
$testResult = ssh "$Username@$PiAddress" "cd '$RemotePath' && timeout 30 npm test"

if ($LASTEXITCODE -eq 0) {
    Write-Success "Connection test passed"
} else {
    Write-Warning "Connection test failed or timed out"
    Write-Info "You may need to configure your .env file or check your API keys"
}

# Start the agent if requested
if ($StartAgent) {
    Write-Info "Starting ElevenLabs Agent..."
    Write-Info "Agent will run in the background. Use Ctrl+C to stop this script."
    Write-Info "To stop the agent later, run: ssh $Username@$PiAddress 'pkill -f \"node.*elevenlabs\"'"
    
    # Start agent in background and show logs
    ssh "$Username@$PiAddress" "cd '$RemotePath' && nohup npm start > agent.log 2>&1 & echo 'Agent started with PID:' `$!"
    
    Write-Success "Agent started on Pi"
    Write-Info "View logs with: ssh $Username@$PiAddress 'tail -f $RemotePath/agent.log'"
}

Write-Success "Deployment completed successfully!"
Write-Info ""
Write-Info "Next steps:"
Write-Info "1. SSH to Pi: ssh $Username@$PiAddress"
Write-Info "2. Navigate to project: cd $RemotePath"
Write-Info "3. Configure .env if needed: nano .env"
Write-Info "4. Test connection: npm test"
Write-Info "5. Start agent: npm start"
Write-Info ""
Write-Info "Useful commands:"
Write-Info "• View logs: tail -f $RemotePath/agent.log"
Write-Info "• Stop agent: pkill -f 'node.*elevenlabs'"
Write-Info "• Check audio devices: aplay -l && arecord -l"
