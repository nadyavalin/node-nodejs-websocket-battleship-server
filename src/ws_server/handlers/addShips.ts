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

  const game = storage.games.get(data.gameId);
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

  player.ships = data.ships;
  storage.games.set(data.gameId, game);

  const shipsAddedResponse: WebSocketResponse = {
    type: 'ships_added',
    data: JSON.stringify({}),
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
          'turn',
          { gameId: game.gameId, playerIndex: p.index },
          JSON.parse(turnResponse.data)
        );
      }
    });
  }
}
