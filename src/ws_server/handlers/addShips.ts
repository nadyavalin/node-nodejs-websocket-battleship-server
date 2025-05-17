import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  AddShipsMessage,
  GenericResult,
  StartGameResult,
  TurnResult,
} from '../../utils/types';
import { broadcastRooms } from '../broadcast';

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
        errorText: 'Player not found in game',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('add_ships', data, JSON.parse(errorResponse.data));
    return;
  }

  const expectedShips = [
    { length: 4, count: 1 },
    { length: 3, count: 2 },
    { length: 2, count: 3 },
    { length: 1, count: 4 },
  ];
  const shipCounts: { [key: number]: number } = {};
  const occupiedCells = new Set<string>();
  const tempCells: { x: number; y: number }[] = [];

  for (const ship of data.ships) {
    const { x, y } = ship.position;
    const length = ship.length;
    const direction = ship.direction;
    const endX = direction ? x : x + length - 1;
    const endY = direction ? y + length - 1 : y;

    if (x < 0 || y < 0 || endX >= 10 || endY >= 10) {
      const errorResponse: WebSocketResponse = {
        type: 'error',
        data: JSON.stringify({
          error: true,
          errorText: `Invalid ship position: ${JSON.stringify(ship)}`,
        } as GenericResult),
        id: parsedMessage.id,
      };
      ws.send(JSON.stringify(errorResponse));
      logger.log('add_ships', data, JSON.parse(errorResponse.data));
      return;
    }

    if (![1, 2, 3, 4].includes(length)) {
      const errorResponse: WebSocketResponse = {
        type: 'error',
        data: JSON.stringify({
          error: true,
          errorText: `Invalid ship length: ${length}`,
        } as GenericResult),
        id: parsedMessage.id,
      };
      ws.send(JSON.stringify(errorResponse));
      logger.log('add_ships', data, JSON.parse(errorResponse.data));
      return;
    }

    shipCounts[length] = (shipCounts[length] || 0) + 1;

    tempCells.length = 0;
    for (let j = 0; j < length; j++) {
      const cellX = direction ? x : x + j;
      const cellY = direction ? y + j : y;
      tempCells.push({ x: cellX, y: cellY });
    }

    for (const cell of tempCells) {
      const cellKey = `${cell.x},${cell.y}`;
      if (occupiedCells.has(cellKey)) {
        const errorResponse: WebSocketResponse = {
          type: 'error',
          data: JSON.stringify({
            error: true,
            errorText: `Ship overlap at ${cellKey}`,
          } as GenericResult),
          id: parsedMessage.id,
        };
        ws.send(JSON.stringify(errorResponse));
        logger.log('add_ships', data, JSON.parse(errorResponse.data));
        return;
      }
    }

    for (const cell of tempCells) {
      occupiedCells.add(`${cell.x},${cell.y}`);
    }
  }

  for (const expected of expectedShips) {
    if ((shipCounts[expected.length] || 0) !== expected.count) {
      const errorResponse: WebSocketResponse = {
        type: 'error',
        data: JSON.stringify({
          error: true,
          errorText: `Invalid number of ships with length ${expected.length}: expected ${expected.count}, got ${shipCounts[expected.length] || 0}`,
        } as GenericResult),
        id: parsedMessage.id,
      };
      ws.send(JSON.stringify(errorResponse));
      logger.log('add_ships', data, JSON.parse(errorResponse.data));
      return;
    }
  }

  for (const ship of data.ships) {
    const { x, y } = ship.position;
    const length = ship.length;
    const direction = ship.direction;
    tempCells.length = 0;

    for (let j = 0; j < length; j++) {
      const cellX = direction ? x : x + j;
      const cellY = direction ? y + j : y;
      tempCells.push({ x: cellX, y: cellY });
    }

    for (const cell of tempCells) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const neighborX = cell.x + dx;
          const neighborY = cell.y + dy;
          if (neighborX >= 0 && neighborX < 10 && neighborY >= 0 && neighborY < 10) {
            const neighborKey = `${neighborX},${neighborY}`;
            let isNeighborOwnCell = false;
            for (const ownCell of tempCells) {
              if (ownCell.x === neighborX && ownCell.y === neighborY) {
                isNeighborOwnCell = true;
                break;
              }
            }
            if (!isNeighborOwnCell && occupiedCells.has(neighborKey)) {
              const errorResponse: WebSocketResponse = {
                type: 'error',
                data: JSON.stringify({
                  error: true,
                  errorText: `Ships too close near ship at (${cell.x},${cell.y})`,
                } as GenericResult),
                id: parsedMessage.id,
              };
              ws.send(JSON.stringify(errorResponse));
              logger.log(
                'add_ships',
                { ship, conflict: neighborKey },
                JSON.parse(errorResponse.data)
              );
              return;
            }
          }
        }
      }
    }
  }

  player.ships = data.ships;
  player.board = { cells: [] };
  storage.games.set(data.gameId, game);

  const shipsAddedResponse: WebSocketResponse = {
    type: 'ships_added',
    data: JSON.stringify({
      ships: data.ships,
      playerIndex: ws.playerIndex,
    }),
    id: parsedMessage.id,
  };
  ws.send(JSON.stringify(shipsAddedResponse));
  logger.log(
    'ships_added',
    { gameId: data.gameId, playerIndex: ws.playerIndex, ships: data.ships },
    JSON.parse(shipsAddedResponse.data)
  );

  const allShipsPlaced =
    game.players.length === 2 && game.players.every((p) => p.ships && p.ships.length >= 1);

  if (allShipsPlaced) {
    const roomId = `room_${data.gameId.split('_')[1]}`;
    storage.rooms.delete(roomId);
    broadcastRooms(wss);

    game.players.forEach((p) => {
      const playerWs = Array.from(
        wss.clients as Set<WebSocket & { playerIndex: string | null }>
      ).find((client) => client.playerIndex === p.index);
      if (playerWs && playerWs.readyState === WebSocket.OPEN) {
        const startGameResponse: WebSocketResponse = {
          type: 'start_game',
          data: JSON.stringify({
            ships: p.ships,
            currentPlayerIndex: game.currentPlayer,
          } as StartGameResult),
          id: parsedMessage.id,
        };
        playerWs.send(JSON.stringify(startGameResponse));
        logger.log(
          'start_game',
          { gameId: game.gameId, playerIndex: p.index },
          JSON.parse(startGameResponse.data)
        );

        const turnResponse: WebSocketResponse = {
          type: 'turn',
          data: JSON.stringify({
            currentPlayer: game.currentPlayer,
          } as TurnResult),
          id: parsedMessage.id,
        };
        playerWs.send(JSON.stringify(turnResponse));
        logger.log(
          'turn redirect',
          { gameId: game.gameId, playerIndex: p.index },
          JSON.parse(turnResponse.data)
        );
      }
    });
  }
}
