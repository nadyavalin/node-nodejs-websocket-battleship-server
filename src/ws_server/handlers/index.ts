import { WebSocket, WebSocketServer } from 'ws';
import { WebSocketResponse, GenericResult } from '../../utils/types';
import { logger } from '../../utils/logger';
import { handleReg } from './reg';
import { handleCreateRoom } from './createRoom';
import { handleAddUserToRoom } from './addUserToRoom';
import { handleAddShips } from './addShips';
import { handleAttack } from './attack';
import { handleRandomAttack } from './randomAttack';
import { handleSinglePlay } from './singlePlay';
import { handleError } from './handleError';

export function handleMessage(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  message: string
) {
  try {
    const parsedMessage = JSON.parse(message);
    let data = parsedMessage.data;

    if (typeof parsedMessage.data === 'string' && parsedMessage.data !== '') {
      data = JSON.parse(parsedMessage.data);
    }

    const messageWithParsedData = { ...parsedMessage, data };

    switch (parsedMessage.type) {
      case 'reg':
        handleReg(wss, ws, messageWithParsedData);
        break;
      case 'create_room':
        handleCreateRoom(wss, ws, messageWithParsedData);
        break;
      case 'add_user_to_room':
        handleAddUserToRoom(wss, ws, messageWithParsedData);
        break;
      case 'add_ships':
        handleAddShips(wss, ws, messageWithParsedData);
        break;
      case 'attack':
        handleAttack(wss, ws, messageWithParsedData);
        break;
      case 'randomAttack':
        handleRandomAttack(wss, ws, messageWithParsedData);
        break;
      case 'single_play':
        handleSinglePlay(wss, ws, messageWithParsedData);
        break;
      default:
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
    }
  } catch {
    handleError(ws, message);
  }
}
