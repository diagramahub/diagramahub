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
        if timeout 10 mongosh "$mongo_uri" --eval "db.adminCommand('ping')" &> /dev/null 2>&1; then
            print_success "Connection successful!"
            return 0
        fi
    fi

    # Try using mongo (legacy)
    if command -v mongo &> /dev/null; then
        if timeout 10 mongo "$mongo_uri" --eval "db.adminCommand('ping')" &> /dev/null 2>&1; then
            print_success "Connection successful!"
            return 0
        fi
    fi

    # Try using Docker to test connection (with timeout and image pull progress)
    print_info "Attempting connection test with Docker (may take a moment to download image)..."

    # Pull image first to show progress
    if ! docker image inspect mongo:8 &> /dev/null; then
        print_info "Downloading MongoDB client image (this is a one-time download)..."
        if ! timeout 120 docker pull mongo:8 2>&1 | grep -E 'Pulling|Downloaded|Status'; then
            print_warning "Image download timeout or failed"
            print_info "Connection will be verified when starting the application"
            return 0
        fi
    fi

    # Test connection with timeout
    if timeout 15 docker run --rm mongo:8 mongosh "$mongo_uri" --eval "db.adminCommand('ping')" &> /dev/null 2>&1; then
        print_success "Connection successful!"
        return 0
    fi

    print_warning "Could not verify connection"
    print_info "This is usually fine - connection will be verified when starting the application"
    return 0
}

configure_mongodb() {
    print_section "MongoDB Configuration"

    echo "DiagramHub supports two deployment modes:"
    echo ""
    echo -e "  ${GREEN}1. 🐳 Local MongoDB (Docker)${NC}"
    echo "     • MongoDB runs in a Docker container"
    echo "     • Perfect for development and testing"
    echo "     • Data persists in a Docker volume"
    echo "     • No external database needed"
    echo ""
    echo -e "  ${BLUE}2. 🌐 External MongoDB${NC}"
    echo "     • Use MongoDB Atlas (cloud)"
    echo "     • Use your own MongoDB server"
    echo "     • Better for production environments"
    echo "     • You manage backups and scaling"
    echo ""

    local choice
    while true; do
        choice=$(ask_input "Enter your choice (1 or 2)" "1")
        if [ "$choice" = "1" ] || [ "$choice" = "2" ]; then
            break
        else
            print_error "Invalid choice. Please enter 1 or 2"
        fi
    done

    if [ "$choice" = "1" ]; then
        echo ""
        print_info "Configuring Local MongoDB (Docker)"
        MONGO_URI="mongodb://mongodb:27017"
        DATABASE_NAME=$(ask_input "Database name" "diagramahub")
        USE_EXTERNAL_MONGO=false
        echo ""
        print_success "Local MongoDB configured"
        print_info "MongoDB will run in a Docker container named 'diagramahub-mongodb'"

    elif [ "$choice" = "2" ]; then
        echo ""
        print_info "Configuring External MongoDB"
        echo ""
        echo "Connection URI examples:"
        echo -e "  ${CYAN}MongoDB Atlas:${NC}  mongodb+srv://username:password@cluster.mongodb.net/"
        echo -e "  ${CYAN}Standard:${NC}       mongodb://username:password@hostname:27017/"
        echo -e "  ${CYAN}Local custom:${NC}   mongodb://localhost:27017/"
        echo ""

        while true; do
            MONGO_URI=$(ask_input "Enter MongoDB connection URI")

            if [ -z "$MONGO_URI" ]; then
                print_error "MongoDB URI cannot be empty"
                continue
            fi

            # Basic validation
            if [[ ! "$MONGO_URI" =~ ^mongodb ]]; then
                print_error "URI must start with 'mongodb://' or 'mongodb+srv://'"
                continue
            fi

            if test_mongodb_connection "$MONGO_URI"; then
                break
            else
                if ask_yes_no "Connection test inconclusive. Continue anyway?" "y"; then
                    break
                fi
            fi
        done

        DATABASE_NAME=$(ask_input "Database name" "diagramahub")
        USE_EXTERNAL_MONGO=true
        echo ""
        print_success "External MongoDB configured"
        print_info "DiagramHub will connect to: ${MONGO_URI%%\?*}"  # Hide query params
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
    local deploy_description

    if [ "$USE_EXTERNAL_MONGO" = true ]; then
        deploy_source_relative="deploy/external-mongodb/docker-compose.yml"
        deploy_name="External MongoDB"
        deploy_description="Backend + Frontend (MongoDB hosted externally)"
    else
        deploy_source_relative="deploy/local-full/docker-compose.yml"
        deploy_name="Local Full Stack"
        deploy_description="MongoDB + Backend + Frontend (all in Docker)"
    fi

    # Verify deployment configuration exists
    local deploy_full_path="$INSTALL_DIR/$deploy_source_relative"
    if [ ! -f "$deploy_full_path" ]; then
        print_error "Deployment configuration not found: $deploy_source_relative"
        print_error "This may indicate the repository is corrupted or incomplete"
        exit 1
    fi

    print_info "Selected deployment mode: $deploy_name"
    print_info "Services: $deploy_description"
    echo ""

    # Remove existing docker-compose.yml (whether file or symlink)
    local compose_target="$INSTALL_DIR/docker-compose.yml"
    if [ -e "$compose_target" ] || [ -L "$compose_target" ]; then
        rm -f "$compose_target"
    fi

    # Create symbolic link to deployment configuration
    cd "$INSTALL_DIR"
    ln -sf "$deploy_source_relative" docker-compose.yml

    print_success "Docker Compose configured successfully"
    print_info "Using: $deploy_source_relative"
}

