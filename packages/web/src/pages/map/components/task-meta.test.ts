import { describe, it, expect } from 'vitest';
import type { NodeDto } from '@mindmap/shared';
import {
  STATUS_OPTIONS,
  statusMeta,
  getInitials,
  hasTaskProps,
} from './task-meta.js';

function makeNode(overrides: Partial<NodeDto> & { id: string }): NodeDto {
  return {
    mapId: 'map-1',
    parentId: null,
    title: overrides.id,
    sortOrder: 0,
    bgColor: null,
    textColor: null,
    status: null,
    assignee: null,
    isCritical: false,
    side: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('STATUS_OPTIONS', () => {
  it('exporta os 4 status com value/label/cor', () => {
    expect(STATUS_OPTIONS.map((s) => s.value)).toEqual([
      'PENDING',
      'IN_PROGRESS',
      'DONE',
      'BLOCKED',
    ]);
    for (const opt of STATUS_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('statusMeta', () => {
  it('faz lookup do StatusMeta correspondente', () => {
    expect(statusMeta('IN_PROGRESS').label).toBe('Em andamento');
    expect(statusMeta('IN_PROGRESS').color).toBe('#3b82f6');
    expect(statusMeta('DONE').value).toBe('DONE');
  });
});

describe('getInitials', () => {
  it('usa as iniciais das 2 primeiras palavras quando há 2+ palavras', () => {
    expect(getInitials('Lucas Martins')).toBe('LM');
    expect(getInitials('Ana Beatriz Costa')).toBe('AB');
  });

  it('usa as 2 primeiras letras quando há 1 palavra', () => {
    expect(getInitials('Lucas')).toBe('LU');
  });

  it('sempre retorna uppercase e no máximo 2 chars', () => {
    expect(getInitials('lucas martins')).toBe('LM');
    expect(getInitials('x')).toBe('X');
  });

  it('lida com acento e emoji sem quebrar (Array.from)', () => {
    expect(getInitials('Ásgard')).toBe('ÁS');
    expect(getInitials('🚀rocket')).toBe('🚀R');
    expect(getInitials('🚀 boom')).toBe('🚀B');
  });

  it('trata espaços extras (trim/split robusto)', () => {
    expect(getInitials('  Lucas   Martins  ')).toBe('LM');
    expect(getInitials('   Lucas   ')).toBe('LU');
  });

  it('retorna string vazia para entrada vazia ou só espaços', () => {
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
  });
});

describe('hasTaskProps', () => {
  it('true quando status definido (campo isolado)', () => {
    expect(hasTaskProps(makeNode({ id: 'n', status: 'PENDING' }))).toBe(true);
  });

  it('true quando assignee não-vazio (campo isolado)', () => {
    expect(hasTaskProps(makeNode({ id: 'n', assignee: 'Lucas' }))).toBe(true);
  });

  it('false quando só isCritical (▲ vai para o título, não para o rodapé)', () => {
    expect(hasTaskProps(makeNode({ id: 'n', isCritical: true }))).toBe(false);
  });

  it('false quando todos vazios/null/false', () => {
    expect(hasTaskProps(makeNode({ id: 'n' }))).toBe(false);
  });

  it('false quando assignee é string vazia', () => {
    expect(hasTaskProps(makeNode({ id: 'n', assignee: '' }))).toBe(false);
  });

  it('retorna boolean de verdade (não truthy/falsy)', () => {
    expect(hasTaskProps(makeNode({ id: 'n' }))).toStrictEqual(false);
    expect(hasTaskProps(makeNode({ id: 'n', assignee: 'Lucas' }))).toStrictEqual(
      true,
    );
  });
});
