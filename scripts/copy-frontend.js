const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, '..', 'dist')
const dest = path.join(__dirname, '..', 'backend', 'frontend')

if (!fs.existsSync(distDir)) {
  console.error(`ERROR: dist directory not found: ${distDir}`)
  console.error('Run "npx vite build" first')
  process.exit(1)
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true })
}

let copied = 0
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else if (
      !entry.name.endsWith('.exe') &&
      !entry.name.endsWith('.map')
    ) {
      fs.copyFileSync(srcPath, destPath)
      copied++
    }
  }
}

copyDir(distDir, dest)
fs.writeFileSync(path.join(dest, '.gitkeep'), '')

console.log(`Copied ${copied} files from ${distDir} -> ${dest}`)
