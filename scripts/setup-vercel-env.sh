#!/bin/bash

# Setup Vercel Environment Variables
# This script adds environment variables from .env to Vercel

echo "🔧 Setting up Vercel environment variables..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Load .env file
source .env

# Function to add env var to Vercel
add_env() {
    local name=$1
    local value=$2

    if [ -z "$value" ]; then
        echo "⏭️  Skipping $name (empty value)"
        return
    fi

    echo "Adding $name..."
    echo "$value" | vercel env add "$name" production preview development --yes 2>&1 | grep -v "Enter"
}

# Add all environment variables
add_env "FEATUREBASE_API_KEY" "$FEATUREBASE_API_KEY"
add_env "FEATUREBASE_HELP_CENTER_ID" "$FEATUREBASE_HELP_CENTER_ID"
add_env "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
add_env "GOOGLE_AI_API_KEY" "$GOOGLE_AI_API_KEY"

# Optional variables
if [ ! -z "$GITHUB_TOKEN" ]; then
    add_env "GITHUB_TOKEN" "$GITHUB_TOKEN"
fi

if [ ! -z "$GITHUB_REPO" ]; then
    add_env "GITHUB_REPO" "$GITHUB_REPO"
fi

echo ""
echo "✅ Environment variables configured!"
echo "📝 Run 'vercel --prod' to redeploy with the new environment variables"
