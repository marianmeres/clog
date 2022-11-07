export declare class ClogConfig {
    static log: boolean;
    static warn: boolean;
    static error: boolean;
    static none(): void;
    static all(): void;
}
interface ClogWriter {
    log: Function;
    warn: Function;
    error: Function;
}
export declare const createClog: (ns: any, config?: any, writer?: ClogWriter) => {
    (...args: any[]): any;
    warn(...args: any[]): any;
    error(...args: any[]): any;
    log: any;
};
export {};
