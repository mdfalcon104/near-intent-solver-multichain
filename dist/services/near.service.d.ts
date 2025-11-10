export declare class NearService {
    private account;
    init(): Promise<void>;
    executeIntent(method: string, args: any): Promise<any>;
    viewFunction(contractId: string, methodName: string, args: any): Promise<any>;
    functionCall(contractId: string, methodName: string, args: any, gas?: string, deposit?: string): Promise<any>;
}
