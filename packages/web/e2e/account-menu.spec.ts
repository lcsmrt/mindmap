import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Roda com a sessão padrão injetada (storageState do playwright.config.ts) —
// usuário fixo 'E2E' <e2e-m19@mindmap.test> / @e2e-m19 (ver e2e/auth.setup.ts).
const FIXTURE_NAME = 'E2E';
const FIXTURE_EMAIL = 'e2e-m19@mindmap.test';
const FIXTURE_USERNAME = 'e2e-m19';

async function openAccountMenu(page: Page) {
  await page.getByRole('button', { name: 'Menu de conta' }).click();
}

test.describe('menu de conta (M20)', () => {
  test('avatar + dropdown aparecem na Home e no Mapa, com nome/@username e itens', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Menu de conta' })).toBeVisible();
    await openAccountMenu(page);
    await expect(page.getByText(FIXTURE_NAME, { exact: true })).toBeVisible();
    await expect(page.getByText(`@${FIXTURE_USERNAME}`)).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Perfil' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
    await page.keyboard.press('Escape');

    const card = page.locator('[data-testid="map-card"]').first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/maps\/[^/]+$/);

    await expect(page.getByRole('button', { name: 'Menu de conta' })).toBeVisible();
    await openAccountMenu(page);
    await expect(page.getByRole('menuitem', { name: 'Perfil' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
  });

  test('"Perfil" navega para /profile', async ({ page }) => {
    await page.goto('/');
    await openAccountMenu(page);
    await page.getByRole('menuitem', { name: 'Perfil' }).click();
    await expect(page).toHaveURL('/profile');
    await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();
  });
});

test.describe('editar nome no Perfil (M20)', () => {
  test('nome inválido bloqueia envio sem chamar o backend', async ({ page }) => {
    await page.goto('/profile');
    await page.getByLabel('Nome').fill('   ');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Informe seu nome')).toBeVisible();
  });

  test('salvar nome válido reflete no avatar e persiste após reload', async ({ page }) => {
    await page.goto('/profile');

    await expect(page.getByLabel('Nome')).toHaveValue(FIXTURE_NAME);
    await expect(page.getByLabel('E-mail')).toHaveValue(FIXTURE_EMAIL);
    await expect(page.getByLabel('E-mail')).toBeDisabled();

    const newName = `E2E Atualizado ${Date.now()}`;
    await page.getByLabel('Nome').fill(newName);
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Perfil atualizado.')).toBeVisible();
    await openAccountMenu(page);
    await expect(page.getByText(newName, { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.reload();
    await expect(page.getByLabel('Nome')).toHaveValue(newName);

    // Restaura o nome original pra não deixar o fixture de e2e sujo entre runs.
    await page.getByLabel('Nome').fill(FIXTURE_NAME);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Perfil atualizado.')).toBeVisible();
  });
});
