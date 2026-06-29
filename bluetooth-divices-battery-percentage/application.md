Build a GNOME Shell Extension: Bluetooth Battery Indicator

Act as a senior GNOME Shell extension developer with expertise in GJS, BlueZ, D-Bus, GTK, and GNOME Shell internals.

I want to build a production-quality GNOME Shell extension for Ubuntu/GNOME that displays the battery percentage of all connected Bluetooth devices in the Top Bar.

Requirements
Use GJS (GNOME JavaScript).
Do not use Node.js.
Do not execute bluetoothctl or parse shell command output.
Use BlueZ D-Bus APIs directly.
Query BlueZ through:
org.freedesktop.DBus.ObjectManager
GetManagedObjects()
Discover every object implementing:
org.bluez.Device1
Read battery information from:
org.bluez.Battery1
Percentage property
Only display connected devices.
Ignore devices that do not expose the Battery1 interface.
UI Requirements

The extension should create a panel button in the GNOME Top Bar.

Examples:

🎧 78%

or

🔋 BT

Clicking the panel should open a dropdown menu listing all connected Bluetooth devices.

Example:

🎧 WH-1000XM5        78%

⌨ Keychron K2       94%

🖱 MX Master 3       63%

If a device has no battery information:

Unknown

or simply hide it.

Live Updates

The extension must update automatically when:

battery percentage changes
a Bluetooth device connects
a Bluetooth device disconnects
a Bluetooth device is paired or removed

Listen for the appropriate D-Bus signals instead of polling.

Performance
Use one GetManagedObjects() call during initialization.
Cache device information.
Update only the affected device when a D-Bus signal arrives.
Avoid unnecessary D-Bus calls.
Avoid polling.
Compatibility

Target:

Ubuntu 24.04+
GNOME 46+
GNOME 47+
GNOME 48 (if compatible)

Use modern GJS APIs.

Project Structure

Generate a complete project:

bluetooth-battery-indicator/

metadata.json

extension.js

stylesheet.css

prefs.js (if needed)

schemas/

README.md
Code Quality

Produce production-quality code.

Requirements:

ES6 classes
asynchronous D-Bus calls
proper cleanup in disable()
disconnect all signals
clear comments
modular helper functions
error handling
logging using console.log() or GNOME logging APIs
Documentation

Explain:

how BlueZ works
how D-Bus communication works
why GetManagedObjects() is used
why bluetoothctl should not be used
how battery updates are received
Installation

Provide installation instructions using:

~/.local/share/gnome-shell/extensions/

Explain how to reload GNOME Shell.

Development Strategy

Generate the project incrementally.

Step 1:
Create a minimal working extension that adds a panel icon.

Step 2:
Connect to BlueZ.

Step 3:
Enumerate Bluetooth devices.

Step 4:
Read battery percentages.

Step 5:
Display devices in the menu.

Step 6:
Listen for D-Bus signals.

Step 7:
Polish the UI.

Do not skip steps.

Generate complete code for each step before moving to the next.