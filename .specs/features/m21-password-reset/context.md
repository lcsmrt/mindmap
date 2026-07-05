# M21 — Context (gray areas resolvidas)

Decisões do usuário na fase *discuss* do planejamento (2026-07-05).

## D1 — Entrega de e-mail: SMTP de mailbox existente

**Decisão:** enviar via **SMTP de uma mailbox já existente** (ex.: Gmail com app password),
usando **nodemailer** com SMTP **configurável por env**.

**Por quê:** app roda em **IP puro, sem domínio próprio**, e é **single-user** (o usuário só
manda reset pra si mesmo). Nesse cenário:
- SMTP de mailbox existente = zero custo, sem vendor novo, sem precisar de domínio (envia do próprio
  endereço), entrega confiável pra própria caixa. Mais alinhado ao *own-your-stack* sem SaaS de auth (AD-025).
- API transacional (Resend) daria melhor deliverability e logs, mas adiciona vendor externo e, sem
  domínio, fica limitada ao domínio de teste do provedor. **Preterida** (over-kill pra 1 destinatário).
- Postfix self-hosted daria own-your-stack completo, mas IP puro sem domínio ⇒ alto risco de spam/rejeição
  e muito setup (SPF/DKIM/DMARC). **Preterida** (frágil pra ganho baixo).

**Consequência de design:** a escolha vira **credencial de ops** (env `SMTP_*`), não acoplamento de
código. Trocar de provedor depois = trocar env, sem mexer no código. Ver design → "Serviço de e-mail".

## D2 — Após redefinir: volta pro login

**Decisão:** depois de redefinir a senha com sucesso, **redireciona pro `/login`** com aviso de sucesso
(**sem auto-login**).

**Por quê:** o usuário digita a nova senha uma vez no login, confirmando que funciona. Mais simples e
seguro; padrão consolidado. Evita costurar criação de sessão dentro do fluxo de reset.

## D3 — Invalidar outras sessões: flag, marcada por padrão

**Decisão:** a página de reset tem um **checkbox "Desconectar de outros dispositivos"**, **marcado por
padrão**. Marcado ⇒ o reset apaga todas as `Session` do usuário. Desmarcado ⇒ preserva as sessões existentes.

**Por quê (usuário):** "dá pra ter uma flag, aí o usuário decide; já vi sistemas assim e resolve bem;
deixar marcada por padrão". O default seguro (derrubar tudo — senha trocada pode significar conta
comprometida) fica ligado, mas o usuário controla. Como o reset **não** faz auto-login (D2), a flag só
afeta as *outras* sessões — não há sessão "atual" a preservar no fluxo.
