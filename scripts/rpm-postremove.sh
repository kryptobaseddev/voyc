#!/bin/bash
# RPM post-remove scriptlet for Voyc
# Updates GTK icon cache after uninstallation
# Only runs on full uninstall ($1 -eq 0), not upgrade

if [ $1 -eq 0 ]; then
  touch --no-create /usr/share/icons/hicolor &>/dev/null || :
  gtk-update-icon-cache /usr/share/icons/hicolor &>/dev/null || :
fi
