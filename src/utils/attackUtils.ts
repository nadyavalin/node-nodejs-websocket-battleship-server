import { storage } from '../ws_server/storage';
import { AttackResult, Ship } from './types';

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
  attackerIndex: string,
  x: number,
  y: number
): {
  status: AttackResult['status'];
  isGameOver: boolean;
  aroundCells: { x: number; y: number }[];
} {
  const game = storage.games.get(gameId)!;
  const opponent = game.players.find((p) => p.index !== attackerIndex)!;

  let status: AttackResult['status'] = 'miss';
  let hitShip: Ship | null = null;

  for (const ship of opponent.ships) {
    const shipCells = getShipCells(ship);
    if (shipCells.some((cell) => cell.x === x && cell.y === y)) {
      status = 'shot';
      hitShip = ship;
      break;
    }
  }

  let isGameOver = false;
  let aroundCells: { x: number; y: number }[] = [];

  if (status === 'shot' && hitShip) {
    const hitCells = new Set<string>(
      game.board.cells.filter((cell) => cell.status === 'shot').map((cell) => `${cell.x},${cell.y}`)
    );
    hitCells.add(`${x},${y}`);
    const shipCells = getShipCells(hitShip);

    if (shipCells.every((cell) => hitCells.has(`${cell.x},${cell.y}`))) {
      status = 'killed';
      aroundCells = getAroundCells(hitShip);

      const opponentShipsCells = opponent.ships.flatMap(getShipCells);
      const hitCellsAll = new Set<string>(
        game.board.cells
          .filter((cell) => cell.status === 'shot')
          .map((cell) => `${cell.x},${cell.y}`)
      );
      isGameOver = opponentShipsCells.every((cell) => hitCellsAll.has(`${cell.x},${cell.y}`));
    }
  }

  game.board.cells.push({ x, y, status });
  storage.games.set(gameId, game);

  return { status, isGameOver, aroundCells };
}
