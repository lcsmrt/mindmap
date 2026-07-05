# M20 — Menu de conta e perfil — Tasks

> Backend (`packages/api`) + frontend (`packages/web`). Cada task é um commit atômico
> `feat(m20)`/`test(m20)`. Rastreabilidade → `spec.md` (M20-NN). Decisões de gray area em
> `context.md`. Executar em chat separado ([[feedback-plan-execute-split]]).
>
> **Decisões arquiteturais (design.md pulado — decisão do usuário; embutidas aqui):**
> - **Endpoint:** `PATCH /auth/me` — reusa o `authPlugin` (prefixo `/auth`) e o `requireAuth` já existentes, simétrico ao `GET /auth/me`. Sem rota/plugin novo.
> - **Header compartilhado:** vai pra `components/` (regra `frontend-structure`); esquerda por *slot*, direita fixa = `AccountMenu`.
> - **Dropdown/avatar:** reusa `components/ui/menu.tsx` (base-ui — teclado/Esc/click-fora nativos) e `components/ui/avatar.tsx` (`AvatarFallback` pras iniciais). **Nada de primitivo novo.**

**Grafo de dependências:**

```
T1 (backend PATCH /auth/me) [P] ─────────────→ T2 (useUpdateProfile) ─┐
T3 (util getInitials) [P] ─→ T4 (AccountMenu) ─→ T5 (AppHeader) ──────┼─→ T6 (ProfilePage+rota) ─→ T7 (e2e+gate)
                                                                       │
                                              T5 ─────────────────────┘
```

- **T1** e **T3** são paralelos `[P]` (packages diferentes, sem overlap).
- **T2** precisa de T1 (endpoint). **T4** precisa de T3 (iniciais). **T5** precisa de T4.
- **T6** precisa de T2 (mutação) + T5 (header na página). **T7** precisa de tudo.

---

## T1 — Backend: `PATCH /auth/me` (editar nome) `[P]`

- **What**: endpoint autenticado que atualiza **só o nome** do usuário da sessão; DTO compartilhado `UpdateProfileBody` (`{ name }`) com validação; retorna o `AuthUser` atualizado.
- **Where**: `packages/api/src/routes/auth.ts` (add rota), `packages/shared` DTO de `UpdateProfileBody` + schema zod, `packages/api/src/routes/auth.test.ts` (add casos).
- **Depends on**: —
- **Reuses**: `requireAuth` preHandler; `toAuthUser` (`mappers/users.ts`); `prisma.user.update`; padrão de body amarrado ao DTO com `satisfies z.ZodType` (fix do M18, commit `d334dfc`); regra de validação de `name` do signup (obrigatório, `trim`, mesmo limite).
- **Done when**:
  - `PATCH /auth/me` com `{ name }` válido atualiza `where: { id: req.user.id }` e responde `AuthUser` novo.
  - Nome inválido (vazio/só espaços após trim, ou > limite do signup) → `400`, sem tocar o banco.
  - Só o próprio user é afetado (escopo por `req.user.id`; nunca aceita `id`/e-mail no body).
  - E-mail e senha **não** são alteráveis por esta rota.
- **Tests**: unit `auth.test.ts` (vitest) — happy path (nome muda, retorna AuthUser); rejeita nome vazio/whitespace/longo (400); sem sessão → 401; body com `email`/`id` extras é ignorado.
- **Traces**: M20-12, M20-13, M20-14.
- **Gate**: `pnpm -r typecheck` ✓, lint ✓, unit api ✓.

## T2 — Front: hook `useUpdateProfile`

- **What**: request fn `updateProfileRequest(body)` → `PATCH /api/auth/me` e hook `useUpdateProfile`; em `onSuccess`, atualiza o cache da sessão pra refletir o novo nome sem reload.
- **Where**: `packages/web/src/api/auth.ts` (add), `src/api/auth.test.ts` (add casos).
- **Depends on**: T1.
- **Reuses**: `request` de `_request.js`; `MutationOptions`; `UpdateProfileBody`/`AuthUser` de `@mindmap/shared`; a **mesma** query key da sessão usada pelo `useSession` (`['auth','me']`).
- **Done when**:
  - `useUpdateProfile` chama o endpoint e, em sucesso, `setQueryData(['auth','me'], updatedUser)`.
  - Erros propagam pro chamador (pra T6 exibir).
- **Tests**: unit `auth.test.ts` — sucesso atualiza o cache; erro propaga (mock de `request`).
- **Traces**: M20-15, M20-16.
- **Gate**: typecheck ✓, lint ✓, unit web ✓.

## T3 — Front: util `getInitials(name)` `[P]`

- **What**: função pura que deriva as iniciais do nome pro avatar (degrada com 1 palavra vs. várias; lida com espaços/acentos).
- **Where**: `packages/web/src/lib/getInitials.ts` (novo), `src/lib/getInitials.test.ts` (novo).
- **Depends on**: —
- **Reuses**: —
- **Done when**: 1 palavra → 1ª letra (ou 2 primeiras, definir e testar); ≥2 palavras → 1ª+última; trim/normaliza; nunca quebra com string vazia (fallback sensato).
- **Tests**: unit `getInitials.test.ts` — 1 palavra, 2, 3+, espaços extras, string vazia, acentos.
- **Traces**: M20-05.
- **Gate**: typecheck ✓, lint ✓, unit web ✓ (não-vacuoso).

## T4 — Front: `AccountMenu` (avatar + dropdown)

