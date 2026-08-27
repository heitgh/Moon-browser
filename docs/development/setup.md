# Development setup

Requirements: Node.js 22+, npm 10+, Git, Python, a C/C++ toolchain, and build tools required by Electron and `better-sqlite3`.

On Arch Linux:

```bash
sudo pacman -S --needed base-devel git python
node --version
npm --version
npm install
npm run typecheck
npm run dev:desktop
```

Install only one Node.js provider. If Node is missing, use `sudo pacman -S nodejs-lts-jod npm`; do not replace `nodejs-lts-jod` with `nodejs` when another installed application depends on the LTS package.

Build installable Linux packages with `npm run build:desktop`. The AppImage and Debian package are written to `release/`.

Copy `.env.example` to `.env` and never commit secrets. The development database defaults to `database/moon.db`.
