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

# Enable the extension.
# gnome-extensions enable only works once GNOME Shell has loaded the extension.
# On a fresh install the running shell hasn't scanned the directory yet, so we
# fall back to writing directly to gsettings (works on both X11 and Wayland).
echo ">>> Enabling extension"
if gnome-extensions enable "$UUID" 2>/dev/null; then
    echo "    enabled via gnome-extensions"
else
    echo "    GNOME Shell not yet aware of extension — writing to gsettings"
    python3 - <<PYEOF
import subprocess, sys

uuid = "$UUID"
result = subprocess.run(
    ["gsettings", "get", "org.gnome.shell", "enabled-extensions"],
    capture_output=True, text=True
)
raw = result.stdout.strip()

if raw in ("", "@as []", "[]"):
    exts = []
else:
    exts = [e.strip().strip("'\"") for e in raw.strip()[1:-1].split(",") if e.strip()]

if uuid in exts:
    print("    already in enabled list")
    sys.exit(0)

exts.append(uuid)
new_val = "[" + ", ".join(f"'{e}'" for e in exts) + "]"
subprocess.run(["gsettings", "set", "org.gnome.shell", "enabled-extensions", new_val], check=True)
print(f"    added {uuid}")
PYEOF
fi

echo ""
echo "Done. Reload GNOME Shell to activate the extension:"
echo "  X11:    press Alt+F2, type 'r', press Enter"
echo "  Wayland: log out and back in"
echo ""
echo "After reloading, verify:"
echo "  gnome-extensions list --enabled | grep $UUID"
echo ""
echo "To open preferences:"
echo "  gnome-extensions prefs $UUID"
