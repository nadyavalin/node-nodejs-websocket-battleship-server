import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { storage } from './storage';
import {
  RegData,
  RegResult,
  WebSocketResponse,
  CreateRoomData,
  CreateGameResult,
  UpdateWinnersResult,
  AddUserToRoomData,
  UpdateRoomResult,
  GenericResult,
  RoomUser,
  StartGameResult,
  AttackData,
  AttackResult,
} from '../utils/types';

export function startWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`WebSocket server is running on port ${port}`);
  });

  const broadcastWinners = () => {
    const winners: UpdateWinnersResult['winners'] = Array.from(storage.players.values()).map(
      (player) => ({
        name: player.name,
        wins: player.wins,
      })
    );
    const response: WebSocketResponse<UpdateWinnersResult> = {
      type: 'update_winners',
      data: { winners },
      id: 0,
    };
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(response));
      }
    });
    logger.log('update_winners', { event: 'update_winners' }, response);
  };

  wss.on('connection', (ws: WebSocket) => {
    let playerIndex: string | null = null;

    logger.log('connection', { event: 'Client connected' }, { status: 'success' });

    ws.on('message', (message: string) => {
      try {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === 'reg') {
          const data: RegData = parsedMessage.data;

          if (!data.name || !data.password) {
            const errorResponse: WebSocketResponse<RegResult> = {
              type: 'reg',
              data: {
                name: data.name || '',
                index: '',
                error: true,
                errorText: 'Name and password are required',
              },
              id: 0,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('reg', data, errorResponse);
            return;
          }

          let player = Array.from(storage.players.values()).find((p) => p.name === data.name);
          let response: WebSocketResponse<RegResult>;

          if (player) {
            if (player.password === data.password) {
              response = {
                type: 'reg',
                data: {
                  name: player.name,
                  index: player.index,
                  error: false,
                  errorText: '',
                },
                id: 0,
              };
              playerIndex = player.index;
            } else {
              response = {
                type: 'reg',
                data: {
                  name: player.name,
                  index: '',
                  error: true,
                  errorText: 'Invalid password',
                },
                id: 0,
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
              data: {
                name: player.name,
                index: player.index,
                error: false,
                errorText: '',
              },
              id: 0,
            };
            playerIndex = index;
          }

          ws.send(JSON.stringify(response));
          logger.log('reg', data, response);
          if (!response.data.error) {
            broadcastWinners();
          }
          return;
        }

        if (parsedMessage.type === 'create_room') {
          const data: CreateRoomData = parsedMessage.data;

          if (!playerIndex) {
            const errorResponse: WebSocketResponse<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player not registered',
              },
              id: 0,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('create_room', data, errorResponse);
            return;
          }

          const isInRoom = Array.from(storage.rooms.values()).some((room) =>
            room.players.some((p) => p.index === playerIndex)
          );
          const isInGame = Array.from(storage.games.values()).some((game) =>
            game.players.some((p) => p.index === playerIndex)
          );
          if (isInRoom || isInGame) {
            const errorResponse: WebSocketResponse<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player is already in a room or game',
              },
              id: 0,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('create_room', data, errorResponse);
            return;
          }

          const roomId = `room_${storage.rooms.size + 1}`;
          const player = storage.players.get(playerIndex);
          const room = {
            roomId,
            players: [player!],
          };
          storage.rooms.set(roomId, room);

          const gameId = `game_${storage.games.size + 1}`;
          const game = {
            gameId,
            players: [{ index: playerIndex, ships: [] }],
            currentPlayer: playerIndex,
            board: { cells: [] },
          };
          storage.games.set(gameId, game);

          const response: WebSocketResponse<CreateGameResult> = {
            type: 'create_game',
            data: {
              idGame: gameId,
              idPlayer: playerIndex,
            },
            id: 0,
          };

          ws.send(JSON.stringify(response));
          logger.log('create_room', data, response);
          return;
        }

        if (parsedMessage.type === 'add_user_to_room') {
          const data: AddUserToRoomData = parsedMessage.data;

          if (!playerIndex) {
            const errorResponse: WebSocketResponse<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player not registered',
              },
              id: 0,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_user_to_room', data, errorResponse);
            return;
          }

          const isInRoom = Array.from(storage.rooms.values()).some((room) =>
            room.players.some((p) => p.index === playerIndex)
          );
          if (isInRoom) {
            const errorResponse: WebSocketResponse<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player is already in a room',
              },
              id: 0,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_user_to_room', data, errorResponse);
            return;
          }

          const room = storage.rooms.get(data.indexRoom);
          if (!room) {
            const errorResponse: WebSocketResponse<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Room not found',
              },
              id: 0,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_user_to_room', data, errorResponse);
            return;
          }

          if (room.players.length >= 2) {
            const errorResponse: WebSocketResponse<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Room is full',
              },
              id: 0,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_user_to_room', data, errorResponse);
            return;
          }

          const player = storage.players.get(playerIndex);
          room.players.push(player!);
          storage.rooms.set(data.indexRoom, room);

          const game = storage.games.get(`game_${data.indexRoom.split('_')[1]}`);
          if (game) {
            game.players.push({ index: playerIndex, ships: [] });
            storage.games.set(game.gameId, game);
          }

          const response: WebSocketResponse<UpdateRoomResult> = {
            type: 'update_room',
            data: {
              room: room.players.map(
                (p: { name: string; index: string }) =>
                  ({
                    name: p.name,
                    index: p.index,
                  }) as RoomUser
              ),
            },
            id: 0,
          };

          const createGameResponse: WebSocketResponse<CreateGameResult> = {
            type: 'create_game',
            data: {
              idGame: game!.gameId,
              idPlayer: playerIndex,
            },
            id: 0,
          };
          ws.send(JSON.stringify(createGameResponse));

          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(response));
            }
          });

          logger.log('add_user_to_room', data, response);

          // TODO: Отложить до получения позиций кораблей
          if (room.players.length === 2) {
            const startGameResponse: WebSocketResponse<StartGameResult> = {
              type: 'start_game',
              data: {
                ships: [],
                currentPlayerIndex: game!.players[0].index,
              },
              id: 0,
            };
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(startGameResponse));
              }
            });
            logger.log('start_game', { event: 'start_game' }, startGameResponse);
            storage.rooms.delete(data.indexRoom);
          }

          return;
        }

        if (parsedMessage.type === 'attack') {
          const data: AttackData = parsedMessage.data;

          if (!playerIndex) {
            const errorResponse: WebSocketResponse<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player not registered',
              },
              id: 0,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('attack', data, errorResponse);
            return;
          }

          const game = storage.games.get(data.gameId);
          if (!game) {
            const errorResponse: WebSocketResponse<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Game not found',
              },
              id: 0,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('attack', data, errorResponse);
            return;
          }

          if (game.currentPlayer !== playerIndex) {
            const errorResponse: WebSocketResponse<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Not your turn',
              },
              id: 0,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('attack', data, errorResponse);
            return;
          }

          const opponent = game.players.find((p) => p.index !== playerIndex);
          let status: AttackResult['status'] = 'miss';

          const response: WebSocketResponse<AttackResult> = {
            type: 'attack',
            data: {
              status,
              position: { x: data.x, y: data.y },
              currentPlayer: opponent!.index,
            },
            id: 0,
          };

          game.currentPlayer = opponent!.index;
          storage.games.set(game.gameId, game);

          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(response));
            }
          });

          logger.log('attack', data, response);
          return;
        }

        const errorResponse: WebSocketResponse<GenericResult> = {
          type: 'error',
          data: {
            error: true,
            errorText: 'Unknown command',
          },
          id: 0,
        };
        ws.send(JSON.stringify(errorResponse));
        logger.log('error', { message: message.toString() }, errorResponse);
      } catch {
        const errorResponse: WebSocketResponse<GenericResult> = {
          type: 'error',
          data: {
            error: true,
            errorText: 'Invalid JSON or command',
          },
          id: 0,
        };
        ws.send(JSON.stringify(errorResponse));
        logger.log('error', { message: message.toString() }, errorResponse);
      }
    });

    ws.on('close', () => {
      logger.log('connection', { event: 'Client disconnected' }, { status: 'success' });
    });

    ws.on('error', (error) => {
      logger.log('error', { event: 'WebSocket error' }, { error: error.message });
    });
  });

  wss.on('close', () => {
    logger.log('server', { event: 'WebSocket server closed' }, { status: 'success' });
  });

  process.once('SIGINT', () => {
    console.log('Closing WebSocket server...');
    logger.log('server', { event: 'WebSocket server closing' }, { status: 'success' });
    wss.close(() => {
      console.log('WebSocket server closed gracefully');
      setTimeout(() => process.exit(0), 100);
    });
  });

  process.once('SIGTERM', () => {
    console.log('Closing WebSocket server...');
    logger.log('server', { event: 'WebSocket server closing' }, { status: 'success' });
    wss.close(() => {
      console.log('WebSocket server closed gracefully');
      setTimeout(() => process.exit(0), 100);
    });
  });

  return wss;
}
