import esbuild, { type BuildOptions, type Plugin } from 'esbuild';
import { clear } from './clear.js';
import { generateFxManifest } from './manifest.js';
import { generateTypes } from './types.js';
import { green, red, cyan, yellow } from 'kleur/colors';
import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import ora from 'ora';
import { createInterface } from 'readline';

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
    /** Whether to include web build (auto-detected if not specified) */
    includeWebBuild?: boolean;
    /** Spinner instance for output management */
    spinner?: any;
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
 * Checks if a web folder exists in the specified directory
 */
function hasWebFolder(cwd: string): boolean {
    const webPath = join(cwd, 'web');
    return existsSync(webPath);
}

/**
 * Spawns a web build process
 */
function spawnWebBuild(cwd: string, production: boolean, spinner?: any): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
        const webPath = join(cwd, 'web');
        const command = production ? 'npm run build' : 'npm run dev';
        
        let webSpinner: any = null;
        
        if (production) {
            webSpinner = ora('Building web...').start();
        } else {
            webSpinner = ora('Starting web development server...').start();
        }
        
        const childProcess = spawn(command, {
            cwd: webPath,
            shell: true,
            stdio: production ? ['inherit', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe']
        });

        if (production) {
            childProcess.stdout?.on('data', () => {
            });

            childProcess.stderr?.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    console.error(red(`[WEB ERROR] ${output}`));
                }
            });

            childProcess.on('error', (error) => {
                if (webSpinner) webSpinner.fail('Web build failed');
                console.error(red(`❌ Web build process error: ${error.message}`));
                reject(error);
            });

            childProcess.on('close', (code) => {
                if (code === 0) {
                    if (webSpinner) webSpinner.succeed(green('Web build completed successfully'));
                    resolve(childProcess);
                } else {
                    if (webSpinner) webSpinner.fail('Web build failed');
                    reject(new Error(`Web build process exited with code ${code}`));
                }
            });
        } else {
            childProcess.stdout?.on('data', (data) => {
                const output = data.toString().trim();
                if (output && output.includes('hmr update')) {
                    console.log(cyan(`[WEB] ${output}`));
                }
            });

            childProcess.stderr?.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    console.error(red(`[WEB ERROR] ${output}`));
                }
            });

            childProcess.on('error', (error) => {
                if (webSpinner) webSpinner.fail('Web development server failed to start');
                console.error(red(`❌ Web build process error: ${error.message}`));
                reject(error);
            });

            setTimeout(() => {
                if (webSpinner) {
                    webSpinner.stop();
                    console.log(green('✔ Web development server started at http://localhost:3000/'));
                }
                
                if (spinner) {
                    spinner.start('Building FiveM resources...');
                }
                
                resolve(childProcess);
            }, 2000);
        }
    });
}

/**
 * Spawns both web dev server and build --watch processes (development only)
 * and resolves once both are ready.
 */
function spawnWebProcesses(
    cwd: string,
    spinner?: any
): Promise<{ devProc: ChildProcess; buildProc: ChildProcess }> {
    return new Promise((resolve, reject) => {
        const webPath = join(cwd, 'web');

        const devProc = spawn('npm run dev', {
            cwd: webPath,
            shell: true,
            stdio: ['inherit', 'pipe', 'pipe']
        });

        const buildProc = spawn('npm run build -- --watch', {
            cwd: webPath,
            shell: true,
            stdio: ['inherit', 'pipe', 'pipe']
        });

        let devReady = false;
        let buildReady = false;

        const tryResolve = () => {
            if (devReady && buildReady) {
                resolve({ devProc, buildProc });
            }
        };

        if (devProc.stdout) {
            const rlDev = createInterface({ input: devProc.stdout });
            rlDev.on('line', (line: string) => {
                const lower = line.toLowerCase();
                if (!devReady) {
                    if (lower.includes('localhost')) {
                        devReady = true;
                        tryResolve();
                    }
                    return;
                }

                if (lower.includes('hmr')) {
                    console.log(cyan(`[WEB SERVER] ${line}`));
                }
            });
        }

        devProc.stderr?.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.error(red(`[WEB ERROR] ${output}`));
            }
        });

        devProc.on('error', (error) => {
            console.error(red(`❌ Web dev process error: ${error.message}`));
            reject(error);
        });

        devProc.on('exit', (code) => {
            if (!devReady) {
                reject(new Error(`Web dev process exited before ready (code ${code})`));
            }
        });

        if (buildProc.stdout) {
            const rlBuild = createInterface({ input: buildProc.stdout });
            rlBuild.on('line', (line: string) => {
                const lower = line.toLowerCase();
                if (!buildReady) {
                    if (lower.includes('built in')) {
                        buildReady = true;
                        tryResolve();
                    }
                    return;
                }

                if (lower.includes('built in')) {
                    console.log(green('[WEB BUILD] - Changes detected, files rebuilt'));
                }
            });
        }

        buildProc.stderr?.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.error(red(`[WEB ERROR] ${output}`));
            }
        });

        buildProc.on('error', (error) => {
            console.error(red(`❌ Web build error: ${error.message}`));
            reject(error);
        });

        buildProc.on('exit', (code) => {
            if (!buildReady) {
                reject(new Error(`Web build exited before ready (code ${code})`));
            }
        });
    });
}

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
        generateTypes: shouldGenerateTypes = true,
        includeWebBuild = hasWebFolder(cwd),
        spinner
    } = options;

    const srcPath = `${cwd}/${srcPathRelative}`;
    const distPath = `${cwd}/${distPathRelative}`;

    clear({ cwd, paths: [distPathRelative] });

    let webDevProcess: ChildProcess | null = null;
    let webWatchBuildProcess: ChildProcess | null = null;
    if (includeWebBuild) {
        try {
            if (production) {
                await spawnWebBuild(cwd, production, spinner);
            } else {
                const procs = await spawnWebProcesses(cwd, spinner);
                webDevProcess = procs.devProc;
                webWatchBuildProcess = procs.buildProc;
            }
        } catch (error) {
            console.error(red('❌ Failed to start web build process'));
            throw error;
        }
    }

    if (spinner) {
        spinner.start('Building FiveM resources...');
    }

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
                    const name = context.name.charAt(0).toUpperCase() + context.name.slice(1);
                    if (result.errors.length === 0) {
                        !production && console.log(green(`✔ ${name} ${status} successfully`));
                    } else {
                        throw new Error(red(`❌ ${name} ${status} with errors!`));
                    }
                    count++;

                    if (i + 1 >= contexts.length) {
                        if (generateManifest) {
                            generateFxManifest({ cwd, production }).catch(console.error);
                        }
                        if (!production) {
                            console.log(cyan('🕒 Watching for file changes...'));
                        }
                        if (production && shouldGenerateTypes) {
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

    if (!production) {
        const cleanup = () => {
            console.log(yellow('\n🔄 Shutting down build processes...'));
            if (webDevProcess && !webDevProcess.killed) {
                webDevProcess.kill('SIGTERM');
            }
            if (webWatchBuildProcess && !webWatchBuildProcess.killed) {
                webWatchBuildProcess.kill('SIGTERM');
            }
            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
    }
}
