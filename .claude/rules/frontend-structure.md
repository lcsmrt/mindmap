---
paths:
  - "packages/web/**"
---

# Estrutura Frontend

## Colocação de componentes

Componentes específicos de uma página ficam em `pages/<pagina>/components/`.
Só vai para `components/` o que for compartilhado entre 2+ páginas.

## Reusar antes de criar

Antes de usar uma tag HTML pura ou criar um componente novo, verificar o que já existe em `components/` — tanto os primitivos em `ui/` quanto os compostos na raiz.
Se já existe algo que resolve, usar. Isso mantém o design system consistente.

## Pasta ui/

`components/ui/` é o repositório dos primitivos globais do design system (Button, Input, Dialog, etc.).