build_and_start() {
    print_section "Building and Starting DiagramHub"

    cd "$INSTALL_DIR"

    # Show what will be started
    if [ "$USE_EXTERNAL_MONGO" = true ]; then
        echo "The following services will be started:"
        echo -e "  • ${GREEN}Backend${NC} (FastAPI on port 5172)"
        echo -e "  • ${GREEN}Frontend${NC} (Vite on port 5173)"
        echo ""
        print_info "MongoDB will NOT be started (using external connection)"
    else
        echo "The following services will be started:"
        echo -e "  • ${GREEN}MongoDB${NC} (port 27017)"
        echo -e "  • ${GREEN}Backend${NC} (FastAPI on port 5172)"
        echo -e "  • ${GREEN}Frontend${NC} (Vite on port 5173)"
    fi
    echo ""

    if ask_yes_no "Would you like to start DiagramHub now?" "y"; then
        print_info "Building Docker images (this may take a few minutes)..."
        if docker-compose build; then
            print_success "Docker images built successfully"
        else
            print_error "Failed to build Docker images"
            print_info "Check the output above for errors"
            exit 1
        fi

        echo ""
        print_info "Starting services..."
        if docker-compose up -d; then
            print_success "Services started successfully"
        else
            print_error "Failed to start services"
            print_info "Check logs with: cd $INSTALL_DIR && docker-compose logs"
            exit 1
        fi

        echo ""
        print_info "Waiting for services to initialize (15 seconds)..."
        sleep 15

        # Check service status
        echo ""
        print_info "Checking service status..."
        docker-compose ps

        # Verify services are running
        local running_services=$(docker-compose ps --filter "status=running" --quiet | wc -l)
        local expected_services
        if [ "$USE_EXTERNAL_MONGO" = true ]; then
            expected_services=2  # backend + frontend
        else
            expected_services=3  # mongodb + backend + frontend
        fi

        echo ""
        if [ "$running_services" -ge "$expected_services" ]; then
            print_success "All services are running!"
        else
            print_warning "Some services may not have started correctly"
            print_info "Running services: $running_services / $expected_services"
            print_info "Check logs with: cd $INSTALL_DIR && docker-compose logs -f"
        fi
    else
        echo ""
        print_info "Skipping automatic startup"
        print_info "You can start DiagramHub later with:"
        echo ""
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
    echo "════════════════════════════════════════════════════════════════"
    echo "  Configuration Summary"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    if [ "$USE_EXTERNAL_MONGO" = true ]; then
        echo -e "  ${CYAN}Deployment Mode:${NC}  External MongoDB"
        echo -e "  ${CYAN}Services:${NC}         Backend + Frontend"
        echo -e "  ${CYAN}MongoDB:${NC}          External (not managed by Docker Compose)"
        echo -e "  ${CYAN}Database:${NC}         $DATABASE_NAME"
    else
        echo -e "  ${CYAN}Deployment Mode:${NC}  Local Full Stack"
        echo -e "  ${CYAN}Services:${NC}         MongoDB + Backend + Frontend"
        echo -e "  ${CYAN}MongoDB:${NC}          Running in Docker (diagramahub-mongodb)"
        echo -e "  ${CYAN}Database:${NC}         $DATABASE_NAME"
    fi
    echo -e "  ${CYAN}Location:${NC}         $INSTALL_DIR"
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Access DiagramHub"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo -e "  ${GREEN}🌐 Frontend:${NC}  http://localhost:5173"
    echo -e "  ${GREEN}🔧 Backend:${NC}   http://localhost:5172"
    echo -e "  ${GREEN}📚 API Docs:${NC}  http://localhost:5172/docs"
    if [ "$USE_EXTERNAL_MONGO" = false ]; then
        echo -e "  ${GREEN}🗄️  MongoDB:${NC}   localhost:27017"
    fi
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Useful Commands"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo -e "  ${YELLOW}View logs (all services):${NC}"
    echo "    cd $INSTALL_DIR && docker-compose logs -f"
    echo ""
    echo -e "  ${YELLOW}View logs (specific service):${NC}"
    echo "    cd $INSTALL_DIR && docker-compose logs -f backend"
    echo "    cd $INSTALL_DIR && docker-compose logs -f frontend"
    if [ "$USE_EXTERNAL_MONGO" = false ]; then
        echo "    cd $INSTALL_DIR && docker-compose logs -f mongodb"
    fi
    echo ""
    echo -e "  ${YELLOW}Stop services:${NC}"
    echo "    cd $INSTALL_DIR && docker-compose down"
    echo ""
    echo -e "  ${YELLOW}Restart services:${NC}"
    echo "    cd $INSTALL_DIR && docker-compose restart"
    echo ""
    echo -e "  ${YELLOW}Update DiagramHub:${NC}"
    echo "    cd $INSTALL_DIR"
    echo "    git pull"
    echo "    docker-compose build"
    echo "    docker-compose up -d"
    echo ""
    echo -e "  ${YELLOW}Run backend tests:${NC}"
    echo "    docker exec diagramahub-backend poetry run pytest"
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo -e "${GREEN}🎉 Happy diagramming!${NC}"
    echo ""
    echo -e "${CYAN}💡 Tip:${NC} Visit http://localhost:5173 to start creating diagrams"
    echo -e "${CYAN}💡 Tip:${NC} Visit http://localhost:5172/docs to explore the API"
    echo ""
}

# Run main function
main "$@"
