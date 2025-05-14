import { WebSocket, WebSocketServer } from 'ws';
import { WebSocketResponseGeneric, GenericResult } from '../../utils/types';
import { logger } from '../../utils/logger';
import { handleReg } from './reg';
import { handleCreateRoom } from './createRoom';
import { handleAddUserToRoom } from './addUserToRoom';
import { handleAddShips } from './addShips';
import { handleAttack } from './attack';
import { handleError } from './handleError';

export function handleMessage(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  message: string
) {
  try {
    const parsedMessage = JSON.parse(message);

    switch (parsedMessage.type) {
      case 'reg':
        handleReg(wss, ws, parsedMessage);
        break;
      case 'create_room':
        handleCreateRoom(wss, ws, parsedMessage);
        break;
      case 'add_user_to_room':
        handleAddUserToRoom(wss, ws, parsedMessage);
        break;
      case 'add_ships':
        handleAddShips(wss, ws, parsedMessage);
        break;
      case 'attack':
        handleAttack(wss, ws, parsedMessage);
        break;
      default:
        const errorResponse: WebSocketResponseGeneric<GenericResult> = {
          type: 'error',
          data: {
            error: true,
            errorText: 'Unknown command',
          },
          id: parsedMessage.id,
        };
        ws.send(JSON.stringify(errorResponse));
        logger.log('error', { message: message.toString() }, errorResponse);
    }
  } catch {
    handleError(ws, message);
  }
}
