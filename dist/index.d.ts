interface ConfigFlags {
    debug: boolean;
    log: boolean;
    info: boolean;
    warn: boolean;
    error: boolean;
}
interface Writer {
    (...args: any[]): any;
    debug: Function;
    log: Function;
    info: Function;
    warn: Function;
    error: Function;
}
export declare function createClog(ns: any, config?: boolean | ConfigFlags, writer?: Writer, filter?: Function): Writer;
export declare namespace createClog {
    var CONFIG: {
        debug: boolean;
        log: boolean;
        info: boolean;
        warn: boolean;
        error: boolean;
        MASTER: any;
        WRITER: any;
        none: () => any & ConfigFlags;
        all: () => any & ConfigFlags;
        reset: () => void;
    };
}
export declare const clogFilterStringifier: (args: any) => any;
export declare const createClogStr: (ns: any, config?: boolean | ConfigFlags, writer?: Writer) => Writer;
export {};
