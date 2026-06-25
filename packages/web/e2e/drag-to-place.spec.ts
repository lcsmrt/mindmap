import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// M9 — drag-to-place unificado: reorder, reparent posicionado e troca de lado.
// Padrão de isolamento (M6/CONCERNS.md): cada teste cria seus próprios nós via API
// com títulos únicos, verifica o resultado pela API (determinístico) e limpa no
// afterEach. O gesto em si é um drag real (pointer) para exercer slots + useNodeDrag
// + card-fantasma + optimistic ponta a ponta; os asserts são feitos sobre o estado
// persistido (não sobre ordem no DOM).

interface ApiNode {
  id: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  side: 'LEFT' | 'RIGHT' | null;
}

let createdMapId: string | null = null;
let counter = 0;

function uniqueLabel(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

// Cria um mapa próprio via API e abre — o teste fica independente do estado do DB
// compartilhado (não depende de um mapa pré-existente na lista).
async function openNewMap(page: Page): Promise<string> {
  const res = await page.request.post('/api/maps', { data: { title: uniqueLabel('m9-map') } });
  const map = (await res.json()) as { id: string };
  createdMapId = map.id;
  await page.goto(`/maps/${map.id}`);
  await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });
  return map.id;
}

async function getNodes(page: Page, mapId: string): Promise<ApiNode[]> {
  const res = await page.request.get(`/api/maps/${mapId}/nodes`);
  return ((await res.json()) as { nodes: ApiNode[] }).nodes;
}

async function createChild(
  page: Page,
  mapId: string,
  parentId: string,
  title: string,
): Promise<ApiNode> {
  const res = await page.request.post('/api/nodes', { data: { mapId, parentId, title } });
  return (await res.json()) as ApiNode;
}

async function reloadCanvas(page: Page): Promise<void> {
  await page.reload();
  await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });
}

// Arrasta o nó `sourceId` (a partir do seu centro) até o ponto de tela (tx, ty). Drag
// real via pointer events; aguarda o card-fantasma aparecer e a mutação assentar.
async function dragToPoint(page: Page, sourceId: string, tx: number, ty: number): Promise<void> {
  const src = await page.locator(`[data-node-id="${sourceId}"]`).boundingBox();
  if (!src) throw new Error('boundingBox indisponível');
  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.mouse.move(tx, ty, { steps: 3 }); // assenta para o targetSlot ser calculado
  await expect(page.getByTestId('ghost-slot')).toBeVisible({ timeout: 2_000 });
  await page.mouse.up();
  await expect(page.getByText('Salvando…')).toHaveCount(0, { timeout: 5_000 });
}

// Centro do nó `targetId` deslocado por (dx, dy) em px de tela.
async function nodePoint(
  page: Page,
  targetId: string,
  offset: { dx?: number; dy?: number } = {},
): Promise<{ x: number; y: number }> {
  const b = await page.locator(`[data-node-id="${targetId}"]`).boundingBox();
  if (!b) throw new Error('boundingBox indisponível');
  return { x: b.x + b.width / 2 + (offset.dx ?? 0), y: b.y + b.height / 2 + (offset.dy ?? 0) };
}

async function dragOnto(
  page: Page,
  sourceId: string,
  targetId: string,
  offset: { dx?: number; dy?: number } = {},
): Promise<void> {
  const p = await nodePoint(page, targetId, offset);
  await dragToPoint(page, sourceId, p.x, p.y);
}

