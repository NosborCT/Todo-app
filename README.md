# Chrono

Um aplicativo pessoal de tarefas, hábitos, calendário e foco. Tauri 2 + React + TypeScript + SQLite. Interface em português, inspirada em `design.md` e nas referências de lista, Kanban, modal e painel lateral.

## Executar com um comando

Dentro de `Todo-app`:

```powershell
npm run start
```

O comando instala as dependências fixadas em `package-lock.json` na primeira execução (e quando o lock muda), inicia o Vite e abre o aplicativo Tauri. O Cargo baixa as dependências Rust na primeira compilação. Depois de preparar os caches, o uso é local e não exige rede.

Pré-requisitos:

- Node.js 22.12+ (ou uma versão LTS mais recente compatível), npm e Rust stable com Cargo no PATH.
- Windows: Visual Studio com **Desenvolvimento para desktop com C++**, Windows SDK e WebView2 Runtime.
- Outros desktops: dependências nativas de [Tauri 2](https://v2.tauri.app/start/prerequisites/). A validação deste projeto foi feita no Windows.

Se aparecer `link.exe not found`, instale o componente C++ e reabra o terminal. Não crie `src-tauri/gen/schemas/desktop-schema.json` manualmente: `cargo check --manifest-path src-tauri/Cargo.toml` gera seu conteúdo.

Outros comandos:

```powershell
npm run dev                    # prévia web; armazenamento separado do desktop
npm run build                  # TypeScript + frontend de produção
npm run tauri dev              # desktop, com dependências já instaladas
npm run tauri build            # instaladores desktop
```

A prévia web informa sua condição na barra lateral e usa localStorage apenas para desenvolvimento/testes. Notificações nativas e backups automáticos exigem o desktop. Ela não acessa nem substitui `todo.db`.

## Funcionalidades

- Captura rápida para Inbox; todas as tarefas, Hoje (incluindo atrasadas), Próximas, pendentes, em progresso, algum dia, concluídas e arquivo.
- Lista e Kanban, com arrastar/soltar e menu de mudança de status acessível por teclado.
- Projetos, tags, início, prazo, prioridades, notas em texto, subtarefas e anexos locais.
- Repetições diárias, semanais, mensais e personalizadas por intervalo, dias da semana e data final.
- Calendário mensal; hábitos com dias programados e marcações históricas; foco com uma tarefa ativa, pausa e histórico de sessões completas.
- Busca em títulos, notas, subtarefas e tags; filtros combinados e filtros salvos.
- Desfazer as últimas 30 gravações no desktop, inclusive exclusão, importação e alterações de preferências. A prévia web mantém somente a última alteração.
- Exportação/importação JSON versionada, incluindo anexos; backups automáticos e manuais.
- Tema claro/escuro, estados vazios, feedback de gravação, erros recuperáveis e navegação adaptável.

Os dados começam vazios. Tarefas da versão anterior são migradas uma única vez, sem excluir a tabela original. As imagens de demonstração usam fixtures isoladas, não os dados reais.

Atalhos (fora de campos de texto): `N` nova tarefa, `Q` captura, `/` busca, `Ctrl/Cmd+K` comandos, `Ctrl/Cmd+Z` desfazer, `Ctrl/Cmd+\` navegação em janela pequena. `Esc` fecha diálogos. `Tab` fica dentro do diálogo aberto.

## Regras de datas e recorrência

Datas de início e prazo são `YYYY-MM-DD` no calendário local; timestamps são RFC 3339/ISO 8601 com fuso. Não se converte um prazo para UTC. A repetição é calculada a partir do prazo da ocorrência concluída, não do dia da conclusão. Isso preserva o histórico de atrasos; ocorrências perdidas são avançadas uma por vez ao concluir.

A conclusão preserva a tarefa no histórico e cria a próxima ocorrência na mesma gravação. Subtarefas são reabertas; notas, tags, prioridade e anexos são copiados. A série evita duplicar a mesma próxima data após reabrir/concluir. Alterar uma ocorrência não edita retroativamente as anteriores.

- Mensal: dia original preservado. `31/jan → 28/fev → 31/mar`; fevereiro bissexto termina em 29.
- Semanal: semanas começam segunda-feira. Seleção vazia repete no mesmo dia; intervalos maiores que um pulam semanas inteiras após os dias selecionados da semana atual.
- Data final inclusiva. Recorrência precisa de prazo.
- Calendário mostra as ocorrências já criadas, não uma projeção infinita.

Lembretes e término do foco são avaliados a cada segundo **enquanto a aplicação está aberta**. O timer usa um instante final persistido, sem depender de contar ticks: suspensão e reabertura recuperam a sessão vencida. Fechar o aplicativo não agenda serviços do sistema. Na reabertura, lembretes vencidos ainda não mostrados são recuperados. Alertas internos funcionam sem a API nativa; notificações de sistema são opcionais e dependem de permissão. No Windows, verifique a entrega de notificações na versão instalada, conforme as restrições do plugin.

## Arquitetura

- `src/domain/task.ts`: tipos, esquemas Zod, datas, filtros e transformações puras de conclusão/recorrência.
- `src/lib/storage.ts`: fronteira IPC Tauri e adaptador isolado da prévia web.
- `src/App.tsx`: navegação e coordenação de gravações; alterações só aparecem como salvas após confirmação do backend.
- `src/TaskEditor.tsx`, `src/Views.tsx`, `src/components.tsx`: componentes de edição, calendário, hábitos, foco, configurações e diálogos.
- `src-tauri/src/model.rs`: contrato Serde e validação defensiva de toda entrada, inclusive arquivos importados.
- `src-tauri/src/database.rs`: SQLite, migração do cadastro anterior, transações, revisão otimista, desfazer e backups.
- `src-tauri/src/lib.rs`: comandos estreitos de dados, exportação nativa e abertura de anexos.

O SQLite mantém um documento JSON versionado na tabela `workspace`, com revisão incremental, e snapshots em `undo_history`. Essa escolha mantém alterações com múltiplas entidades, recorrência, importação e desfazer atômicos e facilita exportação integral. A aplicação pessoal tem limite de 20 mil tarefas e documento de 50 MB; para volumes muito maiores, o próximo passo arquitetural é normalizar as entidades e fazer consultas SQL indexadas. Não há servidor nem sincronização.

Gravações usam transações `IMMEDIATE`, WAL e comparação de revisão para impedir sobrescrita silenciosa por outra janela. Migração idempotente com `user_version=2`; a tabela antiga `tasks` permanece intacta, mas deixa de ser a fonte de verdade.

## Dados, anexos e permissões

O identificador anterior `com.usuario.todo-app` foi preservado para não perder o caminho dos dados existentes. O caminho exato aparece em **Configurações**. No Windows, normalmente é:

```text
%APPDATA%\com.usuario.todo-app\todo.db
%APPDATA%\com.usuario.todo-app\backups\
%APPDATA%\com.usuario.todo-app\opened-attachments\
```

Anexos são incorporados como base64 no documento SQLite/JSON: exportar inclui o conteúdo dos arquivos. Limites: 10 MB por anexo, 20 anexos por tarefa, 50 MB por workspace. Ao abrir um anexo, o Rust grava uma cópia em `opened-attachments` com prefixo UUID e nome sanitizado; nenhum caminho arbitrário vem da interface. Arquivos executáveis não são abertos. Abertura permitida: PDF, imagens comuns, TXT, Markdown, CSV e DOCX/XLSX/PPTX. Cópias dessa pasta podem ser apagadas com o aplicativo fechado; não são o original persistido.

Permissões declaradas: `core:default` e `notification:default`, somente para a janela `main`. Exportação usa diálogo nativo no Rust; a interface não recebe permissão genérica de escrita no sistema. Abertura de anexos também passa pelo comando Rust restrito. CSP impede conteúdo remoto e execução de objetos. Fontes e ícones são empacotados, sem CDN.

Não há contas, cobrança, telemetria, analytics, plano de controle hospedado, atribuição de equipe, comentários, sincronização bidirecional de calendário/email ou apps móveis. Não são necessários segredos. `.env.example` documenta a política; `.env` e suas variantes são ignorados. Nunca coloque segredos em variáveis `VITE_`, que são públicas no frontend.

## Exportar, importar e restaurar

1. Em **Configurações → Exportar JSON**, escolha um destino no diálogo nativo.
2. Para restaurar, use **Importar JSON**, selecione um arquivo, confira os números e confirme a substituição.
3. O backend valida antes de escrever e cria backup `before-import` antes da troca. Se esse backup falhar, a importação é recusada. Importação pausará qualquer timer importado.
4. A importação pode ser desfeita pela interface. Formato e exemplo estão em [docs/format-v1.md](docs/format-v1.md).

Backups automáticos registram o estado no primeiro acesso de cada dia UTC: ao abrir e antes de salvar. São mantidos os 30 dias mais recentes; alterações posteriores no mesmo dia ficam no SQLite. Use **Criar backup** para um snapshot imediato. Backups manuais e `before-import` não são removidos automaticamente. Copie os JSONs para outro dispositivo para se proteger de falha física do disco; nenhum arquivo é enviado à nuvem.

Se o SQLite estiver corrompido e o aplicativo não conseguir abrir: feche o Chrono, preserve `todo.db`, `todo.db-wal` e `todo.db-shm` renomeando-os ou copiando-os para uma pasta segura. Remova-os do diretório ativo somente após preservar as cópias. Abra o Chrono para criar um banco vazio e importe o JSON de backup escolhido. Nunca copie somente um banco WAL aberto esperando consistência; prefira exportação JSON com o app aberto ou copie todos os arquivos com ele fechado.

## Testes

```powershell
npm test
npm run test:rust
npm run test:e2e
npm run build
```

Ou `npm run check` para os quatro em sequência. O E2E usa Microsoft Edge instalado no Windows (canal `msedge`), com dados de navegador isolados por teste. Em outros sistemas, instale Edge ou ajuste o canal no `playwright.config.ts`. O runner inicia o Vite automaticamente na porta 1420.

Os testes unitários verificam datas, recorrência, conclusão, filtros e importação; testes Rust verificam SQLite real, conflitos, migração, backups e desfazer. O E2E verifica a UI com o adaptador de navegador; ele **não certifica** entrega de notificações pelo Windows ou diálogos nativos. Screenshots reproduzíveis estão em `docs/screenshots/`. Testes não gravam tarefas de exemplo no banco do usuário.

Para QA desktop isolado, builds de debug aceitam `CHRONO_TEST_DATA_DIR` com um caminho absoluto para um banco temporário. Builds de release ignoram essa variável. Ela é uma variável de processo e não é carregada automaticamente de `.env`.
