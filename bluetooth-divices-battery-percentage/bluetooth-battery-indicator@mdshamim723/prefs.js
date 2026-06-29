'use strict';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BluetoothBatteryPrefs extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Display'),
            description: _('Control what appears in the Bluetooth battery menu'),
        });
        page.add(group);

        // Toggle: show devices without battery info
        const row = new Adw.SwitchRow({
            title: _('Show devices without battery info'),
            subtitle: _('Connected devices that don\'t report battery will appear as "—"'),
        });
        group.add(row);

        settings.bind(
            'show-unknown-battery',
            row,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
}
