import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponseGeneric,
  CreateRoomData,
  GenericResult,
  CreateRoomMessage,
  WebSocketResponse,
} from '../../utils/types';
import { broadcastRooms } from '../broadcast';

export function handleCreateRoom(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<CreateRoomMessage>
) {
  const data: CreateRoomData = parsedMessage.data;

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
    logger.log('create_room', data, errorResponse);
    return;
  }

  const isInRoom = Array.from(storage.rooms.values()).some((room) =>
    room.players.some((p) => p.index === ws.playerIndex)
  );
  const isInGame = Array.from(storage.games.values()).some((game) =>
    game.players.some((p) => p.index === ws.playerIndex)
  );
  if (isInRoom || isInGame) {
    const errorResponse: WebSocketResponseGeneric<GenericResult> = {
      type: 'error',
      data: {
        error: true,
        errorText: 'Player is already in a room or game',
      },
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('create_room', data, errorResponse);
    return;
  }

  const roomId = `room_${storage.rooms.size + 1}`;
  const player = storage.players.get(ws.playerIndex);
  const room = {
    roomId,
    players: [player!],
  };
  storage.rooms.set(roomId, room);

  const gameId = `game_${storage.games.size + 1}`;
  const game = {
    gameId,
    players: [{ index: ws.playerIndex, ships: [] }],
    currentPlayer: ws.playerIndex,
    board: { cells: [] },
  };
  storage.games.set(gameId, game);

  const response: WebSocketResponse = {
    type: 'create_game',
    data: JSON.stringify({
      idGame: gameId,
      idPlayer: ws.playerIndex,
    }),
    id: parsedMessage.id,
  };
  ws.send(JSON.stringify(response));
  broadcastRooms(wss);
  const parsedResponse = JSON.parse(response.data);
  logger.log('create_room', data, parsedResponse);
}
