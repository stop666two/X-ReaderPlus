#!/bin/bash
# Build macOS .app bundle and .dmg
set -e

APP_NAME="X-ReaderPlus"
BINARY="$1"
ARCH="$2"

if [ -z "$BINARY" ] || [ -z "$ARCH" ]; then
  echo "Usage: $0 <binary-path> <arch>"
  exit 1
fi

BUNDLE="${APP_NAME}.app"
DMG_OUT="dist/${APP_NAME}-mac-${ARCH}.dmg"

rm -rf "${BUNDLE}"

mkdir -p "${BUNDLE}/Contents/MacOS"
mkdir -p "${BUNDLE}/Contents/Resources"

cp "$BINARY" "${BUNDLE}/Contents/MacOS/${APP_NAME}"
chmod +x "${BUNDLE}/Contents/MacOS/${APP_NAME}"

cat > "${BUNDLE}/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>X-ReaderPlus</string>
	<key>CFBundleDisplayName</key>
	<string>X-ReaderPlus</string>
	<key>CFBundleIdentifier</key>
	<string>com.stop666.x-reader-plus</string>
	<key>CFBundleVersion</key>
	<string>0.3.0</string>
	<key>CFBundleShortVersionString</key>
	<string>0.3.0</string>
	<key>CFBundleExecutable</key>
	<string>X-ReaderPlus</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>LSMinimumSystemVersion</key>
	<string>11.0</string>
	<key>LSApplicationCategoryType</key>
	<string>public.app-category.books</string>
	<key>NSHighResolutionCapable</key>
	<true/>
	<key>LSUIElement</key>
	<false/>
</dict>
</plist>
PLIST

if [ -f "public/icon.svg" ]; then
  ICONSET="${BUNDLE}/Contents/Resources/icon.iconset"
  mkdir -p "${ICONSET}"

  for size in 16 32 64 128 256 512; do
    if command -v rsvg-convert &>/dev/null; then
      rsvg-convert -w $size -h $size "public/icon.svg" -o "${ICONSET}/icon_${size}x${size}.png" 2>/dev/null || true
      rsvg-convert -w $((size*2)) -h $((size*2)) "public/icon.svg" -o "${ICONSET}/icon_${size}x${size}@2x.png" 2>/dev/null || true
    elif command -v convert &>/dev/null; then
      convert -background none -resize ${size}x${size} "public/icon.svg" "${ICONSET}/icon_${size}x${size}.png" 2>/dev/null || true
      convert -background none -resize $((size*2))x$((size*2)) "public/icon.svg" "${ICONSET}/icon_${size}x${size}@2x.png" 2>/dev/null || true
    elif command -v sips &>/dev/null && command -v qlmanage &>/dev/null; then
      qlmanage -t -s $size -o "${ICONSET}" "public/icon.svg" 2>/dev/null || true
    fi
  done

  if command -v iconutil &>/dev/null && ls "${ICONSET}"/icon_*.png &>/dev/null 2>&1; then
    iconutil -c icns "${ICONSET}" -o "${BUNDLE}/Contents/Resources/icon.icns" 2>/dev/null || true
  fi
  rm -rf "${ICONSET}"
fi

rm -f "${DMG_OUT}"
hdiutil create -volname "${APP_NAME}" -srcfolder "${BUNDLE}" -ov -format UDZO "${DMG_OUT}"

echo "Created ${DMG_OUT}"
ls -lh "${DMG_OUT}"
