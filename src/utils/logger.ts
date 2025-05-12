import * as fs from 'fs';
import path from 'path';

type WebSocketData =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

type WebSocketResult = Record<string, unknown> | unknown[] | null;

const logFilePath = path.resolve(__dirname, '../../logs.txt');

export const logger = {
  log(command: string, data: WebSocketData, result: WebSocketResult) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      command,
      data,
      result,
    };

    console.log(JSON.stringify(logEntry, null, 2));

    fs.appendFileSync(
      logFilePath,
      `${JSON.stringify(logEntry, null, 2)}\n`,
      'utf-8'
    );
  },
};
