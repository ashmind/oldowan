# Overview

Oldowan is a primitive node.js build system.

It is designed to choose predictable complexity over simplicity which is often illusory.  
It is hard to set up, and probably hard to maintain in large projects, but it never gets in your way.

Oldowan provides:
* task runner (async)
* watch system
* some error handling
* and that's it

# Usage

In Oldowan, your build script is your build tool.  
You don't need a global install — just do `node build.js`.

## Build file
```
const { task, tasks, run } = require('oldowan');

task('less', async () => {
    // directly call less to do less transforms  
}, { inputs: [...] }); // inputs are optional, and used for --watch mode

task('js', async () => {
    // directly call e.g. rollup to do js transforms  
});

task('default', async () => {
    await Promise.all([tasks.less(), tasks.js()]);
});

run();
```

## CLI

```
node build.js [taskname] [--watch]
```

`taskname` — if not specified, defaults to `default`
`--watch` — instructs Oldowan to watch and rerun tasks based on `inputs`

# Plugins

Oldowan does not support or encourange any plugins (such as `gulp-less`).
Over a period of using Gulp I noticed that:
1. Plugins tend to become oudated pretty quickly, and use obsolete versions of underlying tools
2. Plugins sometimes introduce new issues, e.g. lose source maps or break down when combined with other plugins
3. Plugins might be inefficient — I has performance issues with `gulp-less` that I didn't have with `less` itself
4. Some tools (e.g. Rollup) are hard to integrate using a plugin because underlying models do not match well
5. Some patterns (e.g. async) have to be supported by both underlying tool and the plugin

Instead, import the tool you want to use and use it directly.
this is cumbersome, but also more predictable, which is what the project is about.

# How do I …

## Read files, write files, copy files?

Not built in, use `fs`, or something like [`fs-jetpack`](https://www.npmjs.com/package/fs-jetpack).  
Since tasks support `async`, I recommend using async versions of file APIs.

## Make tasks depend on each other

Call your dependency directly using `await tasks.yourothertask();` or `Promise.all` for parallelism.
Tasks required twice will be called twice, there is currently no deduplication.

## Log something

`console.log()`

# Oldowan versus …

## npm scripts

Oldowan might be a good addition to `npm scripts` if you need a bit of cross-platform complexity.  
However Oldowan does not provide any helper for running shell apps — might be added, but not there yet.

## Gulp

Oldowan build file is probably going to be way larger than a Gulp build file.  
However the flow is also clearer and easier to debug, and it's easier to avoid edge cases (e.g. with sourcemaps).

I've also noticed that Oldowan is faster in some flows, probably because of issues in specific plugins.

## Webpack

I don't use Webpack that much, so hard to judge, but if you have a big project, Webpack might be a better watcher.  
Other than that, you can use Oldowan to orchestrate Webpack with some other tools that need to be applied before or after.