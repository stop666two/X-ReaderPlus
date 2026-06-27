#!/bin/bash
# Build Linux AppImage
set -e

APP_NAME="X-ReaderPlus"
BINARY="$1"
ARCH="$2"

if [ -z "$BINARY" ] || [ -z "$ARCH" ]; then
  echo "Usage: $0 <binary-path> <arch>"
  exit 1
fi

APPDIR="${APP_NAME}.AppDir"
APPIMAGE_OUT="dist/${APP_NAME}-linux-${ARCH}.AppImage"

rm -rf "${APPDIR}"

mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/256x256/apps"

cp "$BINARY" "${APPDIR}/usr/bin/x-reader-plus"
chmod +x "${APPDIR}/usr/bin/x-reader-plus"

cat > "${APPDIR}/AppRun" << 'APPRUN'
#!/bin/bash
HERE="$(dirname "$(readlink -f "$0")")"
exec "${HERE}/usr/bin/x-reader-plus" "$@"
APPRUN
chmod +x "${APPDIR}/AppRun"

cat > "${APPDIR}/${APP_NAME}.desktop" << DESKTOP
[Desktop Entry]
Type=Application
Name=${APP_NAME}
Comment=完全脱机的现代化多格式阅读器
Exec=x-reader-plus
Icon=${APP_NAME}
Categories=Office;Viewer;
Terminal=false
DESKTOP
cp "${APPDIR}/${APP_NAME}.desktop" "${APPDIR}/"

if [ -f "public/icon.svg" ] && command -v convert &>/dev/null 2>&1; then
  convert -background none -resize 256x256 "public/icon.svg" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/${APP_NAME}.png" 2>/dev/null || true
  cp "${APPDIR}/usr/share/icons/hicolor/256x256/apps/${APP_NAME}.png" "${APPDIR}/${APP_NAME}.png" 2>/dev/null || true
fi

APPIMAGETOOL="appimagetool-${ARCH}.AppImage"
if [ ! -f "$APPIMAGETOOL" ]; then
  curl -sSL "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-${ARCH}.AppImage" -o "$APPIMAGETOOL"
  chmod +x "$APPIMAGETOOL"
fi

ARCH="${ARCH}" ./"$APPIMAGETOOL" "${APPDIR}" "${APPIMAGE_OUT}"

rm -rf "${APPDIR}"
echo "Created ${APPIMAGE_OUT}"
ls -lh "${APPIMAGE_OUT}"
