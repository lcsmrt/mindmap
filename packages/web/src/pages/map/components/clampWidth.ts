export function clampWidth(
  startWidth: number,
  worldDx: number,
  floor: number,
  ceiling: number,
): number {
  return Math.max(floor, Math.min(startWidth + worldDx, Math.max(floor, ceiling)));
}
