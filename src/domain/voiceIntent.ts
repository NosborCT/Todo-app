import { addDays, localDate } from './task';

export type VoiceSchedule = { startDate: string; dueDate: string; reminder: string };
export type VoiceIntent = VoiceSchedule & { messages: string[] };
export const emptyVoiceSchedule: VoiceSchedule = { startDate: '', dueDate: '', reminder: '' };
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
const words: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
};
const numberPattern = `(?:\\d{1,4}|(?:vinte|trinta|quarenta|cinquenta)(?: e (?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove))?|${Object.keys(
  words,
)
  .filter((w) => !['vinte', 'trinta', 'quarenta', 'cinquenta'].includes(w))
  .join('|')})`;
function number(s: string): number {
  return /^\d+$/.test(s) ? Number(s) : s.split(' e ').reduce((n, w) => n + (words[w] ?? NaN), 0);
}
const weekdays = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const months = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const pad = (n: number) => String(n).padStart(2, '0');
export function localDateTime(d: Date): string {
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Round-trip validation also rejects local times skipped by a daylight-saving transition. */
export function reminderToISO(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Lembrete inválido.');
  const d = new Date(value);
  if (!Number.isFinite(d.getTime()) || localDateTime(d) !== value)
    throw new Error('Esse horário não existe no fuso local. Escolha outro horário.');
  return d.toISOString();
}

function civil(year: number, month: number, day: number): string {
  const text = `${year}-${pad(month)}-${pad(day)}`;
  const d = new Date(`${text}T12:00:00`);
  if (year < 1000 || year > 9999 || !Number.isFinite(d.getTime()) || localDate(d) !== text)
    throw new Error('A data falada não é válida. Preencha as datas manualmente.');
  return text;
}

/** Conservative, offline Portuguese grammar. Never changes the transcript/title. */
export function interpretVoice(text: string, reference = new Date()): VoiceIntent {
  const result: VoiceIntent = { ...emptyVoiceSchedule, messages: [] };
  const normalized = normalize(text);
  const today = localDate(reference);
  try {
    if (
      /\b(todo dia|todos os dias|toda semana|todas as semanas|toda (segunda|terca|quarta|quinta|sexta)|diariamente|semanalmente|mensalmente|a cada|proxima semana|semana que vem|mes que vem)\b/.test(
        normalized,
      )
    )
      throw new Error(
        'Expressão recorrente ou período sem dia definido. Configure as datas e a repetição nos detalhes da tarefa.',
      );
    if (
      /\b(nao|sem)\b/.test(normalized) &&
      /\b(hoje|amanha|as|lembrete|lembre|lembrar)\b/.test(normalized)
    )
      throw new Error('A frase contém uma negação. Revise e preencha o agendamento manualmente.');
    const markers =
      /\b(comecar|iniciar|inicio|prazo|entregar|concluir|vencimento|me lembre|lembre(?:-me)?|lembrar(?:-me)?|me avise|avise(?:-me)?|avisar|lembrete)\b/g;
    const matches = [...normalized.matchAll(markers)];
    const clauses: { mode: 'start' | 'due' | 'reminder'; text: string }[] = [];
    let start = 0;
    let mode: 'start' | 'due' | 'reminder' = 'due';
    for (const m of matches) {
      clauses.push({ mode, text: normalized.slice(start, m.index) });
      mode = /comecar|iniciar|inicio/.test(m[0])
        ? 'start'
        : /lemb|avis/.test(m[0])
          ? 'reminder'
          : 'due';
      start = m.index! + m[0].length;
    }
    clauses.push({ mode, text: normalized.slice(start) });
    let dueTime = '';
    let explicitReminder = '';
    let incompleteReminder = false;
    let relativeReminder: { n: number; unit: string } | null = null;
    const assign = (field: 'startDate' | 'dueDate', value: string) => {
      if (result[field] && result[field] !== value)
        throw new Error(
          'Encontrei mais de uma data para o mesmo campo. Preencha o agendamento manualmente.',
        );
      result[field] = value;
    };
    for (const clause of clauses) {
      let source = clause.text;
      const beforeMatches = [
        ...source.matchAll(
          new RegExp(`\\b(${numberPattern}) (minutos?|horas?|dias?) antes\\b`, 'g'),
        ),
      ];
      if (beforeMatches.length > 1)
        throw new Error('Há mais de um lembrete. Escolha um horário manualmente.');
      const before = beforeMatches[0];
      if (before && clause.mode === 'reminder') {
        if (relativeReminder || explicitReminder)
          throw new Error('Há mais de um lembrete. Escolha um horário manualmente.');
        relativeReminder = { n: number(before[1]), unit: before[2] };
        source = source.replace(before[0], '');
      }
      const candidates: { date: string; time?: string }[] = [];
      source = source.replace(
        new RegExp(`\\bdaqui a (${numberPattern}) (minutos?|horas?|dias?|semanas?)\\b`, 'g'),
        (_, n: string, unit: string) => {
          const amount = number(n);
          if (amount < 1 || amount > 365)
            throw new Error('Use um intervalo entre 1 e 365 unidades.');
          if (/^(dia|semana)/.test(unit))
            candidates.push({ date: addDays(today, amount * (unit.startsWith('semana') ? 7 : 1)) });
          else {
            const target =
              reference.getTime() + amount * (unit.startsWith('hora') ? 3600000 : 60000);
            const d = new Date(Math.ceil(target / 60000) * 60000);
            if (target % 60000)
              result.messages.push('Horário relativo arredondado para o próximo minuto.');
            candidates.push({ date: localDate(d), time: localDateTime(d) });
          }
          return '';
        },
      );
      source = source.replace(/\b(depois de amanha|amanha|hoje)\b/g, (_, v: string) => {
        candidates.push({ date: addDays(today, v === 'hoje' ? 0 : v === 'amanha' ? 1 : 2) });
        return '';
      });
      source = source.replace(
        new RegExp(`\\b(?:proxim[ao]\\s+)?(${weekdays.join('|')})(?:[- ]feira)?\\b`, 'g'),
        (_, day: string) => {
          const offset = (weekdays.indexOf(day) - reference.getDay() + 7) % 7 || 7;
          candidates.push({ date: addDays(today, offset) });
          return '';
        },
      );
      const dateCandidate = (day: number, month: number, year?: number) => {
        let value = civil(year ?? reference.getFullYear(), month, day);
        if (!year && value < today) value = civil(reference.getFullYear() + 1, month, day);
        candidates.push({ date: value });
      };
      source = source.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, (_, d, m, y) => {
        if (y && y.length !== 4) throw new Error('Informe o ano com quatro dígitos.');
        dateCandidate(Number(d), Number(m), y ? Number(y) : undefined);
        return '';
      });
      source = source.replace(
        new RegExp(
          `\\b(?:dia )?(${numberPattern}) de (${months.join('|')})(?: de (\\d{2,4}))?\\b`,
          'g',
        ),
        (_, d, m, y) => {
          if (y && y.length !== 4) throw new Error('Informe o ano com quatro dígitos.');
          dateCandidate(number(d), months.indexOf(m) + 1, y ? Number(y) : undefined);
          return '';
        },
      );
      const times: string[] = [];
      if (new RegExp(`\\bdia\\s+${numberPattern}\\b`).test(source))
        throw new Error('Informe também o mês, por exemplo “dia 15 de outubro”.');
      source = source.replace(/\b(meio[- ]dia|meia[- ]noite)\b/g, (_, v: string) => {
        times.push(v.startsWith('meio') ? '12:00' : '00:00');
        return '';
      });
      const clock = new RegExp(
        `(?:\\bas\\s+(${numberPattern})(?:\\s+horas?)?(?:\\s*(?::|h)\\s*(\\d{1,2})|\\s+e\\s+(meia|${numberPattern}))?\\s*(?:horas?|h)?|\\b(\\d{1,2})(?::(\\d{1,2})|h(\\d{2})?))\\s*(?:da\\s+(manha|tarde|noite))?\\b(?=\\s*(?:$|[,.;!?]|(?:de|do|da|dos|das|e|ou|para|em|no|na)\\b))`,
        'g',
      );
      source = source.replace(clock, (_, h, m, spoken, bare, bareM, hM, period) => {
        let hour = h ? number(h) : Number(bare);
        const minute = m
          ? Number(m)
          : spoken
            ? spoken === 'meia'
              ? 30
              : number(spoken)
            : Number(bareM || hM || 0);
        if (period && hour > 12) throw new Error('O horário e o período do dia são incompatíveis.');
        if (hour === 12 && (period === 'manha' || period === 'noite'))
          throw new Error('Use “meio-dia” ou “meia-noite” para evitar ambiguidade.');
        if ((period === 'tarde' || period === 'noite') && hour < 12) hour += 12;
        if (period === 'manha' && hour === 12) hour = 0;
        if (hour > 23 || minute > 59 || !Number.isFinite(hour + minute))
          throw new Error('O horário falado não é válido. Preencha o lembrete manualmente.');
        times.push(`${pad(hour)}:${pad(minute)}`);
        return '';
      });
      if (candidates.length > 1 || times.length > 1 || (candidates[0]?.time && times.length))
        throw new Error(
          'Há mais de uma data ou horário na mesma expressão. Revise o agendamento manualmente.',
        );
      if (!candidates.length && !times.length) continue;
      let date = candidates[0]?.date || '';
      let instant = candidates[0]?.time || '';
      if (times[0]) {
        if (!date) {
          date = result.dueDate || result.startDate || today;
          if (
            clause.mode !== 'reminder' &&
            !result.dueDate &&
            !result.startDate &&
            new Date(`${date}T${times[0]}`).getTime() <= reference.getTime()
          )
            date = addDays(today, 1);
          result.messages.push('Horário sem dia: confira a data sugerida.');
        }
        instant = `${date}T${times[0]}`;
        reminderToISO(instant);
      }
      if (clause.mode === 'start') {
        assign('startDate', date);
        if (instant)
          result.messages.push(
            'Horário de início reconhecido; início armazena apenas a data. Diga “me lembre” para criar um lembrete.',
          );
      } else if (clause.mode === 'reminder') {
        if (explicitReminder || (relativeReminder && (date || instant)))
          throw new Error('Há mais de um lembrete. Escolha um horário manualmente.');
        if (instant) explicitReminder = instant;
        else {
          incompleteReminder = true;
          result.messages.push('Você pediu um lembrete sem horário. Preencha o campo Lembrete.');
        }
      } else {
        assign('dueDate', date);
        if (instant) {
          if (dueTime && dueTime !== instant)
            throw new Error('Há mais de um horário para a tarefa. Escolha um manualmente.');
          dueTime = instant;
        }
      }
    }
    result.reminder = explicitReminder || (incompleteReminder ? '' : dueTime);
    if (relativeReminder) {
      if (!dueTime) {
        result.reminder = '';
        result.messages.push('Para lembrar antes, informe também o dia e a hora da tarefa.');
      } else {
        const { n, unit } = relativeReminder;
        if (n < 1 || n > 365) throw new Error('Antecedência inválida. Use entre 1 e 365 unidades.');
        const d = new Date(dueTime);
        if (unit.startsWith('dia')) d.setDate(d.getDate() - n);
        else d.setTime(d.getTime() - n * (unit.startsWith('hora') ? 3600000 : 60000));
        result.reminder = localDateTime(d);
      }
    }
    if (result.startDate && result.dueDate && result.startDate > result.dueDate)
      throw new Error('O início ficou depois do prazo. Revise as datas manualmente.');
    if (result.reminder && new Date(result.reminder).getTime() <= reference.getTime())
      result.messages.push('O lembrete sugerido está no passado. Ajuste antes de salvar.');
    if (result.dueDate && result.dueDate < today)
      result.messages.push('O prazo sugerido está no passado.');
    if (!result.startDate && !result.dueDate && !result.reminder && !result.messages.length)
      result.messages.push(
        'Não reconheci um agendamento. Você pode preencher as datas manualmente.',
      );
    return result;
  } catch (e) {
    return {
      ...emptyVoiceSchedule,
      messages: [e instanceof Error ? e.message : 'Não foi possível interpretar as datas.'],
    };
  }
}
