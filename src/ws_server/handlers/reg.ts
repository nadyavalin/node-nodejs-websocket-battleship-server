import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  RegMessage,
  RegResponseData,
  AddUserToRoomMessage,
} from '../../utils/types';
import { broadcastWinners, broadcastRooms } from '../broadcast';
import { handleAddUserToRoom } from './addUserToRoom';

export function handleReg(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<string | RegMessage>
) {
  let data: RegMessage;
  if (typeof parsedMessage.data === 'string') {
    data = JSON.parse(parsedMessage.data);
  } else {
    data = parsedMessage.data;
  }

  if (!data.name || !data.password) {
    const errorResponse: WebSocketResponse = {
      type: 'reg',
      data: JSON.stringify({
        name: data.name || '',
        index: '',
        error: true,
        errorText: 'Name and password are required',
      }),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('reg', data, JSON.parse(errorResponse.data) as RegResponseData);
    return;
  }

  let player = Array.from(storage.players.values()).find((p) => p.name === data.name);
  let response: WebSocketResponse;

  if (player) {
    if (player.password === data.password) {
      response = {
        type: 'reg',
        data: JSON.stringify({
          name: player.name,
          index: player.index,
          error: false,
          errorText: '',
        }),
        id: parsedMessage.id,
      };
      ws.playerIndex = player.index;
    } else {
      response = {
        type: 'reg',
        data: JSON.stringify({
          name: player.name,
          index: '',
          error: true,
          errorText: 'Invalid password',
        }),
        id: parsedMessage.id,
      };
    }
  } else {
    const index = `player_${storage.players.size + 1}`;
    player = {
      name: data.name,
      password: data.password,
      wins: 0,
      index,
    };
    storage.players.set(index, player);
    response = {
      type: 'reg',
      data: JSON.stringify({
        name: player.name,
        index: player.index,
        error: false,
        errorText: '',
      }),
      id: parsedMessage.id,
    };
    ws.playerIndex = index;
  }

  ws.send(JSON.stringify(response));
  logger.log('reg', data, JSON.parse(response.data) as RegResponseData);

  if (!JSON.parse(response.data).error) {
    broadcastWinners(wss);
    broadcastRooms(wss);
    const availableRoom = Array.from(storage.rooms.entries()).find(
      ([, r]) => r.players.length === 1
    );

    if (availableRoom) {
      const [roomId] = availableRoom;
      logger.log(
        'reg_debug',
        { autoJoinRoom: roomId, playerIndex: ws.playerIndex },
        { status: 'debug' }
      );
      const addUserMessage: WebSocketResponseGeneric<AddUserToRoomMessage> = {
        type: 'add_user_to_room',
        data: { indexRoom: roomId },
        id: parsedMessage.id,
      };
      handleAddUserToRoom(wss, ws, addUserMessage);
    } else {
      logger.log(
        'reg_debug',
        { noAvailableRoom: true, playerIndex: ws.playerIndex },
        { status: 'debug' }
      );
    }
  }
}
