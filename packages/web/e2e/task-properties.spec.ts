import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function openFirstMap(page: Page) {
  await page.goto('/');
  await page.locator('ul button').first().click();
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });
}

// Cria um filho da raiz com um título único via API e o devolve como locator.
// A suíte e2e compartilha o mesmo mapa/DB entre testes, então cada teste precisa
// de um nó identificável por título — índices de DOM acumulam nós de testes
// anteriores e não são confiáveis. Criar pela API (mesmo padrão do teste de
// "mover nó" em persistence.spec.ts) é determinístico e evita timing do canvas.
// Ids dos nós criados no teste corrente, para limpeza no afterEach (mantém o
// mapa compartilhado estável entre execuções/testes).
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
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });

  const node = page
    .locator('.react-flow__node')
    .filter({ has: page.locator('.truncate', { hasText: label }) });
  await expect(node).toBeVisible({ timeout: 5_000 });
  return node;
}

async function openEditDialog(page: Page, node: Locator) {
  await node.getByTitle('Editar nó').click();
  await expect(page.getByText('Editar nó')).toBeVisible({ timeout: 3_000 });
}

const IN_PROGRESS_RGB = 'rgb(59, 130, 246)';

let counter = 0;
function uniqueLabel(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

test.describe('propriedades de tarefa no canvas (M6)', () => {
  test.beforeEach(() => {
    createdNodeIds = [];
  });

  test.afterEach(async ({ page }) => {
    for (const id of createdNodeIds) {
      await page.request.delete(`/api/nodes/${id}`).catch(() => {});
    }
    createdNodeIds = [];
  });

  test('marcar status "Em andamento" exibe ponto colorido no nó', async ({ page }) => {
    await openFirstMap(page);
    const node = await createUniqueNode(page, uniqueLabel('status'));

    // Sem propriedades, não há rodapé de indicadores (M6-18).
    await expect(node.getByTestId('node-task-indicators')).toHaveCount(0);

    await openEditDialog(page, node);
    await page.getByTestId('status-btn-IN_PROGRESS').click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Editar nó')).not.toBeVisible({ timeout: 3_000 });

    const indicators = node.getByTestId('node-task-indicators');
    await expect(indicators).toBeVisible({ timeout: 3_000 });

    const dot = indicators.locator('[aria-label="Em andamento"]');
    await expect(dot).toBeVisible();
    await expect(dot).toHaveCSS('background-color', IN_PROGRESS_RGB);
  });

  test('digitar responsável exibe iniciais no rodapé', async ({ page }) => {
    await openFirstMap(page);
    const node = await createUniqueNode(page, uniqueLabel('assignee'));

    await openEditDialog(page, node);
    const assigneeInput = page.getByTestId('assignee-input');
    await assigneeInput.fill('Lucas Martins');
    await assigneeInput.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.getByText('Editar nó')).not.toBeVisible({ timeout: 3_000 });

    const indicators = node.getByTestId('node-task-indicators');
    await expect(indicators).toBeVisible({ timeout: 3_000 });
    await expect(indicators.getByText('LM', { exact: true })).toBeVisible();
  });

  test('marcar "Crítico" exibe ícone de prioridade', async ({ page }) => {
    await openFirstMap(page);
    const node = await createUniqueNode(page, uniqueLabel('critical'));

    await openEditDialog(page, node);
    await page.getByTestId('critical-toggle').click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Editar nó')).not.toBeVisible({ timeout: 3_000 });

    const indicators = node.getByTestId('node-task-indicators');
    await expect(indicators).toBeVisible({ timeout: 3_000 });
    await expect(indicators.locator('[aria-label="Crítico"]')).toBeVisible();
  });

  test('nó sem propriedades não tem rodapé de indicadores', async ({ page }) => {
    await openFirstMap(page);
    const node = await createUniqueNode(page, uniqueLabel('empty'));

    await expect(node.getByTestId('node-task-indicators')).toHaveCount(0);
  });

  test('clicar no status ativo limpa o ponto; responsável vazio limpa as iniciais', async ({
    page,
  }) => {
    await openFirstMap(page);
    const node = await createUniqueNode(page, uniqueLabel('clear'));

    // Define status + responsável.
    await openEditDialog(page, node);
    await page.getByTestId('status-btn-IN_PROGRESS').click();
    const assigneeInput = page.getByTestId('assignee-input');
    await assigneeInput.fill('Ana');
    await assigneeInput.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.getByText('Editar nó')).not.toBeVisible({ timeout: 3_000 });

    const indicators = node.getByTestId('node-task-indicators');
    await expect(indicators).toBeVisible({ timeout: 3_000 });
    await expect(indicators.locator('[aria-label="Em andamento"]')).toBeVisible();
    await expect(indicators.getByText('AN', { exact: true })).toBeVisible();

    // Limpa status clicando no botão ativo; limpa responsável esvaziando o input.
    await openEditDialog(page, node);
    await page.getByTestId('status-btn-IN_PROGRESS').click();
    await assigneeInput.fill('');
    await assigneeInput.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.getByText('Editar nó')).not.toBeVisible({ timeout: 3_000 });

    // Ambos os campos vazios ⇒ rodapé inteiro some (M6-17/M6-18).
    await expect(node.getByTestId('node-task-indicators')).toHaveCount(0, { timeout: 3_000 });
  });

  test('status, responsável e crítico persistem após reload', async ({ page }) => {
    await openFirstMap(page);
    const label = uniqueLabel('persist');
    const node = await createUniqueNode(page, label);

    await openEditDialog(page, node);
    await page.getByTestId('status-btn-IN_PROGRESS').click();
    const assigneeInput = page.getByTestId('assignee-input');
    await assigneeInput.fill('Lucas Martins');
    await assigneeInput.press('Enter');
    await page.getByTestId('critical-toggle').click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Editar nó')).not.toBeVisible({ timeout: 3_000 });

    await expect(node.getByTestId('node-task-indicators')).toBeVisible({ timeout: 3_000 });

    await page.waitForTimeout(1_000);
    await page.reload();
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });

    const reloadedNode = page
      .locator('.react-flow__node')
      .filter({ has: page.locator('.truncate', { hasText: label }) });
    const reloadedIndicators = reloadedNode.getByTestId('node-task-indicators');
    await expect(reloadedIndicators).toBeVisible({ timeout: 3_000 });
    await expect(reloadedIndicators.locator('[aria-label="Em andamento"]')).toBeVisible();
    await expect(reloadedIndicators.getByText('LM', { exact: true })).toBeVisible();
    await expect(reloadedIndicators.locator('[aria-label="Crítico"]')).toBeVisible();
  });
});
