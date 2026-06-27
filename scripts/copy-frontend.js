const fs = require('fs')
const path = require('path')

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else if (!entry.name.endsWith('.exe')) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const distDir = path.join(__dirname, '..', 'dist')
const dest = path.join(__dirname, '..', 'backend', 'frontend')

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true })
}

copyDir(distDir, dest)
fs.writeFileSync(path.join(dest, '.gitkeep'), '')
console.log(`Copied ${distDir} -> ${dest}`)
