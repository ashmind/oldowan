# Overview

Oldowan is a primitive node.js build system.

It is designed to choose predictable complexity over simplicity which is often illusory.
It is hard to set up, and probably hard to maintain in large projects, but it never gets in your way.

Oldowan provides:
* task runner (async)
* watch system
* some error handling
* system exec helper
* and that's it

# Usage

In Oldowan, your build script is your build tool.
You don't need a global install — just do `node build.js`.

## Build file

```javascript
const { task, exec, build } = require('oldowan');

const js = task('js', async () => {
    // local, from node_modules (using execa)
    await exec('eslint . --max-warnings 0');
    await exec('tsc --project ./tsconfig.json');
}, { inputs: ['**/*.js'] }); // inputs are optional (used for --watch mode)

const less = task('less', async () => {
    // ...
});

task('default', () => Promise.all([less(), js()]));

build();
```

## CLI

```
node build.js [task] [--watch]

task      — task to run, `default` if not specified
--watch   — watch and rerun specified task if input files change
```

# Plugins

Oldowan does not support or encourage any plugins (such as `gulp-less`).

Over a period of using Gulp I noticed that:
1. Plugins tend to become outdated pretty quickly, and use obsolete versions of underlying tools
2. Plugins sometimes introduce new issues, e.g. lose source maps or break down when combined with other plugins
3. Plugins might be inefficient — I has performance issues with `gulp-less` that I didn't have with `less` itself
4. Some tools (e.g. Rollup) are hard to integrate using a plugin because underlying models do not match well
5. Some patterns (e.g. async) have to be supported by both underlying tool and the plugin

Instead, either run the tool you want to use directly, or use it programmatically.
It is cumbersome, but also more predictable, which is what the project is about.

# How do I …

## Read files, write files, copy files?

Not built in, use `fs`, or something like [`fs-jetpack`](https://www.npmjs.com/package/fs-jetpack).
Since tasks support `async`, I recommend using async versions of file APIs.

## Make tasks depend on each other

Call your dependency directly using `await yourothertask();` or `Promise.all` for parallelism.
Tasks required twice will be called twice, there is currently no de-duplication.

## Log something

`console.log()`

# Oldowan versus …

## npm scripts

Oldowan might be a good addition to `npm scripts` if you need a bit of cross-platform complexity.
Built-in `exec` helper should be enough for many scenarios.

## Gulp

Oldowan build file is probably going to be way larger than a Gulp build file.
However the flow is also clearer and easier to debug, and it's easier to avoid edge cases (e.g. with sourcemaps).

I've also noticed that Oldowan is faster in some flows, probably because of issues in specific plugins.

## Webpack

I don't use Webpack that much, so hard to judge, but if you have a big project, Webpack might be a better watcher.
You can use Oldowan to orchestrate Webpack with some other tools that it does not support directly.