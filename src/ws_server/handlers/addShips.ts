import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  AddShipsMessage,
  GenericResult,
  AddShipsResult,
  StartGameResult,
} from '../../utils/types';

export function handleAddShips(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<AddShipsMessage>
) {
  const data: AddShipsMessage = parsedMessage.data;

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
    logger.log('add_ships', data, JSON.parse(errorResponse.data));
    return;
  }

  if (ws.playerIndex !== data.indexPlayer) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Invalid player index',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_ships', data, JSON.parse(errorResponse.data));
    return;
  }

  const game = storage.games.get(data.gameId);
  if (!game) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Game not found',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_ships', data, JSON.parse(errorResponse.data));
    return;
  }

  const player = game.players.find((p) => p.index === ws.playerIndex);
  if (!player) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Player not in game',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_ships', data, JSON.parse(errorResponse.data));
    return;
  }

  const validShipConfig = [
    { length: 4, type: 'huge', count: 1 },
    { length: 3, type: 'large', count: 2 },
    { length: 2, type: 'medium', count: 3 },
    { length: 1, type: 'small', count: 4 },
  ];

  const shipCounts = validShipConfig.reduce(
    (acc, config) => {
      acc[config.length] = { type: config.type, count: 0, max: config.count };
      return acc;
    },
    {} as Record<number, { type: string; count: number; max: number }>
  );

  const occupiedCells = new Set<string>();
  for (const ship of data.ships) {
    if (
      !Number.isInteger(ship.position.x) ||
      !Number.isInteger(ship.position.y) ||
      typeof ship.direction !== 'boolean' ||
      !Number.isInteger(ship.length) ||
      !['small', 'medium', 'large', 'huge'].includes(ship.type)
    ) {
      const errorResponse: WebSocketResponse = {
        type: 'error',
        data: JSON.stringify({
          error: true,
          errorText: 'Invalid ship format',
        } as GenericResult),
        id: parsedMessage.id,
      };
      ws.send(JSON.stringify(errorResponse));
      logger.log('add_ships', data, JSON.parse(errorResponse.data));
      return;
    }

    const config = validShipConfig.find((c) => c.length === ship.length && c.type === ship.type);
    if (!config || shipCounts[ship.length].count >= shipCounts[ship.length].max) {
      const errorResponse: WebSocketResponse = {
        type: 'error',
        data: JSON.stringify({
          error: true,
          errorText: 'Invalid ship length or type',
        } as GenericResult),
        id: parsedMessage.id,
      };
      ws.send(JSON.stringify(errorResponse));
      logger.log('add_ships', data, JSON.parse(errorResponse.data));
      return;
    }
    shipCounts[ship.length].count++;

    const { x, y } = ship.position;
    const endX = ship.direction ? x + ship.length - 1 : x;
    const endY = ship.direction ? y : y + ship.length - 1;
    if (x < 0 || y < 0 || endX >= 10 || endY >= 10) {
      const errorResponse: WebSocketResponse = {
        type: 'error',
        data: JSON.stringify({
          error: true,
          errorText: 'Ship out of bounds',
        } as GenericResult),
        id: parsedMessage.id,
      };
      ws.send(JSON.stringify(errorResponse));
      logger.log('add_ships', data, JSON.parse(errorResponse.data));
      return;
    }

    for (let i = 0; i < ship.length; i++) {
      const cellX = ship.direction ? x + i : x;
      const cellY = ship.direction ? y : y + i;
      const cellKey = `${cellX},${cellY}`;
      if (occupiedCells.has(cellKey)) {
        const errorResponse: WebSocketResponse = {
          type: 'error',
          data: JSON.stringify({
            error: true,
            errorText: 'Ships overlap',
          } as GenericResult),
          id: parsedMessage.id,
        };
        ws.send(JSON.stringify(errorResponse));
        logger.log('add_ships', data, JSON.parse(errorResponse.data));
        return;
      }
      occupiedCells.add(cellKey);
    }
  }

  if (!validShipConfig.every((config) => shipCounts[config.length].count === config.count)) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Incorrect number of ships',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_ships', data, JSON.parse(errorResponse.data));
    return;
  }

  player.ships = data.ships;
  storage.games.set(game.gameId, game);

  const response: WebSocketResponse = {
    type: 'ships_added',
    data: JSON.stringify({
      gameId: game.gameId,
      playerId: ws.playerIndex,
    } as AddShipsResult),
    id: parsedMessage.id,
  };
  ws.send(JSON.stringify(response));
  logger.log('add_ships', data, JSON.parse(response.data));

  if (game.players.every((p) => p.ships.length > 0)) {
    game.players.forEach((p) => {
      const client = Array.from(
        wss.clients as Set<WebSocket & { playerIndex: string | null }>
      ).find((c) => c.playerIndex === p.index);
      if (client && client.readyState === WebSocket.OPEN) {
        const startGameResponse: WebSocketResponse = {
          type: 'start_game',
          data: JSON.stringify({
            ships: p.ships,
            currentPlayerIndex: game.players[0].index,
          } as StartGameResult),
          id: parsedMessage.id,
        };
        client.send(JSON.stringify(startGameResponse));
        logger.log('start_game', { player: p.index }, JSON.parse(startGameResponse.data));

        const turnResponse: WebSocketResponse = {
          type: 'turn',
          data: JSON.stringify({
            currentPlayer: game.players[0].index,
          }),
          id: parsedMessage.id,
        };
        client.send(JSON.stringify(turnResponse));
        logger.log('turn', { player: p.index }, JSON.parse(turnResponse.data));
      }
    });
  }
}
