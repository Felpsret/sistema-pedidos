# StockFlow — versão organizada

## O que mudou

**1 arquivo → 4 arquivos**, sem alterar nenhuma regra de negócio:

```
stockflow-pro/
├── index.html          → só a estrutura da página (HTML)
├── css/
│   └── style.css       → todo o visual (antes era um <style> gigante no meio do HTML)
└── js/
    ├── firebase-config.js  → só a configuração do Firebase (App, Firestore, Auth)
    └── app.js               → toda a lógica do sistema (pedidos, kanban, dashboard, etc.)
```

O JavaScript foi **movido, não reescrito** — toda a lógica (funções, listeners do Firestore,
autenticação, kanban, dashboard) é byte a byte idêntica à do arquivo original, só que agora
vive num arquivo próprio em vez de dentro do HTML. Isso foi verificado automaticamente
(diff linha a linha) antes da entrega, então o comportamento do app não muda em nada.

## O que foi ajustado no visual

- **Tipografia**: trocada a fonte do sistema (Segoe UI) pela Inter, com fallback automático
  caso a fonte não carregue (offline, por exemplo) — visual mais "produto" e menos "planilha".
- **Cabeçalho fixo (sticky)**: fica visível ao rolar listas longas (kanban, pedidos), com
  logo em gradiente e sombra mais suave. No celular ele volta a ser estático pra não ocupar
  espaço demais.
- **Botão primário** com leve elevação/hover mais perceptível.
- **Foco de teclado visível** em inputs/botões (acessibilidade).
- **Scrollbar customizada** discreta, combinando com o tema.
- **Rodapé do desenvolvedor** com gradiente e ícone em destaque, mais alinhado ao resto do app.
- Pequenos ajustes de espaçamento/consistência (títulos de card, sombras).

Nada de cor de marca, fluxo de tela ou texto foi alterado — é refinamento em cima do que
já existia, não um redesign.

## Como usar

Suba a pasta **inteira** (mantendo `css/` e `js/` dentro dela) para onde o app já está
hospedado (GitHub Pages, Firebase Hosting, etc.). Os caminhos são relativos
(`css/style.css`, `js/app.js`), então a estrutura de pastas precisa ser preservada.

## Próximos passos possíveis (se quiser ir além)

- Separar `app.js` em módulos menores por funcionalidade (kanban.js, dashboard.js, etc.).
  Não fiz isso agora porque exigiria reescrever como as variáveis compartilhadas
  (`pedidos`, `catalogo`, `itensPedido`...) circulam entre as partes — dá pra fazer com
  segurança, mas é um passo separado que merece ser testado com calma antes de ir pra produção.
- Reduzir estilos inline que ainda restam espalhados pelo `index.html`, migrando pros
  arquivos CSS conforme forem aparecendo.
