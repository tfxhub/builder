#!/usr/bin/env node

import { build } from './build.js';
import { clear } from './clear.js';
import { generateFxManifest } from './manifest.js';
import { generateTypes } from './types.js';
import ora from 'ora';
import { green, yellow, red } from 'kleur/colors';
import prompts from 'prompts';

const command = process.argv[2];
const isProductionFlag =
    process.argv.includes('--production') ||
    process.argv.includes('-P');
const isInteractive = process.stdin.isTTY && !process.env.CI;

async function askInteractive() {
    const { cmd } = await prompts({
        type: 'select',
        name: 'cmd',
        message: 'What do you want to do?',
        choices: [
            { title: 'Build', value: 'build' },
            { title: 'Clear', value: 'clear' },
            { title: 'Generate fxmanifest.lua', value: 'manifest' },
            { title: 'Generate TypeScript types', value: 'types' },
        ],
        initial: 0,
    });

    if (!cmd) return { cmd: 'cancelled' } as const;

    if (cmd === 'build') {
        const { prod } = await prompts({
            type: 'toggle',
            name: 'prod',
            message: 'Build for production?',
            initial: isProductionFlag,
            active: 'yes',
            inactive: 'no',
        });
        return { cmd, prod: Boolean(prod) } as const;
    }

    if (cmd === 'clear') {
        const { confirm } = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: 'This will remove generated files. Continue?',
            initial: false,
        });
        if (!confirm) return { cmd: 'cancelled' } as const;
    }

    return { cmd } as const;
}

async function main() {
    try {
        let selected: { cmd: string | undefined; prod?: boolean } = { cmd: command, prod: isProductionFlag };

        if (!selected.cmd && isInteractive) {
            selected = await askInteractive();
        }

        switch (selected.cmd) {
            case 'build': {
                const spinner = ora('Building...').start();
                const successMessage = selected.prod || isProductionFlag ? 'FiveM resource files built succesfully' : 'Started development with watch mode';
                try {
                    await build({ 
                        production: Boolean(selected.prod || isProductionFlag),
                        spinner
                    });
                    spinner.succeed(green(successMessage));
                } catch (e) {
                    spinner.fail(red('Build failed'));
                    throw e;
                }
                break;
            }
            case 'clear': {
                const spinner = ora('Clearing generated files...').start();
                try {
                    clear();
                    spinner.succeed(green('All generated files cleared.'));
                } catch (e) {
                    spinner.fail(red('Clear failed'));
                    throw e;
                }
                break;
            }
            case 'manifest': {
                const spinner = ora('Generating fxmanifest.lua...').start();
                try {
                    await generateFxManifest({ production: isProductionFlag });
                    spinner.succeed(green('fxmanifest.lua generated'));
                } catch (e) {
                    spinner.fail(red('Manifest generation failed'));
                    throw e;
                }
                break;
            }
            case 'types': {
                const spinner = ora('Generating TypeScript types...').start();
                try {
                    await generateTypes();
                    spinner.succeed(green('TypeScript types generated.'));
                } catch (e) {
                    spinner.fail(red('Types generation failed'));
                    throw e;
                }
                break;
            }
            case 'cancelled':
                console.log(yellow('Cancelled'));
                process.exit(0);
            default:
                console.log('Usage: tfxb <command> [options]');
                console.log('Commands:');
                console.log('  build     Build client and server files');
                console.log('  clear     Clear generated files');
                console.log('  manifest  Generate fxmanifest.lua');
                console.log('  types     Generate TypeScript types');
                console.log('');
                console.log('Build options:');
                console.log('  --production, -P     Build for production (no watch mode)');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
