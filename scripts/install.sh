#!/usr/bin/env bash
# keyrotate installer — fetches the latest release binary for your platform
# and drops it in ~/bin (or /usr/local/bin if writable). No sudo, no compile.
#
#   curl -fsSL https://raw.githubusercontent.com/botflowlab/keyrotate/main/scripts/install.sh | bash
set -euo pipefail

REPO="${KEYROTATE_REPO:-botflowlab/keyrotate}"
INSTALL_DIR="${KEYROTATE_INSTALL_DIR:-$HOME/bin}"

os=$(uname -s)
arch=$(uname -m)
case "$os-$arch" in
  Darwin-arm64) asset="keyrotate-darwin-arm64.tar.gz" ;;
  Darwin-x86_64) asset="keyrotate-darwin-x64.tar.gz" ;;
  Linux-x86_64) asset="keyrotate-linux-x64.tar.gz" ;;
  *) echo "Unsupported platform: $os-$arch" >&2; exit 1 ;;
esac

tag=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)
url="https://github.com/${REPO}/releases/download/${tag}/${asset}"

tmp=$(mktemp -d)
echo "→ Downloading $asset ($tag) …"
curl -fsSL "$url" -o "$tmp/$asset"
tar -xzf "$tmp/$asset" -C "$tmp"

mkdir -p "$INSTALL_DIR"
install -m 0755 "$tmp/keyrotate" "$INSTALL_DIR/keyrotate"
ln -sf "$INSTALL_DIR/keyrotate" "$INSTALL_DIR/kr"
rm -rf "$tmp"

echo "✓ Installed: $INSTALL_DIR/keyrotate"
echo "✓ Symlinked: $INSTALL_DIR/kr"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) : ;;
  *) echo "⚠  $INSTALL_DIR is not in your PATH. Add this to your shell rc:"; echo "    export PATH=\"$INSTALL_DIR:\$PATH\"" ;;
esac
echo
"$INSTALL_DIR/keyrotate" version
