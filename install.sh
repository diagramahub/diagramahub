#!/bin/bash

################################################################################
# DiagramHub - One Line Installer
# Fast and easy installation wizard for DiagramHub
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh)
#
# Or:
#   wget -qO- https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh | bash
################################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/diagramahub/diagramahub.git"
PROJECT_NAME="diagramahub"
INSTALL_DIR="$HOME/$PROJECT_NAME"

################################################################################
# Helper Functions
################################################################################

print_header() {
    clear
    echo -e "${CYAN}"
    echo "════════════════════════════════════════════════════════════════"
    echo "              DiagramHub - One Line Installer                    "
    echo "════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}────────────────────────────────────────────────────────────────${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────────────────────${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

ask_yes_no() {
    local prompt="$1"
    local default="${2:-y}"

    if [ "$default" = "y" ]; then
        local options="[Y/n]"
    else
        local options="[y/N]"
    fi

    while true; do
        read -p "$(echo -e ${CYAN}${prompt} ${options}: ${NC})" response
        response=${response:-$default}
        # Convert to lowercase (Bash 3.2 compatible)
        response=$(echo "$response" | tr '[:upper:]' '[:lower:]')
        case $response in
            y|yes|s|si|sí) return 0 ;;
            n|no) return 1 ;;
            *) echo -e "${YELLOW}Please answer yes or no${NC}" ;;
        esac
    done
}

ask_input() {
    local prompt="$1"
    local default="$2"
    local response

    if [ -n "$default" ]; then
        read -p "$(echo -e ${CYAN}${prompt} [${default}]: ${NC})" response
        echo "${response:-$default}"
    else
        read -p "$(echo -e ${CYAN}${prompt}: ${NC})" response
        echo "$response"
    fi
}

################################################################################
# System Detection & Prerequisites
################################################################################

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    elif [ "$(uname)" = "Darwin" ]; then
        OS="macos"
        OS_VERSION=$(sw_vers -productVersion)
    else
        OS="unknown"
    fi

    print_info "Detected OS: $OS $OS_VERSION"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

install_docker() {
    print_section "Installing Docker"

    case $OS in
        ubuntu|debian)
            print_info "Installing Docker on Ubuntu/Debian..."
            sudo apt-get update
            sudo apt-get install -y \
                ca-certificates \
                curl \
                gnupg \
                lsb-release

            sudo mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

            echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
                $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

            # Add user to docker group
            sudo usermod -aG docker $USER
            print_success "Docker installed successfully"
            print_warning "You may need to log out and log back in for group changes to take effect"
            ;;

        centos|rhel|fedora)
            print_info "Installing Docker on CentOS/RHEL/Fedora..."
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -aG docker $USER
            print_success "Docker installed successfully"
            ;;

        macos)
            print_error "Please install Docker Desktop for macOS manually:"
            print_info "Visit: https://docs.docker.com/desktop/install/mac-install/"
            return 1
            ;;

        *)
            print_error "Automatic Docker installation not supported for $OS"
            print_info "Please install Docker manually: https://docs.docker.com/engine/install/"
            return 1
            ;;
    esac
}

check_prerequisites() {
    print_section "Checking Prerequisites"

    local missing_deps=0

    # Check Git
    if ! check_command git; then
        print_info "Installing git..."
        case $OS in
            ubuntu|debian) sudo apt-get install -y git ;;
            centos|rhel|fedora) sudo yum install -y git ;;
            macos) brew install git ;;
        esac
    fi

    # Check Docker
    if ! check_command docker; then
        if ask_yes_no "Docker is not installed. Would you like to install it now?" "y"; then
            install_docker
        else
            print_error "Docker is required to run DiagramHub"
            exit 1
        fi
    fi

    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        if ! check_command docker-compose; then
            print_error "Docker Compose not found"
            if ask_yes_no "Would you like to install docker-compose?" "y"; then
                case $OS in
                    ubuntu|debian|centos|rhel|fedora)
                        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
                        sudo chmod +x /usr/local/bin/docker-compose
                        print_success "Docker Compose installed"
                        ;;
                    *)
                        print_error "Please install Docker Compose manually"
                        exit 1
                        ;;
                esac
            else
                exit 1
            fi
        fi
    else
        print_success "Docker Compose is installed"
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_warning "Docker daemon is not running"
        if ask_yes_no "Would you like to start Docker?" "y"; then
            case $OS in
                ubuntu|debian|centos|rhel|fedora)
                    sudo systemctl start docker
                    ;;
                macos)
                    open -a Docker
                    echo "Waiting for Docker to start..."
                    sleep 10
                    ;;
            esac
        fi
    fi
}

