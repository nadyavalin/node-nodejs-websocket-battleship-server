import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  AddUserToRoomMessage,
  GenericResult,
  CreateGameResult,
} from '../../utils/types';
import { broadcastRooms } from '../broadcast';

export function handleAddUserToRoom(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<AddUserToRoomMessage>
) {
  const data: AddUserToRoomMessage = parsedMessage.data;

  if (!ws.playerIndex) {
    const error: GenericResult = {
      error: true,
      errorText: 'Player not registered',
    };
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify(error),
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
    const error: GenericResult = {
      error: true,
      errorText: 'Player is already in a room',
    };
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify(error),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, JSON.parse(errorResponse.data));
    return;
  }

  const room = storage.rooms.get(data.indexRoom);
  if (!room) {
    const error: GenericResult = {
      error: true,
      errorText: `Room not found: ${data.indexRoom}`,
    };
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify(error),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, JSON.parse(errorResponse.data));
    return;
  }

  const gameId = `game_${data.indexRoom.split('_')[1]}`;

  const game = storage.games.get(gameId);
  if (!game) {
    const error: GenericResult = {
      error: true,
      errorText: `Game not found for gameId: ${gameId}`,
    };
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify(error),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_user_to_room', data, JSON.parse(errorResponse.data));
    return;
  }

  const player = storage.players.get(ws.playerIndex);
  room.players.push(player!);
  storage.rooms.set(data.indexRoom, room);

  game.players.push({ index: ws.playerIndex!, ships: [], board: { cells: [] } });
  storage.games.set(game.gameId, game);

  game.players.forEach((p) => {
    const playerWs = Array.from(
      wss.clients as Set<WebSocket & { playerIndex: string | null }>
    ).find((client) => client.playerIndex === p.index);
    if (playerWs && playerWs.readyState === WebSocket.OPEN) {
      const createGameResponse: WebSocketResponse = {
        type: 'create_game',
        data: JSON.stringify({
          idGame: game.gameId,
          idPlayer: p.index,
        } as CreateGameResult),
        id: parsedMessage.id,
      };
      playerWs.send(JSON.stringify(createGameResponse));
    }
  });

  broadcastRooms(wss);
  logger.log('add_user_to_room', data, { status: 'success' });
}
