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

  // Проверка регистрации игрока
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

  // Проверка соответствия индекса игрока
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

  // Проверка существования игры
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

  // Проверка, ходит ли текущий игрок
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

  // Проверка наличия противника
  const opponent = game.players.find((p) => p.index !== ws.playerIndex);
  if (!opponent) {
    const error: GenericResult = {
      error: true,
      errorText: 'Opponent not found',
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

  // Выбор случайной клетки
  const availableCells = [];
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      if (!game.board.cells.some((cell) => cell.x === x && cell.y === y)) {
        availableCells.push({ x, y });
      }
    }
  }

  if (availableCells.length === 0) {
    const error: GenericResult = {
      error: true,
      errorText: 'No available cells to attack',
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

  const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];

  // Обработка атаки
  const { status, isGameOver, aroundCells } = processAttack(
    data.gameId,
    ws.playerIndex,
    randomCell.x,
    randomCell.y
  );

  // Отправляем результат атаки
  const response: WebSocketResponse = {
    type: 'attack',
    data: JSON.stringify({
      position: { x: randomCell.x, y: randomCell.y },
      currentPlayer: ws.playerIndex,
      status,
    } as AttackResult),
    id: parsedMessage.id,
  };
  broadcastToGamePlayers(wss, data.gameId, response);
  logger.log(
    'randomAttack_debug',
    {
      gameId: data.gameId,
      attackPosition: { x: randomCell.x, y: randomCell.y },
      status,
      boardCells: game.board.cells.length,
    },
    { status: 'debug' }
  );
  logger.log('randomAttack', data, JSON.parse(response.data));

  // Отправляем клетки вокруг уничтоженного корабля
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
    broadcastToGamePlayers(wss, data.gameId, aroundResponse);
    logger.log('randomAttack', { aroundCell: cell }, JSON.parse(aroundResponse.data));
  });

  // Обновляем ход
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
  logger.log('turn', { player: nextPlayer }, JSON.parse(turnResponse.data));

  // Обработка конца игры
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
      } as FinishResult),
      id: parsedMessage.id,
    };
    broadcastToGamePlayers(wss, data.gameId, finishResponse);
    logger.log('finish', { winner: ws.playerIndex }, JSON.parse(finishResponse.data));
    storage.games.delete(data.gameId);
    broadcastWinners(wss);
  }
}
