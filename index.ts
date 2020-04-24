import path from 'path';
import execa from 'execa';
import { Gaze } from 'gaze';

function formatDuration([seconds, nanoseconds]: [number, number]) {
    if (seconds === 0) {
        if (nanoseconds > 1000000)
            return Math.round(nanoseconds / 1000000) + 'ms';
        if (nanoseconds > 1000)
            return Math.round(nanoseconds / 1000) + 'us';
        return nanoseconds + 'ns';
    }

    if (seconds < 60)
        return `${seconds}.${Math.round(nanoseconds / 10000000)}s`;

    return `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}

type TaskFunction = () => Promise<void>;

interface Task {
    name: string;
    run: TaskFunction;
    ranAtLeastOnce?: boolean;
    watch: () => void;
    inputs?: ReadonlyArray<string>;
    watching?: boolean;
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

function watchTask(task: Task) {
    const { name, inputs, run } = task;
    if (!inputs)
        throw new Error(`Task ${name} has no inputs and cannot be watched.`);

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
    console.log(`task ${name} watching...`);
}

const tasks = {} as {
    [name: string]: Task;
};

function watchAll() {
    let watchingAtLeastOne = false;
    for (const task of Object.values(tasks)) {
        if (!task.ranAtLeastOnce)
            continue;
        if (task.watching || !task.inputs)
            continue;
        task.watch();
        task.watching = true;
        watchingAtLeastOne = true;
    }
    if (!watchingAtLeastOne) {
        console.error('No tasks have specified any inputs -- nothing to watch.');
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
    body: () => void|Promise<void>,
    options: { inputs?: ReadonlyArray<string> } = {}
): TaskFunction {
    const task = { name, inputs: options.inputs } as Partial<Task>;

    task.run = (async (...args: never[]) => {
        if (args.length > 0)
            processTaskError(new Error(`Tasks do not support arguments (provided: ${args})`), name);
        console.log(`task ${name} starting...`);
        const startTime = process.hrtime();
        try {
            await Promise.resolve(body());
        }
        catch(e) {
            processTaskError(e, name);
        }
        const duration = process.hrtime(startTime);
        console.log(`task ${name} completed [${formatDuration(duration)}]`);
        task.ranAtLeastOnce = true;
    }) as TaskFunction;

    task.watch = () => watchTask(task as Task);

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