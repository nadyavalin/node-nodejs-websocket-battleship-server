import * as fs from 'fs';
import * as path from 'path';
import { RegData, RegResult, EventData, EventResult, GenericData, GenericResult } from './types';
import { colorize, Color } from './colorize';

const logFilePath = path.resolve(__dirname, '../../logs.txt');

export const logger = {
  log(
    command: string,
    data: RegData | EventData | GenericData,
    result: RegResult | EventResult | GenericResult
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
    } else if (
      command === 'connection' ||
      command === 'server' ||
      (result as EventResult).status === 'success'
    ) {
      color = 'green';
    } else if (command === 'reg') {
      color = 'blue';
    }

    console.log(colorize(JSON.stringify(logEntry, null, 2), color, ['bold']));

    fs.appendFileSync(logFilePath, `${JSON.stringify(logEntry, null, 2)}\n`, 'utf-8');
  },
};
