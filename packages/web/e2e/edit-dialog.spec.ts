import { test, expect } from '@playwright/test';

async function openFirstMap(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('ul button').first().click();
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });
}

async function openEditDialog(page: import('@playwright/test').Page) {
  const node = page.locator('.react-flow__node').first();
  const editBtn = node.getByTitle('Editar nó');
  await editBtn.click();
  await expect(page.getByText('Editar nó')).toBeVisible({ timeout: 3_000 });
  return node;
}

test.describe('dialog de edição e cores (M5)', () => {
  test('clicar no botão Palette abre dialog com título correto', async ({ page }) => {
    await openFirstMap(page);

    const node = page.locator('.react-flow__node').first();
    const titleSpan = node.locator('.truncate');
    const originalTitle = await titleSpan.textContent();

    await openEditDialog(page);

    const titleInput = page.locator('#node-title');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue(originalTitle!);
  });

  test('editar título no dialog atualiza nó no canvas', async ({ page }) => {
    await openFirstMap(page);

    const node = page.locator('.react-flow__node').first();
    const titleSpan = node.locator('.truncate');
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
    const span = node.locator('.truncate');
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

    const node = page.locator('.react-flow__node').first();
    const nodeDiv = node.locator('div').first();
    await expect(nodeDiv).toHaveCSS('background-color', 'rgb(254, 202, 202)', { timeout: 3_000 });

    // reset
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

    const node = page.locator('.react-flow__node').first();
    const nodeDiv = node.locator('div').first();
    await expect(nodeDiv).toHaveCSS('color', 'rgb(220, 38, 38)', { timeout: 3_000 });

    // reset
    const editBtn = node.getByTitle('Editar nó');
    await editBtn.click();
    const defaultBtn = page.locator('button[aria-label="Padrão"]').nth(1);
    await defaultBtn.click();
    await page.keyboard.press('Escape');
  });

  test('cores persistem após reload', async ({ page }) => {
    await openFirstMap(page);
    await openEditDialog(page);

    const bgSwatch = page.locator('button[aria-label="Azul claro"]');
    await bgSwatch.click();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1_000);
    await page.reload();
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });

    const node = page.locator('.react-flow__node').first();
    const nodeDiv = node.locator('div').first();
    await expect(nodeDiv).toHaveCSS('background-color', 'rgb(191, 219, 254)', { timeout: 3_000 });

    // reset
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

    const node = page.locator('.react-flow__node').first();
    const nodeDiv = node.locator('div').first();
    const bgColor = await nodeDiv.evaluate((el) => el.style.backgroundColor);
    expect(bgColor).toBe('');
  });

  test('fechar dialog via Escape funciona sem efeito colateral', async ({ page }) => {
    await openFirstMap(page);

    const node = page.locator('.react-flow__node').first();
    const titleSpan = node.locator('.truncate');
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
