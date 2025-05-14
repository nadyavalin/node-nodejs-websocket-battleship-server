import { WebSocket } from 'ws';
import { logger } from '../../utils/logger';
import { WebSocketResponseGeneric, GenericResult } from '../../utils/types';

export function handleError(ws: WebSocket & { playerIndex: string | null }, message: string) {
  const errorResponse: WebSocketResponseGeneric<GenericResult> = {
    type: 'error',
    data: {
      error: true,
      errorText: 'Invalid JSON or command',
    },
    id: 0,
  };
  ws.send(JSON.stringify(errorResponse));
  logger.log('error', { message: message.toString() }, errorResponse);
}
