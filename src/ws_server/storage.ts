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

interface Ship {
  x: number;
  y: number;
  direction: 'horizontal' | 'vertical';
  length: number;
}

interface Board {
  cells: Array<{
    x: number;
    y: number;
    status: 'empty' | 'ship' | 'hit' | 'miss';
  }>;
}

interface Game {
  gameId: string;
  players: { index: string; ships: Ship[] }[];
  currentPlayer: string;
  board: Board;
}

export const storage = {
  players: new Map<string, Player>(),
  rooms: new Map<string, Room>(),
  games: new Map<string, Game>(),
};
