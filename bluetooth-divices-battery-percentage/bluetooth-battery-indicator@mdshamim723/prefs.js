'use strict';

const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;

const ExtensionUtils = imports.misc.extensionUtils;

function init() {}

function buildPrefsWidget() {
    const settings = ExtensionUtils.getSettings();

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 20,
        margin_bottom: 20,
        margin_start: 20,
        margin_end: 20,
        spacing: 12,
    });

    const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 20,
    });

    const label = new Gtk.Label({
        label: 'Show devices without battery info',
        xalign: 0,
        hexpand: true,
    });

    const toggle = new Gtk.Switch({
        valign: Gtk.Align.CENTER,
    });

    settings.bind(
        'show-unknown-battery',
        toggle,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );

    row.append(label);
    row.append(toggle);
    box.append(row);

    return box;
}
