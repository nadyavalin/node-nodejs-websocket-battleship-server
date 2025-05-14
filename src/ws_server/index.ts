import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { storage } from './storage';
import {
  RegData,
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
  RoomInfo,
  AddShipsData,
  AddShipsResult,
  WebSocketResponseGeneric,
  RegResponseData,
} from '../utils/types';

export function startWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`WebSocket server is running on port ${port}`);
  });

  const broadcastWinners = () => {
    const winners: UpdateWinnersResult = Array.from(storage.players.values()).map((player) => ({
      name: player.name,
      wins: player.wins,
    }));
    const response: WebSocketResponseGeneric<UpdateWinnersResult> = {
      type: 'update_winners',
      data: winners,
      id: 0,
    };
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(response));
      }
    });
    logger.log('update_winners', { event: 'update_winners' }, response);
  };

  const broadcastRooms = () => {
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
    const response: WebSocketResponseGeneric<UpdateRoomResult> = {
      type: 'update_room',
      data: { rooms },
      id: 0,
    };
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(response));
      }
    });
    logger.log('update_room', { event: 'update_room' }, response);
  };

  wss.on('connection', (ws: WebSocket & { playerIndex: string | null }) => {
    let playerIndex: string | null = null;
    ws.playerIndex = playerIndex;

    logger.log('connection', { event: 'Client connected' }, { status: 'success' });

    ws.on('message', (message: string) => {
      try {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === 'reg') {
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
              playerIndex = player.index;
              ws.playerIndex = playerIndex;
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
            playerIndex = index;
            ws.playerIndex = playerIndex;
          }
          ws.send(JSON.stringify(response));
          const responseData: RegResponseData = JSON.parse(response.data);
          logger.log('reg', data, responseData);
          if (!responseData.error) {
            broadcastWinners();
          }
          return;
        }

        if (parsedMessage.type === 'create_room') {
          const data: CreateRoomData = parsedMessage.data;

          if (!playerIndex) {
            const errorResponse: WebSocketResponseGeneric<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player not registered',
              },
              id: parsedMessage.id,
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
            const errorResponse: WebSocketResponseGeneric<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player is already in a room or game',
              },
              id: parsedMessage.id,
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

          const response: WebSocketResponseGeneric<CreateGameResult> = {
            type: 'create_game',
            data: {
              idGame: gameId,
              idPlayer: playerIndex,
            },
            id: parsedMessage.id,
          };
          ws.send(JSON.stringify(response));
          broadcastRooms();
          logger.log('create_room', data, response);
          return;
        }

        if (parsedMessage.type === 'add_user_to_room') {
          const data: AddUserToRoomData = parsedMessage.data;

          if (!playerIndex) {
            const errorResponse: WebSocketResponseGeneric<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player not registered',
              },
              id: parsedMessage.id,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_user_to_room', data, errorResponse);
            return;
          }

          const isInRoom = Array.from(storage.rooms.values()).some((room) =>
            room.players.some((p) => p.index === playerIndex)
          );
          if (isInRoom) {
            const errorResponse: WebSocketResponseGeneric<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player is already in a room',
              },
              id: parsedMessage.id,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_user_to_room', data, errorResponse);
            return;
          }

          const room = storage.rooms.get(data.indexRoom);
          if (!room) {
            const errorResponse: WebSocketResponseGeneric<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Room not found',
              },
              id: parsedMessage.id,
            };
            console.log('add_user_to_room:', JSON.stringify(errorResponse));
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_user_to_room', data, errorResponse);
            return;
          }

          if (room.players.length >= 2) {
            const errorResponse: WebSocketResponseGeneric<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Room is full',
              },
              id: parsedMessage.id,
            };
            console.log('add_user_to_room:', JSON.stringify(errorResponse));
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

          const response: WebSocketResponseGeneric<UpdateRoomResult> = {
            type: 'update_room',
            data: {
              rooms: Array.from(storage.rooms.values())
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
                })),
            },
            id: parsedMessage.id,
          };

          const createGameResponse: WebSocketResponseGeneric<CreateGameResult> = {
            type: 'create_game',
            data: {
              idGame: game!.gameId,
              idPlayer: playerIndex,
            },
            id: parsedMessage.id,
          };

          const creatorWs = Array.from(
            wss.clients as Set<WebSocket & { playerIndex: string | null }>
          ).find((client) => room.players.some((p) => p.index === client.playerIndex));
          if (creatorWs && creatorWs.readyState === WebSocket.OPEN) {
            const createGameMsg = {
              type: 'create_game',
              data: {
                idGame: game!.gameId,
                idPlayer: room.players[0].index,
              },
              id: parsedMessage.id,
            };
            creatorWs.send(JSON.stringify(createGameMsg));
          }

          console.log('createGameResponse:', JSON.stringify(createGameResponse));
          ws.send(JSON.stringify(createGameResponse));

          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              console.log('readyState === WebSocket:', JSON.stringify(response));
              client.send(JSON.stringify(response));
            }
          });

          logger.log('add_user_to_room', data, response);

          if (room.players.length === 2) {
            storage.rooms.delete(data.indexRoom);
            broadcastRooms();
          }

          return;
        }

        if (parsedMessage.type === 'add_ships') {
          const data: AddShipsData = parsedMessage.data;

          if (!playerIndex) {
            const errorResponse: WebSocketResponseGeneric<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player not registered',
              },
              id: parsedMessage.id,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_ships', data, errorResponse);
            return;
          }

          if (playerIndex !== data.indexPlayer) {
            const errorResponse: WebSocketResponseGeneric<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Invalid player index',
              },
              id: parsedMessage.id,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_ships', data, errorResponse);
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
            logger.log('add_ships', data, errorResponse);
            return;
          }

          const player = game.players.find((p) => p.index === playerIndex);
          if (!player) {
            const errorResponse: WebSocketResponseGeneric<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Player not in game',
              },
              id: parsedMessage.id,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_ships', data, errorResponse);
            return;
          }

          // Валидация кораблей
          const validShipConfig = [
            { length: 4, type: 'huge', count: 1 },
            { length: 3, type: 'large', count: 2 },
            { length: 2, type: 'medium', count: 3 },
            { length: 1, type: 'small', count: 4 },
          ];

          const shipCounts = validShipConfig.reduce(
            (acc, config) => {
              acc[config.length] = acc[config.length] || {
                type: config.type,
                count: 0,
                max: config.count,
              };
              return acc;
            },
            {} as Record<number, { type: string; count: number; max: number }>
          );

          const occupiedCells = new Set<string>();
          for (const ship of data.ships) {
            // Проверка формата
            if (
              !Number.isInteger(ship.position.x) ||
              !Number.isInteger(ship.position.y) ||
              typeof ship.direction !== 'boolean' ||
              !Number.isInteger(ship.length) ||
              !['small', 'medium', 'large', 'huge'].includes(ship.type)
            ) {
              const errorResponse: WebSocketResponseGeneric<GenericResult> = {
                type: 'error',
                data: {
                  error: true,
                  errorText: 'Invalid ship format',
                },
                id: parsedMessage.id,
              };
              ws.send(JSON.stringify(errorResponse));
              logger.log('add_ships', data, errorResponse);
              return;
            }

            // Проверка соответствия length и type
            const config = validShipConfig.find(
              (c) => c.length === ship.length && c.type === ship.type
            );
            if (!config || shipCounts[ship.length].count >= shipCounts[ship.length].max) {
              const errorResponse: WebSocketResponseGeneric<GenericResult> = {
                type: 'error',
                data: {
                  error: true,
                  errorText: 'Invalid ship length or type',
                },
                id: parsedMessage.id,
              };
              ws.send(JSON.stringify(errorResponse));
              logger.log('add_ships', data, errorResponse);
              return;
            }
            shipCounts[ship.length].count++;

            // Проверка границ поля (10x10)
            const { x, y } = ship.position;
            const endX = ship.direction ? x + ship.length - 1 : x;
            const endY = ship.direction ? y : y + ship.length - 1;
            if (x < 0 || y < 0 || endX >= 10 || endY >= 10) {
              const errorResponse: WebSocketResponseGeneric<GenericResult> = {
                type: 'error',
                data: {
                  error: true,
                  errorText: 'Ship out of bounds',
                },
                id: parsedMessage.id,
              };
              ws.send(JSON.stringify(errorResponse));
              logger.log('add_ships', data, errorResponse);
              return;
            }

            // Проверка пересечений
            for (let i = 0; i < ship.length; i++) {
              const cellX = ship.direction ? x + i : x;
              const cellY = ship.direction ? y : y + i;
              const cellKey = `${cellX},${cellY}`;
              if (occupiedCells.has(cellKey)) {
                const errorResponse: WebSocketResponseGeneric<GenericResult> = {
                  type: 'error',
                  data: {
                    error: true,
                    errorText: 'Ships overlap',
                  },
                  id: parsedMessage.id,
                };
                ws.send(JSON.stringify(errorResponse));
                logger.log('add_ships', data, errorResponse);
                return;
              }
              occupiedCells.add(cellKey);
            }
          }

          // Проверка полного набора кораблей
          if (
            !validShipConfig.every((config) => shipCounts[config.length].count === config.count)
          ) {
            const errorResponse: WebSocketResponseGeneric<GenericResult> = {
              type: 'error',
              data: {
                error: true,
                errorText: 'Incorrect number of ships',
              },
              id: parsedMessage.id,
            };
            ws.send(JSON.stringify(errorResponse));
            logger.log('add_ships', data, errorResponse);
            return;
          }

          // Сохранение кораблей
          player.ships = data.ships;
          storage.games.set(game.gameId, game);

          // Ответ ships_added
          const response: WebSocketResponseGeneric<AddShipsResult> = {
            type: 'ships_added',
            data: {
              gameId: game.gameId,
              playerId: playerIndex,
            },
            id: parsedMessage.id,
          };
          ws.send(JSON.stringify(response));
          logger.log('add_ships', data, response);

          // Проверка, готовы ли оба игрока
          if (game.players.every((p) => p.ships.length > 0)) {
            game.players.forEach((p) => {
              const client = Array.from(
                wss.clients as Set<WebSocket & { playerIndex: string | null }>
              ).find((c) => c.playerIndex === p.index);
              if (client && client.readyState === WebSocket.OPEN) {
                const startGameResponse: WebSocketResponseGeneric<StartGameResult> = {
                  type: 'start_game',
                  data: {
                    ships: p.ships,
                    currentPlayerIndex: game.players[0].index,
                  },
                  id: parsedMessage.id,
                };
                console.log('startGameResponse:', JSON.stringify(startGameResponse));
                client.send(JSON.stringify(startGameResponse));
                logger.log('start_game', { player: p.index }, startGameResponse);
              }
            });
          }

          return;
        }

        if (parsedMessage.type === 'attack') {
          const data: AttackData = parsedMessage.data;

          if (!playerIndex) {
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

          if (playerIndex !== data.indexPlayer) {
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

          if (game.currentPlayer !== playerIndex) {
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

          const opponent = game.players.find((p) => p.index !== playerIndex);
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
          return;
        }

        const errorResponse: WebSocketResponseGeneric<GenericResult> = {
          type: 'error',
          data: {
            error: true,
            errorText: 'Unknown command',
          },
          id: parsedMessage.id,
        };
        ws.send(JSON.stringify(errorResponse));
        logger.log('error', { message: message.toString() }, errorResponse);
      } catch {
        const errorResponse: WebSocketResponseGeneric<GenericResult> = {
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
