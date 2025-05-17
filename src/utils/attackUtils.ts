import { storage } from '../ws_server/storage';
import { Ship } from './types';
import { logger } from '../utils/logger';

export function getShipCells(ship: Ship): { x: number; y: number }[] {
  const { x: shipX, y: shipY } = ship.position;
  const cells: { x: number; y: number }[] = [];
  for (let i = 0; i < ship.length; i++) {
    const cellX = ship.direction ? shipX : shipX + i;
    const cellY = ship.direction ? shipY + i : shipY;
    cells.push({ x: cellX, y: cellY });
  }
  return cells;
}

export function getAroundCells(ship: Ship): { x: number; y: number }[] {
  const shipCells = getShipCells(ship);
  const aroundCells: { x: number; y: number }[] = [];
  const rangeX = ship.direction ? 1 : ship.length;
  const rangeY = ship.direction ? ship.length : 1;
  const shipX = ship.position.x;
  const shipY = ship.position.y;

  for (let i = -1; i <= rangeX; i++) {
    for (let j = -1; j <= rangeY; j++) {
      const cellX = ship.direction ? shipX + i : shipX + j;
      const cellY = ship.direction ? shipY + j : shipY + i;
      if (
        cellX >= 0 &&
        cellX < 10 &&
        cellY >= 0 &&
        cellY < 10 &&
        !shipCells.some((cell) => cell.x === cellX && cell.y === cellY)
      ) {
        aroundCells.push({ x: cellX, y: cellY });
      }
    }
  }
  return aroundCells;
}

export function processAttack(
  gameId: string,
  playerIndex: string,
  x: number,
  y: number
): {
  status: 'miss' | 'shot' | 'killed';
  isGameOver: boolean;
  aroundCells: { x: number; y: number }[];
  error?: string;
} {
  const game = storage.games.get(gameId);
  if (!game) {
    logger.log('attack_error', { gameId, x, y, error: 'Game not found' }, { status: 'error' });
    return { status: 'miss', isGameOver: false, aroundCells: [], error: 'Game not found' };
  }

  const attacker = game.players.find((p) => p.index === playerIndex);
  const opponent = game.players.find((p) => p.index !== playerIndex);
  if (!attacker || !opponent) {
    logger.log(
      'attack_error',
      { gameId, x, y, error: 'Player or opponent not found' },
      { status: 'error' }
    );
    return {
      status: 'miss',
      isGameOver: false,
      aroundCells: [],
      error: 'Player or opponent not found',
    };
  }

  if (x < 0 || x >= 10 || y < 0 || y >= 10) {
    logger.log(
      'attack_error',
      { gameId, x, y, error: 'Attack out of bounds' },
      { status: 'error' }
    );
    return { status: 'miss', isGameOver: false, aroundCells: [], error: 'Attack out of bounds' };
  }

  if (!attacker.board) {
    attacker.board = { cells: [] };
  }
  const existingCell = attacker.board.cells.find((cell) => cell.x === x && cell.y === y);
  if (existingCell) {
    logger.log(
      'attack_error',
      {
        gameId,
        x,
        y,
        error: 'Cell already attacked',
        existingStatus: existingCell.status,
      },
      { status: 'error' }
    );
    return {
      status: 'miss',
      isGameOver: false,
      aroundCells: [],
      error: 'Cell already attacked',
    };
  }

  const currentHitKey = `${x},${y}`;
  let status: 'miss' | 'shot' | 'killed' = 'miss';
  let hitShip: Ship | null = null;

  for (const ship of opponent.ships) {
    const shipCells = getShipCells(ship);
    const shipCellKeys = shipCells.map((cell) => `${cell.x},${cell.y}`);
    if (shipCellKeys.includes(currentHitKey)) {
      hitShip = ship;
      status = 'shot';
      break;
    }
  }

  attacker.board.cells.push({ x, y, status });

  if (hitShip && status === 'shot') {
    const shipCells = getShipCells(hitShip);
    const shipCellKeys = shipCells.map((cell) => `${cell.x},${cell.y}`);

    const allShipCellsHit = shipCellKeys.every((cellKey) =>
      attacker.board.cells.some(
        (cell) =>
          `${cell.x},${cell.y}` === cellKey && (cell.status === 'shot' || cell.status === 'killed')
      )
    );

    if (allShipCellsHit) {
      status = 'killed';
      shipCells.forEach((shipCell) => {
        const cellIndex = attacker.board.cells.findIndex(
          (c) => c.x === shipCell.x && c.y === shipCell.y
        );
        if (cellIndex !== -1) {
          attacker.board.cells[cellIndex].status = 'killed';
        } else {
          attacker.board.cells.push({ x: shipCell.x, y: shipCell.y, status: 'killed' });
        }
      });
    }
  }

  logger.log(
    'attack_debug',
    {
      gameId,
      playerIndex,
      attack: { x, y },
      status,
      hitShip: hitShip
        ? {
            type: hitShip.type,
            position: hitShip.position,
            length: hitShip.length,
            direction: hitShip.direction,
          }
        : null,
      boardCells: attacker.board.cells.map((cell) => ({
        x: cell.x,
        y: cell.y,
        status: cell.status,
      })),
      opponentShips: opponent.ships.map((ship) => ({
        type: ship.type,
        position: ship.position,
        length: ship.length,
        direction: ship.direction,
        cells: getShipCells(ship),
      })),
    },
    { status: 'debug' }
  );

  const allShipsKilled = opponent.ships.every((ship) => {
    const shipCells = getShipCells(ship).map((cell) => `${cell.x},${cell.y}`);
    return shipCells.every((cell) =>
      attacker.board.cells.some(
        (c) => `${c.x},${c.y}` === cell && (c.status === 'shot' || c.status === 'killed')
      )
    );
  });

  return {
    status,
    isGameOver: allShipsKilled,
    aroundCells: status === 'killed' && hitShip ? getAroundCells(hitShip) : [],
  };
}
