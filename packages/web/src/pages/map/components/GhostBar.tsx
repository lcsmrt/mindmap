import type { Slot } from '../lib/slots.js';

const GHOST_BAR_HEIGHT = 6; // 6px cabe no GAP_Y=40 sem invadir cards

interface GhostBarProps {
  targetSlot: Slot | null;
}

export function GhostBar({ targetSlot }: GhostBarProps) {
  if (!targetSlot) return null;
  return (
    <div
      className="absolute rounded-full bg-primary shadow-sm"
      data-testid="ghost-slot"
      style={{
        left: targetSlot.colX,
        top: targetSlot.anchorY - GHOST_BAR_HEIGHT / 2,
        width: targetSlot.colWidth,
        height: GHOST_BAR_HEIGHT,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    />
  );
}
