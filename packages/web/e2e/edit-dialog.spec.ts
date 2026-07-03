import { test, expect } from '@playwright/test';

async function openFirstMap(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('[data-testid="map-card"]').first().click();
  await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });
}

async function openEditDialog(page: import('@playwright/test').Page) {
  // M16: raiz ignora cor de usuário — usamos o segundo nó (branch) para testes de cor.
  const node = page.locator('[data-testid="mind-node"]').nth(1);
  // T10: a toolbar (incluindo "Editar nó") é revelada apenas no hover.
  await node.hover();
  const editBtn = node.getByTitle('Editar nó');
  await editBtn.click();
  await expect(page.getByText('Editar nó')).toBeVisible({ timeout: 3_000 });
  return node;
}

test.describe('dialog de edição e cores (M5)', () => {
  test('clicar no botão Palette abre dialog com título correto', async ({ page }) => {
    await openFirstMap(page);

    const node = page.locator('[data-testid="mind-node"]').nth(1);
    const titleSpan = node.locator('[data-testid="node-title"]');
    const originalTitle = await titleSpan.textContent();

    await openEditDialog(page);

    const titleInput = page.locator('#node-title');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue(originalTitle!);
  });

  test('editar título no dialog atualiza nó no canvas', async ({ page }) => {
    await openFirstMap(page);

    const node = page.locator('[data-testid="mind-node"]').nth(1);
    const titleSpan = node.locator('[data-testid="node-title"]');
    const originalTitle = await titleSpan.textContent();

    await openEditDialog(page);

    const titleInput = page.locator('#node-title');
    const newTitle = `Dialog-${Date.now()}`;
    await titleInput.fill(newTitle);
    await titleInput.press('Enter');

    await page.keyboard.press('Escape');
    await expect(page.getByText('Editar nó')).not.toBeVisible({ timeout: 3_000 });

    await expect(node.getByText(newTitle)).toBeVisible({ timeout: 3_000 });

    // restaura
    const span = node.locator('[data-testid="node-title"]');
    await span.click();
    const restoreInput = node.locator('input');
    await restoreInput.fill(originalTitle!);
    await restoreInput.press('Enter');
  });

  test('selecionar swatch de cor de fundo muda cor no canvas', async ({ page }) => {
    await openFirstMap(page);
    await openEditDialog(page);

    const bgSwatch = page.locator('button[aria-label="Vermelho claro"]');
    await bgSwatch.click();

    await page.keyboard.press('Escape');

    const node = page.locator('[data-testid="mind-node"]').nth(1);
    const nodeDiv = node.locator('div').first();
    // T11: paleta realinhada — "Vermelho claro" agora é #f4b8b8.
    await expect(nodeDiv).toHaveCSS('background-color', 'rgb(244, 184, 184)', { timeout: 3_000 });

    // reset
    await node.hover();
    const editBtn = node.getByTitle('Editar nó');
    await editBtn.click();
    const defaultBtn = page.locator('button[aria-label="Padrão"]').first();
    await defaultBtn.click();
    await page.keyboard.press('Escape');
  });

  test('selecionar swatch de cor de texto muda cor do texto', async ({ page }) => {
    await openFirstMap(page);
    await openEditDialog(page);

    const textSwatch = page.locator('button[aria-label="Vermelho"]');
    await textSwatch.click();

    await page.keyboard.press('Escape');

    const node = page.locator('[data-testid="mind-node"]').nth(1);
    const nodeDiv = node.locator('div').first();
    // T11: paleta de texto realinhada — "Vermelho" agora é #e23b3b.
    await expect(nodeDiv).toHaveCSS('color', 'rgb(226, 59, 59)', { timeout: 3_000 });

    // reset: a cor de texto agora reseta via "Automático" (grava textColor=null),
    // que deriva a cor por luminância do fundo (fundo padrão escuro ⇒ texto claro).
    await node.hover();
    const editBtn = node.getByTitle('Editar nó');
    await editBtn.click();
    const autoBtn = page.locator('button[aria-label="Automático"]');
    await autoBtn.click();
    await page.keyboard.press('Escape');
    await expect(nodeDiv).toHaveCSS('color', 'rgb(237, 237, 242)', { timeout: 3_000 });
  });

  test('cores persistem após reload', async ({ page }) => {
    await openFirstMap(page);
    await openEditDialog(page);

    const bgSwatch = page.locator('button[aria-label="Azul claro"]');
    await bgSwatch.click();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1_000);
    await page.reload();
    await expect(page.locator('[data-testid="mind-node"]').first()).toBeVisible({ timeout: 10_000 });

    const node = page.locator('[data-testid="mind-node"]').nth(1);
    const nodeDiv = node.locator('div').first();
    // T11: "Azul claro" agora é #bcd0f2.
    await expect(nodeDiv).toHaveCSS('background-color', 'rgb(188, 208, 242)', { timeout: 3_000 });

    // reset
    await node.hover();
    const editBtn = node.getByTitle('Editar nó');
    await editBtn.click();
    const defaultBtn = page.locator('button[aria-label="Padrão"]').first();
    await defaultBtn.click();
    await page.keyboard.press('Escape');
  });

  test('clicar Padrão reseta cor de fundo', async ({ page }) => {
    await openFirstMap(page);
    await openEditDialog(page);

    const bgSwatch = page.locator('button[aria-label="Verde claro"]');
    await bgSwatch.click();

    const defaultBtn = page.locator('button[aria-label="Padrão"]').first();
    await defaultBtn.click();

    await page.keyboard.press('Escape');

    const node = page.locator('[data-testid="mind-node"]').nth(1);
    const nodeDiv = node.locator('div').first();
    // DEFAULT_BG = --color-card = #201f24 = rgb(32, 31, 36): nó default combina com os cards da home.
    await expect(nodeDiv).toHaveCSS('background-color', 'rgb(32, 31, 36)', { timeout: 3_000 });
  });

  test('fechar dialog via Escape funciona sem efeito colateral', async ({ page }) => {
    await openFirstMap(page);

    const node = page.locator('[data-testid="mind-node"]').first();
    const titleSpan = node.locator('[data-testid="node-title"]');
    const originalTitle = await titleSpan.textContent();

    await openEditDialog(page);
    await page.keyboard.press('Escape');

    await expect(page.getByText('Editar nó')).not.toBeVisible({ timeout: 3_000 });
    await expect(node.getByText(originalTitle!)).toBeVisible();
  });

  test('erro na API causa rollback e toast', async ({ page }) => {
    await openFirstMap(page);

    await page.route('**/api/nodes/*', (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({ status: 500, body: JSON.stringify({ error: 'Erro simulado' }) });
      }
      return route.continue();
    });

    await openEditDialog(page);

    const bgSwatch = page.locator('button[aria-label="Rosa claro"]');
    await bgSwatch.click();

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[role="alert"]')).toContainText('Erro');

    await page.unroute('**/api/nodes/*');
    await page.keyboard.press('Escape');
  });
});
