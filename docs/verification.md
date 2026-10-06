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
