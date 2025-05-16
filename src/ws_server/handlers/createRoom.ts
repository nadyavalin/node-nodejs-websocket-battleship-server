import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  CreateRoomMessage,
  GenericResult,
  CreateGameResult,
} from '../../utils/types';
import { broadcastRooms } from '../broadcast';

function createRoomAndGame(playerIndex: string) {
  const roomId = `room_${storage.rooms.size + 1}`;
  const player = storage.players.get(playerIndex);
  const room = {
    roomId,
    players: [player!],
  };
  storage.rooms.set(roomId, room);

  const gameId = `game_${storage.games.size + 1}`;
  const game = {
    gameId,
    players: [{ index: playerIndex, ships: [] }],
    currentPlayer: playerIndex,
    board: { cells: [] },
  };
  storage.games.set(gameId, game);

  return { roomId, gameId };
}

export function handleCreateRoom(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<CreateRoomMessage>
) {
  const data: CreateRoomMessage = parsedMessage.data;

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

  const isPlayerInRoomOrGame =
    Array.from(storage.rooms.values()).some((room) =>
      room.players.some((p) => p.index === ws.playerIndex)
    ) ||
    Array.from(storage.games.values()).some((game) =>
      game.players.some((p) => p.index === ws.playerIndex)
    );
  if (isPlayerInRoomOrGame) {
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

  const { roomId, gameId } = createRoomAndGame(ws.playerIndex);
  logger.log(
    'create_room_debug',
    {
      roomId,
      gameId,
      playerIndex: ws.playerIndex,
      roomPlayers: storage.rooms.get(roomId)!.players,
      gamePlayers: storage.games.get(gameId)!.players,
    },
    { status: 'debug' }
  );

  const response: WebSocketResponse = {
    type: 'create_game',
    data: JSON.stringify({
      idGame: gameId,
      idPlayer: ws.playerIndex,
    } as CreateGameResult),
    id: parsedMessage.id,
  };
  ws.send(JSON.stringify(response));

  broadcastRooms(wss);
  logger.log('create_room', data, JSON.parse(response.data));
}
