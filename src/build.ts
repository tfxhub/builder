import { exec as execCb } from 'child_process';
import esbuild, { type BuildOptions, type Plugin } from 'esbuild';
import { promisify } from 'util';
import { clear } from './clear.js';
import { generateFxManifest } from './manifest.js';
import { generateTypes } from './types.js';

const exec = promisify(execCb);

/**
 * Build context configuration for client or server
 */
export type ContextItem = {
    name: 'server' | 'client';
    buildOptions: BuildOptions;
};

/**
 * Options for the build process
 */
export interface BuildOptionsConfig {
    /** Working directory (defaults to process.cwd()) */
    cwd?: string;
    /** Source directory path (relative to cwd, defaults to 'src') */
    srcPath?: string;
    /** Distribution directory path (relative to cwd, defaults to 'dist') */
    distPath?: string;
    /** Whether to build in production mode */
    production?: boolean;
    /** Build contexts for different targets */
    contexts?: ContextItem[];
    /** Whether to generate manifest after build */
    generateManifest?: boolean;
    /** Whether to generate types after production build */
    generateTypes?: boolean;
}

/**
 * Default build contexts for FiveM resources
 */
export const defaultContexts: ContextItem[] = [
    {
        name: 'server',
        buildOptions: {
            platform: 'node',
            target: ['node22'],
            format: 'cjs',
        },
    },
    {
        name: 'client',
        buildOptions: {
            platform: 'browser',
            target: ['es2023'],
            format: 'iife',
        },
    },
];

/**
 * Builds the client and server files into production-ready JS files.
 */
export async function build(options: BuildOptionsConfig = {}): Promise<void> {
    const {
        cwd = process.cwd(),
        srcPath: srcPathRelative = 'src',
        distPath: distPathRelative = 'dist',
        production = false,
        contexts = defaultContexts,
        generateManifest = true,
        generateTypes: shouldGenerateTypes = true
    } = options;

    const srcPath = `${cwd}/${srcPathRelative}`;
    const distPath = `${cwd}/${distPathRelative}`;

    clear({ cwd, paths: [distPathRelative] });

    for (let i = 0; i < contexts.length; i++) {
        const context = contexts[i];
        const entryPath = `${srcPath}/${context.name}/index.ts`;
        const outputPath = `${distPath}/${context.name}.js`;

        const watchPlugin: Plugin = {
            name: 'watch-plugin',
            setup(buildApi) {
                let count = 0;
                buildApi.onEnd((result) => {
                    const status = count === 0 ? 'built' : 'rebuilt';
                    const message = result.errors.length === 0 ? `files ${status} successfully.` : `${status} failed.`;
                    console.log(`${context.name.charAt(0).toUpperCase() + context.name.slice(1)} ${message}`);
                    count++;

                    if (i + 1 >= contexts.length) {
                        if (generateManifest) {
                            generateFxManifest({ cwd }).catch(console.error);
                        }
                        if (!production) {
                            console.log('\nWatching for file changes...');
                        }
                        if (production && shouldGenerateTypes) {
                            console.log('\nGenerating types...\n');
                            generateTypes({ cwd });
                        }
                    }
                });
            },
        };

        const esbuildOptions: BuildOptions = {
            bundle: true,
            entryPoints: [entryPath],
            outfile: outputPath,
            keepNames: true,
            dropLabels: production ? ['DEV'] : undefined,
            legalComments: 'inline',
            ...context.buildOptions,
        } as BuildOptions;

        const ctx = await esbuild.context({ ...esbuildOptions, plugins: [watchPlugin] });
        await ctx.watch();

        if (production) await ctx.dispose();
    }
}
