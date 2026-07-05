import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Estes testes cobrem o fluxo jogável deslogado (signup/login/logout/return-to),
// então rodam sem a sessão padrão injetada via storageState (playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } });

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
}

function uniqueUsername(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

const PASSWORD = 'senha-forte-123';

async function signupViaUI(page: Page, email: string, name: string, username: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByPlaceholder('Como te chamamos').fill(name);
  await page.getByPlaceholder('seu-usuario').fill(username);
  await page.getByPlaceholder('voce@exemplo.com').fill(email);
  await page.getByPlaceholder('Crie uma senha forte').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
}

async function loginViaUI(page: Page, email: string, password: string) {
  await page.getByPlaceholder('voce@exemplo.com').fill(email);
  await page.getByPlaceholder('Sua senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

// "Sair" mora no dropdown do menu de conta (M20) — abre pelo avatar antes de clicar.
async function logoutViaMenu(page: Page) {
  await page.getByRole('button', { name: 'Menu de conta' }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
}

test.describe('auth — fluxo jogável (M19)', () => {
  test('criar conta válida cai na Home autenticada, sem 401', async ({ page }) => {
    await signupViaUI(page, uniqueEmail('signup'), 'Nova Usuária', uniqueUsername('signup'));

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Meus Mapas' })).toBeVisible();
    await expect(page.getByText('Erro ao carregar mapas')).toHaveCount(0);
  });

  test('credenciais erradas mostram banner único', async ({ page }) => {
    await page.goto('/login');
    await loginViaUI(page, uniqueEmail('inexistente'), 'senha-qualquer');

    await expect(page.getByText('E-mail ou senha incorretos')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('Sair derruba a sessão; reabrir / cai no login', async ({ page }) => {
    await signupViaUI(page, uniqueEmail('logout'), 'Sai Daqui', uniqueUsername('logout'));
    await expect(page).toHaveURL('/');

    await logoutViaMenu(page);
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('return-to: abrir mapa deslogado leva ao login e volta ao mapa após entrar', async ({
    page,
  }) => {
    const email = uniqueEmail('returnto');
    await signupViaUI(page, email, 'Volta Aqui', uniqueUsername('returnto'));
    await expect(page).toHaveURL('/');

    const title = `Mapa de retorno ${Date.now()}`;
    await page.getByTestId('new-map-button').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Ex.: Arquitetura do produto').fill(title);
    await dialog.getByRole('button', { name: 'Criar mapa' }).click();

    const card = page
      .locator('[data-testid="map-card"]')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await expect(card).toBeVisible({ timeout: 5_000 });
    await card.click();
    await expect(page).toHaveURL(/\/maps\/[^/]+$/, { timeout: 5_000 });
    const mapUrl = page.url();

    // O menu de conta (M20) leva o "Sair" também pra tela de mapa — desloga direto daqui.
    await logoutViaMenu(page);
    await expect(page).toHaveURL(/\/login$/);

    await page.goto(mapUrl);
    await expect(page).toHaveURL(/\/login$/);

    await loginViaUI(page, email, PASSWORD);
    await expect(page).toHaveURL(mapUrl, { timeout: 5_000 });
  });
});

test.describe('login por username (M23)', () => {
  test('cadastro com username → login por username → login por e-mail', async ({ page }) => {
    const email = uniqueEmail('m23');
    const username = uniqueUsername('m23');

    await signupViaUI(page, email, 'Usuária M23', username);
    await expect(page).toHaveURL('/');

    await logoutViaMenu(page);
    await expect(page).toHaveURL(/\/login$/);

    await loginViaUI(page, username, PASSWORD);
    await expect(page).toHaveURL('/');

    await logoutViaMenu(page);
    await expect(page).toHaveURL(/\/login$/);

    await loginViaUI(page, email, PASSWORD);
    await expect(page).toHaveURL('/');
  });
});
