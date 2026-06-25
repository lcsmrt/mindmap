import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// O DB de e2e é compartilhado/acumulativo entre testes (workers=1). Cada teste
// cria mapas com títulos únicos e remove o que criou para não poluir contagens.
function uniqueTitle(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Localiza o card pelo título exato dentro do grid.
function cardByTitle(page: Page, title: string) {
  return page
    .locator('[data-testid="map-card"]')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

// Cria um mapa pela UI (modal) e devolve o locator do card resultante.
async function createMapViaModal(page: Page, title: string) {
  await page.getByTestId('new-map-button').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Novo mapa')).toBeVisible({ timeout: 3_000 });

  const input = dialog.getByPlaceholder('Ex.: Arquitetura do produto');
  await input.fill(title);
  await dialog.getByRole('button', { name: 'Criar mapa' }).click();

  const card = cardByTitle(page, title);
  await expect(card).toBeVisible({ timeout: 5_000 });
  return card;
}

// Exclui o card via menu ⋯ + ConfirmDialog.
async function deleteMapViaMenu(page: Page, title: string) {
  const card = cardByTitle(page, title);
  await card.getByRole('button', { name: 'Ações do mapa' }).click();
  await page.getByRole('menuitem', { name: 'Excluir' }).click();

  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText('Excluir mapa')).toBeVisible({ timeout: 3_000 });
  await confirm.getByRole('button', { name: 'Excluir' }).click();

  await expect(cardByTitle(page, title)).toHaveCount(0, { timeout: 5_000 });
}

test.describe('home — gestão de mapas (M10)', () => {
  test('criar via modal mostra o card novo no grid', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Meus Mapas' })).toBeVisible();

    const title = uniqueTitle('Criar');
    await createMapViaModal(page, title);

    // limpa
    await deleteMapViaMenu(page, title);
  });

  test('card novo exibe métricas (1 nó) e datas', async ({ page }) => {
    await page.goto('/');

    const title = uniqueTitle('Metricas');
    const card = await createMapViaModal(page, title);

    // mapa novo tem 1 nó (raiz) e nenhum crítico
    await expect(card.getByText('1 nó', { exact: true })).toBeVisible();
    await expect(card.getByText(/^Criado /)).toBeVisible();
    await expect(card.getByText(/^Editado /)).toBeVisible();

    // limpa
    await deleteMapViaMenu(page, title);
  });

  test('excluir via ⋯ com confirmação remove o card', async ({ page }) => {
    await page.goto('/');

    const title = uniqueTitle('Excluir');
    await createMapViaModal(page, title);

    await deleteMapViaMenu(page, title);
    await expect(cardByTitle(page, title)).toHaveCount(0);
  });
});
