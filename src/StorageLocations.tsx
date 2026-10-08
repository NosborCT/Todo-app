import { useEffect, useRef, useState } from 'react';
import { Dialog } from './components';
import {
  desktop,
  getStorageLocations,
  pickStorageFolder,
  type StorageKind,
  type StorageLocations as Locations,
} from './lib/storage';

export function StorageLocations({
  onChange,
}: {
  onChange: (kind: StorageKind, folder: string) => Promise<void>;
}) {
  const [locations, setLocations] = useState<Locations | null>(null);
  const [proposal, setProposal] = useState<{ kind: StorageKind; folder: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);
  async function refresh() {
    try {
      const value = await getStorageLocations();
      if (mounted.current) {
        setLocations(value);
        setError('');
      }
    } catch (e) {
      if (mounted.current) setError(String(e));
    }
  }
  useEffect(() => {
    mounted.current = true;
    if (desktop) void refresh();
    return () => {
      mounted.current = false;
    };
  }, []);
  async function choose(kind: StorageKind) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const folder = await pickStorageFolder();
      if (mounted.current && folder) setProposal({ kind, folder });
    } catch (e) {
      if (mounted.current) setError(String(e));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (!desktop)
    return (
      <p className="hint">
        Alterar as pastas de dados e backups está disponível no aplicativo desktop.
      </p>
    );
  return (
    <div className="storage-locations">
      <h3>Pastas de armazenamento</h3>
      {!locations && !error && <p role="status">Carregando pastas…</p>}
      {locations && (
        <>
          <label>
            Pasta dos dados<code>{locations.dataDir}</code>
          </label>
          <button className="secondary" disabled={busy} onClick={() => void choose('data')}>
            Alterar pasta dos dados
          </button>
          <label>
            Pasta dos backups<code>{locations.backupDir}</code>
          </label>
          <button className="secondary" disabled={busy} onClick={() => void choose('backup')}>
            Alterar pasta dos backups
          </button>
          <p className="hint">
            As pastas são independentes. O banco inclui tarefas, anexos, hábitos e históricos. O
            modelo de voz permanece na pasta do aplicativo.
          </p>
        </>
      )}
      {error && !proposal && (
        <div role="alert" className="field-error">
          {error}
          <button className="text-button" disabled={busy} onClick={() => void refresh()}>
            Tentar novamente
          </button>
        </div>
      )}
      {success && <p role="status">{success}</p>}
      {proposal && (
        <Dialog
          title={proposal.kind === 'data' ? 'Alterar pasta dos dados' : 'Alterar pasta dos backups'}
          onClose={() => {
            if (!locked.current) setProposal(null);
          }}
        >
          <div className="dialog-body">
            <p>Destino escolhido:</p>
            <code className="storage-destination">{proposal.folder}</code>
            <p>
              {proposal.kind === 'data'
                ? 'O banco atual será copiado e validado. O Chrono passará a salvar nesta pasta; a cópia antiga será mantida para recuperação. Uma pasta que já contenha todo.db será recusada.'
                : 'Será criado um backup de verificação no destino. Os próximos backups diários, manuais e anteriores à importação usarão esta pasta. Os backups antigos permanecem onde estão.'}
            </p>
            <p className="hint">
              Mantenha a unidade disponível durante o uso. Feche outras instâncias do Chrono antes
              de transferir os dados.
            </p>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (locked.current) return;
                locked.current = true;
                setBusy(true);
                setError('');
                try {
                  await onChange(proposal.kind, proposal.folder);
                  if (!mounted.current) return;
                  setProposal(null);
                  setSuccess(
                    'Pasta atualizada. A alteração já está em uso e será mantida ao reabrir o Chrono.',
                  );
                  await refresh();
                } catch (e) {
                  if (mounted.current) setError(String(e));
                } finally {
                  locked.current = false;
                  if (mounted.current) setBusy(false);
                }
              }}
            >
              {busy ? 'Transferindo e validando…' : 'Confirmar alteração'}
            </button>
            <button className="secondary" disabled={busy} onClick={() => setProposal(null)}>
              Cancelar
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
