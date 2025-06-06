import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  WebSocketResponseGeneric,
  AttackMessage,
  GenericResult,
  AttackResult,
  TurnResult,
  FinishResult,
} from '../../utils/types';
import { broadcastWinners } from '../broadcast';
import { processAttack } from '../../utils/attackUtils';
import { botAttack } from './randomAttack';

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

export function handleAttack(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<AttackMessage>
) {
  const data: AttackMessage = parsedMessage.data;

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
    logger.log('attack', data, JSON.parse(errorResponse.data));
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
    logger.log('attack', data, JSON.parse(errorResponse.data));
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
    logger.log('attack', data, JSON.parse(errorResponse.data));
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
    logger.log('attack', data, JSON.parse(errorResponse.data));
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
    logger.log('attack', data, JSON.parse(errorResponse.data));
    return;
  }

  const { status, isGameOver, aroundCells, error } = processAttack(
    data.gameId,
    ws.playerIndex,
    data.x,
    data.y
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
    logger.log('attack', data, JSON.parse(errorResponse.data));
    return;
  }

  const response: WebSocketResponse = {
    type: 'attack',
    data: JSON.stringify({
      position: { x: data.x, y: data.y },
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
  if (nextPlayer) {
    game.currentPlayer = nextPlayer;
  }
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
    if (!ws.playerIndex.startsWith('bot_')) {
      const player = storage.players.get(ws.playerIndex);
      if (player) {
        player.wins += 1;
        storage.players.set(ws.playerIndex, player);
      }
    }
    const finishResponse: WebSocketResponse = {
      type: 'finish',
      data: JSON.stringify({ winPlayer: ws.playerIndex } as FinishResult),
      id: parsedMessage.id,
    };
    broadcastToGamePlayers(wss, data.gameId, finishResponse);
    storage.games.delete(data.gameId);
    const botIndex = game.players.find((p) => p.index.startsWith('bot_'))?.index;
    if (botIndex) {
      storage.players.delete(botIndex);
    }
    broadcastWinners(wss);
    return;
  }

  if (nextPlayer && nextPlayer.startsWith('bot_')) {
    const performBotAttack = () => {
      setTimeout(() => {
        const botAttackResult = botAttack(wss, data.gameId, nextPlayer);
        if (botAttackResult) {
          const botResponse: WebSocketResponse = {
            type: 'attack',
            data: JSON.stringify({
              position: { x: botAttackResult.x, y: botAttackResult.y },
              currentPlayer: nextPlayer,
              status: botAttackResult.status,
            } as AttackResult),
            id: parsedMessage.id,
          };
          broadcastToGamePlayers(wss, data.gameId, botResponse);

          if (botAttackResult.aroundCells.length > 0) {
            botAttackResult.aroundCells.forEach((cell) => {
              const cellExists = opponent.board.cells.some((c) => c.x === cell.x && c.y === cell.y);
              if (!cellExists) {
                opponent.board.cells.push({ x: cell.x, y: cell.y, status: 'miss' });
                const aroundResponse: WebSocketResponse = {
                  type: 'attack',
                  data: JSON.stringify({
                    position: { x: cell.x, y: cell.y },
                    currentPlayer: nextPlayer,
                    status: 'miss',
                  } as AttackResult),
                  id: parsedMessage.id,
                };
                broadcastToGamePlayers(wss, data.gameId, aroundResponse);
              }
            });
          }

          if (botAttackResult.isGameOver) {
            const finishResponse: WebSocketResponse = {
              type: 'finish',
              data: JSON.stringify({ winPlayer: nextPlayer } as FinishResult),
              id: parsedMessage.id,
            };
            broadcastToGamePlayers(wss, data.gameId, finishResponse);
            storage.games.delete(data.gameId);
            storage.players.delete(nextPlayer);
            broadcastWinners(wss);
            return;
          }

          const botNextPlayer = botAttackResult.status === 'miss' ? ws.playerIndex : nextPlayer;
          if (botNextPlayer) {
            game.currentPlayer = botNextPlayer;
          }
          const botTurnResponse: WebSocketResponse = {
            type: 'turn',
            data: JSON.stringify({
              currentPlayer: botNextPlayer,
            } as TurnResult),
            id: parsedMessage.id,
          };
          broadcastToGamePlayers(wss, data.gameId, botTurnResponse);
          logger.log('turn redirect', { player: botNextPlayer }, JSON.parse(botTurnResponse.data));

          if (botAttackResult.status !== 'miss' && botNextPlayer === nextPlayer) {
            performBotAttack();
          }
        }
      }, 1000);
    };

    performBotAttack();
  }
}
