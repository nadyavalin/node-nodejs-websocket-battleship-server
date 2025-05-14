import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponseGeneric,
  AddUserToRoomData,
  GenericResult,
  UpdateRoomResult,
  CreateGameResult,
  RoomUser,
  AddUserToRoomMessage,
} from '../../utils/types';
import { broadcastRooms } from '../broadcast';

export function handleAddUserToRoom(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<AddUserToRoomMessage>
) {
  const data: AddUserToRoomData = parsedMessage.data;

  if (!ws.playerIndex) {
    const errorResponse: WebSocketResponseGeneric<GenericResult> = {
      type: 'error',
      data: {
        error: true,
        errorText: 'Player not registered',
      },
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, errorResponse);
    return;
  }

  const isInRoom = Array.from(storage.rooms.values()).some((room) =>
    room.players.some((p) => p.index === ws.playerIndex)
  );
  if (isInRoom) {
    const errorResponse: WebSocketResponseGeneric<GenericResult> = {
      type: 'error',
      data: {
        error: true,
        errorText: 'Player is already in a room',
      },
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, errorResponse);
    return;
  }

  const room = storage.rooms.get(data.indexRoom);
  if (!room) {
    const errorResponse: WebSocketResponseGeneric<GenericResult> = {
      type: 'error',
      data: {
        error: true,
        errorText: 'Room not found',
      },
      id: parsedMessage.id,
    };
    console.log('add_user_to_room:', JSON.stringify(errorResponse));
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, errorResponse);
    return;
  }

  if (room.players.length >= 2) {
    const errorResponse: WebSocketResponseGeneric<GenericResult> = {
      type: 'error',
      data: {
        error: true,
        errorText: 'Room is full',
      },
      id: parsedMessage.id,
    };
    console.log('add_user_to_room:', JSON.stringify(errorResponse));
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, errorResponse);
    return;
  }

  const player = storage.players.get(ws.playerIndex);
  room.players.push(player!);
  storage.rooms.set(data.indexRoom, room);

  const game = storage.games.get(`game_${data.indexRoom.split('_')[1]}`);
  if (game) {
    game.players.push({ index: ws.playerIndex, ships: [] });
    storage.games.set(game.gameId, game);
  }

  const response: WebSocketResponseGeneric<UpdateRoomResult> = {
    type: 'update_room',
    data: {
      rooms: Array.from(storage.rooms.values())
        .filter((room) => room.players.length === 1)
        .map((room) => ({
          roomId: room.roomId,
          roomUsers: room.players.map(
            (p) =>
              ({
                name: p.name,
                index: p.index,
              }) as RoomUser
          ),
        })),
    },
    id: parsedMessage.id,
  };

  const createGameResponse: WebSocketResponseGeneric<CreateGameResult> = {
    type: 'create_game',
    data: {
      idGame: game!.gameId,
      idPlayer: ws.playerIndex,
    },
    id: parsedMessage.id,
  };

  const creatorWs = Array.from(wss.clients as Set<WebSocket & { playerIndex: string | null }>).find(
    (client) => room.players.some((p) => p.index === client.playerIndex)
  );
  if (creatorWs && creatorWs.readyState === WebSocket.OPEN) {
    const createGameMsg = {
      type: 'create_game',
      data: {
        idGame: game!.gameId,
        idPlayer: room.players[0].index,
      },
      id: parsedMessage.id,
    };
    creatorWs.send(JSON.stringify(createGameMsg));
  }

  console.log('createGameResponse:', JSON.stringify(createGameResponse));
  ws.send(JSON.stringify(createGameResponse));

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      console.log('readyState === WebSocket:', JSON.stringify(response));
      client.send(JSON.stringify(response));
    }
  });

  logger.log('add_user_to_room', data, response);

  if (room.players.length === 2) {
    storage.rooms.delete(data.indexRoom);
    broadcastRooms(wss);
  }
}
