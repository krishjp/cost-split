#!/bin/bash
# Render build script for Cost Splitting App
# Installs both Node.js and Python dependencies

set -e  # Exit on error

echo "Installing Node.js dependencies..."
npm install

echo "Installing Python dependencies..."
pip3 install -r requirements.txt

echo "Build complete!"
