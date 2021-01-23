export type FilterTypes<T extends { [key: string]: any }, U extends T[keyof T]> = {
    [key in keyof T as T[key] extends U ? key : never]: T[key];
};

export type Ordered<T extends { index: number }> = { [key in string]: T };

export type KeyFromOrderedIndex<T extends Ordered<any>, Index extends number> = keyof {
    [key in keyof T as T[key]["index"] extends Index ? key : never]: key
};

export type TupleFromOrdered<
    T extends Ordered<any>,
    SubKey extends keyof T[keyof T],
    R extends unknown[] = [],
    Key = KeyFromOrderedIndex<T, R['length']>,
    //@ts-ignore
    > = {} extends T ? R : TupleFromOrdered<Pick<T, Exclude<keyof T, Key>>, SubKey, [...R, T[Key][SubKey]]>;

export type TupleKeys<T extends readonly any[]> = keyof { [key in keyof T as key extends `${number}` ? number : never]: any }
type test_TupleKeys = TupleKeys<[number, number]>

namespace RandomTesting {
    type NumberExtractTest<T> = T extends `${infer K} and that` ? K : never;

    type FunctionExtract<T> = T extends `${infer ReturnType} ${infer Name}(${infer Arguments});` ? {
        return_type: ReturnType,
        name: Name,
        arguments: Arguments,
    } : "Error: Required form <return_type> <name>(<arguments>)";

    type test = FunctionExtract<"void main(char* args);">;

    type that = NumberExtractTest<"2 and this" | "123 and that">;
}

export namespace Scripting {
    export function length<T>(obj: T) {
        return Object.keys(obj).length;
    }
    export function get_keys<T>(obj: T): (keyof T)[] {
        return Object.keys(obj) as (keyof T)[];
    }
    export function reduce_keys<T, U>(obj: T, accum: <Key extends keyof T>(this: any, result: U, current_key: Key) => U): U {
        return get_keys(obj).reduce(accum, {} as U);
    }
    export function key_value_to_object<Key extends string | number, Value>(keys: readonly Key[], key_to_value: (key: Key) => Value) {
        return keys.
            map(key => [key, key_to_value(key)] as const).
            reduce<{ [key in Key]: Value }>((result, key_value) => ({
                ...result,
                [key_value[0]]: key_value[1],
            }), {} as { [key in Key]: Value })
    }
    export function transform_object<T, U extends { [key in keyof T]: unknown }>(
        obj: T,
        transform: <Key extends keyof T>(value: T[Key], key: Key) => U[keyof T]
    ) {
        return get_keys(obj).
            reduce((new_obj, key) => ({
                ...new_obj,
                [key]: transform(obj[key], key),
            }), {} as U);
    }
}