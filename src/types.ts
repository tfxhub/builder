import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const exec = promisify(execCb);

/**
 * Options for the types generation
 */
export interface TypesOptions {
    /** Working directory (defaults to process.cwd()) */
    cwd?: string;
    /** Source directories to generate types for (relative to cwd/src) */
    sourceDirs?: string[];
}

/**
 * Generates TypeScript types for source directories
 */
export async function generateTypes(options: TypesOptions = {}): Promise<void> {
    const { cwd = process.cwd(), sourceDirs = ['server', 'client', 'common'] } = options;

    const promises = sourceDirs.map(dir => {
        const dirPath = join(cwd, 'src', dir);
        return exec(`cd ${dirPath} && tsc`);
    });

    await Promise.all(promises);
}
