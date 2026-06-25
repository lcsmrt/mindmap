import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Smoke visual (gate L-005): captura screenshots das duas telas do reskin para
// inspeção manual. Os PNGs vão para test-results/ (gitignored). Cria um nó rico
// (cor + status + responsável) via API, screenshota e limpa.

let createdNodeIds: string[] = [];

async function createRichNode(page: Page, label: string): Promise<Locator> {
  const mapId = page.url().split('/maps/').pop()!;

  const res = await page.request.get(`/api/maps/${mapId}/nodes`);
  const { nodes } = (await res.json()) as { nodes: { id: string; parentId: string | null }[] };
  const root = nodes.find((n) => n.parentId === null)!;

  const createRes = await page.request.post('/api/nodes', {
    data: { mapId, parentId: root.id, title: label },
  });
  const created = (await createRes.json()) as { id: string };
  createdNodeIds.push(created.id);

  await page.request.patch(`/api/nodes/${created.id}`, {
    data: { bgColor: '#bcd0f2', status: 'IN_PROGRESS', assignee: 'Lucas Martins', isCritical: true },
  });

  await page.reload();
  await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });

  const node = page
    .locator('[data-testid="mind-node"]')
    .filter({ has: page.locator('.truncate', { hasText: label }) });
  await expect(node).toBeVisible({ timeout: 5_000 });
  return node;
}

test.describe('smoke visual (L-005)', () => {
  test.afterEach(async ({ page }) => {
    for (const id of createdNodeIds) {
      await page.request.delete(`/api/nodes/${id}`).catch(() => {});
    }
    createdNodeIds = [];
  });

  test('home redesenhada (grid de cards)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Meus Mapas' })).toBeVisible();
    await expect(page.locator('[data-testid="map-card"]').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'test-results/home.png', fullPage: true });
  });

  test('canvas com nó rico (cor/status/responsável/crítico)', async ({ page }) => {
    createdNodeIds = [];
    await page.goto('/');
    await page.locator('[data-testid="map-card"]').first().click();
    await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });

    const node = await createRichNode(page, `Smoke-${Date.now()}`);
    await expect(node.getByTestId('node-task-indicators')).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: 'test-results/canvas.png', fullPage: true });
  });
});