test.describe('M9 — drag-to-place', () => {
  test.beforeEach(() => {
    createdMapId = null;
  });

  test.afterEach(async ({ page }) => {
    if (createdMapId) {
      await page.request.delete(`/api/maps/${createdMapId}`).catch(() => {});
    }
    createdMapId = null;
  });

  test('reorder entre irmãos altera a ordem e persiste após reload', async ({ page }) => {
    const mapId = await openNewMap(page);
    const nodes = await getNodes(page, mapId);
    const root = nodes.find((n) => n.parentId === null)!;

    // Pai com dois filhos profundos (sem lado), ordem inicial [C1, C2].
    const parent = await createChild(page, mapId, root.id, uniqueLabel('reorder-parent'));
    const c1 = await createChild(page, mapId, parent.id, uniqueLabel('reorder-c1'));
    const c2 = await createChild(page, mapId, parent.id, uniqueLabel('reorder-c2'));
    expect(c1.sortOrder).toBeLessThan(c2.sortOrder);
    await reloadCanvas(page);

    // Arrasta C2 sobre C1 (mira o topo de C1) → C2 deve cair antes de C1.
    await dragOnto(page, c2.id, c1.id, { dy: -8 });

    await reloadCanvas(page);
    const after = await getNodes(page, mapId);
    const kids = after.filter((n) => n.parentId === parent.id).sort((a, b) => a.sortOrder - b.sortOrder);
    expect(kids.map((n) => n.id)).toEqual([c2.id, c1.id]);
  });

  test('reparent posicionado coloca o nó sob o novo pai numa posição do meio', async ({ page }) => {
    const mapId = await openNewMap(page);
    const nodes = await getNodes(page, mapId);
    const root = nodes.find((n) => n.parentId === null)!;

    // P1 com dois filhos [C1, C2]; D vive sob P2. O alvo é o gap entre C1 e C2.
    const p1 = await createChild(page, mapId, root.id, uniqueLabel('reparent-p1'));
    const c1 = await createChild(page, mapId, p1.id, uniqueLabel('reparent-c1'));
    const c2 = await createChild(page, mapId, p1.id, uniqueLabel('reparent-c2'));
    const p2 = await createChild(page, mapId, root.id, uniqueLabel('reparent-p2'));
    const d = await createChild(page, mapId, p2.id, uniqueLabel('reparent-d'));
    expect(d.parentId).toBe(p2.id);
    await reloadCanvas(page);

    // Solta D no ponto médio entre C1 e C2 (slot inequívoco do grupo de P1, no meio).
    const c1Box = await page.locator(`[data-node-id="${c1.id}"]`).boundingBox();
    const c2Box = await page.locator(`[data-node-id="${c2.id}"]`).boundingBox();
    if (!c1Box || !c2Box) throw new Error('boundingBox indisponível');
    const midX = c1Box.x + c1Box.width / 2;
    const midY = (c1Box.y + c1Box.height + c2Box.y) / 2;
    await dragToPoint(page, d.id, midX, midY);

    await reloadCanvas(page);
    const after = await getNodes(page, mapId);
    const moved = after.find((n) => n.id === d.id)!;
    expect(moved.parentId).toBe(p1.id); // virou filho de P1
    // caiu entre C1 e C2 na ordem
    const kids = after.filter((n) => n.parentId === p1.id).sort((a, b) => a.sortOrder - b.sortOrder);
    expect(kids.map((n) => n.id)).toEqual([c1.id, d.id, c2.id]);
  });

  test('arrastar ramo de 1º nível para o outro lado troca o lado e persiste', async ({ page }) => {
    const mapId = await openNewMap(page);
    const nodes = await getNodes(page, mapId);
    const root = nodes.find((n) => n.parentId === null)!;

    // Dois filhos de 1º nível: o create alterna lados (1º RIGHT, 2º LEFT).
    const a = await createChild(page, mapId, root.id, uniqueLabel('side-a'));
    const b = await createChild(page, mapId, root.id, uniqueLabel('side-b'));
    expect(a.side).toBe('RIGHT');
    expect(b.side).toBe('LEFT');
    await reloadCanvas(page);

    // Arrasta A (direita) sobre B (esquerda) → A passa para o lado esquerdo.
    await dragOnto(page, a.id, b.id);

    await reloadCanvas(page);
    const movedA = (await getNodes(page, mapId)).find((n) => n.id === a.id)!;
    expect(movedA.parentId).toBe(root.id);
    expect(movedA.side).toBe('LEFT');
  });
});
