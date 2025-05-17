import { GamePlayer } from '../utils/types';

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

export interface Game {
  gameId: string;
  players: GamePlayer[];
  currentPlayer: string;
}

export const storage = {
  players: new Map<string, Player>(),
  rooms: new Map<string, Room>(),
  games: new Map<string, Game>(),
};
