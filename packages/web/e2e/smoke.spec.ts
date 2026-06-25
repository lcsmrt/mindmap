import { test, expect } from '@playwright/test';

test('app carrega a home com lista de mapas', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/mindmap/i);
  await expect(page.getByRole('heading', { name: 'Meus Mapas' })).toBeVisible();
});

test('clique no texto do nó abre edição inline com foco', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-testid="map-card"]').first().click();

  const node = page.locator('[data-testid="mind-node"]').first();
  await expect(node).toBeVisible({ timeout: 10_000 });

  const titleSpan = node.locator('.truncate');
  const originalTitle = await titleSpan.textContent();

  await titleSpan.click();

  const input = node.locator('input');
  await expect(input).toBeVisible({ timeout: 2_000 });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(originalTitle!);

  await input.fill('Teste e2e');
  await expect(input).toHaveValue('Teste e2e');

  await input.press('Escape');
  await expect(input).not.toBeVisible();

  await expect(node.getByText(originalTitle!)).toBeVisible();
});
