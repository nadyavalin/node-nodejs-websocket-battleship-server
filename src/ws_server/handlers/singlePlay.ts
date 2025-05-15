import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  CreateRoomMessage,
  GenericResult,
  CreateGameResult,
  Ship,
  StartGameResult,
} from '../../utils/types';
import { broadcastRooms } from '../broadcast';

import { Game } from '../storage';

export function handleSinglePlay(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<CreateRoomMessage>
) {
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
    logger.log('single_play', {}, JSON.parse(errorResponse.data));
    return;
  }

  const isInRoom = Array.from(storage.rooms.values()).some((room) =>
    room.players.some((p) => p.index === ws.playerIndex)
  );
  const isInGame = Array.from(storage.games.values()).some((game) =>
    game.players.some((p) => p.index === ws.playerIndex)
  );
  if (isInRoom || isInGame) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Player is already in a room or game',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('single_play', {}, JSON.parse(errorResponse.data));
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
  const game: Game = {
    gameId,
    players: [{ index: ws.playerIndex, ships: [] }],
    currentPlayer: ws.playerIndex,
    board: { cells: [] },
  };
  storage.games.set(gameId, game);

  const botIndex = `bot_${storage.players.size + 1}`;
  const bot = {
    name: `Bot_${botIndex}`,
    password: 'bot',
    wins: 0,
    index: botIndex,
  };
  storage.players.set(botIndex, bot);
  room.players.push(bot);
  storage.rooms.set(roomId, room);
  game.players.push({ index: botIndex, ships: [] });
  storage.games.set(gameId, game);

  const botShips: Ship[] = generateBotShips();
  const botPlayer = game.players.find((p) => p.index === botIndex);
  if (botPlayer) {
    botPlayer.ships = botShips;
  } else {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Bot player not found',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('single_play', {}, JSON.parse(errorResponse.data));
    return;
  }
  storage.games.set(gameId, game);

  const createGameResponse: WebSocketResponse = {
    type: 'create_game',
    data: JSON.stringify({
      idGame: gameId,
      idPlayer: ws.playerIndex,
    } as CreateGameResult),
    id: parsedMessage.id,
  };
  ws.send(JSON.stringify(createGameResponse));
  logger.log('single_play', {}, JSON.parse(createGameResponse.data));

  storage.rooms.delete(roomId);
  broadcastRooms(wss);

  const startGameResponse: WebSocketResponse = {
    type: 'start_game',
    data: JSON.stringify({
      ships: game.players.find((p) => p.index === ws.playerIndex)!.ships,
      currentPlayerIndex: ws.playerIndex,
    } as StartGameResult),
    id: parsedMessage.id,
  };
  ws.send(JSON.stringify(startGameResponse));
  logger.log('start_game', { player: ws.playerIndex }, JSON.parse(startGameResponse.data));

  const turnResponse: WebSocketResponse = {
    type: 'turn',
    data: JSON.stringify({
      currentPlayer: ws.playerIndex,
    }),
    id: parsedMessage.id,
  };
  ws.send(JSON.stringify(turnResponse));
  logger.log('turn', { player: ws.playerIndex }, JSON.parse(turnResponse.data));
}

function generateBotShips(): Ship[] {
  const ships: Ship[] = [];
  const shipConfigs = [
    { length: 4, type: 'huge', count: 1 },
    { length: 3, type: 'large', count: 2 },
    { length: 2, type: 'medium', count: 3 },
    { length: 1, type: 'small', count: 4 },
  ];
  const occupiedCells = new Set<string>();

  for (const config of shipConfigs) {
    for (let i = 0; i < config.count; i++) {
      let placed = false;
      while (!placed) {
        const direction = Math.random() > 0.5;
        const x = Math.floor(Math.random() * 10);
        const y = Math.floor(Math.random() * 10);
        const endX = direction ? x + config.length - 1 : x;
        const endY = direction ? y : y + config.length - 1;

        if (x < 0 || y < 0 || endX >= 10 || endY >= 10) continue;

        let valid = true;
        const cells: string[] = [];
        for (let j = 0; j < config.length; j++) {
          const cellX = direction ? x + j : x;
          const cellY = direction ? y : y + j;
          const cellKey = `${cellX},${cellY}`;
          if (occupiedCells.has(cellKey)) {
            valid = false;
            break;
          }
          cells.push(cellKey);
        }

        if (valid) {
          cells.forEach((cell) => occupiedCells.add(cell));
          ships.push({
            position: { x, y },
            direction,
            length: config.length,
            type: config.type as 'small' | 'medium' | 'large' | 'huge',
          });
          placed = true;
        }
      }
    }
  }
  return ships;
}
