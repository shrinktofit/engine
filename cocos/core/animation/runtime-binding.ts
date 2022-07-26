import { AnimationOutput } from './animation-output-context';

export interface RuntimeBinding<T = any> {
    setValue(value: T): void;

    getValue?(out?: T): T;
}

export interface RuntimeBindingX<T> {
    setValue(value: T, output: AnimationOutput): void;

    getValue?(out?: T): T;
}
