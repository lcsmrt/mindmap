# M19 — Tela de auth + guarda no front — Tasks

> Só `packages/web`. Backend/contrato/schema **intocados**. Cada task é um commit atômico
> `feat(m19)`/`test(m19)`. Rastreabilidade → `spec.md` (M19-NN). Executar em chat separado
> ([[feedback-plan-execute-split]]).

**Grafo de dependências:**

```
T1 (api+credenciais) ─┬─→ T3 (tela) ──┐
T2 (validação) [P] ───┘               ├─→ T5 (rotas+logout) ─→ T6 (e2e+gate)
T1 ───────────────────→ T4 (guarda) ──┘
```

- **T1** e **T2** são paralelos `[P]` (sem overlap de arquivo).
- **T3** precisa de T1 (hooks) + T2 (validação). **T4** precisa de T1 (`useSession`).
- **T5** precisa de T3 (tela) + T4 (guarda). **T6** precisa de T5.

---

## T1 — Camada de API de auth + envio do cookie `[P]` ✅

- **What**: `src/api/auth.ts` com request fns (`signupRequest`, `loginRequest`, `logoutRequest`, `fetchMe`) e hooks (`useSession`, `useSignup`, `useLogin`, `useLogout`); ajustar `src/api/_request.ts` para enviar credenciais.
- **Where**: `src/api/auth.ts` (novo), `src/api/_request.ts` (modificar).
- **Depends on**: —
- **Reuses**: `request`/`ApiError` de `_request.js`; `QueryOptions`/`MutationOptions` de `types.js`; `AuthUser`/`SignupBody`/`LoginBody` de `@mindmap/shared`.
- **Done when**:
  - `fetchMe` retorna `AuthUser | null` (`ApiError` 401 → `null`; rethrow os demais).
  - `useSession` = query `['auth','me']` (`retry:false`, `staleTime:Infinity`), expõe `user`/`isLoading`/`isAuthenticated`.
  - `useSignup`/`useLogin` `onSuccess` → `setQueryData(['auth','me'], user)`; `useLogout` `onSuccess` → `setQueryData(['auth','me'], null)` + `queryClient.clear()`.
  - `_request.ts` passa `credentials: 'same-origin'`.
- **Tests**: unit `auth.test.ts` — `fetchMe` mapeia 401→null e propaga 500; hooks atualizam o cache (mock de `request`).
- **Traces**: M19-10, M19-16, M19-17.
- **Gate**: `pnpm -r typecheck` ✓, lint ✓, unit web ✓.

## T2 — Validação client-side + mapa de mensagens `[P]` ✅

- **What**: módulo puro `src/pages/auth/validation.ts`: `validateAuth(mode, values)` → `fieldErrors` (email malformado, senha < 8, nome vazio no cadastro) e `messageForError(error)` → string pt-BR (401→"E-mail ou senha incorretos", 409→"Este e-mail já está em uso", fallback genérico).
- **Where**: `src/pages/auth/validation.ts` (novo), `src/pages/auth/validation.test.ts` (novo).
- **Depends on**: —
- **Reuses**: `ApiError` (para ler `status` em `messageForError`).
- **Done when**: funções puras, sem React; cobrem os três campos e os status mapeados; **não** ecoam a string crua do backend.
- **Tests**: unit `validation.test.ts` — casos válidos/ inválidos por campo; cada status→mensagem; status desconhecido→fallback.
- **Traces**: M19-06, M19-07, M19-09.
- **Gate**: typecheck ✓, lint ✓, unit web ✓ (não-vacuoso).

## T3 — Tela de auth (Entrar / Criar conta) ✅

- **What**: `AuthPage` (estado de modo/campos/erros, wiring com T1/T2, botão em loading) + subcomponentes de campo e banner. Espelha o design; remove Google/"ou"/"esqueci a senha"/footer legal.
- **Where**: `src/pages/auth/AuthPage.tsx`, `components/AuthField.tsx`, `components/PasswordField.tsx`, `components/ErrorBanner.tsx` (novos).
- **Depends on**: T1, T2.
- **Reuses**: `components/ui/{input,button}.js`, `cn`; tokens M16; `useLocation`/`useNavigate`.
- **Done when**:
  - Toggle Entrar⇄Criar conta (footer alterna modo); Nome só no cadastro; toggle de olho na senha; "manter conectado" **só no Entrar** → `remember`.
  - Submit valida no cliente (barra e mostra erro inline; **não** chama API se inválido); em sucesso navega para `location.state.from ?? '/'`; em erro de servidor mostra banner via `messageForError`.
  - Botão desabilitado + label de progresso enquanto `isPending`.
  - Sem hex inline; visual aderente ao M16.
