# @tfxhub/builder

Build tool for FiveM TypeScript projects.

## What it does

This tool takes TypeScript files from your FiveM project and builds them for production:

- **Input**: Files from `src/client/`, `src/common/`, `src/server/`
- **Output**: Compiled JavaScript in `dist/client.js`, `dist/server.js`
- **Manifest**: Generates `fxmanifest.lua` from `fxmanifest.json`

## Installation

```bash
npm install --save-dev @tfxhub/builder
```

## Usage

```bash
# Build client and server files
tfxb build

# Build for production (no watch mode)
tfxb build --mode=production

# Clear generated files
tfxb clear

# Generate fxmanifest.lua only
tfxb manifest

# Generate TypeScript types
tfxb types
```

## License

MIT
