'use strict';

const GObject = imports.gi.GObject;
const St      = imports.gi.St;
const Gio     = imports.gi.Gio;
const GLib    = imports.gi.GLib;

const Main      = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;

// ─── Constants ───────────────────────────────────────────────────────────────

const BLUEZ_BUS_NAME   = 'org.bluez';
const BLUEZ_ROOT_PATH  = '/';
const IFACE_OBJECT_MGR = 'org.freedesktop.DBus.ObjectManager';
const IFACE_DEVICE1    = 'org.bluez.Device1';
const IFACE_BATTERY1   = 'org.bluez.Battery1';
const IFACE_PROPERTIES = 'org.freedesktop.DBus.Properties';

const LOW_BATTERY_THRESHOLD = 20;
const DEBOUNCE_MS = 300;

const ICON_MAP = {
    'audio-headset':    '🎧',
    'audio-headphones': '🎧',
    'audio-card':       '🔊',
    'input-keyboard':   '⌨',
    'input-mouse':      '🖱',
    'input-gaming':     '🎮',
    'phone':            '📱',
    'computer':         '💻',
    'printer':          '🖨',
    'camera-photo':     '📷',
};

function deviceEmoji(bluezIcon) {
    return ICON_MAP[bluezIcon] ?? '📡';
}

// Minimal gettext shim — no translations bundled for this port
function _(s) { return s; }

// ─── Panel Indicator ─────────────────────────────────────────────────────────

