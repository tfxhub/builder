#!/usr/bin/env node

import { build } from './build.js';
import { clear } from './clear.js';
import { generateFxManifest } from './manifest.js';
import { generateTypes } from './types.js';

const command = process.argv[2];
const isProduction = process.argv.includes('--mode=production');

async function main() {
    try {
        switch (command) {
            case 'build':
                await build({ production: isProduction });
                break;
            case 'clear':
                clear();
                break;
            case 'manifest':
                await generateFxManifest();
                break;
            case 'types':
                await generateTypes();
                break;
            default:
                console.log('Usage: tfxb <command> [options]');
                console.log('Commands:');
                console.log('  build     Build client and server files');
                console.log('  clear     Clear generated files');
                console.log('  manifest  Generate fxmanifest.lua');
                console.log('  types     Generate TypeScript types');
                console.log('');
                console.log('Build options:');
                console.log('  --mode=production    Build for production (no watch mode)');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
