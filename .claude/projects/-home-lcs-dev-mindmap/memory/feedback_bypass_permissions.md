---
name: feedback-bypass-permissions
description: Usuário configurou bypassPermissions mode — executar ações diretamente sem pedir confirmação
metadata:
  type: feedback
---

Não pedir confirmação antes de executar ações. O usuário configurou bypassPermissions mode explicitamente e espera execução direta.

**Why:** Já configurado no ambiente; perguntas interrompem o fluxo sem necessidade.

**How to apply:** Executar commits, instalação de pacotes, edições de arquivo, etc. sem pedir aprovação prévia. Só pausar se houver ambiguidade genuína no que fazer, não sobre "se pode fazer".