const BluetoothBatteryIndicator = GObject.registerClass(
class BluetoothBatteryIndicator extends PanelMenu.Button {

    _init() {
        super._init(0.0, 'Bluetooth Battery Indicator');

        this._devices = new Map();
        this._signalIds = [];
        this._debounceId = null;
        this._objectManagerProxy = null;
        this._showUnknown = true;
        this._settingsChangedId = null;

        this._label = new St.Label({
            text: '🔋 BT',
            y_align: 2, // Clutter.ActorAlign.CENTER
            style_class: 'panel-label',
        });
        this.add_child(this._label);

        this._settings = ExtensionUtils.getSettings();
        this._showUnknown = this._settings.get_boolean('show-unknown-battery');
        this._settingsChangedId = this._settings.connect(
            'changed::show-unknown-battery',
            () => {
                this._showUnknown = this._settings.get_boolean('show-unknown-battery');
                this._rebuildMenu();
            }
        );

        this._connectToBlueZ();
    }

    // ── Connect to BlueZ ObjectManager ────────────────────────────────────

    _connectToBlueZ() {
        Gio.DBusProxy.new(
            Gio.DBus.system,
            Gio.DBusProxyFlags.DO_NOT_AUTO_START,
            null,
            BLUEZ_BUS_NAME,
            BLUEZ_ROOT_PATH,
            IFACE_OBJECT_MGR,
            null,
            (obj, result) => {
                try {
                    this._objectManagerProxy = Gio.DBusProxy.new_finish(result);
                } catch (e) {
                    log(`[BT Battery] Failed to create ObjectManager proxy: ${e.message}`);
                    this._setOffline();
                    return;
                }
                this._loadAllDevices();
                this._subscribeSignals();
            }
        );
    }

    _setOffline() {
        this._label.text = '🔋 BT';
        this.menu.removeAll();
        const item = new PopupMenu.PopupMenuItem(_('Bluetooth unavailable'));
        item.sensitive = false;
        this.menu.addMenuItem(item);
    }

    // ── Load all devices from GetManagedObjects ────────────────────────────

    _loadAllDevices() {
        this._objectManagerProxy.call(
            'GetManagedObjects',
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (proxy, result) => {
                let variant;
                try {
                    variant = proxy.call_finish(result);
                } catch (e) {
                    log(`[BT Battery] GetManagedObjects failed: ${e.message}`);
                    this._setOffline();
                    return;
                }

                const [objects] = variant.deepUnpack();

                this._devices.clear();

                for (const [path, interfaces] of Object.entries(objects))
                    this._parseObject(path, interfaces);

                this._rebuildMenu();
            }
        );
    }

    _parseObject(path, interfaces) {
        const device1 = interfaces[IFACE_DEVICE1];
        if (!device1)
            return;

        const name      = device1['Name']?.deepUnpack()      ?? path;
        const connected = device1['Connected']?.deepUnpack() ?? false;
        const bluezIcon = device1['Icon']?.deepUnpack()      ?? null;

        if (!connected)
            return;

        const battery1 = interfaces[IFACE_BATTERY1];
        const battery  = battery1
            ? (battery1['Percentage']?.deepUnpack() ?? null)
            : null;

        this._devices.set(path, {name, icon: bluezIcon, battery, connected: true});
    }

    // ── Build the dropdown menu ────────────────────────────────────────────

    _rebuildMenu() {
        this.menu.removeAll();

        const connected = [...this._devices.values()];

        if (connected.length === 0) {
            const item = new PopupMenu.PopupMenuItem(_('No devices connected'));
            item.sensitive = false;
            this.menu.addMenuItem(item);
            this._label.text = '🔋 BT';
            return;
        }

        const withBattery    = connected
            .filter(d => d.battery !== null)
            .sort((a, b) => a.battery - b.battery);
        const withoutBattery = connected
            .filter(d => d.battery === null);

        for (const device of withBattery)
            this.menu.addMenuItem(this._makeDeviceItem(device));

        if (this._showUnknown && withoutBattery.length > 0) {
            if (withBattery.length > 0)
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            for (const device of withoutBattery)
                this.menu.addMenuItem(this._makeDeviceItem(device));
        }

        if (withBattery.length > 0) {
            const lowest = withBattery[0];
            this._label.text = `${deviceEmoji(lowest.icon)} ${lowest.battery}%`;
        } else {
            this._label.text = '🔋 BT';
        }

        const names = connected.map(d =>
            `${deviceEmoji(d.icon)} ${d.name}${d.battery !== null ? ` ${d.battery}%` : ''}`
        ).join('\n');
        this.set_accessible_name(names);
    }

    _makeDeviceItem(device) {
        const isLow  = device.battery !== null && device.battery < LOW_BATTERY_THRESHOLD;
        const batStr = device.battery !== null ? `${device.battery}%` : '—';
        const emoji  = deviceEmoji(device.icon);

        const name = device.name.length > 22
            ? `${device.name.slice(0, 20)}…`
            : device.name;
        const padded = name.padEnd(22, ' ');

        const item = new PopupMenu.PopupMenuItem(`${emoji}  ${padded} ${batStr}`);
        item.sensitive = false;
        item.add_style_class_name('bluetooth-battery-item');
        if (isLow)
            item.add_style_class_name('bluetooth-battery-low');

        return item;
    }

    // ── Subscribe to D-Bus signals ─────────────────────────────────────────

    _subscribeSignals() {
        this._signalIds.push(
            Gio.DBus.system.signal_subscribe(
                BLUEZ_BUS_NAME,
                IFACE_OBJECT_MGR,
                'InterfacesAdded',
                BLUEZ_ROOT_PATH,
                null,
                Gio.DBusSignalFlags.NONE,
                (conn, sender, path, iface, signal, params) => {
                    const [objectPath, interfaces] = params.deepUnpack();
                    this._onInterfacesAdded(objectPath, interfaces);
                }
            )
        );

        this._signalIds.push(
            Gio.DBus.system.signal_subscribe(
                BLUEZ_BUS_NAME,
                IFACE_OBJECT_MGR,
                'InterfacesRemoved',
                BLUEZ_ROOT_PATH,
                null,
                Gio.DBusSignalFlags.NONE,
                (conn, sender, path, iface, signal, params) => {
                    const [objectPath, removedIfaces] = params.deepUnpack();
                    this._onInterfacesRemoved(objectPath, removedIfaces);
                }
            )
        );

        this._signalIds.push(
            Gio.DBus.system.signal_subscribe(
                BLUEZ_BUS_NAME,
                IFACE_PROPERTIES,
                'PropertiesChanged',
                null,
                null,
                Gio.DBusSignalFlags.NONE,
                (conn, sender, objectPath, iface, signal, params) => {
                    const [changedIface, changedProps] = params.deepUnpack();
                    this._onPropertiesChanged(objectPath, changedIface, changedProps);
                }
            )
        );
    }

    _onInterfacesAdded(objectPath, interfaces) {
        const device1  = interfaces[IFACE_DEVICE1];
        const battery1 = interfaces[IFACE_BATTERY1];

        if (device1) {
            const connected = device1['Connected']?.deepUnpack() ?? false;
            if (connected) {
                const existing = this._devices.get(objectPath) ?? {};
                const name     = device1['Name']?.deepUnpack() ?? objectPath;
                const icon     = device1['Icon']?.deepUnpack() ?? null;
                const battery  = battery1
                    ? (battery1['Percentage']?.deepUnpack() ?? null)
                    : (existing.battery ?? null);
                this._devices.set(objectPath, {name, icon, battery, connected: true});
                this._scheduleRebuild();
            }
            return;
        }

        if (battery1) {
            const device = this._devices.get(objectPath);
            if (device) {
                device.battery = battery1['Percentage']?.deepUnpack() ?? null;
                this._scheduleRebuild();
            }
        }
    }

    _onInterfacesRemoved(objectPath, removedIfaces) {
        if (removedIfaces.includes(IFACE_DEVICE1)) {
            this._devices.delete(objectPath);
            this._scheduleRebuild();
            return;
        }

        if (removedIfaces.includes(IFACE_BATTERY1)) {
            const device = this._devices.get(objectPath);
            if (device) {
                device.battery = null;
                this._scheduleRebuild();
            }
        }
    }

    _onPropertiesChanged(objectPath, changedIface, changedProps) {
        if (changedIface === IFACE_DEVICE1) {
            const connectedVariant = changedProps['Connected'];
            if (connectedVariant === undefined)
                return;

            const connected = connectedVariant.deepUnpack();

            if (connected) {
                this._loadAllDevices();
            } else {
                this._devices.delete(objectPath);
                this._scheduleRebuild();
            }
            return;
        }

        if (changedIface === IFACE_BATTERY1) {
            const pctVariant = changedProps['Percentage'];
            if (pctVariant === undefined)
                return;

            const device = this._devices.get(objectPath);
            if (device) {
                device.battery = pctVariant.deepUnpack();
                this._scheduleRebuild();
            }
        }
    }

    _scheduleRebuild() {
        if (this._debounceId !== null)
            return;
        this._debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_MS, () => {
            this._debounceId = null;
            this._rebuildMenu();
            return GLib.SOURCE_REMOVE;
        });
    }

    // ── Cleanup ───────────────────────────────────────────────────────────

    destroy() {
        if (this._debounceId !== null) {
            GLib.source_remove(this._debounceId);
            this._debounceId = null;
        }

        for (const id of this._signalIds)
            Gio.DBus.system.signal_unsubscribe(id);
        this._signalIds = [];

        if (this._settingsChangedId !== null && this._settings) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        this._devices.clear();
        this._objectManagerProxy = null;

        super.destroy();
    }
});

// ─── Extension Entry Point ────────────────────────────────────────────────────

let _indicator = null;

function init() {}

function enable() {
    _indicator = new BluetoothBatteryIndicator();
    Main.panel.addToStatusArea('bluetooth-battery-indicator', _indicator);
    log('[BT Battery] Extension enabled');
}

function disable() {
    if (_indicator !== null) {
        _indicator.destroy();
        _indicator = null;
    }
    log('[BT Battery] Extension disabled');
}
