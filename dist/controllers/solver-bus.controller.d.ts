import { SolverBusService } from '../services/solver-bus.service';
export declare class SolverBusController {
    private solverBus;
    constructor(solverBus: SolverBusService);
    status(): Promise<{
        enabled: boolean;
        connected: boolean;
        url: string;
        status: string;
    }>;
    reconnect(): Promise<{
        status: string;
        message: string;
    }>;
}