################################################################################
# MongoDB Configuration
################################################################################

generate_jwt_secret() {
    # Generate secure random string (32 bytes, base64 encoded)
    if command -v openssl &> /dev/null; then
        openssl rand -base64 32 | tr -d '\n'
    else
        # Fallback to /dev/urandom
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 48 | head -n 1
    fi
}

test_mongodb_connection() {
    local mongo_uri="$1"

    print_info "Testing MongoDB connection..."

    # Try using mongosh if available
    if command -v mongosh &> /dev/null; then
        if mongosh "$mongo_uri" --eval "db.adminCommand('ping')" &> /dev/null; then
            print_success "Connection successful!"
            return 0
        fi
    fi

    # Try using mongo (legacy)
    if command -v mongo &> /dev/null; then
        if mongo "$mongo_uri" --eval "db.adminCommand('ping')" &> /dev/null; then
            print_success "Connection successful!"
            return 0
        fi
    fi

    # Try using Docker to test connection
    if docker run --rm mongo:7 mongosh "$mongo_uri" --eval "db.adminCommand('ping')" &> /dev/null; then
        print_success "Connection successful!"
        return 0
    fi

    print_warning "Could not verify connection (mongo client not available)"
    print_info "Connection will be verified when starting the application"
    return 0
}

configure_mongodb() {
    print_section "MongoDB Configuration"

    echo "Choose your MongoDB setup:"
    echo ""
    echo "  1. 🐳 Local MongoDB (Docker) - Recommended for development"
    echo "  2. 🌐 External MongoDB (Atlas, custom server, etc.)"
    echo ""

    local choice
    choice=$(ask_input "Enter your choice (1 or 2)" "1")

    if [ "$choice" = "1" ]; then
        MONGO_URI="mongodb://mongodb:27017"
        DATABASE_NAME=$(ask_input "Database name" "diagramahub")
        USE_EXTERNAL_MONGO=false
        print_success "Using local MongoDB with Docker"

    elif [ "$choice" = "2" ]; then
        print_info "External MongoDB Configuration"
        echo ""
        echo "Example formats:"
        echo "  MongoDB Atlas: mongodb+srv://user:pass@cluster.mongodb.net/"
        echo "  Standard:      mongodb://user:pass@host:27017/"
        echo "  Local custom:  mongodb://localhost:27017/"
        echo ""

        while true; do
            MONGO_URI=$(ask_input "Enter MongoDB connection URI")

            if [ -z "$MONGO_URI" ]; then
                print_error "MongoDB URI cannot be empty"
                continue
            fi

            if test_mongodb_connection "$MONGO_URI"; then
                break
            else
                if ! ask_yes_no "Connection test inconclusive. Continue anyway?" "y"; then
                    continue
                else
                    break
                fi
            fi
        done

        DATABASE_NAME=$(ask_input "Database name" "diagramahub")
        USE_EXTERNAL_MONGO=true

    else
        print_error "Invalid choice"
        exit 1
    fi
}

################################################################################
# Installation
################################################################################

clone_repository() {
    print_section "Downloading DiagramHub"

    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Directory $INSTALL_DIR already exists"
        if ask_yes_no "Remove existing directory and reinstall?" "n"; then
            rm -rf "$INSTALL_DIR"
        else
            print_info "Using existing directory"
            cd "$INSTALL_DIR"
            git pull
            return 0
        fi
    fi

    print_info "Cloning repository to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    print_success "Repository cloned successfully"
}

create_env_file() {
    print_section "Creating Configuration Files"

    local env_file="$INSTALL_DIR/backend/.env"

    print_info "Generating JWT secret..."
    JWT_SECRET=$(generate_jwt_secret)

    print_info "Creating $env_file..."

    cat > "$env_file" <<EOF
# DiagramHub Backend Configuration
# Generated by install.sh

# MongoDB Configuration
MONGO_URI=$MONGO_URI
DATABASE_NAME=$DATABASE_NAME

# JWT Configuration
JWT_SECRET=$JWT_SECRET
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API Configuration
API_V1_PREFIX=/api/v1
EOF

    print_success "Environment file created"
    print_info "JWT Secret: ${JWT_SECRET:0:20}... (hidden for security)"
}