- **What**: avatar de iniciais como gatilho de um dropdown com cabeçalho (nome + e-mail), item "Perfil" (→ `/profile`) e item "Sair" (logout).
- **Where**: `packages/web/src/components/AccountMenu.tsx` (novo).
- **Depends on**: T3.
- **Reuses**: `components/ui/menu.tsx` (`Menu`/`MenuTrigger`/`MenuContent`/`MenuItem`/`MenuSeparator`); `components/ui/avatar.tsx` (`Avatar`+`AvatarFallback`); `getInitials` (T3); `useSession` (nome/e-mail); `useLogout` (mesmo comportamento/redirect do botão provisório); `useNavigate`.
- **Done when**:
  - Avatar mostra iniciais; abrir mostra nome + e-mail + "Perfil" + "Sair".
  - "Perfil" navega `/profile`; "Sair" faz logout idêntico ao atual.
  - A11y vem do base-ui (teclado, `Esc`, click-fora) — conferir no smoke.
  - Sem hex inline; tokens M16.
- **Tests**: coberto no e2e (T7) + smoke visual; sem teste de render pesado aqui.
- **Traces**: M20-04, M20-05, M20-06, M20-07, M20-08, M20-09.
- **Gate**: typecheck ✓, lint (grep-guard hex) ✓.

## T5 — Front: `AppHeader` compartilhado + migração das duas telas

- **What**: header compartilhado (shell) com *slot* à esquerda e `AccountMenu` fixo à direita; migrar Home e Map pra ele; **remover** os dois `<header>` inline e o botão "Sair" provisório da Home.
- **Where**: `packages/web/src/components/AppHeader.tsx` (novo); `src/pages/home/HomePage.tsx` e `src/pages/map/MapPage.tsx` (migrar); remover markup inline de header.
- **Depends on**: T4.
- **Reuses**: `BrandMark`; estilos/tokens dos headers atuais; `AccountMenu` (T4); regra `frontend-structure` (compartilhado → `components/`).
- **Done when**:
  - Home usa `AppHeader` com esquerda = marca KAOS + "mapas mentais".
  - Map usa `AppHeader` com esquerda = voltar "Mapas" + título do mapa.
  - `AccountMenu` aparece igual nas duas; nenhum `<header>` inline remanescente; botão "Sair" provisório da Home **removido**.
- **Tests**: smoke visual (T7) — headers idênticos no shell, esquerda correta por tela.
- **Traces**: M20-01, M20-02, M20-03.
- **Gate**: typecheck ✓, lint ✓, unit web ✓ (regressão).

## T6 — Front: página `/profile` (editar nome) + rota

- **What**: página de Perfil com form de nome (pré-preenchido) + e-mail read-only; salvar via `useUpdateProfile`; validação client-side, erro e feedback de sucesso; registrar rota `/profile` sob `RequireAuth`.
- **Where**: `packages/web/src/pages/profile/ProfilePage.tsx` (novo); `src/App.tsx` (add `<Route path="/profile">` dentro de `RequireAuth`).
- **Depends on**: T2, T5.
- **Reuses**: `AppHeader` (T5); `components/ui/{field,input,label,button}`; `useSession` (valores iniciais); `useUpdateProfile` (T2); `toast`/`toaster` (feedback); padrão de validação/erro do `AuthPage` (M19).
- **Done when**:
  - `/profile` renderiza sob a guarda (não autenticado → login).
  - Nome pré-preenchido e editável; e-mail read-only.
  - Salvar nome válido persiste e o avatar/dropdown refletem (cache via T2); toast de sucesso.
  - Nome inválido bloqueia envio com erro inline (não chama API); erro de rede/servidor mostra mensagem e preserva o valor; no-op (nome igual) aceito.
- **Tests**: unit da validação se extraída em módulo puro; fluxo principal no e2e (T7).
- **Traces**: M20-10, M20-11, M20-12 (front), M20-15, M20-16.
- **Gate**: typecheck ✓, lint (grep-guard hex) ✓, unit web ✓.

## T7 — E2E do fluxo + gate final

- **What**: e2e cobrindo menu de conta nas duas telas + "Sair", e editar nome persistindo/refletindo; smoke visual; fechar todos os gates.
- **Where**: suíte e2e (`packages/web` playwright — alinhar ao arquivo do M19).
- **Depends on**: T1–T6.
- **Reuses**: helpers/fixtures de auth do e2e do M19 (`51a55aa`).
- **Done when**:
  - E2e: logado, avatar/menu visível em Home e Mapa; "Sair" volta pro login a partir do mapa; editar nome em `/profile` reflete no avatar e persiste após reload.
  - Smoke visual: headers consistentes, dropdown abre/fecha, sem hex fora de token, grade 4px.
  - Gates verdes: `pnpm -r typecheck` ✓, lint ✓, unit web+api ✓, e2e ✓.
- **Tests**: e2e (this task).
- **Traces**: M20-01, M20-04, M20-07, M20-11, M20-12, M20-15.
- **Gate**: todos os gates verdes; atualizar `STATE.md`/`ROADMAP.md`/tasks ao concluir o milestone.

---

## Rastreabilidade (cobertura)

| Req | Task(s) |
|-----|---------|
| M20-01 | T5, T7 |
| M20-02 | T5 |
| M20-03 | T5 |
| M20-04 | T4, T7 |
| M20-05 | T3, T4 |
| M20-06 | T4 |
| M20-07 | T4, T5, T7 |
| M20-08 | T4 |
| M20-09 | T4 |
| M20-10 | T6 |
| M20-11 | T6, T7 |
| M20-12 | T1, T6, T7 |
| M20-13 | T1 |
| M20-14 | T1 |
| M20-15 | T2, T6, T7 |
| M20-16 | T2, T6 |

**16/16 requisitos mapeados.** 7 tasks; T1/T3 paralelos.
