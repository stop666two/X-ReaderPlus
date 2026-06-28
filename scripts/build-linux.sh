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
Comment=Completely offline multi-format ebook reader
Exec=x-reader-plus
Icon=${APP_NAME}
Categories=Office;Viewer;
Terminal=false
DESKTOP
ICON_SRC="$(dirname "$0")/../public/icon.svg"
if [ -f "${ICON_SRC}" ]; then
  if command -v rsvg-convert &>/dev/null; then
    rsvg-convert -w 256 -h 256 "${ICON_SRC}" -o "${APPDIR}/${APP_NAME}.png" 2>/dev/null || true
  elif command -v convert &>/dev/null; then
    convert -background none -resize 256x256 "${ICON_SRC}" "${APPDIR}/${APP_NAME}.png" 2>/dev/null || true
  fi
  if [ -f "${APPDIR}/${APP_NAME}.png" ]; then
    cp "${APPDIR}/${APP_NAME}.png" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/${APP_NAME}.png" 2>/dev/null || true
  fi
fi

APPIMAGETOOL="appimagetool-${ARCH}.AppImage"
if [ ! -f "$APPIMAGETOOL" ]; then
  echo "Downloading appimagetool..."
  curl -fsSL --retry 3 --connect-timeout 30 \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-${ARCH}.AppImage" \
    -o "$APPIMAGETOOL" 2>/dev/null || true
  if [ ! -f "$APPIMAGETOOL" ] || [ ! -s "$APPIMAGETOOL" ]; then
    echo "appimagetool download failed, skipping AppImage"
    rm -rf "${APPDIR}"
    exit 1
  fi
  chmod +x "$APPIMAGETOOL"
fi

export APPIMAGE_EXTRACT_AND_RUN=1
ARCH="${ARCH}" ./"$APPIMAGETOOL" "${APPDIR}" "${APPIMAGE_OUT}" 2>/dev/null || {
  echo "appimagetool failed, skipping AppImage"
  rm -rf "${APPDIR}"
  exit 1
}

rm -rf "${APPDIR}"
echo "Created ${APPIMAGE_OUT}"
ls -lh "${APPIMAGE_OUT}"
