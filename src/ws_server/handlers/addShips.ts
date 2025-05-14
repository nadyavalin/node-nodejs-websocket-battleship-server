import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponseGeneric,
  AddShipsData,
  GenericResult,
  AddShipsResult,
  StartGameResult,
  AddShipsMessage,
} from '../../utils/types';

export function handleAddShips(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<AddShipsMessage>
) {
  const data: AddShipsData = parsedMessage.data;

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
    logger.log('add_ships', data, errorResponse);
    return;
  }

  if (ws.playerIndex !== data.indexPlayer) {
    const errorResponse: WebSocketResponseGeneric<GenericResult> = {
      type: 'error',
      data: {
        error: true,
        errorText: 'Invalid player index',
      },
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_ships', data, errorResponse);
    return;
  }

  const game = storage.games.get(data.gameId);
  if (!game) {
    const errorResponse: WebSocketResponseGeneric<GenericResult> = {
      type: 'error',
      data: {
        error: true,
        errorText: 'Game not found',
      },
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_ships', data, errorResponse);
    return;
  }

  const player = game.players.find((p) => p.index === ws.playerIndex);
  if (!player) {
    const errorResponse: WebSocketResponseGeneric<GenericResult> = {
      type: 'error',
      data: {
        error: true,
        errorText: 'Player not in game',
      },
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_ships', data, errorResponse);
    return;
  }

  // Валидация кораблей
  const validShipConfig = [
    { length: 4, type: 'huge', count: 1 },
    { length: 3, type: 'large', count: 2 },
    { length: 2, type: 'medium', count: 3 },
    { length: 1, type: 'small', count: 4 },
  ];

  const shipCounts = validShipConfig.reduce(
    (acc, config) => {
      acc[config.length] = acc[config.length] || {
        type: config.type,
        count: 0,
        max: config.count,
      };
      return acc;
    },
    {} as Record<number, { type: string; count: number; max: number }>
  );

  const occupiedCells = new Set<string>();
  for (const ship of data.ships) {
    // Проверка формата
    if (
      !Number.isInteger(ship.position.x) ||
      !Number.isInteger(ship.position.y) ||
      typeof ship.direction !== 'boolean' ||
      !Number.isInteger(ship.length) ||
      !['small', 'medium', 'large', 'huge'].includes(ship.type)
    ) {
      const errorResponse: WebSocketResponseGeneric<GenericResult> = {
        type: 'error',
        data: {
          error: true,
          errorText: 'Invalid ship format',
        },
        id: parsedMessage.id,
      };
      ws.send(JSON.stringify(errorResponse));
      logger.log('add_ships', data, errorResponse);
      return;
    }

    // Проверка соответствия length и type
    const config = validShipConfig.find((c) => c.length === ship.length && c.type === ship.type);
    if (!config || shipCounts[ship.length].count >= shipCounts[ship.length].max) {
      const errorResponse: WebSocketResponseGeneric<GenericResult> = {
        type: 'error',
        data: {
          error: true,
          errorText: 'Invalid ship length or type',
        },
        id: parsedMessage.id,
      };
      ws.send(JSON.stringify(errorResponse));
      logger.log('add_ships', data, errorResponse);
      return;
    }
    shipCounts[ship.length].count++;

    // Проверка границ поля (10x10)
    const { x, y } = ship.position;
    const endX = ship.direction ? x + ship.length - 1 : x;
    const endY = ship.direction ? y : y + ship.length - 1;
    if (x < 0 || y < 0 || endX >= 10 || endY >= 10) {
      const errorResponse: WebSocketResponseGeneric<GenericResult> = {
        type: 'error',
        data: {
          error: true,
          errorText: 'Ship out of bounds',
        },
        id: parsedMessage.id,
      };
      ws.send(JSON.stringify(errorResponse));
      logger.log('add_ships', data, errorResponse);
      return;
    }

    // Проверка пересечений
    for (let i = 0; i < ship.length; i++) {
      const cellX = ship.direction ? x + i : x;
      const cellY = ship.direction ? y : y + i;
      const cellKey = `${cellX},${cellY}`;
      if (occupiedCells.has(cellKey)) {
        const errorResponse: WebSocketResponseGeneric<GenericResult> = {
          type: 'error',
          data: {
            error: true,
            errorText: 'Ships overlap',
          },
          id: parsedMessage.id,
        };
        ws.send(JSON.stringify(errorResponse));
        logger.log('add_ships', data, errorResponse);
        return;
      }
      occupiedCells.add(cellKey);
    }
  }

  // Проверка полного набора кораблей
  if (!validShipConfig.every((config) => shipCounts[config.length].count === config.count)) {
    const errorResponse: WebSocketResponseGeneric<GenericResult> = {
      type: 'error',
      data: {
        error: true,
        errorText: 'Incorrect number of ships',
      },
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_ships', data, errorResponse);
    return;
  }

  // Сохранение кораблей
  player.ships = data.ships;
  storage.games.set(game.gameId, game);

  // Ответ ships_added
  const response: WebSocketResponseGeneric<AddShipsResult> = {
    type: 'ships_added',
    data: {
      gameId: game.gameId,
      playerId: ws.playerIndex,
    },
    id: parsedMessage.id,
  };
  ws.send(JSON.stringify(response));
  logger.log('add_ships', data, response);

  // Проверка, готовы ли оба игрока
  if (game.players.every((p) => p.ships.length > 0)) {
    game.players.forEach((p) => {
      const client = Array.from(
        wss.clients as Set<WebSocket & { playerIndex: string | null }>
      ).find((c) => c.playerIndex === p.index);
      if (client && client.readyState === WebSocket.OPEN) {
        const startGameResponse: WebSocketResponseGeneric<StartGameResult> = {
          type: 'start_game',
          data: {
            ships: p.ships,
            currentPlayerIndex: game.players[0].index,
          },
          id: parsedMessage.id,
        };
        console.log('startGameResponse:', JSON.stringify(startGameResponse));
        client.send(JSON.stringify(startGameResponse));
        logger.log('start_game', { player: p.index }, startGameResponse);
      }
    });
  }
}
