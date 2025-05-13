import * as fs from 'fs';
import * as path from 'path';
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
  StartGameResult,
  AttackData,
  AttackResult,
} from './types';
import { colorize, Color } from './colorize';

const logFilePath = path.resolve(__dirname, '../../logs.txt');

export const logger = {
  log(
    command: string,
    data:
      | RegData
      | CreateRoomData
      | AddUserToRoomData
      | AttackData
      | { event: string }
      | { message: string },
    result:
      | RegResult
      | WebSocketResponse<
          | RegResult
          | CreateGameResult
          | UpdateWinnersResult
          | UpdateRoomResult
          | GenericResult
          | StartGameResult
          | AttackResult
        >
      | { status: string }
      | { error: string }
  ) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      command,
      data,
      result,
    };

    let color: Color = 'cyan';
    if (command === 'error' || (result as RegResult).error) {
      color = 'red';
    } else if (command === 'connection' || command === 'server') {
      color = 'green';
    } else if (command === 'reg') {
      color = 'blue';
    } else if (command === 'create_room' || command === 'add_user_to_room') {
      color = 'yellow';
    } else if (command === 'update_winners') {
      color = 'magenta';
    } else if (command === 'start_game' || command === 'attack') {
      color = 'cyan';
    }

    const coloredLog = colorize(JSON.stringify(logEntry, null, 2), color, ['bold']);
    console.log('Applying color:', color);
    console.log(coloredLog);
    console.log('Writing to logs.txt:', logFilePath);
    fs.appendFileSync(logFilePath, `${JSON.stringify(logEntry, null, 2)}\n`, 'utf-8');
  },
};
