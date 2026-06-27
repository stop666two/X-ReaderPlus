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

cat > "${BUNDLE}/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>${APP_NAME}</string>
	<key>CFBundleDisplayName</key>
	<string>${APP_NAME}</string>
	<key>CFBundleIdentifier</key>
	<string>com.stop666.x-reader-plus</string>
	<key>CFBundleVersion</key>
	<string>0.3.0</string>
	<key>CFBundleShortVersionString</key>
	<string>0.3.0</string>
	<key>CFBundleExecutable</key>
	<string>${APP_NAME}</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>LSMinimumSystemVersion</key>
	<string>11.0</string>
	<key>LSApplicationCategoryType</key>
	<string>public.app-category.books</string>
	<key>NSHighResolutionCapable</key>
	<true/>
</dict>
</plist>
PLIST

if [ -f "public/icon.svg" ]; then
  if command -v convert &>/dev/null; then
    convert -background none -resize 128x128 "public/icon.svg" "${BUNDLE}/Contents/Resources/icon.icns" 2>/dev/null || true
  fi
fi

rm -f "${DMG_OUT}"
hdiutil create -volname "${APP_NAME}" -srcfolder "${BUNDLE}" -ov -format UDZO "${DMG_OUT}"

echo "Created ${DMG_OUT}"
ls -lh "${DMG_OUT}"
