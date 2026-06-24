import { describe, it, expect } from 'vitest';
import { findDropTarget } from './useNodeDrag.js';
import type { PositionedNode } from '@/lib/useTreeLayout.js';

const A: PositionedNode = { id: 'a', x: 0, y: 0, width: 180, height: 40 };
const B: PositionedNode = { id: 'b', x: 300, y: 0, width: 180, height: 40 };

describe('findDropTarget', () => {
  it('ponto dentro de um nó retorna o id', () => {
    expect(findDropTarget({ x: 90, y: 20 }, [A, B], { excludeId: 'x' })).toBe('a');
    expect(findDropTarget({ x: 390, y: 20 }, [A, B], { excludeId: 'x' })).toBe('b');
  });

  it('ponto no vazio retorna null', () => {
    expect(findDropTarget({ x: 250, y: 200 }, [A, B], { excludeId: 'x' })).toBeNull();
  });

  it('exclui o próprio nó arrastado (excludeId)', () => {
    expect(findDropTarget({ x: 90, y: 20 }, [A, B], { excludeId: 'a' })).toBeNull();
  });

  it('com candidatos sobrepostos, retorna o primeiro da lista (determinístico)', () => {
    const overlap: PositionedNode = { id: 'overlap', x: 0, y: 0, width: 180, height: 40 };
    expect(findDropTarget({ x: 90, y: 20 }, [A, overlap], { excludeId: 'x' })).toBe('a');
    expect(findDropTarget({ x: 90, y: 20 }, [overlap, A], { excludeId: 'x' })).toBe('overlap');
  });

  it('inclui as bordas do bounds', () => {
    expect(findDropTarget({ x: 0, y: 0 }, [A], { excludeId: 'x' })).toBe('a');
    expect(findDropTarget({ x: 180, y: 40 }, [A], { excludeId: 'x' })).toBe('a');
  });
});
