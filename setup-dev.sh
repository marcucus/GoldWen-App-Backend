#!/bin/bash

# GoldWen Backend Development Setup Script

set -e

echo "🚀 Setting up GoldWen Backend Development Environment"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python is not installed. Please install Python 3.11+ first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. Docker setup will be skipped."
    SKIP_DOCKER=true
else
    echo "✅ Docker found"
fi

# Setup main API
echo "🔧 Setting up Main API (NestJS)..."
cd main-api

if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in main-api directory"
    exit 1
fi

echo "📦 Installing Node.js dependencies..."
npm install

if [ ! -f ".env" ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "⚠️  Please edit main-api/.env with your configuration"
fi

cd ..

# Setup matching service
echo "🔧 Setting up Matching Service (Python)..."
cd matching-service

if [ ! -f "requirements.txt" ]; then
    echo "❌ requirements.txt not found in matching-service directory"
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "🐍 Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "🐍 Activating virtual environment..."
source venv/bin/activate

echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

if [ ! -f ".env" ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "⚠️  Please edit matching-service/.env with your configuration"
fi

cd ..

# Docker setup
if [ "$SKIP_DOCKER" != "true" ]; then
    echo "🐳 Setting up Docker environment..."
    
    if [ ! -f "docker-compose.yml" ]; then
        echo "❌ docker-compose.yml not found"
        exit 1
    fi
    
    echo "🗄️  Starting PostgreSQL and Redis..."
    docker-compose up -d postgres redis
    
    echo "⏳ Waiting for databases to be ready..."
    sleep 10
    
    echo "✅ Database services are running"
else
    echo "⚠️  Docker not available. Please setup PostgreSQL and Redis manually:"
    echo "   - PostgreSQL: localhost:5432 (user: goldwen, password: goldwen_password, db: goldwen_db)"
    echo "   - Redis: localhost:6379"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📚 Next steps:"
echo "1. Configure your environment variables:"
echo "   - main-api/.env"
echo "   - matching-service/.env"
echo ""
echo "2. Start the services:"
if [ "$SKIP_DOCKER" != "true" ]; then
    echo "   For full Docker setup:"
    echo "   docker-compose up"
    echo ""
fi
echo "   For manual startup:"
echo "   Terminal 1: cd main-api && npm run start:dev"
echo "   Terminal 2: cd matching-service && source venv/bin/activate && python main.py"
echo ""
echo "3. Access the services:"
echo "   - Main API: http://localhost:3000/api/v1"
echo "   - API Documentation: http://localhost:3000/api/v1/docs"
echo "   - Matching Service: http://localhost:8000/api/v1"
echo "   - Matching Docs: http://localhost:8000/api/v1/docs"
echo ""
echo "📖 For complete API documentation, see: API_ROUTES.md"
echo ""
echo "Happy coding! 🚀"