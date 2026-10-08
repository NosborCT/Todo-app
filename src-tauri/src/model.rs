use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::{DateTime, NaiveDate};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub status: String,
    pub notes: String,
    pub priority: u8,
    pub project_id: Option<String>,
    pub tags: Vec<String>,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub reminder_at: Option<String>,
    pub notified_at: Option<String>,
    pub recurrence: Option<Recurrence>,
    pub subtasks: Vec<Subtask>,
    pub attachments: Vec<Attachment>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub archived: bool,
    pub series_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Recurrence {
    pub unit: String,
    pub interval: u16,
    pub weekdays: Vec<u8>,
    pub month_day: u8,
    pub until: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Subtask {
    pub id: String,
    pub title: String,
    pub done: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attachment {
    pub id: String,
    pub name: String,
    pub data: String,
    pub size: usize,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub color: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Tag {
    pub id: String,
    pub name: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Habit {
    pub id: String,
    pub title: String,
    pub weekdays: Vec<u8>,
    pub logs: Vec<String>,
    pub created_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Criteria {
    pub query: String,
    pub status: String,
    pub project_id: String,
    pub tag_id: String,
    pub priority: String,
    #[serde(default = "default_date_field")]
    pub date_field: String,
    #[serde(default)]
    pub date_from: String,
    #[serde(default)]
    pub date_to: String,
}
fn default_date_field() -> String {
    "dueDate".into()
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Filter {
    pub id: String,
    pub name: String,
    pub criteria: Criteria,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Session {
    pub id: String,
    pub task_id: Option<String>,
    pub title: String,
    pub seconds: u32,
    pub ended_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    pub theme: String,
    pub notifications: bool,
    pub focus_minutes: u16,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Timer {
    pub task_id: Option<String>,
    pub end_at: Option<String>,
    pub remaining: u32,
    pub duration: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Workspace {
    pub version: u8,
    pub tasks: Vec<Task>,
    pub projects: Vec<Project>,
    pub tags: Vec<Tag>,
    pub habits: Vec<Habit>,
    pub filters: Vec<Filter>,
    pub sessions: Vec<Session>,
    pub settings: Settings,
    pub timer: Option<Timer>,
}
impl Default for Workspace {
    fn default() -> Self {
        Self {
            version: 1,
            tasks: vec![],
            projects: vec![],
            tags: vec![],
            habits: vec![],
            filters: vec![],
            sessions: vec![],
            settings: Settings {
                theme: "light".into(),
                notifications: false,
                focus_minutes: 25,
            },
            timer: None,
        }
    }
}
fn ensure(ok: bool, msg: &str) -> Result<(), String> {
    if ok {
        Ok(())
    } else {
        Err(msg.into())
    }
}
fn title(s: &str) -> Result<(), String> {
    ensure(
        !s.trim().is_empty() && s.chars().count() <= 240,
        "Título obrigatório (até 240 caracteres).",
    )
}
fn identifier(s: &str) -> Result<(), String> {
    ensure(
        !s.is_empty()
            && s.len() <= 100
            && s.chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
        "Identificador inválido.",
    )
}
fn ids<'a>(iter: impl Iterator<Item = &'a str>) -> Result<(), String> {
    let mut seen = HashSet::new();
    for s in iter {
        identifier(s)?;
        ensure(seen.insert(s), "Identificador duplicado.")?;
    }
    Ok(())
}
fn date(s: &str) -> Result<(), String> {
    ensure(
        s.len() == 10 && NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok(),
        "Data inválida.",
    )
}
fn timestamp(s: &str) -> Result<(), String> {
    ensure(
        DateTime::parse_from_rfc3339(s).is_ok(),
        "Timestamp inválido.",
    )
}
pub fn safe_name(s: &str) -> String {
    let name: String = s
        .chars()
        .map(|c| {
            if c.is_control() || "<>:\"/\\|?*".contains(c) {
                '_'
            } else {
                c
            }
        })
        .take(150)
        .collect();
    let trimmed = name.trim_end_matches(['.', ' ']);
    if trimmed.is_empty() {
        "anexo".into()
    } else {
        trimmed.into()
    }
}
pub fn validate(w: &Workspace) -> Result<(), String> {
    ensure(w.version == 1, "Versão de arquivo não suportada.")?;
    ensure(
        w.tasks.len() <= 20000
            && w.projects.len() <= 1000
            && w.tags.len() <= 1000
            && w.habits.len() <= 1000
            && w.filters.len() <= 100
            && w.sessions.len() <= 100000,
        "Limite de registros excedido.",
    )?;
    ids(w.tasks.iter().map(|t| t.id.as_str()))?;
    ids(w.projects.iter().map(|t| t.id.as_str()))?;
    ids(w.tags.iter().map(|t| t.id.as_str()))?;
    ids(w.habits.iter().map(|t| t.id.as_str()))?;
    ids(w.filters.iter().map(|t| t.id.as_str()))?;
    ids(w.sessions.iter().map(|t| t.id.as_str()))?;
    for p in &w.projects {
        title(&p.name)?;
        ensure(
            p.color.len() == 7
                && p.color.starts_with('#')
                && p.color[1..].chars().all(|c| c.is_ascii_hexdigit()),
            "Cor inválida.",
        )?;
    }
    for t in &w.tags {
        title(&t.name)?;
    }
    let statuses = ["inbox", "pending", "progress", "someday", "completed"];
    for t in &w.tasks {
        title(&t.title)?;
        ensure(
            statuses.contains(&t.status.as_str())
                && t.priority <= 3
                && t.notes.chars().count() <= 50000,
            "Tarefa inválida.",
        )?;
        timestamp(&t.created_at)?;
        timestamp(&t.updated_at)?;
        for s in [&t.reminder_at, &t.notified_at, &t.completed_at]
            .into_iter()
            .flatten()
        {
            timestamp(s)?;
        }
        for s in [&t.start_date, &t.due_date].into_iter().flatten() {
            date(s)?;
        }
        ensure(
            (t.status == "completed") == t.completed_at.is_some(),
            "Estado de conclusão inconsistente.",
        )?;
        ensure(
            !t.archived || t.status == "completed",
            "Somente tarefas concluídas podem ser arquivadas.",
        )?;
        if let (Some(start), Some(due)) = (&t.start_date, &t.due_date) {
            ensure(start <= due, "Início posterior ao prazo.")?;
        }
        if let Some(p) = &t.project_id {
            ensure(
                w.projects.iter().any(|x| &x.id == p),
                "Projeto inexistente.",
            )?;
        }
        if let Some(s) = &t.series_id {
            identifier(s)?;
        }
        ensure(
            t.tags.len() <= 100
                && t.tags
                    .iter()
                    .all(|id| w.tags.iter().any(|tag| &tag.id == id)),
            "Tag inválida.",
        )?;
        if let Some(r) = &t.recurrence {
            ensure(
                t.due_date.is_some()
                    && ["day", "week", "month"].contains(&r.unit.as_str())
                    && (1..=365).contains(&r.interval)
                    && (1..=31).contains(&r.month_day)
                    && r.weekdays.len() <= 7
                    && r.weekdays.iter().all(|d| *d <= 6),
                "Recorrência inválida.",
            )?;
            if let Some(until) = &r.until {
                date(until)?;
            }
        }
        ensure(
            t.subtasks.len() <= 500 && t.attachments.len() <= 20,
            "Excesso de subtarefas ou anexos.",
        )?;
        ids(t.subtasks.iter().map(|s| s.id.as_str()))?;
        ids(t.attachments.iter().map(|s| s.id.as_str()))?;
        for s in &t.subtasks {
            title(&s.title)?;
        }
        for a in &t.attachments {
            ensure(
                !a.name.is_empty()
                    && a.name.chars().count() <= 160
                    && safe_name(&a.name) == a.name
                    && a.size <= 10485760
                    && a.data.len() <= 14000000,
                "Anexo inválido (máximo 10 MB).",
            )?;
            let bytes = STANDARD
                .decode(&a.data)
                .map_err(|_| "Conteúdo de anexo inválido.")?;
            ensure(bytes.len() == a.size, "Tamanho do anexo inconsistente.")?;
        }
    }
    for h in &w.habits {
        title(&h.title)?;
        timestamp(&h.created_at)?;
        ensure(
            !h.weekdays.is_empty()
                && h.weekdays.len() <= 7
                && h.weekdays.iter().all(|d| *d <= 6)
                && h.logs.len() <= 100000,
            "Hábito inválido.",
        )?;
        for d in &h.logs {
            date(d)?;
        }
        ensure(
            h.logs.iter().collect::<HashSet<_>>().len() == h.logs.len(),
            "Registro de hábito duplicado.",
        )?;
    }
    for f in &w.filters {
        title(&f.name)?;
        if !f.criteria.date_from.is_empty() {
            date(&f.criteria.date_from)?;
        }
        if !f.criteria.date_to.is_empty() {
            date(&f.criteria.date_to)?;
        }
        ensure(
            ["dueDate", "startDate"].contains(&f.criteria.date_field.as_str())
                && (f.criteria.date_from.is_empty()
                    || f.criteria.date_to.is_empty()
                    || f.criteria.date_from <= f.criteria.date_to),
            "Intervalo de datas do filtro inválido.",
        )?;
        ensure(
            f.criteria.query.len() <= 2000
                && (f.criteria.status.is_empty() || statuses.contains(&f.criteria.status.as_str()))
                && ["", "0", "1", "2", "3"].contains(&f.criteria.priority.as_str())
                && f.criteria.project_id.len() <= 100
                && f.criteria.tag_id.len() <= 100,
            "Filtro inválido.",
        )?;
    }
    for s in &w.sessions {
        ensure(
            s.seconds > 0 && s.seconds <= 86400 && s.title.chars().count() <= 240,
            "Sessão inválida.",
        )?;
        timestamp(&s.ended_at)?;
    }
    ensure(
        ["light", "dark"].contains(&w.settings.theme.as_str())
            && (1..=180).contains(&w.settings.focus_minutes),
        "Preferências inválidas.",
    )?;
    if let Some(t) = &w.timer {
        ensure(
            (60..=10800).contains(&t.duration) && t.remaining <= t.duration,
            "Timer inválido.",
        )?;
        if let Some(s) = &t.end_at {
            timestamp(s)?;
        }
        if let Some(id) = &t.task_id {
            ensure(
                w.tasks.iter().any(|x| &x.id == id),
                "Tarefa de foco inexistente.",
            )?;
        }
    }
    ensure(
        serde_json::to_vec(w).map_err(|e| e.to_string())?.len() <= 52428800,
        "Workspace excede 50 MB. Exporte e remova anexos antigos.",
    )?;
    Ok(())
}
