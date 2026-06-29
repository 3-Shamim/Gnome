#!/usr/bin/env bash
set -euo pipefail

UUID="bluetooth-battery-indicator@mdshamim723"
SRC="$(cd "$(dirname "$0")/$UUID" && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo ">>> Installing $UUID"
echo "    src:  $SRC"
echo "    dest: $DEST"

# Copy all extension files
mkdir -p "$DEST/schemas"
cp "$SRC/metadata.json"  "$DEST/metadata.json"
cp "$SRC/extension.js"   "$DEST/extension.js"
cp "$SRC/prefs.js"       "$DEST/prefs.js"
cp "$SRC/stylesheet.css" "$DEST/stylesheet.css"
cp "$SRC/schemas/"*.xml  "$DEST/schemas/"

# Compile GSettings schema
echo ">>> Compiling schema"
glib-compile-schemas "$DEST/schemas/"

# Enable if not already enabled
if ! gnome-extensions list --enabled | grep -q "$UUID"; then
    echo ">>> Enabling extension"
    gnome-extensions enable "$UUID"
else
    echo ">>> Extension already enabled"
fi

echo ""
echo "Done. To apply changes reload GNOME Shell:"
echo "  X11:    press Alt+F2, type 'r', press Enter"
echo "  Wayland: log out and back in"
echo ""
echo "To open preferences:"
echo "  gnome-extensions prefs $UUID"
