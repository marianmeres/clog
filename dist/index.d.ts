interface ConfigFlags {
    log: boolean;
    warn: boolean;
    error: boolean;
}
interface ClogWriter {
    log: Function;
    warn: Function;
    error: Function;
}
export declare class ClogConfig {
    static log: boolean;
    static warn: boolean;
    static error: boolean;
    static none(): void;
    static all(): void;
}
export declare const createClog: (ns: any, config?: boolean | ConfigFlags, writer?: ClogWriter) => {
    (...args: any[]): any;
    warn(...args: any[]): any;
    error(...args: any[]): any;
    log: any;
};
export {};
