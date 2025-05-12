import * as dotenv from 'dotenv';
dotenv.config();

import { httpServer } from './src/http_server/index';
import { startWebSocketServer } from './src/ws_server/index';

const HTTP_PORT = Number(process.env.HTTP_PORT) || 8181;
const WS_PORT = Number(process.env.WS_PORT) || 8080;

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);

console.log(`Start WebSocket server on the ${WS_PORT} port!`);
startWebSocketServer(WS_PORT);
