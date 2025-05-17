import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { storage } from './storage';
import {
  WebSocketResponse,
  UpdateRoomResult,
  UpdateWinnersResult,
  RoomInfo,
  RoomUser,
} from '../utils/types';

export function broadcastRooms(wss: WebSocketServer) {
  const rooms: RoomInfo[] = Array.from(storage.rooms.values())
    .filter((room) => room.players.length === 1)
    .map((room) => ({
      roomId: room.roomId,
      roomUsers: room.players.map(
        (p) =>
          ({
            name: p.name,
            index: p.index,
          }) as RoomUser
      ),
    }));
  const response: WebSocketResponse = {
    type: 'update_room',
    data: JSON.stringify({ rooms } as UpdateRoomResult),
    id: 0,
  };
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(response));
    }
  });
  logger.log('update_room', { event: 'update_room' }, JSON.parse(response.data));
}

export function broadcastWinners(wss: WebSocketServer) {
  const winners: UpdateWinnersResult = Array.from(storage.players.values()).map((player) => ({
    name: player.name,
    wins: player.wins,
  }));
  const response: WebSocketResponse = {
    type: 'update_winners',
    data: JSON.stringify(winners as UpdateWinnersResult),
    id: 0,
  };
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(response));
    }
  });
  logger.log('update_winners', { event: 'update_winners' }, JSON.parse(response.data));
}
