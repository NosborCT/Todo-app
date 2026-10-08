import { describe, expect, it } from 'vitest';
import { emptyVoiceSchedule, interpretVoice, reminderToISO } from '../src/domain/voiceIntent';
const reference = new Date(2026, 9, 8, 10, 15); // Thursday, local calendar.
describe('interpretação local de voz', () => {
  it.each([
    ['Comprar pão hoje', '2026-10-08', ''],
    ['Revisar amanhã às 8', '2026-10-09', '2026-10-09T08:00'],
    ['Revisar depois de amanhã às oito e meia', '2026-10-10', '2026-10-10T08:30'],
    ['Consulta sexta-feira às duas da tarde', '2026-10-09', '2026-10-09T14:00'],
    ['Revisar quinta', '2026-10-15', ''],
    ['Consulta dia 12 de outubro às 14h30', '2026-10-12', '2026-10-12T14:30'],
    ['Consulta 12/10/2026 às vinte e três e quinze', '2026-10-12', '2026-10-12T23:15'],
    ['Consulta 01/01', '2027-01-01', ''],
    ['Consulta amanhã ao meio-dia', '2026-10-09', '2026-10-09T12:00'],
    ['Revisar amanhã à meia-noite', '2026-10-09', '2026-10-09T00:00'],
    ['Revisar daqui a dois dias', '2026-10-10', ''],
    ['Revisar daqui a 30 minutos', '2026-10-08', '2026-10-08T10:45'],
    ['Revisar daqui a duas horas', '2026-10-08', '2026-10-08T12:15'],
    ['Revisar às 8', '2026-10-09', '2026-10-09T08:00'],
    ['Revisar às 18:05', '2026-10-08', '2026-10-08T18:05'],
    ['Revisar amanhã às oito horas e trinta', '2026-10-09', '2026-10-09T08:30'],
    ['Revisar depois  de amanhã às 8', '2026-10-10', '2026-10-10T08:00'],
  ])('%s', (text, dueDate, reminder) => {
    expect(interpretVoice(text, reference)).toMatchObject({ startDate: '', dueDate, reminder });
  });
  it('separa início, prazo e antecedência do lembrete', () => {
    expect(
      interpretVoice(
        'Começar o relatório amanhã e entregar sexta às 14h, me lembre 30 minutos antes',
        reference,
      ),
    ).toMatchObject({
      startDate: '2026-10-09',
      dueDate: '2026-10-09',
      reminder: '2026-10-09T13:30',
    });
  });
  it('lembrete explícito substitui horário do prazo e pode vir em outro dia', () => {
    expect(
      interpretVoice('Entregar relatório sexta às 14h e me lembre hoje às 18h', reference),
    ).toMatchObject({ dueDate: '2026-10-09', reminder: '2026-10-08T18:00' });
    expect(interpretVoice('Me lembre amanhã às 9 de comprar pão', reference)).toMatchObject({
      dueDate: '',
      reminder: '2026-10-09T09:00',
    });
  });
  it('não inventa horário para data ou pedido de lembrete sem hora', () => {
    expect(interpretVoice('Entregar amanhã, me lembre 30 minutos antes', reference)).toMatchObject({
      dueDate: '2026-10-09',
      reminder: '',
    });
    expect(interpretVoice('Me lembre amanhã', reference).messages).toContain(
      'Você pediu um lembrete sem horário. Preencha o campo Lembrete.',
    );
  });
  it.each([
    'Revisar amanhã ou sexta às 8',
    'Revisar amanhã às 25',
    'Revisar 31/02/2026 às 8',
    'Começar sexta e entregar hoje',
    'Revisar toda semana amanhã',
    'Não me lembre amanhã às 8',
    'Revisar dia 15 às 8',
    'Revisar 12/10/26 às 8',
    'Entregar amanhã às 8 ou entregar amanhã às 9',
    'Entregar amanhã às 8, me lembre 1 hora antes e 30 minutos antes',
  ])('recusa expressão inválida ou ambígua: %s', (text) => {
    const result = interpretVoice(text, reference);
    expect(result).toMatchObject(emptyVoiceSchedule);
    expect(result.messages.length).toBeGreaterThan(0);
  });
  it('não confunde quantidades e artigos com horários', () => {
    expect(interpretVoice('Ler as duas páginas amanhã', reference)).toMatchObject({
      dueDate: '2026-10-09',
      reminder: '',
    });
    expect(interpretVoice('Comprar 8 pães e ir a uma loja', reference)).toMatchObject(
      emptyVoiceSchedule,
    );
  });
  it('lida com virada de ano e datas bissextas explícitas', () => {
    expect(interpretVoice('Revisar amanhã', new Date(2026, 11, 31, 23))).toMatchObject({
      dueDate: '2027-01-01',
    });
    expect(interpretVoice('Revisar 29/02/2028', reference)).toMatchObject({
      dueDate: '2028-02-29',
    });
  });
  it('converte lembrete local para um instante sem deslocar datas civis', () => {
    expect(reminderToISO('2026-10-09T08:30')).toBe(new Date(2026, 9, 9, 8, 30).toISOString());
    expect(reminderToISO('')).toBeNull();
    expect(() => reminderToISO('2026-02-30T08:00')).toThrow();
  });
  it('avisa sobre um horário passado e preserva a data explícita', () => {
    const result = interpretVoice('Revisar hoje às 8', reference);
    expect(result.reminder).toBe('2026-10-08T08:00');
    expect(result.messages.join(' ')).toContain('passado');
  });
  it('não antecipa um intervalo relativo por arredondar segundos', () => {
    expect(
      interpretVoice('Me lembre daqui a um minuto', new Date(2026, 9, 8, 23, 59, 30)).reminder,
    ).toBe('2026-10-09T00:01');
  });
  it('não usa a hora do prazo quando o lembrete explícito está incompleto', () => {
    expect(interpretVoice('Entregar amanhã às 14, me lembre hoje', reference)).toMatchObject({
      dueDate: '2026-10-09',
      reminder: '',
    });
  });
  it('rejeita um horário inexistente em transição de fuso', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(() => reminderToISO('2026-03-08T02:30')).toThrow();
      expect(interpretVoice('Revisar amanhã às 2:30', new Date(2026, 2, 7, 12))).toMatchObject(
        emptyVoiceSchedule,
      );
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
