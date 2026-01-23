#!/bin/bash
# Render build script for Cost Splitting App
# Installs both Node.js and Python dependencies

set -e  # Exit on error

echo "Installing Node.js dependencies..."
npm install

echo "Installing Python dependencies..."
# Upgrade pip to ensure we can download binary wheels instead of compiling from source
pip3 install --upgrade pip
pip3 install -r server/requirements.txt

echo "Build complete!"
