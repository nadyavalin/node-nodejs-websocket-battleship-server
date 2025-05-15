export interface RegData {
  name: string;
  password: string;
}

export interface RegResponseData {
  name: string;
  index: string;
  error: boolean;
  errorText: string;
}

export interface WebSocketResponse {
  type: string;
  data: string; // JSON-строка
  id: number;
}

export interface WebSocketResponseGeneric<T> {
  type: string;
  data: T;
  id: number;
}

export interface RegMessage {
  name: string;
  password: string;
}

export type CreateRoomMessage = Record<string, never>;

export interface AddUserToRoomMessage {
  indexRoom: string;
}

export interface AddShipsMessage {
  gameId: string;
  ships: Ship[];
  indexPlayer: string;
}

export interface AttackMessage {
  gameId: string;
  x: number;
  y: number;
  indexPlayer: string;
}

export interface RandomAttackMessage {
  gameId: string;
  indexPlayer: string;
}

export interface Winner {
  name: string;
  wins: number;
}

export type UpdateWinnersResult = Winner[];

export type CreateRoomData = object;

export interface CreateGameResult {
  idGame: string;
  idPlayer: string;
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
  rooms: RoomInfo[];
}

export interface GenericResult {
  type?: string;
  data?: { error: boolean; errorText: string; [key: string]: unknown };
  id?: number;
  status?: string;
  [key: string]: unknown;
}

export interface Ship {
  position: {
    x: number;
    y: number;
  };
  direction: boolean; // true = horizontal, false = vertical
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
}

export interface AddShipsData {
  gameId: string;
  ships: Ship[];
  indexPlayer: string;
}

export interface AddShipsResult {
  gameId: string;
  playerId: string;
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
  status: 'miss' | 'shot' | 'killed';
  position: { x: number; y: number };
  currentPlayer: string;
}

export interface TurnResult {
  currentPlayer: string;
}

export interface FinishResult {
  winPlayer: string;
}