setup_docker_compose() {
    print_section "Setting Up Docker Compose"

    local deploy_source_relative
    local deploy_name

    if [ "$USE_EXTERNAL_MONGO" = true ]; then
        deploy_source_relative="deploy/external-mongodb/docker-compose.yml"
        deploy_name="External MongoDB"
        print_info "Using deployment configuration: External MongoDB"
    else
        deploy_source_relative="deploy/local-full/docker-compose.yml"
        deploy_name="Local Full Stack"
        print_info "Using deployment configuration: Local Full Stack (with MongoDB)"
    fi

    # Create symbolic link or copy the appropriate docker-compose file
    local compose_target="$INSTALL_DIR/docker-compose.yml"

    # Backup original if exists
    if [ -f "$compose_target" ] && [ ! -L "$compose_target" ]; then
        cp "$compose_target" "$compose_target.backup"
        print_info "Original docker-compose.yml backed up"
    fi

    # Remove existing symlink if it exists
    if [ -L "$compose_target" ]; then
        rm "$compose_target"
    fi

    # Create symbolic link to deployment configuration (using relative path)
    cd "$INSTALL_DIR"
    ln -sf "$deploy_source_relative" docker-compose.yml
    cd - > /dev/null

    print_success "Docker Compose configured for: $deploy_name"
    print_info "Configuration: $deploy_source_relative"
}

build_and_start() {
    print_section "Building and Starting DiagramHub"

    cd "$INSTALL_DIR"

    if ask_yes_no "Would you like to start DiagramHub now?" "y"; then
        print_info "Building Docker images (this may take a few minutes)..."
        docker-compose build

        print_info "Starting services..."
        docker-compose up -d

        print_success "DiagramHub is starting..."

        echo ""
        print_info "Waiting for services to be ready (30 seconds)..."
        sleep 30

        # Check if services are running
        if docker-compose ps | grep -q "Up"; then
            print_success "Services are running!"
        else
            print_warning "Some services may not have started correctly"
            print_info "Check logs with: cd $INSTALL_DIR && docker-compose logs"
        fi
    else
        print_info "You can start DiagramHub later with:"
        echo "  cd $INSTALL_DIR"
        echo "  docker-compose up -d"
    fi
}

################################################################################
# Main Installation Flow
################################################################################

main() {
    print_header

    echo "Welcome to the DiagramHub installer!"
    echo ""
    echo "This script will:"
    echo "  • Check and install prerequisites (Docker, Docker Compose)"
    echo "  • Clone the DiagramHub repository"
    echo "  • Configure MongoDB (local or external)"
    echo "  • Generate secure JWT secrets"
    echo "  • Build and start the application"
    echo ""

    if ! ask_yes_no "Would you like to continue?" "y"; then
        print_info "Installation cancelled"
        exit 0
    fi

    # Detect OS
    detect_os

    # Check prerequisites
    check_prerequisites

    # Clone repository
    clone_repository

    # Configure MongoDB
    configure_mongodb

    # Create configuration files
    create_env_file
    setup_docker_compose

    # Build and start
    build_and_start

    # Print summary
    print_section "Installation Complete!"

    echo -e "${GREEN}✅ DiagramHub has been installed successfully!${NC}"
    echo ""
    echo "Configuration:"
    echo "  • MongoDB: $([ "$USE_EXTERNAL_MONGO" = true ] && echo "External" || echo "Local (Docker)")"
    echo "  • Database: $DATABASE_NAME"
    echo "  • Location: $INSTALL_DIR"
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Access DiagramHub"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo "  🌐 Frontend:  http://localhost:5173"
    echo "  🔧 Backend:   http://localhost:5172"
    echo "  📚 API Docs:  http://localhost:5172/docs"
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Useful Commands"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo "  View logs:"
    echo "    cd $INSTALL_DIR && docker-compose logs -f"
    echo ""
    echo "  Stop services:"
    echo "    cd $INSTALL_DIR && docker-compose down"
    echo ""
    echo "  Restart services:"
    echo "    cd $INSTALL_DIR && docker-compose restart"
    echo ""
    echo "  Update DiagramHub:"
    echo "    cd $INSTALL_DIR && git pull && docker-compose build && docker-compose up -d"
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo -e "${CYAN}🎉 Happy diagramming!${NC}"
    echo ""
}

# Run main function
main "$@"
