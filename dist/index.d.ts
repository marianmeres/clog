interface ConfigFlags {
    debug: boolean;
    log: boolean;
    info: boolean;
    warn: boolean;
    error: boolean;
}
interface Writer {
    debug: Function;
    log: Function;
    info: Function;
    warn: Function;
    error: Function;
}
export declare class ClogConfig {
    static debug: boolean;
    static log: boolean;
    static info: boolean;
    static warn: boolean;
    static error: boolean;
    static MASTER: any;
    static WRITER: Writer;
    static none(): void;
    static all(): void;
    static reset(): void;
}
export declare const createClog: (ns: any, config?: boolean | ConfigFlags, writer?: Writer) => Writer;
export {};
