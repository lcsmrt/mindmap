import { request as playwrightRequest } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = join(__dirname, '.auth');
const AUTH_FILE = join(AUTH_DIR, 'user.json');
const BASE_URL = 'http://localhost:5173';

// Usuário fixo, reutilizado entre runs (o DB de e2e é acumulativo — ver
// CONCERNS.md > Test Infrastructure). Garante que a suíte roda autenticada.
const EMAIL = 'e2e-m19@mindmap.test';
const USERNAME = 'e2e-m19';
const PASSWORD = 'e2e-password-123';

export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });

  const context = await playwrightRequest.newContext({ baseURL: BASE_URL });

  const signupRes = await context.post('/api/auth/signup', {
    data: { email: EMAIL, username: USERNAME, password: PASSWORD, name: 'E2E' },
  });

  if (!signupRes.ok()) {
    const loginRes = await context.post('/api/auth/login', {
      data: { identifier: EMAIL, password: PASSWORD },
    });
    if (!loginRes.ok()) {
      throw new Error(
        `e2e auth setup: falha ao autenticar o usuário fixo (signup ${signupRes.status()}, login ${loginRes.status()})`,
      );
    }
  }

  // Specs pré-existentes assumem >=1 mapa já na Home (`.first()`); com escopo
  // por dono (M18) cada usuário só vê os próprios mapas, então garantimos 1 —
  // com um 2º nó fixo, já que edit-dialog.spec.ts (M5) assume um `nth(1)`
  // permanente (a raiz não recebe cor de usuário — M16).
  const mapsRes = await context.get('/api/maps');
  const { maps } = (await mapsRes.json()) as { maps: { id: string }[] };
  if (maps.length === 0) {
    const mapRes = await context.post('/api/maps', { data: { title: 'E2E Seed' } });
    const map = (await mapRes.json()) as { id: string; rootNodeId?: string };
    const nodesRes = await context.get(`/api/maps/${map.id}/nodes`);
    const { nodes } = (await nodesRes.json()) as { nodes: { id: string; parentId: string | null }[] };
    const root = nodes.find((n) => n.parentId === null)!;
    await context.post('/api/nodes', {
      data: { mapId: map.id, parentId: root.id, title: 'Filial fixa (fixture e2e)' },
    });
  }

  await context.storageState({ path: AUTH_FILE });
  await context.dispose();
}
