# Battleship WebSocket Server

A WebSocket-based server for a Battleship game, supporting multiplayer and single-player modes with a bot. Built with TypeScript, it handles user registration, game rooms, ship placement, attacks, and game state updates.

## Features

- Multiplayer mode: Create rooms, add players, place ships, and attack.
- Single-player mode: Play against a bot with automatic ship placement and attacks.
- User management: Register with name and password, track wins.
- Real-time updates: Room states and winner table broadcasted to clients.
- TypeScript: Strict typing and modular codebase.
- Logging: Colored console logs and file output (`logs.txt`).

## Prerequisites

- Node.js 22.x.x version (22.14.0 or upper)
- npm (v8 or higher)
- TypeScript (`tsc`)

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/nadyavalin/node-nodejs-websocket-battleship-server.git
   ```
   ```bash
   cd node-nodejs-websocket-battleship-server
   ```
2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   HTTP_PORT=8181
   NODE_ENV=development
   ```
   - `WS_PORT`: WebSocket server port (must match frontend's WebSocket client, default `3000`).
   - `HTTP_PORT`: Frontend HTTP server port (default `8181`).
   - `NODE_ENV`: Set to `development` for dev mode or `production` for prod mode.

## Running in Development Mode

1. **Start the server**:

   ```bash
   npm run start:dev
   ```

   This uses `ts-node` to run `src/index.ts` directly, with auto-reload on changes (requires `ts-node` and `nodemon` installed).

2. **Logs**:
   - Console output with colored logs.
   - File output at `logs.txt`.

## Running in Production Mode

1. **Build the project**:
   ```bash
   npm run build
   ```
   This compiles TypeScript to JavaScript in `dist/`.
2. **Start the server**:

   ```bash
   npm start
   ```

3. **Logs**:
   - Same as dev mode, but optimized for production (no auto-reload).

## Project Structure

```
├── src/                    # Source code for the backend server
├── src/http_server/        # HTTP server setup
│   ├── index.ts            # HTTP server configuration and initialization
├── src/utils/
│   ├── attackUtils.ts      # Attack processing utilities
│   ├── colorize.ts         # Console log coloring
│   ├── logger.ts           # Logging to console and file
│   ├── types.ts            # TypeScript interfaces and types
├── src/ws_server/          # WebSocket server and handlers
│   ├── index.ts            # WebSocket server setup
│   ├── connection.ts       # Client connection handling
│   ├── broadcast.ts        # Broadcasting room and winner updates
│   ├── storage.ts          # In-memory storage for players, rooms, games
│   ├── handlers/           # Command handlers for WebSocket messages
│   │   ├── reg.ts          # User registration handler
│   │   ├── createRoom.ts   # Game room creation handler
│   │   ├── addUserToRoom.ts # Adding users to game rooms
│   │   ├── addShips.ts     # Ship placement handler
│   │   ├── attack.ts       # Attack processing handler
│   │   ├── randomAttack.ts # Random attack handler for players and bots
│   │   ├── singlePlay.ts   # Single-player mode with bot handler
│   │   ├── handleError.ts  # Error message handling
├── dist/                   # Compiled JavaScript files
├── logs.txt                # Log file
├── .env                    # Environment variables
├── package.json            # Project metadata and scripts
├── tsconfig.json           # TypeScript configuration
```

## Scripts

- `npm run start:dev`: Run in development mode with `nodemon`.
- `npm run start`: Run in production mode with `ts-node`.
- `npm run build`: Compile TypeScript to JavaScript.
- `npm run format`: Run Prettier to format code.
- `npm run lint`: Run ESLint to run linting.
