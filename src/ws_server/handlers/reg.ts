import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';
import { storage } from '../storage';
import {
  WebSocketResponse,
  RegData,
  RegResponseData,
  WebSocketMessageGeneric,
  RegMessage,
} from '../../utils/types';
import { broadcastWinners } from '../broadcast';

export function handleReg(
  wss: WebSocketServer,
  ws: WebSocket & { playerIndex: string | null },
  parsedMessage: WebSocketMessageGeneric<string | RegMessage>
) {
  let data: RegData;
  if (typeof parsedMessage.data === 'string') {
    data = JSON.parse(parsedMessage.data);
  } else {
    data = parsedMessage.data;
  }

  if (!data.name || !data.password) {
    const errorResponse: WebSocketResponse = {
      type: 'reg',
      data: JSON.stringify({
        name: data.name || '',
        index: '',
        error: true,
        errorText: 'Name and password are required',
      }),
      id: parsedMessage.id,
    };
    ws.send(JSON.stringify(errorResponse));
    logger.log('reg', data, JSON.parse(errorResponse.data) as RegResponseData);
    return;
  }

  let player = Array.from(storage.players.values()).find((p) => p.name === data.name);
  let response: WebSocketResponse;

  if (player) {
    if (player.password === data.password) {
      response = {
        type: 'reg',
        data: JSON.stringify({
          name: player.name,
          index: player.index,
          error: false,
          errorText: '',
        }),
        id: parsedMessage.id,
      };
      ws.playerIndex = player.index;
    } else {
      response = {
        type: 'reg',
        data: JSON.stringify({
          name: player.name,
          index: '',
          error: true,
          errorText: 'Invalid password',
        }),
        id: parsedMessage.id,
      };
    }
  } else {
    const index = `player_${storage.players.size + 1}`;
    player = {
      name: data.name,
      password: data.password,
      wins: 0,
      index,
    };
    storage.players.set(index, player);
    response = {
      type: 'reg',
      data: JSON.stringify({
        name: player.name,
        index: player.index,
        error: false,
        errorText: '',
      }),
      id: parsedMessage.id,
    };
    ws.playerIndex = index;
  }
  ws.send(JSON.stringify(response));
  const responseData: RegResponseData = JSON.parse(response.data);
  logger.log('reg', data, responseData);
  if (!responseData.error) {
    broadcastWinners(wss);
  }
}
