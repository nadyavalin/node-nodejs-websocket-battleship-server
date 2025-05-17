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

  Array.from(storage.games.entries()).forEach(([gameId, game]) => {
    if (game.players.some((p) => p.index === ws.playerIndex)) {
      storage.games.delete(gameId);
    }
  });
  Array.from(storage.rooms.entries()).forEach(([roomId, room]) => {
    if (room.players.some((p) => p.index === ws.playerIndex)) {
      storage.rooms.delete(roomId);
    }
  });

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
    players: [{ index: ws.playerIndex, ships: [], board: { cells: [] } }],
    currentPlayer: ws.playerIndex,
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
  game.players.push({ index: botIndex, ships: [], board: { cells: [] } });
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
      let attempts = 0;
      const maxAttempts = 100;

      while (!placed && attempts < maxAttempts) {
        attempts++;
        const direction = Math.random() > 0.5;
        const x = Math.floor(Math.random() * 10);
        const y = Math.floor(Math.random() * 10);
        const endX = direction ? x : x + config.length - 1;
        const endY = direction ? y + config.length - 1 : y;

        if (x < 0 || y < 0 || endX >= 10 || endY >= 10) continue;

        let valid = true;
        const cells: string[] = [];

        for (let j = 0; j < config.length; j++) {
          const cellX = direction ? x : x + j;
          const cellY = direction ? y + j : y;
          const cellKey = `${cellX},${cellY}`;

          if (occupiedCells.has(cellKey)) {
            valid = false;
            break;
          }

          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              const neighborX = cellX + dx;
              const neighborY = cellY + dy;
              if (neighborX >= 0 && neighborX < 10 && neighborY >= 0 && neighborY < 10) {
                const neighborKey = `${neighborX},${neighborY}`;
                if (occupiedCells.has(neighborKey)) {
                  valid = false;
                  break;
                }
              }
            }
            if (!valid) break;
          }

          if (!valid) break;
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

      if (!placed) {
        logger.log(
          'generateBotShips_error',
          { config, attempt: attempts, error: 'Failed to place ship' },
          { status: 'error' }
        );
      }
    }
  }

  if (ships.length !== 10) {
    logger.log(
      'generateBotShips_error',
      { generatedShips: ships.length, expected: 10, ships },
      { status: 'error' }
    );
  }

  return ships;
}
