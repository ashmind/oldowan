
import { Gaze } from 'gaze';
import path from 'path';
import type { Watchable } from './task';

const logWatch = (name: string) => console.log(`task ${name} watching...`);

function watchDefault(task: Watchable, inputs: ReadonlyArray<string>) {
    const { name, run } = task;

    let running = false;
    let queued = false;
    const gaze = new Gaze(inputs as string[], { debounceDelay: 500 }) as Gaze & {
        // seems to be missing from Gaze types
        on(type: 'all', callback: (event: string, fullPath: string) => void): void;
        on(type: 'error', callback: (e: unknown) => void): void;
    };
    gaze.on('all', async (event, fullPath) => {
        console.log(`task ${name} detected:`);
        console.log(`  [${event}] ${path.relative(process.cwd(), fullPath)}`);
        if (running || queued) {
            console.log(`task ${name} queued...`);
            queued = true;
            return;
        }

        do {
            running = true;
            queued = false;
            try {
                await Promise.resolve(run());
            }
            catch (e) {
                console.error(e);
            }
            finally {
                running = false;
            }
        } while (queued);
    });
    gaze.on('error', e => {
        console.error(`task watch error: ${e}`);
        process.exit(1);
    });
    logWatch(name);
}

function watchCustom(task: Watchable, watch: () => void|Promise<any>) {
    // non-blocking
    (async () => {
        while (true) {
            const startTime = new Date();
            try {
                await Promise.resolve(watch());
            }
            catch (e) {
                console.error(`task ${task.name} watch process failed:`);
                console.error(e);
                const duration = (new Date()).getTime() - startTime.getTime();
                if (duration < 5000) {
                    // failed in less than 5 sec, restarting might be dangerous if it will keep failing quickly
                    console.error(`task ${task.name} watch process failed within 5 sec, shutting down...`);
                    process.exit(1);
                }
                console.log(`task ${task.name} restarting watch...`);
            }
        }
    })();
    logWatch(task.name);
}

export function makeWatch(task: Watchable, watch: ReadonlyArray<string>|(() => void|Promise<any>)|undefined) {
    if (!watch)
        return null;

    if (!(watch instanceof Array)) {
        if (typeof watch !== 'function')
            throw new Error(`Cannot use watch ${watch} of task ${task.name} as it is neither array or function.`);

        return () => watchCustom(task, watch);
    }

    return () => watchDefault(task, watch);
}