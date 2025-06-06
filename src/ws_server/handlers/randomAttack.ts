import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  RandomAttackMessage,
  GenericResult,
  AttackResult,
  TurnResult,
  FinishResult,
} from '../../utils/types';
import { broadcastWinners } from '../broadcast';
import { processAttack } from '../../utils/attackUtils';

function broadcastToGamePlayers(wss: WebSocketServer, gameId: string, response: WebSocketResponse) {
  const game = storage.games.get(gameId);
  if (!game) return;

  game.players.forEach((p) => {
    const playerWs = Array.from(
      wss.clients as Set<WebSocket & { playerIndex: string | null }>
    ).find((client) => client.playerIndex === p.index);
    if (playerWs && playerWs.readyState === WebSocket.OPEN) {
      playerWs.send(JSON.stringify(response));
    }
  });
}

export function handleRandomAttack(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<RandomAttackMessage>
) {
  const data: RandomAttackMessage = parsedMessage.data;

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
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  if (ws.playerIndex !== data.indexPlayer) {
    const error: GenericResult = {
      error: true,
      errorText: 'Invalid player index',
    };
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify(error),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  const game = storage.games.get(data.gameId);
  if (!game) {
    const error: GenericResult = {
      error: true,
      errorText: 'Game not found',
    };
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify(error),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  if (game.currentPlayer !== ws.playerIndex) {
    const error: GenericResult = {
      error: true,
      errorText: 'Not your turn',
    };
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify(error),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  const attacker = game.players.find((p) => p.index === ws.playerIndex);
  const opponent = game.players.find((p) => p.index !== ws.playerIndex);
  if (!attacker || !opponent) {
    const error: GenericResult = {
      error: true,
      errorText: 'Player or opponent not found',
    };
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify(error),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  if (!attacker.board) {
    attacker.board = { cells: [] };
  }
  const availableCells = [];
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      if (!attacker.board.cells.some((cell) => cell.x === x && cell.y === y)) {
        availableCells.push({ x, y });
      }
    }
  }

  if (availableCells.length === 0) {
    const error: GenericResult = {
      error: true,
      errorText: 'No available cells for random attack',
    };
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify(error),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  const { x, y } = availableCells[Math.floor(Math.random() * availableCells.length)];
  const { status, isGameOver, aroundCells, error } = processAttack(
    data.gameId,
    ws.playerIndex,
    x,
    y
  );

  if (error) {
    const errorResponse: WebSocketResponse = {
      type: 'error',
      data: JSON.stringify({
        error: true,
        errorText: error,
      } as GenericResult),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('randomAttack', data, JSON.parse(errorResponse.data));
    return;
  }

  const response: WebSocketResponse = {
    type: 'attack',
    data: JSON.stringify({
      position: { x, y },
      currentPlayer: ws.playerIndex,
      status,
    } as AttackResult),
    id: parsedMessage.id,
  };
  broadcastToGamePlayers(wss, data.gameId, response);

  if (aroundCells.length > 0) {
    aroundCells.forEach((cell) => {
      const cellExists = attacker.board.cells.some((c) => c.x === cell.x && c.y === cell.y);
      if (!cellExists) {
        attacker.board.cells.push({ x: cell.x, y: cell.y, status: 'miss' });
        const aroundResponse: WebSocketResponse = {
          type: 'attack',
          data: JSON.stringify({
            position: { x: cell.x, y: cell.y },
            currentPlayer: ws.playerIndex,
            status: 'miss',
          } as AttackResult),
          id: parsedMessage.id,
        };
        broadcastToGamePlayers(wss, data.gameId, aroundResponse);
      }
    });
  }

  const nextPlayer = status === 'miss' ? opponent.index : ws.playerIndex;
  game.currentPlayer = nextPlayer;
  const turnResponse: WebSocketResponse = {
    type: 'turn',
    data: JSON.stringify({
      currentPlayer: nextPlayer,
    } as TurnResult),
    id: parsedMessage.id,
  };
  broadcastToGamePlayers(wss, data.gameId, turnResponse);
  logger.log('turn redirect', { player: nextPlayer }, JSON.parse(turnResponse.data));

  if (isGameOver) {
    const winner = storage.players.get(ws.playerIndex);
    if (winner) {
      winner.wins += 1;
      storage.players.set(ws.playerIndex, winner);
    }
    const finishResponse: WebSocketResponse = {
      type: 'finish',
      data: JSON.stringify({ winPlayer: ws.playerIndex } as FinishResult),
      id: parsedMessage.id,
    };
    broadcastToGamePlayers(wss, data.gameId, finishResponse);
    storage.games.delete(data.gameId);
    broadcastWinners(wss);
  }
}

export function botAttack(
  wss: WebSocketServer,
  gameId: string,
  botIndex: string
): {
  x: number;
  y: number;
  status: 'miss' | 'shot' | 'killed';
  isGameOver: boolean;
  aroundCells: { x: number; y: number }[];
} | null {
  const game = storage.games.get(gameId);
  if (!game) {
    logger.log('botAttack_error', { gameId, error: 'Game not found' }, { status: 'error' });
    return null;
  }

  const attacker = game.players.find((p) => p.index === botIndex);
  if (!attacker) {
    logger.log(
      'botAttack_error',
      { gameId, botIndex, error: 'Bot not found' },
      { status: 'error' }
    );
    return null;
  }

  if (!attacker.board) {
    attacker.board = { cells: [] };
  }
  const availableCells = [];
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      if (!attacker.board.cells.some((cell) => cell.x === x && cell.y === y)) {
        availableCells.push({ x, y });
      }
    }
  }

  if (availableCells.length === 0) {
    logger.log(
      'botAttack_error',
      { gameId, botIndex, error: 'No available cells for bot attack' },
      { status: 'error' }
    );
    return null;
  }

  const { x, y } = availableCells[Math.floor(Math.random() * availableCells.length)];
  const { status, isGameOver, aroundCells, error } = processAttack(gameId, botIndex, x, y);

  if (error) {
    logger.log('botAttack_error', { gameId, botIndex, x, y, error }, { status: 'error' });
    return null;
  }

  return { x, y, status, isGameOver, aroundCells };
}
