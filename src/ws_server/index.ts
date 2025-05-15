import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { handleReg } from './handlers/reg';
import { handleCreateRoom } from './handlers/createRoom';
import { handleAddUserToRoom } from './handlers/addUserToRoom';
import { handleAddShips } from './handlers/addShips';
import { handleAttack } from './handlers/attack';
import { handleRandomAttack } from './handlers/randomAttack';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  CreateRoomMessage,
  AddUserToRoomMessage,
  AddShipsMessage,
  AttackMessage,
  RandomAttackMessage,
  GenericResult,
  RegMessage,
} from '../utils/types';

export function startWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`WebSocket server is running on port ${port}`);
  });

  wss.on('connection', (ws: WebSocket & { playerIndex: string | null }) => {
    ws.playerIndex = null;
    logger.log('connection', { event: 'Client connected' }, { status: 'success' });

    ws.on('message', (message: string) => {
      try {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === 'reg') {
          handleReg(wss, ws, parsedMessage as WebSocketResponseGeneric<string | RegMessage>);
          return;
        }

        if (parsedMessage.type === 'create_room') {
          handleCreateRoom(wss, ws, parsedMessage as WebSocketResponseGeneric<CreateRoomMessage>);
          return;
        }

        if (parsedMessage.type === 'add_user_to_room') {
          handleAddUserToRoom(
            wss,
            ws,
            parsedMessage as WebSocketResponseGeneric<AddUserToRoomMessage>
          );
          return;
        }

        if (parsedMessage.type === 'add_ships') {
          handleAddShips(wss, ws, parsedMessage as WebSocketResponseGeneric<AddShipsMessage>);
          return;
        }

        if (parsedMessage.type === 'attack') {
          handleAttack(wss, ws, parsedMessage as WebSocketResponseGeneric<AttackMessage>);
          return;
        }

        if (parsedMessage.type === 'randomAttack') {
          handleRandomAttack(
            wss,
            ws,
            parsedMessage as WebSocketResponseGeneric<RandomAttackMessage>
          );
          return;
        }

        const errorResponse: WebSocketResponse = {
          type: 'error',
          data: JSON.stringify({
            error: true,
            errorText: 'Unknown command',
          } as GenericResult),
          id: parsedMessage.id,
        };
        ws.send(JSON.stringify(errorResponse));
        logger.log('error', { message: message.toString() }, JSON.parse(errorResponse.data));
      } catch {
        const errorResponse: WebSocketResponse = {
          type: 'error',
          data: JSON.stringify({
            error: true,
            errorText: 'Invalid JSON or command',
          } as GenericResult),
          id: 0,
        };
        ws.send(JSON.stringify(errorResponse));
        logger.log('error', { message: message.toString() }, JSON.parse(errorResponse.data));
      }
    });

    ws.on('close', () => {
      logger.log('connection', { event: 'Client disconnected' }, { status: 'success' });
    });

    ws.on('error', (error) => {
      logger.log('error', { event: 'WebSocket error' }, { error: error.message });
    });
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
