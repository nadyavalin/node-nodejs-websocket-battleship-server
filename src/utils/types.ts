export interface RegData {
  name: string;
  password: string;
}

export interface RegResult {
  name: string;
  index: string;
  error: boolean;
  errorText: string;
}

export interface WebSocketResponse<T> {
  type: string;
  data: T;
  id: number;
}

export type CreateRoomData = object;

export interface CreateGameResult {
  idGame: string;
  idPlayer: string;
}

export interface Winner {
  name: string;
  wins: number;
}

export interface UpdateWinnersResult {
  winners: Winner[];
}

export interface AddUserToRoomData {
  indexRoom: string;
}

export interface RoomUser {
  name: string;
  index: string;
}

export interface RoomInfo {
  roomId: string;
  roomUsers: RoomUser[];
}

export interface UpdateRoomResult {
  room: RoomUser[];
}

export interface GenericResult {
  type?: string;
  data?: { error: boolean; errorText: string; [key: string]: unknown };
  id?: number;
  status?: string;
  [key: string]: unknown;
}

export interface Ship {
  x: number;
  y: number;
  direction: 'horizontal' | 'vertical';
  length: number;
}

export interface StartGameResult {
  ships: Ship[];
  currentPlayerIndex: string;
}

export interface AttackData {
  gameId: string;
  x: number;
  y: number;
  indexPlayer: string;
}

export interface AttackResult {
  status: 'miss' | 'hit' | 'killed' | 'gameover';
  position?: { x: number; y: number };
  currentPlayer?: string;
  winner?: string;
}
