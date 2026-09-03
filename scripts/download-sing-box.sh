#!/usr/bin/env bash
# Script to download official sing-box binary for macOS Apple Silicon
set -e

REPO="SagerNet/sing-box"
LATEST_TAG=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_TAG" ]; then
    echo "Warning: Could not fetch latest release tag via GitHub API, using fallback version v1.10.1"
    LATEST_TAG="v1.10.1"
fi

VERSION="${LATEST_TAG#v}"
TARGET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../src-tauri/binaries" && pwd)"
mkdir -p "$TARGET_DIR"

echo "Downloading sing-box $LATEST_TAG for macOS aarch64 (Apple Silicon)..."
TAR_FILE="sing-box-${VERSION}-darwin-arm64.tar.gz"
URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${TAR_FILE}"

TMP_DIR=$(mktemp -d)
curl -fsSL "$URL" -o "$TMP_DIR/$TAR_FILE"
tar -xzf "$TMP_DIR/$TAR_FILE" -C "$TMP_DIR"

EXTRACTED_BIN=$(find "$TMP_DIR" -type f -name "sing-box")
if [ -f "$EXTRACTED_BIN" ]; then
    cp "$EXTRACTED_BIN" "$TARGET_DIR/sing-box-aarch64-apple-darwin"
    chmod +x "$TARGET_DIR/sing-box-aarch64-apple-darwin"
    echo "✅ Successfully placed sing-box binary at $TARGET_DIR/sing-box-aarch64-apple-darwin"
else
    echo "❌ Failed to extract sing-box binary"
    exit 1
fi

rm -rf "$TMP_DIR"
