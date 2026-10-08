# Verificação — 6 de outubro de 2026

Ambiente: Windows, Node/npm, Rust MSVC e Microsoft Edge.

Comandos executados a partir de `D:\code\ticktick\Todo-app`, exceto onde indicado:

| Comando                                      | Resultado                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                                   | 19 testes passaram: recorrência, datas, conclusão idempotente, filtros, formato de dados e timer                                                 |
| `cargo test --offline` (em `src-tauri`)      | 4 testes passaram com SQLite real: migração idempotente, ciclo de tarefa, anexos, rollback de importação inválida, conflitos, desfazer e backups |
| `npm run test:e2e`                           | 4 testes passaram no Edge: fluxo completo de tarefas/exportação/importação, navegação/hábitos/foco/temas e recuperação de timer/lembretes        |
| `npm run build`                              | TypeScript e build de produção do frontend concluídos                                                                                            |
| `npm run tauri build -- --debug --no-bundle` | Executável desktop de debug gerado e aberto para inspeção                                                                                        |
| `node --check scripts/start.mjs`             | Sintaxe válida                                                                                                                                   |
| `git diff --check`                           | Sem erros de whitespace                                                                                                                          |
| `npm audit fix`                              | Dependência transitiva corrigida; auditoria final com zero vulnerabilidades                                                                      |

As telas de lista, criação, detalhes, Kanban, foco, hábitos, calendário e tema escuro foram capturadas em `docs/screenshots`. Lista, detalhes, foco e tema escuro foram inspecionados visualmente. A inspeção encontrou e corrigiu um caso de timer exibindo um segundo além da duração ao pausar imediatamente; o caso ganhou teste.

A janela Tauri abriu, carregou o SQLite e mostrou a interface sem erro de inicialização. A instância de inspeção usa `test-results/native-smoke/todo.db`, preservado fora da pasta de saída do Playwright. Essa instância não usa os dados normais do usuário. Não foram criadas fixtures no banco normal.

Limites de verificação: E2E de UI usa o adaptador de navegador; SQLite é verificado separadamente pelos testes Rust. Entrega de notificações Windows, diálogo de exportação e abertura de anexos pelo aplicativo associado não receberam teste interativo completo. Não foram gerados ou testados instaladores MSI/NSIS, nem builds de macOS/Linux.

Também foi executado `$env:TZ = "America/New_York"; npm test` no PowerShell: os mesmos 19 testes passaram em um fuso com transição de horário de verão.

Correção adicional solicitada durante a implementação: o contexto do projeto selecionado agora é aplicado ao criar tarefas pelo modal (incluindo atalhos), pela captura rápida e por uma coluna Kanban. O teste verifica os três caminhos, persistência após recarregar e ausência de vínculo indevido ao sair do projeto.

Build final após a correção do projeto: `npm run tauri build -- --no-bundle` concluído com sucesso. Executável de produção: `src-tauri/target/release/todo-app.exe`. Foram aprovados 27 testes distintos (19 domínio + 4 Rust + 4 E2E). O build também executou novamente a checagem TypeScript e o Vite. Há avisos não bloqueantes do toolchain sobre `STATIC_VCRUNTIME` e mensagens informativas do linker; não houve erro de compilação.

## Captura por voz — 06/10/2026

Primeira etapa implementada: instalar modelo, gravar/parar/cancelar, transcrever localmente, revisar e confirmar a criação na Inbox com o projeto de origem. A tela de revisão foi inspecionada em `docs/screenshots/voz.png`.

Comandos de validação executados na raiz `Todo-app`:

```powershell
npm run build
npm test
npm run test:rust -- --offline
npm run test:e2e
$env:CHRONO_VOICE_FIXTURE_DIR = 'D:\code\ticktick\Todo-app\test-results\voice-native'
node scripts/native.mjs cargo test --offline offline_whisper_fixture -- --ignored
node --check scripts/native.mjs
git diff --check
```

Resultado: 33 testes distintos aprovados (19 domínio, 6 Rust, 7 E2E e 1 integração real com Whisper). O teste de integração é ignorado na execução comum para evitar download de 142 MiB. Foi executado separadamente, primeiro com download e verificação SHA-256, depois com o mesmo modelo sem rede. A fixture WAV mono/16 kHz/16 bits foi gerada por System.Speech com voz sintética em inglês; o teste reconheceu a palavra esperada. O arquivo fica na pasta isolada de testes e não contém gravação do usuário.

Os E2E de voz simulam somente a fronteira IPC nativa e verificam instalação, revisão, confirmação, projeto, recuperação de falha ao salvar, cancelamento e indisponibilidade no navegador. Rust testa silêncio, gravação curta e reamostragem. A inferência real é verificada separadamente. Não foi acionado o microfone físico, nem validada a qualidade do reconhecimento de português com a voz do usuário. Os dados existentes não foram alterados.

## Filtro de datas — melhoria antes da próxima entrega

Adicionados `dateField`, `dateFrom` e `dateTo`, com limites inclusivos e filtros por prazo ou início. Filtros antigos recebem valores padrão compatíveis. Datas inválidas e intervalos invertidos são rejeitados no frontend e no Rust. O teste de interface cobre lista, Kanban, filtro salvo após recarregar, troca de campo, erro de intervalo e limpeza das datas. Captura inspecionada: `docs/screenshots/filtros-data.png`.

Comandos executados nesta melhoria: `npm run build`, `npm test`, `npm run test:rust -- --offline`, `npm run test:e2e` e `git diff --check`. A geração de produção desta melhoria foi adiada conforme solicitado.

Resultado desta melhoria: 39 testes aprovados (24 domínio, 7 Rust, 8 E2E), build frontend concluído e diff sem erros. O teste opt-in de transcrição real ficou ignorado nesta rodada; ele havia passado na validação da captura por voz.
