import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Fluxo deslogado (forgot/reset/login), então sem a sessão padrão do storageState.
test.use({ storageState: { cookies: [], origins: [] } });

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
}

function uniqueUsername(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

const PASSWORD = 'senha-forte-123';
const NEW_PASSWORD = 'nova-senha-456';

async function signupViaUI(page: Page, email: string, name: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByPlaceholder('Como te chamamos').fill(name);
  await page.getByPlaceholder('seu-usuario').fill(uniqueUsername('reset'));
  await page.getByPlaceholder('voce@exemplo.com').fill(email);
  await page.getByPlaceholder('Crie uma senha forte').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL('/');
}

async function logoutViaMenu(page: Page) {
  await page.getByRole('button', { name: 'Menu de conta' }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.describe('reset de senha (M21)', () => {
  test('forgot → reset → login com a nova senha', async ({ page }) => {
    const email = uniqueEmail('reset');
    await signupViaUI(page, email, 'Reset User');
    await logoutViaMenu(page);

    await page.getByRole('link', { name: 'Esqueci a senha' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);

    await page.getByPlaceholder('voce@exemplo.com').fill(email);
    await page.getByRole('button', { name: 'Enviar link de acesso' }).click();
    await expect(page.getByText(/enviamos um link/i)).toBeVisible();

    // Test seam: o último link de reset é capturado em memória (NODE_ENV=test),
    // sem e-mail real.
    const res = await page.request.get('/api/auth/__test/last-reset');
    const { resetUrl } = (await res.json()) as { resetUrl: string };
    expect(resetUrl).toContain('/reset-password?token=');

    await page.goto(resetUrl.replace(/^https?:\/\/[^/]+/, ''));

    await page.getByPlaceholder('Crie uma senha forte').fill(NEW_PASSWORD);
    await page.getByPlaceholder('Repita a nova senha').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Redefinir senha' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/Senha redefinida com sucesso/i)).toBeVisible();

    await page.getByPlaceholder('voce@exemplo.com').fill(email);
    await page.getByPlaceholder('Sua senha').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL('/');
  });

  test('token inválido mostra estado de erro sem formulário', async ({ page }) => {
    await page.goto('/reset-password?token=inexistente');

    await expect(page.getByText(/inválido ou expirou/i)).toBeVisible();
    await expect(page.getByPlaceholder('Crie uma senha forte')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Pedir novo link' })).toBeVisible();
  });
});
