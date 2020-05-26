import { task, exec, build } from './src/index';

task('default', () => exec('tsc --project ./tsconfig.build.json'), {
    watch: () => exec('tsc --project ./tsconfig.build.json --watch')
});

build();