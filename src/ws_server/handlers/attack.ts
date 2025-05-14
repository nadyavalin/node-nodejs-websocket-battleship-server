import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponseGeneric,
  AttackData,
  GenericResult,
  AttackResult,
  AttackMessage,
} from '../../utils/types';

export function handleAttack(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketResponseGeneric<AttackMessage>
) {
  const data: AttackData = parsedMessage.data;

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
    logger.log('attack', data, errorResponse);
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
    logger.log('attack', data, errorResponse);
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
    logger.log('attack', data, errorResponse);
    return;
  }

  if (game.currentPlayer !== ws.playerIndex) {
    const errorResponse: WebSocketResponseGeneric<GenericResult> = {
      type: 'error',
      data: {
        error: true,
        errorText: 'Not your turn',
      },
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('attack', data, errorResponse);
    return;
  }

  const opponent = game.players.find((p) => p.index !== ws.playerIndex);
  let status: AttackResult['status'] = 'miss';

  const response: WebSocketResponseGeneric<AttackResult> = {
    type: 'attack',
    data: {
      status,
      position: { x: data.x, y: data.y },
      currentPlayer: opponent!.index,
    },
    id: parsedMessage.id,
  };

  game.currentPlayer = opponent!.index;
  storage.games.set(game.gameId, game);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      console.log('readyState === WebSocket:', JSON.stringify(response));
      client.send(JSON.stringify(response));
    }
  });

  logger.log('attack', data, response);
}
