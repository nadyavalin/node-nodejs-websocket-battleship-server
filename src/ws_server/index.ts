import { WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { handleConnection } from './connection';

export function startWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`WebSocket server is running on port ${port}`);
    logger.log(
      'server',
      { event: `WebSocket server started on port ${port}` },
      { status: 'success' }
    );
  });

  wss.on('connection', (ws) => {
    handleConnection(wss, ws);
  });

  wss.on('close', () => {
    logger.log('server', { event: 'WebSocket server closed' }, { status: 'success' });
  });

  process.once('SIGINT', () => {
    console.log('Closing WebSocket server...');
    wss.close(() => process.exit(0));
  });

  process.once('SIGTERM', () => {
    console.log('Closing WebSocket server...');
    wss.close(() => process.exit(0));
  });

  return wss;
}
