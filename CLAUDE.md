# Mindmap

Mindmap pessoal. Stack fixado: React + React Flow + TanStack Query + Tailwind v4 + shadcn/ui no frontend; Fastify + Prisma no backend. Não propor trocas.

## Idioma

- Conversa, docs, commits e PRs: pt-BR.
- Código e identificadores: inglês.

## Estilo de código

- Código auto-explicativo: nomes descritivos; cada função com uma responsabilidade; preferir early return a aninhamento profundo.
- Não escrever comentários. Se um trecho precisa de comentário pra ser entendido, renomear/extrair em vez de comentar.
- Exceções (mantêm o comentário, em até 1 linha): (a) o *porquê* não-óbvio — workaround, decisão contra-intuitiva; (b) código mantido denso/inline de propósito porque refatorar regrediria um hot path comprovado. O raciocínio de decisões arquiteturais vai pras ADs (`.specs`/`STATE.md`), não pro código.

## Commits

- Formato: `tipo(escopo): descrição`. Escopo = milestone (`m2`, `m3`) ou área (`web`, `api`).

## Workflow

- Ao concluir milestone, atualizar `STATE.md` e `tasks`.
