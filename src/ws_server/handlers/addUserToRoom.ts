import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  AddUserToRoomMessage,
  GenericResult,
  CreateGameResult,
  UpdateRoomResult,
  AddUserToRoomData,
} from '../../utils/types';
import { broadcastRooms } from '../broadcast';

export function handleAddUserToRoom(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<AddUserToRoomMessage>
) {
  const data: AddUserToRoomData = parsedMessage.data;

  if (!ws.playerIndex) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Player not registered',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, JSON.parse(errorResponse.data));
    return;
  }

  const isInRoom = Array.from(storage.rooms.values()).some((room) =>
    room.players.some((p) => p.index === ws.playerIndex)
  );
  if (isInRoom) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Player is already in a room',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, JSON.parse(errorResponse.data));
    return;
  }

  const room = storage.rooms.get(data.indexRoom);
  if (!room) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Room not found',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, JSON.parse(errorResponse.data));
    return;
  }

  if (room.players.length >= 2) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Room is full',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, JSON.parse(errorResponse.data));
    return;
  }

  const player = storage.players.get(ws.playerIndex);
  room.players.push(player!);
  storage.rooms.set(data.indexRoom, room);

  const game = storage.games.get(`game_${data.indexRoom.split('_')[1]}`);
  if (game) {
    game.players.push({ index: ws.playerIndex!, ships: [] });
    storage.games.set(game.gameId, game);
  }

  const createGameResponse: WebSocketResponse = {
    type: 'create_game',
    data: JSON.stringify({
      idGame: game!.gameId,
      idPlayer: ws.playerIndex,
    } as CreateGameResult),
    id: parsedMessage.id,
  };
  ws.send(JSON.stringify(createGameResponse));

  const creatorWs = Array.from(wss.clients as Set<WebSocket & { playerIndex: string | null }>).find(
    (client) => room.players[0].index === client.playerIndex
  );
  if (creatorWs && creatorWs.readyState === WebSocket.OPEN) {
    const createGameMsg: WebSocketResponse = {
      type: 'create_game',
      data: JSON.stringify({
        idGame: game!.gameId,
        idPlayer: room.players[0].index,
      } as CreateGameResult),
      id: parsedMessage.id,
    };
    creatorWs.send(JSON.stringify(createGameMsg));
  }

  const updateRoomResponse: WebSocketResponse = {
    type: 'update_room',
    data: JSON.stringify({
      rooms: Array.from(storage.rooms.values())
        .filter((room) => room.players.length === 1)
        .map((room) => ({
          roomId: room.roomId,
          roomUsers: room.players.map((p) => ({
            name: p.name,
            index: p.index,
          })),
        })),
    } as UpdateRoomResult),
    id: parsedMessage.id,
  };
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(updateRoomResponse));
    }
  });

  logger.log('add_user_to_room', data, JSON.parse(createGameResponse.data));

  if (room.players.length === 2) {
    storage.rooms.delete(data.indexRoom);
    broadcastRooms(wss);
  }
}
