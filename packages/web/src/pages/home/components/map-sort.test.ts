import { describe, it, expect } from 'vitest';
import type { MapSummary } from '@mindmap/shared';
import { filterAndSortMaps, type MapSort } from './map-sort.js';

function map(overrides: Partial<MapSummary> = {}): MapSummary {
  return {
    id: 'id',
    title: 'title',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    nodeCount: 0,
    criticalCount: 0,
    ...overrides,
  };
}

describe('filterAndSortMaps', () => {
  describe('filtering', () => {
    it('filtra por substring case-insensitive no título', () => {
      const maps = [
        map({ id: '1', title: 'Projeto Alpha' }),
        map({ id: '2', title: 'Roadmap Beta' }),
        map({ id: '3', title: 'alpha centauri' }),
      ];
      const result = filterAndSortMaps(maps, 'ALPHA', 'alpha');
      expect(result.map((m) => m.id)).toEqual(['3', '1']);
    });

    it('retorna todos quando query é vazia', () => {
      const maps = [map({ id: '1' }), map({ id: '2' })];
      const result = filterAndSortMaps(maps, '', 'recent');
      expect(result).toHaveLength(2);
    });

    it('retorna todos quando query é só whitespace', () => {
      const maps = [map({ id: '1' }), map({ id: '2' })];
      const result = filterAndSortMaps(maps, '   ', 'recent');
      expect(result).toHaveLength(2);
    });

    it('faz trim na query antes de filtrar', () => {
      const maps = [
        map({ id: '1', title: 'Alpha' }),
        map({ id: '2', title: 'Beta' }),
      ];
      const result = filterAndSortMaps(maps, '  alpha  ', 'recent');
      expect(result.map((m) => m.id)).toEqual(['1']);
    });
  });

  describe('sort recent', () => {
    it('ordena por updatedAt desc (mais recente primeiro)', () => {
      const maps = [
        map({ id: 'b', updatedAt: '2024-03-01T00:00:00.000Z' }),
        map({ id: 'a', updatedAt: '2024-05-01T00:00:00.000Z' }),
        map({ id: 'c', updatedAt: '2024-01-01T00:00:00.000Z' }),
      ];
      const result = filterAndSortMaps(maps, '', 'recent');
      expect(result.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('sort alpha', () => {
    it('ordena título A–Z ignorando acentos e caixa', () => {
      const maps = [
        map({ id: 'z', title: 'Zebra' }),
        map({ id: 'a', title: 'ábaco' }),
        map({ id: 'm', title: 'Maçã' }),
        map({ id: 'b', title: 'banana' }),
      ];
      const result = filterAndSortMaps(maps, '', 'alpha');
      expect(result.map((m) => m.id)).toEqual(['a', 'b', 'm', 'z']);
    });
  });

  describe('sort nodes', () => {
    it('ordena por nodeCount desc', () => {
      const maps = [
        map({ id: 'mid', nodeCount: 10 }),
        map({ id: 'high', nodeCount: 50 }),
        map({ id: 'low', nodeCount: 2 }),
      ];
      const result = filterAndSortMaps(maps, '', 'nodes');
      expect(result.map((m) => m.id)).toEqual(['high', 'mid', 'low']);
    });
  });

  describe('imutabilidade', () => {
    it('não muta o array de entrada', () => {
      const maps = [
        map({ id: 'b', title: 'Beta', nodeCount: 1 }),
        map({ id: 'a', title: 'Alpha', nodeCount: 9 }),
      ];
      const original = [...maps];
      const sorts: MapSort[] = ['recent', 'alpha', 'nodes'];
      for (const sort of sorts) {
        filterAndSortMaps(maps, '', sort);
      }
      expect(maps).toEqual(original);
      expect(maps[0]?.id).toBe('b');
      expect(maps[1]?.id).toBe('a');
    });
  });
});
