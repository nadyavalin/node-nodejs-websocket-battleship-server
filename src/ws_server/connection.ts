import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { handleReg } from './handlers/reg';
import { handleCreateRoom } from './handlers/createRoom';
import { handleAddUserToRoom } from './handlers/addUserToRoom';
import { handleAddShips } from './handlers/addShips';
import { handleAttack } from './handlers/attack';
import { handleRandomAttack } from './handlers/randomAttack';
import { handleSinglePlay } from './handlers/singlePlay';
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

interface ExtendedWebSocket extends WebSocket {
  playerIndex: string | null;
}

export function handleConnection(wss: WebSocketServer, ws: WebSocket) {
  const extendedWs: ExtendedWebSocket = ws as ExtendedWebSocket;
  extendedWs.playerIndex = null;

  logger.log('connection', { event: 'Client connected' }, { status: 'success' });

  ws.on('message', (message: string) => {
    try {
      logger.log(
        'raw_message_received',
        { message, messageLength: message.length },
        { status: 'debug' }
      );
      const parsedMessage = JSON.parse(message);

      logger.log(
        'raw_message',
        { message, type: parsedMessage.type, typeTrimmed: parsedMessage.type.trim() },
        { status: 'debug' }
      );

      let data = parsedMessage.data;

      const isDataRequired = !['create_room', 'single_play'].includes(parsedMessage.type.trim());
      if (isDataRequired) {
        if (typeof parsedMessage.data === 'string' && parsedMessage.data !== '') {
          try {
            data = JSON.parse(parsedMessage.data);
            logger.log(
              'data_parsed',
              { parsedData: data, rawData: parsedMessage.data },
              { status: 'debug' }
            );
          } catch (e) {
            logger.log(
              'error',
              { message: 'Failed to parse data', rawData: parsedMessage.data },
              { error: (e as Error).message }
            );
            throw e;
          }
        } else if (typeof parsedMessage.data === 'object' && parsedMessage.data !== null) {
          data = parsedMessage.data;
        } else {
          logger.log(
            'error',
            { message: 'Invalid data format', rawData: parsedMessage.data },
            { error: 'Data is not a string or object' }
          );
          throw new Error('Invalid data format');
        }
      } else {
        data = parsedMessage.data === '' ? {} : parsedMessage.data;
      }

      const messageWithParsedData = { ...parsedMessage, data };

      switch (parsedMessage.type.trim()) {
        case 'reg':
          handleReg(wss, extendedWs, messageWithParsedData as WebSocketResponseGeneric<RegMessage>);
          break;
        case 'create_room':
          handleCreateRoom(
            wss,
            extendedWs,
            messageWithParsedData as WebSocketResponseGeneric<CreateRoomMessage>
          );
          break;
        case 'add_user_to_room':
          handleAddUserToRoom(
            wss,
            extendedWs,
            messageWithParsedData as WebSocketResponseGeneric<AddUserToRoomMessage>
          );
          break;
        case 'add_ships':
          handleAddShips(
            wss,
            extendedWs,
            messageWithParsedData as WebSocketResponseGeneric<AddShipsMessage>
          );
          break;
        case 'attack':
          handleAttack(
            wss,
            extendedWs,
            messageWithParsedData as WebSocketResponseGeneric<AttackMessage>
          );
          break;
        case 'randomAttack':
          handleRandomAttack(
            wss,
            extendedWs,
            messageWithParsedData as WebSocketResponseGeneric<RandomAttackMessage>
          );
          break;
        case 'single_play':
          handleSinglePlay(
            wss,
            extendedWs,
            messageWithParsedData as WebSocketResponseGeneric<CreateRoomMessage>
          );
          break;
        default:
          const errorResponse: WebSocketResponse = {
            type: 'error',
            data: JSON.stringify({
              error: true,
              errorText: `Unknown command: ${parsedMessage.type}`,
            } as GenericResult),
            id: parsedMessage.id,
          };
          extendedWs.send(JSON.stringify(errorResponse));
          logger.log('error', { message: message.toString() }, JSON.parse(errorResponse.data));
      }
    } catch (error) {
      logger.log(
        'error',
        { message: 'Message processing error', rawMessage: message },
        { error: (error as Error).message }
      );
      const errorResponse: WebSocketResponse = {
        type: 'error',
        data: JSON.stringify({
          error: true,
          errorText: 'Invalid JSON or command',
        } as GenericResult),
        id: 0,
      };
      extendedWs.send(JSON.stringify(errorResponse));
    }
  });

  ws.on('close', () => {
    logger.log('connection', { event: 'Client disconnected' }, { status: 'success' });
  });

  ws.on('error', (error) => {
    logger.log('error', { event: 'WebSocket error' }, { error: error.message });
  });
}
