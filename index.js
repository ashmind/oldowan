'use strict';
const path = require('path');
const { Gaze } = require('gaze');

const tasks = {};
const internal = Symbol('task: internal state');

function formatDuration([seconds, nanoseconds]) {
    if (seconds === 0) {
        if (nanoseconds > 1000000)
            return Math.round(nanoseconds / 1000000) + 'ms';
        return nanoseconds + 'ns';
    }

    if (seconds < 60)
        return `${seconds}.${Math.round(nanoseconds / 10000000)}s`;

    return `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}

function taskError(e, taskName) {
    if (e.fromTask) {
        console.error(`task ${taskName} failed: task ${e.fromTask} failed`);
    }
    else {
        console.error(`task ${taskName} failed:`);
        console.error(e);
    }
    const error = new Error();
    error.fromTask = taskName;
    throw error;
}

function defineTask(name, body, { inputs } = {}) {
    const task = async (...args) => {
        if (args.length > 0)
            taskError(new Error(`Tasks do not support arguments (provided: ${args})`), name);
        await runTask(name, body);
        task[internal].ran = true;
    };
    task[internal] = { canWatch: !!inputs };
    task.watch = () => watchTask(name, task, { inputs });

    tasks[name] = task;
    return task;
}

async function runTask(name, body) {
    console.log(`task ${name} starting...`);
    const startTime = process.hrtime();
    try {
        await Promise.resolve(body());
    }
    catch(e) {
        taskError(e, name);
    }
    const duration = process.hrtime(startTime);
    console.log(`task ${name} completed [${formatDuration(duration)}]`);
}

function watchTask(name, task, { inputs }) {
    if (!inputs)
        throw new Error(`Task ${name} has no inputs and cannot be watched.`);

    let running = false;
    let queued = false;
    const gaze = new Gaze(inputs, { debounceDelay: 500 });
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
                await Promise.resolve(task());
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

async function run() {
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
        await task();
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

function watchAll() {
    let watching = false;
    for (const task of Object.values(tasks)) {
        if (!task[internal].ran)
            continue;
        if (task[internal].watching || !task[internal].canWatch)
            continue;
        task.watch();
        task[internal].watching = true;
        watching = true;
    }
    if (!watching) {
        console.error('No tasks have specified any inputs -- nothing to watch.');
        process.exit(1);
    }
}

module.exports = {
    task: defineTask,
    tasks,
    run
};