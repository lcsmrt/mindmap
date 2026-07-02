import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// M15 — resize horizontal do card.
// Padrão de isolamento: cada teste cria mapa e nós próprios via API com títulos únicos
// e limpa no afterEach. O gesto de arraste usa pointer real para exercer a alça,
// activeResize, persistência e setPointerCapture ponta a ponta.

interface ApiNode {
  id: string;
  parentId: string | null;
  title: string;
  width: number | null;
}

let createdNodeIds: string[] = [];
let createdMapIds: string[] = [];
let counter = 0;

function uniqueLabel(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function openNewMap(page: Page): Promise<string> {
  const res = await page.request.post('/api/maps', { data: { title: uniqueLabel('m15-map') } });
  const map = (await res.json()) as { id: string };
  createdMapIds.push(map.id);
  await page.goto(`/maps/${map.id}`);
  await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });
  return map.id;
}

async function getNodes(page: Page, mapId: string): Promise<ApiNode[]> {
  const res = await page.request.get(`/api/maps/${mapId}/nodes`);
  return ((await res.json()) as { nodes: ApiNode[] }).nodes;
}

async function createChild(page: Page, mapId: string, parentId: string, title: string): Promise<ApiNode> {
  const res = await page.request.post('/api/nodes', { data: { mapId, parentId, title } });
  const node = (await res.json()) as ApiNode;
  createdNodeIds.push(node.id);
  return node;
}

async function dragResizeHandle(page: Page, nodeId: string, screenDx: number): Promise<void> {
  const nodeEl = page.locator(`[data-node-id="${nodeId}"]`);
  await expect(nodeEl).toBeVisible({ timeout: 5_000 });
  await nodeEl.hover();

  const handle = nodeEl.locator('[data-testid="resize-handle"]');
  await expect(handle).toBeVisible({ timeout: 2_000 });
  const box = await handle.boundingBox();
  if (!box) throw new Error('resize-handle sem boundingBox');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + screenDx, startY, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByText('Salvando…')).toHaveCount(0, { timeout: 5_000 });
}

test.describe('M15 — card resize', () => {
  test.afterEach(async ({ page }) => {
    for (const id of [...createdNodeIds].reverse()) {
      await page.request.delete(`/api/nodes/${id}`).catch(() => {});
    }
    createdNodeIds = [];
    for (const id of createdMapIds) {
      await page.request.delete(`/api/maps/${id}`).catch(() => {});
    }
    createdMapIds = [];
  });

  test('arrastar alça para a direita persiste a largura após reload', async ({ page }) => {
    const mapId = await openNewMap(page);
    const nodes = await getNodes(page, mapId);
    const root = nodes.find((n) => n.parentId === null)!;
    // Título longo garante teto de conteúdo acima do NODE_WIDTH (180px).
    const child = await createChild(
      page,
      mapId,
      root.id,
      uniqueLabel('m15-resize-titulo-suficientemente-longo-para-caber'),
    );

    await page.reload();
    await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });

    await dragResizeHandle(page, child.id, 80);

    await page.reload();
    await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });

    const afterNodes = await getNodes(page, mapId);
    const persisted = afterNodes.find((n) => n.id === child.id);
    // arrastar para a direita alarga: a largura persistida cresce além do default (180).
    expect(persisted?.width).toBeGreaterThan(180);
  });

  test('arrastar alça não altera o pai do nó (não dispara drag-to-place)', async ({ page }) => {
    const mapId = await openNewMap(page);
    const nodes = await getNodes(page, mapId);
    const root = nodes.find((n) => n.parentId === null)!;
    const child = await createChild(page, mapId, root.id, uniqueLabel('m15-no-reparent'));

    await page.reload();
    await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });

    await dragResizeHandle(page, child.id, 60);

    const afterNodes = await getNodes(page, mapId);
    const afterChild = afterNodes.find((n) => n.id === child.id);
    expect(afterChild?.parentId).toBe(root.id);
  });
});
