import { Controller, Post, HttpCode, Get } from '@nestjs/common';
import { SolverBusService } from '../services/solver-bus.service';

@Controller('solver-bus')
export class SolverBusController {
  constructor(private solverBus: SolverBusService) {}

  /**
   * Get WebSocket connection status
   */
  @Get('status')
  @HttpCode(200)
  async status() {
    const status = this.solverBus.getStatus();
    return {
      status: 'ok',
      ...status,
    };
  }

  /**
   * Manually trigger WebSocket reconnection
   */
  @Post('reconnect')
  @HttpCode(200)
  async reconnect() {
    this.solverBus.reconnect();
    return {
      status: 'ok',
      message: 'WebSocket reconnection triggered',
    };
  }
}
