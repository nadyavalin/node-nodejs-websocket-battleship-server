import { Ship } from '../utils/types';

interface Player {
  name: string;
  password: string;
  wins: number;
  index: string;
}

interface Room {
  roomId: string;
  players: Player[];
}

interface GamePlayer {
  index: string;
  ships: Ship[];
}

export interface Game {
  gameId: string;
  players: GamePlayer[];
  currentPlayer: string;
  board: { cells: { x: number; y: number; status: 'miss' | 'shot' | 'killed' }[] };
}

export const storage = {
  players: new Map<string, Player>(),
  rooms: new Map<string, Room>(),
  games: new Map<string, Game>(),
};
