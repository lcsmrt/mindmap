import { test, expect } from '@playwright/test';

async function openFirstMap(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('ul button').first().click();
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });
}

test.describe('persistência e restauração (M4)', () => {
  test('criar nó filho persiste após reload', async ({ page }) => {
    await openFirstMap(page);

    const initialCount = await page.locator('.react-flow__node').count();

    const addBtn = page.locator('.react-flow__node').first().getByTitle('Adicionar filho');
    await addBtn.click();

    await expect(page.locator('.react-flow__node')).toHaveCount(initialCount + 1, {
      timeout: 5_000,
    });

    await page.waitForTimeout(1_000);
    await page.reload();
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('.react-flow__node')).toHaveCount(initialCount + 1, {
      timeout: 5_000,
    });
  });

  test('renomear nó persiste após reload', async ({ page }) => {
    await openFirstMap(page);

    const node = page.locator('.react-flow__node').first();
    const titleSpan = node.locator('.truncate');
    const originalTitle = await titleSpan.textContent();

    await titleSpan.click();
    const input = node.locator('input');
    await expect(input).toBeVisible({ timeout: 2_000 });

    const newTitle = `Rename-${Date.now()}`;
    await input.fill(newTitle);
    await input.press('Enter');

    await expect(node.getByText(newTitle)).toBeVisible({ timeout: 3_000 });

    await page.waitForTimeout(1_000);
    await page.reload();
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('.react-flow__node').first().getByText(newTitle)).toBeVisible();

    // restaura título original
    const span = page.locator('.react-flow__node').first().locator('.truncate');
    await span.click();
    const restoreInput = page.locator('.react-flow__node').first().locator('input');
    await restoreInput.fill(originalTitle!);
    await restoreInput.press('Enter');
  });

  test('toast de erro aparece e estado reverte quando API falha', async ({ page }) => {
    await openFirstMap(page);

    const node = page.locator('.react-flow__node').first();
    const titleSpan = node.locator('.truncate');
    const originalTitle = await titleSpan.textContent();

    await page.route('**/api/nodes/*', (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({ status: 500, body: JSON.stringify({ error: 'Erro simulado' }) });
      }
      return route.continue();
    });

    await titleSpan.click();
    const input = node.locator('input');
    await input.fill('Deve reverter');
    await input.press('Enter');

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[role="alert"]')).toContainText('Erro');

    await page.unroute('**/api/nodes/*');

    await page.reload();
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('.react-flow__node').first().getByText(originalTitle!),
    ).toBeVisible();
  });

  test('retry transparente em falha transiente (1 falha + 1 sucesso)', async ({ page }) => {
    await openFirstMap(page);

    let callCount = 0;
    await page.route('**/api/nodes/*', (route) => {
      if (route.request().method() === 'PATCH') {
        callCount++;
        if (callCount === 1) {
          return route.fulfill({ status: 500, body: JSON.stringify({ error: 'transient' }) });
        }
      }
      return route.continue();
    });

    const node = page.locator('.react-flow__node').first();
    const titleSpan = node.locator('.truncate');
    const originalTitle = await titleSpan.textContent();

    const retryTitle = `Retry-${Date.now()}`;
    await titleSpan.click();
    const input = node.locator('input');
    await input.fill(retryTitle);
    await input.press('Enter');

    await page.waitForTimeout(5_000);

    await expect(page.locator('[role="alert"]')).not.toBeVisible();

    await page.unroute('**/api/nodes/*');
    await page.reload();
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('.react-flow__node').first().getByText(retryTitle),
    ).toBeVisible();

    // restaura
    const span = page.locator('.react-flow__node').first().locator('.truncate');
    await span.click();
    const restoreInput = page.locator('.react-flow__node').first().locator('input');
    await restoreInput.fill(originalTitle!);
    await restoreInput.press('Enter');
  });

  test('todos os nós expandidos ao reabrir (AD-004)', async ({ page }) => {
    await openFirstMap(page);

    const nodeCount = await page.locator('.react-flow__node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    await page.reload();
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });

    const afterReload = await page.locator('.react-flow__node').count();
    expect(afterReload).toBe(nodeCount);
  });
});
