#!/bin/bash
# RPM post-install scriptlet for Voyc
# Updates GTK icon cache after installation

touch --no-create /usr/share/icons/hicolor &>/dev/null || :
gtk-update-icon-cache /usr/share/icons/hicolor &>/dev/null || :
