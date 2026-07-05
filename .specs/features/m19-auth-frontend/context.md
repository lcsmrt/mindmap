# M19 — Tela de auth + guarda no front — Context

**Gathered:** 2026-07-04
**Spec:** `.specs/features/m19-auth-frontend/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Primeira fatia jogável ponta-a-ponta da autenticação (email+senha): a **tela KAOS** (modos
Entrar / Criar conta) e a **guarda no front** (rotas protegidas, bootstrap de sessão via `/me`,
"manter conectado", logout). Consome o contrato pronto do M18 (`signup`/`login`/`logout`/`me`,
cookie httpOnly `mm_session`). Só frontend (`packages/web`); nenhuma mudança de backend/contrato.

---

## Implementation Decisions

### Escopo visual (elementos de M20/M21/M22 no design)

- **Esconder por completo** o que não é do M19. A tela renderiza só: toggle Entrar/Criar conta,
  campo Nome (só no cadastro), E-mail, Senha (com toggle de olho), "manter conectado" (só no
  Entrar) e o botão de submit.
- **Fora do M19, removidos da tela agora** (voltam no milestone dono): "Continuar com Google" +
  divisória "ou" (M22); "Esqueci a senha" e o modo recuperar (M21); footer legal
  Termos/Privacidade/Ajuda. O sigilo KAOS/cabeçalho da marca permanece.

### Logout no M19 (menu de conta é M20)

- **Botão simples "Sair" no header da Home**, temporário, a ser substituído pelo dropdown de conta
  completo no M20. Garante a fatia jogável (dá pra entrar E sair) sem antecipar o M20.
- Sem avatar/dropdown/tema/perfil nesta etapa.

### Feedback de erro e estado de envio (híbrido)

- **Validação client-side por campo** no que dá pra atribuir localmente: e-mail malformado, senha
  < 8, nome vazio (no cadastro). Mensagem inline junto do campo.
- **Banner no topo do card** para erros que o servidor devolve genéricos/atribuídos ao formulário:
  login `401` ("E-mail ou senha incorretos" — mensagem única, não vaza existência de conta) e
  signup `409` ("Este e-mail já está em uso"). Backend responde `{ error }`; o front traduz para
  pt-BR amigável, não ecoa a string crua.
- **Botão de submit com estado de loading** (desabilitado + label tipo "Entrando…"/"Criando…")
  enquanto a request está no ar. Toast **não** é usado para erro de formulário (efêmero demais).
- Racional: heurísticas de localidade/proximidade (Nielsen #1/#9) — erro fica onde a ação e o olho
  estão; atribuição por campo só onde o cliente consegue atribuir; o `401` de login é genérico por
  design de segurança do M18.

### Redirect / return-to

- **Return-to**: rota protegida acessada sem sessão guarda o destino tentado, manda pro login e,
  após entrar, redireciona **de volta ao destino** (padrão `location.state.from` do React Router).
- Usuário **já logado** que abre a tela de login é redirecionado pra Home.
- Após signup bem-sucedido: mesmo tratamento (entra e vai pro destino/Home).

### Agent's Discretion

- Nome/caminho da rota de auth (proposta: `/login`, tela única com toggle de modo — espelha o
  design, que é uma tela só) e nomes de arquivos/hooks/componentes.
- Estado de carregamento do bootstrap `/me` (splash/spinner leve em tela cheia até resolver
  logado/deslogado) — decidir na implementação, contanto que não pisque conteúdo protegido.
- Como a camada de API passa a enviar o cookie (`credentials`) e a estrutura do contexto/estado de
  sessão (context + TanStack Query) — detalhe de design.
- Estilo exato do banner de erro e das mensagens inline, dentro dos tokens do design system M16.

---

## Specific References

- Design: `designs/v3/Autenticação.dc.html` — seguir a tela "Login" (coluna central). Ignorar o
  quadro "Menu de conta" (é M20). O modo "recuperar" e o botão Google existem no mock mas ficam
  fora do M19.
- Contrato M18 (`.specs/features/m18-auth-core/`): cookie `mm_session`; `POST /auth/signup`
  → 201; `POST /auth/login` → 200 (`remember` = 30d, senão 7d); `POST /auth/logout` → 204;
  `GET /auth/me` → 200/401; corpo de erro `{ error }`; `401` de login genérico.

---

## Deferred Ideas

- "Esqueci a senha" / reset por e-mail → **M21**.
- "Continuar com Google" → **M22**.
- Menu de conta (avatar, dropdown, tema claro/escuro, editar perfil, Preferências, Ajuda & atalhos)
  → **M20**.
- Footer legal (Termos/Privacidade/Ajuda) → sem dono definido; fica deferred até haver conteúdo.
- Verificação de e-mail no cadastro → dependente de infra de e-mail (M21).
