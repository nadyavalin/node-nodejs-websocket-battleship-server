import { storage } from '../ws_server/storage';
import { Ship } from './types';

export function getShipCells(ship: Ship): { x: number; y: number }[] {
  const { x: shipX, y: shipY } = ship.position;
  const cells: { x: number; y: number }[] = [];
  for (let i = 0; i < ship.length; i++) {
    const cellX = ship.direction ? shipX + i : shipX;
    const cellY = ship.direction ? shipY : shipY + i;
    cells.push({ x: cellX, y: cellY });
  }
  return cells;
}

export function getAroundCells(ship: Ship): { x: number; y: number }[] {
  const { x: shipX, y: shipY } = ship.position;
  const shipCells = getShipCells(ship);
  const aroundCells: { x: number; y: number }[] = [];

  const range = ship.direction ? ship.length : 1;
  const rangeY = ship.direction ? 1 : ship.length;

  for (let i = -1; i <= range; i++) {
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
} {
  const game = storage.games.get(gameId);
  if (!game) {
    return { status: 'miss', isGameOver: false, aroundCells: [] };
  }

  const opponent = game.players.find((p) => p.index !== playerIndex);
  if (!opponent) {
    return { status: 'miss', isGameOver: false, aroundCells: [] };
  }

  const currentHitKey = `${x},${y}`;
  let status: 'miss' | 'shot' | 'killed' = 'miss';
  let hitShip: Ship | null = null;

  for (const ship of opponent.ships) {
    const shipCells = getShipCells(ship).map((cell) => `${cell.x},${cell.y}`);
    if (shipCells.includes(currentHitKey)) {
      hitShip = ship;
      status = 'shot';
      break;
    }
  }

  const existingCellIndex = game.board.cells.findIndex((cell) => cell.x === x && cell.y === y);
  const isNewAttack = existingCellIndex === -1;

  if (!isNewAttack) {
    status = game.board.cells[existingCellIndex].status;
  } else {
    game.board.cells.push({ x, y, status });
  }

  if (hitShip && isNewAttack && status === 'shot') {
    const shipCells = getShipCells(hitShip);
    const shipCellKeys = shipCells.map((cell) => `${cell.x},${cell.y}`);

    const allShipCellsHit = shipCellKeys.every((cellKey) =>
      game.board.cells.some(
        (cell) =>
          `${cell.x},${cell.y}` === cellKey && (cell.status === 'shot' || cell.status === 'killed')
      )
    );

    if (allShipCellsHit) {
      status = 'killed';
      shipCells.forEach((shipCell) => {
        const cellIndex = game.board.cells.findIndex(
          (c) => c.x === shipCell.x && c.y === shipCell.y
        );
        if (cellIndex !== -1) {
          game.board.cells[cellIndex].status = 'killed';
        }
      });
    }
  }

  const allShipsKilled = opponent.ships.every((ship) => {
    const shipCells = getShipCells(ship);
    return shipCells.every((shipCell) =>
      game.board.cells.some(
        (cell) =>
          cell.x === shipCell.x &&
          cell.y === shipCell.y &&
          (cell.status === 'shot' || cell.status === 'killed')
      )
    );
  });

  return {
    status,
    isGameOver: allShipsKilled,
    aroundCells: status === 'killed' && hitShip ? getAroundCells(hitShip) : [],
  };
}
