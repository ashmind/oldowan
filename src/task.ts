
export type TaskFunction = () => Promise<void>;

export interface Watchable {
    name: string;
    run: TaskFunction;
}

export interface Task extends Watchable {
    ranAtLeastOnce?: boolean;
    watch: (() => void)|null;
    watching?: boolean;
}