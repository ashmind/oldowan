import execa from 'execa';
import type { Task, TaskFunction } from './task';
import { makeWatch } from './watch';

const nanosecondsIn1Millisecond = 1000000;

function formatDuration([seconds, nanoseconds]: readonly [number, number]) {
    if (seconds === 0) {
        if (nanoseconds > nanosecondsIn1Millisecond)
            return Math.round(nanoseconds / nanosecondsIn1Millisecond) + 'ms';
        if (nanoseconds > 1000)
            return Math.round(nanoseconds / 1000) + 'us';
        return nanoseconds + 'ns';
    }

    if (seconds < 60) {
        const milliseconds = Math.round(nanoseconds / nanosecondsIn1Millisecond);
        return milliseconds > 0 ? `${seconds}.${milliseconds}s` : `${seconds}s`;
    }

    return `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}

interface TaskError extends Error {
    fromTask: string;
}

function processTaskError(e: Readonly<Error|TaskError>, taskName: string) {
    if ('fromTask' in e) {
        console.error(`task ${taskName} failed: task ${e.fromTask} failed`);
    }
    else {
        console.error(`task ${taskName} failed:`);
        console.error(e);
    }
    const error = new Error() as TaskError;
    error.fromTask = taskName;
    throw error;
}

const tasks = {} as {
    [name: string]: Task;
};

function watchAll() {
    let watchingAtLeastOne = false;
    for (const task of Object.values(tasks)) {
        if (!task.ranAtLeastOnce)
            continue;
        if (!task.watch || task.watching)
            continue;
        task.watch();
        task.watching = true;
        watchingAtLeastOne = true;
    }
    if (!watchingAtLeastOne) {
        console.error('No tasks have a watch options -- nothing to watch.');
        process.exit(1);
    }
}

export async function exec(command: string): Promise<void> {
    await execa.command(command, {
        preferLocal: true,
        stdout: process.stdout,
        stderr: process.stderr
    });
}

export { TaskFunction };

export function task(
    name: string,
    body: () => void|Promise<any>,
    options: {
        timeout?: number,
        watch?: (ReadonlyArray<string>|(() => void|Promise<any>))
    } = {}
): TaskFunction {
    const { timeout = 10 * 60 * 1000, watch } = options;
    const task = { name } as Partial<Task>;

    task.run = (async (...args: never[]) => {
        if (args.length > 0)
            processTaskError(new Error(`Tasks do not support arguments (provided: ${args})`), name);
        console.log(`task ${name} starting...`);
        const startTime = process.hrtime();
        const timer = timeout ? setTimeout(() => {
            const timeoutAsHRTime = [Math.floor(timeout / 1000), (timeout % 1000) * nanosecondsIn1Millisecond] as const;
            console.error(`task ${name} did not complete within ${formatDuration(timeoutAsHRTime)}, shutting down...`);
            process.exit(1);
        }, timeout) : null;
        try {
            await Promise.resolve(body());
            if (timer)
                clearTimeout(timer);
        }
        catch(e) {
            if (timer)
                clearTimeout(timer);
            processTaskError(e, name);
        }
        const duration = process.hrtime(startTime);
        console.log(`task ${name} completed [${formatDuration(duration)}]`);
        task.ranAtLeastOnce = true;
    }) as TaskFunction;

    task.watch = makeWatch(task as Task, watch);

    tasks[name] = task as Task;
    return task.run;
}

export async function build() {
    let args = process.argv.slice(2); // node x.js ...
    let shouldWatch = false;
    if (args.includes('--watch')) {
        shouldWatch = true;
        args = args.filter(a => a !== '--watch');
    }
    const taskName = args[0] || 'default';

    const task = tasks[taskName];
    if (!task) {
        console.error(`Unknown task: ${taskName}`);
        console.error(`Registered tasks:\r\n  ${Object.keys(tasks).join('\r\n  ')}`);
        process.exit(1);
    }

    try {
        await task.run();
    }
    catch (e) {
        if (!e.fromTask)
            console.error(e);
        process.exit(1);
    }

    if (shouldWatch) {
        watchAll();
        return; // not exiting the process, watching
    }

    process.exit(0);
}