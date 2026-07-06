# M14 — Hierarquia visual + espaçamento — Context (gray areas resolvidas)

> Decisões refinadas com o usuário no chat de planejamento (2026-07-05). O ponto de partida foi
> um debate de design (hierarquia estilo MindMeister) que, no meio, o usuário redirecionou para
> incluir o espaçamento. Cores exatas ficaram deliberadamente **abertas** (tweak).

## C1 — Ênfase por tipografia/escala, não por largura

**Decisão:** o destaque de tier vive em **tipografia/peso/tamanho**, não na largura do card.
**Por quê:** a largura por nó é território do usuário (M15/AD-020 — `width` persistido, resize por drag).
Amarrar hierarquia à largura brigaria com o resize e com o layout. Tipografia não disputa com nada.
No máximo um leve bump de largura *default* só no N1 (que não tem largura de usuário relevante).

## C2 — Fundo dos cards intocado (usuário é dono da cor)

**Decisão:** a hierarquia **não** mexe no `bgColor` dos cards. Nada de escurecer/clarear por nível.
**Por quê:** o usuário pinta qualquer nó com a paleta (M10/M15). Um skin por profundidade no fundo
sobrescreveria a escolha dele. A hierarquia mora nas dimensões que o usuário **não** controla:
o N1 (que já ignora cor do usuário), tipografia e **edges**.

## C3 — Cor da edge = cabeça de ramo (N2), com propagação MindMeister

**Decisão:** cada edge herda a cor **derivada do `bgColor` da N2 ancestral** do seu destino, e essa
cor vale para **toda** a subárvore abaixo daquela N2. Regras finas:
- cor do **central (N1) não propaga** (o centro é tratado à parte; não "colore" ramos);
- nós **intermediários** pintados **não** mudam a cor do ramo — mudam só o próprio fundo (a cor do
  ramo depende **só** da N2 no topo). Previsível e fiel ao MindMeister.

**Cores/contraste = tweak, fora do travamento agora.** O usuário disse explicitamente pra não me
preocupar com cor/contraste — "mudar as cores não impacta na lógica". A **lógica** (de onde vem a cor,
como propaga) é o que está travado; os hexes/luminância/espessura são calibráveis depois.

## C4 — Default do ramo = neutro (sem auto-arco-íris)

**Decisão:** N2 sem cor custom (`bgColor === null`) → edge **neutra** (o `stroke-edge` cinza atual).
**Por quê:** casa exatamente com "a cor da N2 afeta os filhos" — um controle de cor só (a paleta que já
existe). O arco-íris **emerge** conforme o usuário pinta as cabeças de ramo (que é justamente o que a
pessoa faz). Auto-atribuir cor às N2 (MindMeister de fábrica) foi **preterido**: criaria um segundo
sistema de cor (auto quando null, usuário quando pintado) sem ganho real numa ferramenta pessoal.

## C5 — Máximo 3 tiers

**Decisão:** N1 (central) / N2 (cabeça de ramo) / N3+ (resto uniforme). Sem 4º tier nem degradê contínuo.
**Por quê:** confirmado pelo usuário ("no MindMeister, N3 pra frente segue o mesmo padrão; N1 e N2 têm um
pouco mais de destaque"). Mais tiers = retorno decrescente e degradê ilegível.

## C6 — Espaçamento embutido neste pacote (não é feature à parte)

**Decisão:** o alívio de `GAP_Y`/`GAP_X` entra no **mesmo** milestone da hierarquia, a pedido do usuário
("vamos planejar a hierarquia e já coloca isso no meio; quando executar vejo o pacote completo").
**Por quê:** ambos são ajustes do mesmo canvas/geometria; o usuário quer ver o resultado junto. O
espaçamento é a peça **simples e de baixo risco** do pacote (dois números + um fix de teste).

## C7 — Fundo transparente = Deferred

**Decisão:** poder deixar o fundo do card **transparente** é desejado pelo usuário, mas **fora do M14**
(Deferred Idea no STATE). **Por quê:** o próprio usuário apontou a dificuldade — resize handle, hover e
a ancoragem de layout assumem um card opaco/sólido; fazer direito é um projeto à parte.

## C8 — Reescrita do `nearestSlot` só se o espaçamento não bastar

**Decisão:** o fix do drop-indicator é, **primeiro**, o espaçamento (M14-09) — que ataca diretamente o
caso relatado (faixas de ramos vizinhos deixam de se sobrepor). Se, com folga boa, a ghost bar **ainda**
bugar em cantos muito apertados, o fix de fundo seria a **precedência do `nearestSlot`** (desempate
quando colunas coincidem — área do M13/AD-021). Isso é **outra tarefa**, maior, e **não** se faz
preventivamente ([[feedback-scope-discipline]]).
