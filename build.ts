import { task, exec, build } from './index';

task('default',
    () => exec('tsc --project ./tsconfig.build.json'),
    { inputs: ['./index.ts', './tsconfig.build.json'] }
);

build();