- **Tests**: cobertura da lógica via T2 (unit) + verificação visual no smoke do T6. (Sem teste de render pesado aqui.)
- **Traces**: M19-01..M19-09.
- **Gate**: typecheck ✓, lint (grep-guard hex) ✓, unit web ✓.

## T4 — Guarda de rota + splash + `401` global ✅

- **What**: `RequireAuth` (rota-layout com `<Outlet/>`), `RedirectIfAuthed` (para `/login`), `AuthSplash` (bootstrap loading); handler global de `401` no `QueryClient`.
- **Where**: `src/auth/RequireAuth.tsx`, `src/auth/RedirectIfAuthed.tsx`, `src/auth/AuthSplash.tsx`, `src/auth/RequireAuth.test.tsx` (novos); `src/main.tsx` (modificar).
- **Depends on**: T1.
- **Reuses**: `useSession` (T1); `Navigate`/`Outlet`/`useLocation`; `ApiError`.
- **Done when**:
  - `RequireAuth`: `isLoading`→splash; `!user`→`<Navigate to="/login" state={{from:location}} replace/>`; senão `<Outlet/>`.
  - `RedirectIfAuthed`: `user`→`<Navigate to={from ?? '/'} replace/>`; senão renderiza filho.
  - `main.tsx`: `QueryCache.onError` — `ApiError` 401 em query que **não** seja `['auth','me']` → `setQueryData(['auth','me'], null)`.
- **Tests**: unit `RequireAuth.test.tsx` — **ambos** os ramos (sessão mockada → Outlet; sem sessão → redireciona guardando `from`).
- **Traces**: M19-10..M19-14.
- **Gate**: typecheck ✓, lint ✓, unit web ✓ (não-vacuoso, dois ramos).

## T5 — Rotas do App + botão Sair na Home ✅

- **What**: reestrutura `App.tsx` (rota `/login` + rota-layout protegida com Home/MapPage); adiciona botão "Sair" temporário no header da `HomePage`.
- **Where**: `src/App.tsx`, `src/pages/home/HomePage.tsx` (modificar).
- **Depends on**: T3, T4.
- **Reuses**: `AuthPage` (T3), `RequireAuth`/`RedirectIfAuthed` (T4), `useLogout` (T1), `Button`.
- **Done when**:
  - `/login` sob `RedirectIfAuthed`; `/` e `/maps/:id` sob `RequireAuth`; `VersionBadge` mantido.
  - Botão "Sair" na Home chama `useLogout` → `navigate('/login')`; comentário 1-linha marcando-o como provisório até o menu de conta (M20).
- **Tests**: coberto pelo e2e do T6.
- **Traces**: M19-11, M19-12, M19-15.
- **Gate**: typecheck ✓, lint ✓, unit web ✓.

## T6 — e2e + smoke + gate final ✅

- **What**: e2e do fluxo jogável + verificação visual + gate completo.
- **Where**: `e2e/auth.spec.ts` (novo) — ver diretório e2e existente para padrão.
- **Depends on**: T5.
- **Reuses**: infra e2e/Playwright existente; DB de teste.
- **Done when** (e2e verde):
  - Criar conta válida → Home autenticada (maps carregam, **não** 401).
  - Credenciais erradas → banner "E-mail ou senha incorretos".
  - Sair → `/login`; reabrir `/` → cai no login.
  - **Return-to**: abrir `/maps/:id` deslogado → login → após entrar volta ao mapa.
- **Tests**: a própria suíte e2e; smoke visual (tela aderente ao design, sem elementos fora de escopo, sem overflow).
- **Traces**: M19-18, M19-19, M19-20.
- **Gate final**: `pnpm -r typecheck` ✓, lint (grep-guard hex) ✓, unit **web + api** ✓ (api idêntico — backend intocado), **e2e** ✓.

---

## Definition of Done (milestone)

- [x] M19-01..M19-20 rastreados e verdes.
- [x] Backend/schema/contrato **inalterados** (suíte api idêntica — 97/97).
- [x] Fluxo jogável ponta-a-ponta (criar conta/entrar → app → sair) + return-to em e2e.
- [x] Sem hex inline; aderente ao design system M16.
- [x] `STATE.md`/`ROADMAP.md`/`tasks` atualizados; AD-026 registrada.
