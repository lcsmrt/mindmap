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
    .filter({ has: page.locator('[data-testid="node-title"]', { hasText: label }) });
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

  // Smoke do M12: cards de 1/2/4 linhas + palavra gigante. Verifica que o título não
  // é truncado (sem ellipsis) nem vaza horizontalmente (break-words quebra a palavra),
  // e gera screenshot para inspeção da altura dinâmica / ausência de sobreposição.
  test('M12 — cards multi-linha sem truncamento nem overflow horizontal', async ({ page }) => {
    createdNodeIds = [];
    await page.goto('/');
    await page.locator('[data-testid="map-card"]').first().click();
    await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });

    const mapId = page.url().split('/maps/').pop()!;
    const stamp = Date.now();
    const res = await page.request.get(`/api/maps/${mapId}/nodes`);
    const { nodes } = (await res.json()) as { nodes: { id: string; parentId: string | null }[] };
    const root = nodes.find((n) => n.parentId === null)!;

    const giantTitle = `M12-${stamp}-${'x'.repeat(60)}`;
    const titles = [
      `M12-${stamp}-curto`,
      `M12-${stamp} título de duas linhas que não cabe em uma só`,
      `M12-${stamp} título bem longo que precisa de várias linhas para caber inteiro dentro do card sem reticências porque o truncate foi removido`,
      giantTitle,
    ];

    for (const title of titles) {
      const r = await page.request.post('/api/nodes', { data: { mapId, parentId: root.id, title } });
      const created = (await r.json()) as { id: string };
      createdNodeIds.push(created.id);
    }

    await page.reload();
    await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });

    // A palavra gigante quebra dentro do card (break-words) — sem vazar na horizontal.
    const giant = page.locator('[data-testid="node-title"]', { hasText: giantTitle });
    await expect(giant).toBeVisible({ timeout: 5_000 });
    const overflow = await giant.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // Nenhum título usa reticências (truncate removido).
    const textOverflow = await giant.evaluate((el) => getComputedStyle(el).textOverflow);
    expect(textOverflow).not.toBe('ellipsis');

    // O título longo ocupa mais de uma linha (altura cresceu além de uma linha simples).
    const longTitle = page.locator('[data-testid="node-title"]', { hasText: 'truncate foi removido' });
    const lineCount = await longTitle.evaluate((el) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      return Math.round(el.clientHeight / lh);
    });
    expect(lineCount).toBeGreaterThan(1);

    await page.screenshot({ path: 'test-results/m12-card-responsive.png', fullPage: true });
  });
});
