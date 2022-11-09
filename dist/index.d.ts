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
export declare const createClog: {
    (ns: any, config?: boolean | ConfigFlags, writer?: Writer): Writer;
    CONFIG: {
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
};
export {};
