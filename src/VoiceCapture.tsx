import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Mic, Square, Download } from 'lucide-react';
import { Dialog } from './components';
import { desktop } from './lib/storage';

type VoiceStatus = {
  phase: string;
  seconds: number;
  progress: number;
  text: string;
  error: string | null;
  modelReady: boolean;
};
export function VoiceCapture({
  projectName,
  onClose,
  onSave,
}: {
  projectName?: string;
  onClose: () => void;
  onSave: (title: string) => Promise<boolean>;
}) {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const reviewed = useRef(false);
  const locked = useRef(false);
  const requestVersion = useRef(0);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = body.current;
    if (!node) return;
    (node.querySelector('textarea, button:not(:disabled)') as HTMLElement | null)?.focus();
  }, [status?.phase, pending]);
  useEffect(() => {
    mounted.current = true;
    if (!desktop) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const version = requestVersion.current;
      try {
        const next = await invoke<VoiceStatus>('voice_status');
        if (!active) return;
        if (version === requestVersion.current && !locked.current) {
          setStatus(next);
          if (next.phase !== 'review') reviewed.current = false;
          else if (!reviewed.current) {
            setText(next.text);
            reviewed.current = true;
          }
        }
      } catch (e) {
        if (active) setError(String(e));
      }
      if (active) timer = setTimeout(poll, 400);
    };
    void poll();
    return () => {
      mounted.current = false;
      active = false;
      clearTimeout(timer);
      void invoke('voice_cancel').catch(() => {});
    };
  }, []);
  const command = async (name: string, args?: Record<string, unknown>) => {
    if (locked.current) return;
    requestVersion.current++;
    locked.current = true;
    setPending(true);
    setError('');
    try {
      await invoke(name, args);
      if (mounted.current) setStatus(await invoke<VoiceStatus>('voice_status'));
    } catch (e) {
      if (mounted.current) setError(String(e));
    } finally {
      locked.current = false;
      if (mounted.current) setPending(false);
    }
  };
  const close = async () => {
    if (saving || pending) return;
    if (desktop) {
      try {
        await invoke('voice_cancel');
      } catch (e) {
        setError(String(e));
        return;
      }
    }
    onClose();
  };
  const working =
    status && ['starting', 'recording', 'transcribing', 'downloading'].includes(status.phase);
  return (
    <Dialog title="Criar tarefa por voz" onClose={() => void close()}>
      <div ref={body} className="dialog-body voice-capture">
        <p className="muted">
          Fale em português, revise o texto e confirme. O áudio fica apenas na memória e é
          descartado após a transcrição ou o cancelamento.
        </p>
        <p className="hint">Destino: {projectName ? `Inbox · ${projectName}` : 'Inbox'}</p>
        {!desktop ? (
          <p role="status">
            A captura por voz está disponível no aplicativo desktop. Abra o Chrono com npm run
            start.
          </p>
        ) : (
          <>
            {!status && !error && <p role="status">Verificando o modelo de voz…</p>}
            {status && (
              <>
                {!status.modelReady && !working && (
                  <p>
                    Instale o modelo Whisper base (aproximadamente 142 MiB). Esse download precisa
                    de internet; depois, a transcrição funciona offline.
                  </p>
                )}
                <div
                  className={`voice-status ${status.phase === 'recording' ? 'is-recording' : ''}`}
                  role="status"
                  aria-live="polite"
                >
                  {status.phase === 'recording' && (
                    <>
                      <Mic size={24} /> Gravando · {status.seconds}s / 60s
                    </>
                  )}
                  {status.phase === 'starting' && 'Abrindo o microfone…'}
                  {status.phase === 'transcribing' && 'Transcrevendo no seu computador…'}
                  {status.phase === 'downloading' && (
                    <>
                      Baixando modelo · {status.progress}%
                      <progress value={status.progress} max={100} />
                    </>
                  )}
                  {status.phase === 'idle' &&
                    status.modelReady &&
                    'Modelo pronto. Clique em Gravar para começar.'}
                </div>
                {status.phase === 'review' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (locked.current || !text.trim() || text.trim().length > 240) return;
                      locked.current = true;
                      setSaving(true);
                      setError('');
                      try {
                        if (await onSave(text.trim())) onClose();
                        else
                          setError(
                            'Não foi possível salvar. Seu texto foi mantido; tente novamente.',
                          );
                      } catch (e) {
                        setError(String(e));
                      } finally {
                        locked.current = false;
                        if (mounted.current) setSaving(false);
                      }
                    }}
                  >
                    <label htmlFor="voice-text">Revise o título da tarefa</label>
                    <textarea
                      id="voice-text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={4}
                      disabled={saving}
                    />
                    <p className="hint">
                      {text.trim().length}/240 caracteres. Datas mencionadas permanecem no texto
                      nesta etapa.
                    </p>
                    {text.trim().length > 240 && (
                      <p className="field-error">Resuma o título para até 240 caracteres.</p>
                    )}
                    <button
                      className="primary"
                      disabled={saving || !text.trim() || text.trim().length > 240}
                    >
                      {saving ? 'Salvando…' : 'Criar tarefa'}
                    </button>
                  </form>
                )}
                <div className="voice-actions">
                  {!working && status.phase !== 'review' && (
                    <button
                      className="primary"
                      disabled={pending}
                      onClick={() => {
                        reviewed.current = false;
                        void command('voice_begin', { download: !status.modelReady });
                      }}
                    >
                      {status.modelReady ? (
                        <>
                          <Mic size={16} /> Gravar
                        </>
                      ) : (
                        <>
                          <Download size={16} /> Instalar modelo
                        </>
                      )}
                    </button>
                  )}
                  {status.phase === 'recording' && (
                    <button
                      className="primary"
                      disabled={pending}
                      onClick={() => void command('voice_stop')}
                    >
                      <Square size={16} /> Parar e transcrever
                    </button>
                  )}
                  {status.phase === 'review' && (
                    <button
                      className="secondary"
                      disabled={saving || pending}
                      onClick={() => {
                        reviewed.current = false;
                        void command('voice_begin', { download: false });
                      }}
                    >
                      Gravar novamente
                    </button>
                  )}
                  {status.phase === 'error' && status.modelReady && (
                    <button
                      className="secondary"
                      disabled={pending}
                      onClick={() => void command('voice_begin', { download: true })}
                    >
                      Reinstalar modelo
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {(error || status?.error) && (
          <p role="alert" className="field-error">
            {error || status?.error}
          </p>
        )}
        <button className="secondary" disabled={saving || pending} onClick={() => void close()}>
          Cancelar
        </button>
      </div>
    </Dialog>
  );
}
