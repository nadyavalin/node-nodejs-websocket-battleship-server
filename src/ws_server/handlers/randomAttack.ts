import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  RandomAttackMessage,
  GenericResult,
  AttackResult,
  Ship,
} from '../../utils/types';
import { broadcastWinners } from '../broadcast';

export function handleRandomAttack(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<RandomAttackMessage>
) {
  const data: RandomAttackMessage = parsedMessage.data;

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
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
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
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
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
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  if (game.currentPlayer !== ws.playerIndex) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Not your turn',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  const opponent = game.players.find((p) => p.index !== ws.playerIndex);
  if (!opponent) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'Opponent not found',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  const availableCells = [];
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      if (!game.board.cells.some((cell) => cell.x === x && cell.y === y)) {
        availableCells.push({ x, y });
      }
    }
  }

  if (availableCells.length === 0) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: 'No available cells to attack',
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
  let status: AttackResult['status'] = 'miss';
  let hitShip: Ship | null = null;

  for (const ship of opponent.ships) {
    const { x: shipX, y: shipY } = ship.position;
    const shipCells: { x: number; y: number }[] = [];
    for (let i = 0; i < ship.length; i++) {
      const cellX = ship.direction ? shipX + i : shipX;
      const cellY = ship.direction ? shipY : shipY + i;
      shipCells.push({ x: cellX, y: cellY });
    }
    if (shipCells.some((cell) => cell.x === randomCell.x && cell.y === randomCell.y)) {
      status = 'shot';
      hitShip = ship;
      break;
    }
  }

  const response: WebSocketResponse = {
    type: 'attack',
    data: JSON.stringify({
      position: { x: randomCell.x, y: randomCell.y },
      currentPlayer: ws.playerIndex,
      status,
    } as AttackResult),
    id: parsedMessage.id,
  };

  let isGameOver = false;
  if (status === 'shot' && hitShip) {
    const hitCells = new Set<string>(
      game.board.cells.filter((cell) => cell.status === 'shot').map((cell) => `${cell.x},${cell.y}`)
    );
    hitCells.add(`${randomCell.x},${randomCell.y}`);
    const shipCells = [];
    for (let i = 0; i < hitShip.length; i++) {
      const cellX = hitShip.direction ? hitShip.position.x + i : hitShip.position.x;
      const cellY = hitShip.direction ? hitShip.position.y : hitShip.position.y + i;
      shipCells.push(`${cellX},${cellY}`);
    }
    if (shipCells.every((cell) => hitCells.has(cell))) {
      response.data = JSON.stringify({
        position: { x: randomCell.x, y: randomCell.y },
        currentPlayer: ws.playerIndex,
        status: 'killed',
      } as AttackResult);
      const aroundCells = [];
      for (let i = -1; i <= hitShip.length; i++) {
        for (let j = -1; j <= 1; j++) {
          const cellX = hitShip.direction ? hitShip.position.x + i : hitShip.position.x + j;
          const cellY = hitShip.direction ? hitShip.position.y + j : hitShip.position.y + i;
          if (
            cellX >= 0 &&
            cellX < 10 &&
            cellY >= 0 &&
            cellY < 10 &&
            !shipCells.includes(`${cellX},${cellY}`)
          ) {
            aroundCells.push({ x: cellX, y: cellY });
          }
        }
      }
      aroundCells.forEach((cell) => {
        const aroundResponse: WebSocketResponse = {
          type: 'attack',
          data: JSON.stringify({
            position: { x: cell.x, y: cell.y },
            currentPlayer: ws.playerIndex,
            status: 'miss',
          } as AttackResult),
          id: parsedMessage.id,
        };
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(aroundResponse));
          }
        });
        game.board.cells.push({ x: cell.x, y: cell.y, status: 'miss' });
        logger.log('randomAttack', { aroundCell: cell }, JSON.parse(aroundResponse.data));
      });

      const opponentShipsCells = opponent.ships.flatMap((ship) => {
        const cells: { x: number; y: number }[] = [];
        for (let i = 0; i < ship.length; i++) {
          const cellX = ship.direction ? ship.position.x + i : ship.position.x;
          const cellY = ship.direction ? ship.position.y : ship.position.y + i;
          cells.push({ x: cellX, y: cellY });
        }
        return cells;
      });
      const hitCellsAll = new Set<string>(
        game.board.cells
          .filter((cell) => cell.status === 'shot')
          .map((cell) => `${cell.x},${cell.y}`)
      );
      isGameOver = opponentShipsCells.every((cell) => hitCellsAll.has(`${cell.x},${cell.y}`));
    }
  }

  game.board.cells.push({ x: randomCell.x, y: randomCell.y, status });
  storage.games.set(game.gameId, game);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(response));
    }
  });

  logger.log('randomAttack', data, JSON.parse(response.data));

  const nextPlayer = status === 'miss' ? opponent.index : ws.playerIndex;
  game.currentPlayer = nextPlayer;
  const turnResponse: WebSocketResponse = {
    type: 'turn',
    data: JSON.stringify({
      currentPlayer: nextPlayer,
    }),
    id: parsedMessage.id,
  };
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(turnResponse));
    }
  });
  logger.log('turn', { player: nextPlayer }, JSON.parse(turnResponse.data));

  if (isGameOver) {
    const winner = storage.players.get(ws.playerIndex);
    if (winner) {
      winner.wins += 1;
      storage.players.set(ws.playerIndex, winner);
    }
    const finishResponse: WebSocketResponse = {
      type: 'finish',
      data: JSON.stringify({
        winPlayer: ws.playerIndex,
      }),
      id: parsedMessage.id,
    };
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(finishResponse));
      }
    });
    logger.log('finish', { winner: ws.playerIndex }, JSON.parse(finishResponse.data));
    storage.games.delete(game.gameId);
    broadcastWinners(wss);
  }
}
