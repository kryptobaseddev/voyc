/**
 * @task T015
 * @epic T001
 * @why Simple working Voyc main
 * @what Minimal but functional GTK4 app
 */

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio?version=2.0';
import GLib from 'gi://GLib?version=2.0';
import GObject from 'gi://GObject?version=2.0';

const APP_ID = 'com.voyc.app';

class VoycApp extends Adw.Application {
  static {
    GObject.registerClass({ GTypeName: 'VoycApp' }, VoycApp);
  }

  constructor() {
    super({ application_id: APP_ID, flags: Gio.ApplicationFlags.FLAGS_NONE });
    print('Voyc constructor');
  }

  vfunc_activate(): void {
    print('Voyc activate called');
    
    const window = new Adw.ApplicationWindow({
      application: this,
      title: 'Voyc',
      default_width: 400,
      default_height: 300,
    });

    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 20,
      margin_top: 40,
      margin_bottom: 40,
      margin_start: 40,
      margin_end: 40,
    });

    const label = new Gtk.Label({
      label: 'Voyc Voice Dictation',
      css_classes: ['title-1'],
    });
    box.append(label);

    const btn = new Gtk.Button({
      label: 'Click Me',
      css_classes: ['suggested-action'],
    });
    btn.connect('clicked', () => {
      print('Button clicked!');
    });
    box.append(btn);

    window.set_content(box);
    
    print('Showing window...');
    window.present();
    print('Window presented');
  }
}

print('Starting Voyc...');
const app = new VoycApp();
const exitCode = (app as any).run([]);
print('Exit code: ' + exitCode);
