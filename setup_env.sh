#!/bin/bash

echo "==========================================="
echo "    Edushine AQS API Key Setup Wizard "
echo "==========================================="
echo "You can leave a field blank and press Enter if you don't use that model."
echo ""

# Prompt for keys
read -p "Enter your Anthropic API Key (e.g. sk-ant-...): " anthropic
read -p "Enter your OpenAI API Key (e.g. sk-...): " openai
read -p "Enter your Gemini API Key (e.g. AIza...): " gemini

echo ""
echo "Writing configuration to .env file..."

# Write to .env
cat > .env <<EOF
ANTHROPIC_API_KEY=$anthropic
OPENAI_API_KEY=$openai
GEMINI_API_KEY=$gemini
EOF

echo "✅ Success! .env file created."
echo ""
echo "To restart the backend with the new keys, run:"
echo "docker compose restart backend celery"
echo "==========================================="
