import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { handleMessage } from './handlers';

export function handleConnection(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null }
) {
  let playerIndex: string | null = null;
  ws.playerIndex = playerIndex;

  logger.log('connection', { event: 'Client connected' }, { status: 'success' });

  ws.on('message', (message: string) => {
    handleMessage(wss, ws, message);
  });

  ws.on('close', () => {
    logger.log('connection', { event: 'Client disconnected' }, { status: 'success' });
  });

  ws.on('error', (error) => {
    logger.log('error', { event: 'WebSocket error' }, { error: error.message });
  });
}
