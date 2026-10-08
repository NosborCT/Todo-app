# JSON Chrono — versão 1

A raiz é um objeto `Workspace`. Não há envelope nem revisão de banco no arquivo. UTF-8, até 50 MB. Datas civis em `YYYY-MM-DD`; instantes em RFC 3339 com fuso. IDs únicos por coleção, até 100 caracteres alfanuméricos, hífen ou underscore. Exportação é integral: inclui concluídas, arquivadas, anexos, hábitos, sessões e preferências.

```json
{
  "version": 1,
  "tasks": [],
  "projects": [],
  "tags": [],
  "habits": [],
  "filters": [],
  "sessions": [],
  "settings": { "theme": "light", "notifications": false, "focusMinutes": 25 },
  "timer": null
}
```

Cada tarefa contém estes campos (campos opcionais usam `null`, não são omitidos):

```json
{
  "id": "task-001",
  "title": "Revisar planejamento",
  "status": "pending",
  "notes": "Escolher três prioridades.",
  "priority": 2,
  "projectId": null,
  "tags": [],
  "startDate": "2026-10-06",
  "dueDate": "2026-10-07",
  "reminderAt": "2026-10-07T09:00:00-03:00",
  "notifiedAt": null,
  "recurrence": { "unit": "week", "interval": 1, "weekdays": [3], "monthDay": 7, "until": null },
  "subtasks": [{ "id": "sub-001", "title": "Abrir agenda", "done": false }],
  "attachments": [{ "id": "attachment-001", "name": "nota.txt", "data": "YWJj", "size": 3 }],
  "createdAt": "2026-10-06T12:00:00Z",
  "updatedAt": "2026-10-06T12:00:00Z",
  "completedAt": null,
  "archived": false,
  "seriesId": null
}
```

- Status: `inbox`, `pending`, `progress`, `someday`, `completed`. Só `completed` tem `completedAt` e pode ser arquivado.
- Prioridade: 0 nenhuma, 1 baixa, 2 média, 3 alta. Título não vazio, até 240 caracteres; notas até 50 mil.
- `projectId`/`tags`: referências a registros existentes nas coleções correspondentes.
- Recorrência: `unit` é `day`, `week` ou `month`; intervalo inteiro 1–365; dias da semana 0 domingo até 6 sábado; `monthDay` 1–31 preserva a âncora mensal; `until` é inclusivo.
- Anexo: nome sanitizado, bytes em base64 padrão e tamanho binário exato. Máximo 10 MB por arquivo e 20 por tarefa. Não há caminhos locais no formato portátil.
- Projeto: `{ "id": "p1", "name": "Trabalho", "color": "#7c3aed" }`.
- Tag: `{ "id": "tag1", "name": "estudo" }`.
- Hábito: `{ "id": "h1", "title": "Ler", "weekdays": [1,2,3,4,5], "logs": ["2026-10-06"], "createdAt": "2026-10-06T12:00:00Z" }`. Uma marcação por data.
- Filtro: `{ "id": "f1", "name": "Importantes", "criteria": { "query": "", "status": "", "projectId": "", "tagId": "", "priority": "3", "dateField": "dueDate", "dateFrom": "2026-10-06", "dateTo": "2026-10-10" } }`. String vazia significa qualquer valor. `dateField` aceita `dueDate` (prazo) ou `startDate` (início); `dateFrom` e `dateTo` aceitam datas locais inclusivas ou string vazia para limite aberto. O início não pode ser posterior ao fim. Arquivos antigos sem esses três campos continuam válidos e recebem `dueDate`, `""` e `""`, respectivamente. Exportações novas incluem os campos; versões antigas do aplicativo podem não aceitar esses arquivos.
- Sessão: `{ "id": "s1", "taskId": null, "title": "Sessão livre", "seconds": 1500, "endedAt": "2026-10-06T12:25:00Z" }`. Título preservado mesmo se a tarefa for removida.
- Timer: `null` ou `{ "taskId": null, "endAt": null, "remaining": 1500, "duration": 1500 }`. Segundos inteiros; duração entre 60 e 10800. Importação pausa o timer.

Versões desconhecidas, IDs duplicados, referências quebradas, datas inválidas, conteúdo base64 inválido e limites excedidos são recusados. Não há merge automático: importar substitui o workspace após confirmação e backup prévio. `src/domain/task.ts` e `src-tauri/src/model.rs` são os contratos de validação.
