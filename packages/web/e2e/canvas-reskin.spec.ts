import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// E2e do reskin do canvas (M10, história P1). Cobre a toolbar revelada no hover
// (T10) e o preview ao vivo + persistência no dialog de edição (T11), usando nós
// criados via API com título único — o mesmo padrão determinístico de
// task-properties.spec.ts, já que o DB e2e é compartilhado/acumulativo.

async function openFirstMap(page: Page) {
  await page.goto('/');
  await page.locator('[data-testid="map-card"]').first().click();
  await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });
}

let createdNodeIds: string[] = [];

async function createUniqueNode(page: Page, label: string): Promise<Locator> {
  const mapId = page.url().split('/maps/').pop()!;

  const res = await page.request.get(`/api/maps/${mapId}/nodes`);
  const { nodes } = (await res.json()) as { nodes: { id: string; parentId: string | null }[] };
  const root = nodes.find((n) => n.parentId === null)!;

  const createRes = await page.request.post('/api/nodes', {
    data: { mapId, parentId: root.id, title: label },
  });
  const created = (await createRes.json()) as { id: string };
  createdNodeIds.push(created.id);

  await page.reload();
  await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });

  const node = page
    .locator('[data-testid="mind-node"]')
    .filter({ has: page.locator('[data-testid="node-title"]', { hasText: label }) });
  await expect(node).toBeVisible({ timeout: 5_000 });
  return node;
}

let counter = 0;
function uniqueLabel(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

test.describe('canvas reskin (M10)', () => {
  test.beforeEach(() => {
    createdNodeIds = [];
  });

  test.afterEach(async ({ page }) => {
    for (const id of createdNodeIds) {
      await page.request.delete(`/api/nodes/${id}`).catch(() => {});
    }
    createdNodeIds = [];
  });

  test('toolbar fica oculta até o hover; clicar em "Editar nó" abre o dialog', async ({ page }) => {
    await openFirstMap(page);
    const node = await createUniqueNode(page, uniqueLabel('hover'));

    const editBtn = node.getByTitle('Editar nó');

    // Sem hover, a toolbar está oculta: opacity-0 + pointer-events-none. O
    // Playwright ignora opacity ao avaliar visibilidade, mas respeita
    // pointer-events; logo, a marca real de "oculta" é o botão não ser clicável.
    // Confirmamos via toolbar com opacity 0 e clique bloqueado (timeout curto).
    const toolbar = editBtn.locator('xpath=ancestor::div[1]');
    await expect(toolbar).toHaveCSS('opacity', '0');
    let blocked = false;
    await editBtn.click({ trial: true, timeout: 1_000 }).catch(() => {
      blocked = true;
    });
    expect(blocked).toBe(true);

    // O hover revela a toolbar (group-hover:opacity-100 + pointer-events-auto),
    // tornando o botão clicável; clicar abre o dialog.
    await node.hover();
    await expect(toolbar).toHaveCSS('opacity', '1', { timeout: 2_000 });
    await editBtn.click();
    await expect(page.getByText('Editar nó')).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await expect(page.getByText('Editar nó')).not.toBeVisible({ timeout: 3_000 });
  });

  test('preview ao vivo reflete cor/status e a mudança persiste no nó do canvas', async ({
    page,
  }) => {
    await openFirstMap(page);
    const label = uniqueLabel('preview');
    const node = await createUniqueNode(page, label);
    const nodeId = createdNodeIds[createdNodeIds.length - 1]!;
    const mapId = page.url().split('/maps/').pop()!;

    // Abre o dialog do nó recém-criado.
    await node.hover();
    await node.getByTitle('Editar nó').click();
    await expect(page.getByText('Editar nó')).toBeVisible({ timeout: 3_000 });

    const dialog = page.getByRole('dialog');

    // Troca a cor de fundo num swatch da paleta (T11: "Verde claro" = #b6e6c1).
    await dialog.locator('button[aria-label="Verde claro"]').click();

    // O preview ao vivo dentro do dialog reflete o novo fundo imediatamente.
    // O preview é o cartão que exibe o título do nó (label único); subimos do
    // <span> de título até o contêiner arredondado do cartão para checar o fundo.
    const preview = dialog
      .locator('span', { hasText: label })
      .locator('xpath=ancestor::div[contains(@class,"rounded-")][1]');
    await expect(preview).toHaveCSS('background-color', 'rgb(182, 230, 193)', { timeout: 3_000 });

    // Troca o status; o preview ganha o ponto colorido (IN_PROGRESS = #3b82f6).
    await page.getByTestId('status-btn-IN_PROGRESS').click();
    await expect(
      preview.locator('span').filter({ hasText: 'Em andamento' }).locator('span').first(),
    ).toHaveCSS('background-color', 'rgb(59, 130, 246)', { timeout: 3_000 });

    await page.keyboard.press('Escape');
    await expect(page.getByText('Editar nó')).not.toBeVisible({ timeout: 3_000 });

    // O nó no canvas reflete o novo fundo...
    const nodeDiv = node.locator('div').first();
    await expect(nodeDiv).toHaveCSS('background-color', 'rgb(182, 230, 193)', { timeout: 3_000 });

    // ...e o rodapé de indicadores mostra o status escolhido (rótulo em texto).
    const indicators = node.getByTestId('node-task-indicators');
    await expect(indicators).toBeVisible({ timeout: 3_000 });
    await expect(indicators.locator('span').filter({ hasText: 'Em andamento' }).first()).toBeVisible();

    // Persistência (mutation optimistic): valida via API que bgColor/status gravaram.
    await expect
      .poll(
        async () => {
          const res = await page.request.get(`/api/maps/${mapId}/nodes`);
          const { nodes } = (await res.json()) as {
            nodes: { id: string; bgColor: string | null; status: string | null }[];
          };
          const persisted = nodes.find((n) => n.id === nodeId);
          return persisted ? `${persisted.bgColor}|${persisted.status}` : 'missing';
        },
        { timeout: 5_000 },
      )
      .toBe('#b6e6c1|IN_PROGRESS');
  });
});
