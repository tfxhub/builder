import { rmSync } from 'fs';

/**
 * Options for the clear command
 */
export interface ClearOptions {
    /** Paths to clear (defaults to ['dist', 'types', 'fxmanifest.lua']) */
    paths?: string[];
    /** Working directory (defaults to process.cwd()) */
    cwd?: string;
}

/**
 * Clears generated files and directories
 */
export function clear(options: ClearOptions = {}): void {
    const { paths = ['dist', 'types', 'fxmanifest.lua'], cwd = process.cwd() } = options;

    for (const path of paths) {
        try {
            rmSync(`${cwd}/${path}`, { recursive: true, force: true });
        } catch (error) {
            // Ignore errors if path doesn't exist
        }
    }

    console.log('All generated files cleared.');
}
