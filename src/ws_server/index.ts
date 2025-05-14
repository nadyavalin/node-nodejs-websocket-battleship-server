import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { handleConnection } from './connection';

export function startWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`WebSocket server is running on port ${port}`);
  });

  wss.on('connection', (ws: WebSocket & { playerIndex: string | null }) => {
    handleConnection(wss, ws);
  });

  wss.on('close', () => {
    logger.log('server', { event: 'WebSocket server closed' }, { status: 'success' });
  });

  process.once('SIGINT', () => {
    console.log('Closing WebSocket server...');
    logger.log('server', { event: 'WebSocket server closing' }, { status: 'success' });
    wss.close(() => {
      console.log('WebSocket server closed gracefully');
      setTimeout(() => process.exit(0), 100);
    });
  });

  process.once('SIGTERM', () => {
    console.log('Closing WebSocket server...');
    logger.log('server', { event: 'WebSocket server closing' }, { status: 'success' });
    wss.close(() => {
      console.log('WebSocket server closed gracefully');
      setTimeout(() => process.exit(0), 100);
    });
  });

  return wss;
}
