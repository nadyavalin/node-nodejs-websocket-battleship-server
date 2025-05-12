import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';

export function startWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`WebSocket server is running on port ${port}`);
  });

  wss.on('connection', (ws: WebSocket) => {
    logger.log(
      'connection',
      { event: 'Client connected' },
      { status: 'success' }
    );

    ws.on('message', (message: string) => {
      try {
        const parsedMessage = JSON.parse(message);
        logger.log(parsedMessage.type, parsedMessage.data, {
          status: 'received',
        });

        const response = {
          type: parsedMessage.type,
          data: { message: `Received ${parsedMessage.type}` },
          id: 0,
        };
        ws.send(JSON.stringify(response));
        logger.log(parsedMessage.type, parsedMessage.data, response);
      } catch (error) {
        const errorResponse = {
          type: 'error',
          data: { error: true, errorText: 'Invalid JSON or command' },
          id: 0,
        };
        ws.send(JSON.stringify(errorResponse));
        logger.log('error', { message: error }, errorResponse);
      }
    });

    ws.on('close', () => {
      logger.log(
        'connection',
        { event: 'Client disconnected' },
        { status: 'success' }
      );
    });

    ws.on('error', (error) => {
      logger.log(
        'error',
        { event: 'WebSocket error' },
        { error: error.message }
      );
    });
  });

  wss.on('close', () => {
    logger.log(
      'server',
      { event: 'WebSocket server closed' },
      { status: 'success' }
    );
  });

  return wss;
}
