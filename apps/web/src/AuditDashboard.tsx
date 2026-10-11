import React from 'react';
import { apiRequest } from './api';
import type { AuditEntry, SimilarMatch } from './types';

interface CreateForm {
  evidenceId: string;
  entityName: string;
  description: string;
  monetaryImpact: string;
  controlId: string;
  actorUserId: string;
}

interface Editor {
  id: string;
  evidenceId: string;
  kind: 'note' | 'core';
  evidenceVersion: number;
  description: string;
  monetaryImpact: string;
  controlId: string;
  auditorNotes: string;
}

interface DashboardState {
  entries: AuditEntry[];
  loading: boolean;
  apiStatus: 'Connecting' | 'Connected' | 'Offline';
  error: string;
  message: string;
  busy: boolean;
  createForm: CreateForm;
  editor: Editor | null;
  matches: { evidenceId: string; items: SimilarMatch[] } | null;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Request failed.';

const newEntryForm = (): CreateForm => ({
  evidenceId: `EVID-${Date.now().toString().slice(-9)}`,
  entityName: '',
  description: '',
  monetaryImpact: '85000',
  controlId: 'CTRL-FIN-302',
  actorUserId: 'user_demo',
});

const currency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export class AuditDashboard extends React.Component<Record<string, never>, DashboardState> {
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  state: DashboardState = {
    entries: [],
    loading: true,
    apiStatus: 'Connecting',
    error: '',
    message: '',
    busy: false,
    createForm: newEntryForm(),
    editor: null,
    matches: null,
  };

  componentDidMount(): void {
    this.loadEntries();
    this.refreshTimer = setInterval(this.loadEntries, 5000);
  }

  componentWillUnmount(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  loadEntries = async (): Promise<void> => {
    try {
      const entries = await apiRequest<AuditEntry[]>('/audit-entries');
      this.setState({ entries, loading: false, apiStatus: 'Connected', error: '' });
    } catch (error: unknown) {
      this.setState({ loading: false, apiStatus: 'Offline', error: errorMessage(error) });
    }
  };

  changeCreate = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, value } = event.target;
    this.setState((state) => ({ createForm: { ...state.createForm, [name]: value } }));
  };

  createEntry = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    this.setState({ busy: true, error: '', message: '' });
    try {
      const form = this.state.createForm;
      await apiRequest('/audit-entries', {
        method: 'POST',
        body: JSON.stringify({ ...form, monetaryImpact: Number(form.monetaryImpact) }),
      });
      this.setState({ createForm: newEntryForm(), message: 'Evidence saved as PENDING.' });
      await this.loadEntries();
    } catch (error: unknown) {
      this.setState({ error: errorMessage(error) });
    } finally {
      this.setState({ busy: false });
    }
  };

  openEditor = (entry: AuditEntry, kind: Editor['kind']): void => {
    this.setState({
      editor: {
        id: entry._id,
        evidenceId: entry.evidenceId,
        kind,
        evidenceVersion: entry.evidenceVersion,
        description: entry.description,
        monetaryImpact: String(entry.monetaryImpact),
        controlId: entry.controlId,
        auditorNotes: entry.aiMetadata.auditorNotes,
      },
      error: '',
      message: '',
    });
  };

  changeEditor = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, value } = event.target;
    this.setState((state) => ({
      editor: state.editor ? { ...state.editor, [name]: value } : null,
    }));
  };

  saveEdit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const editor = this.state.editor;
    if (!editor) return;
    const changes =
      editor.kind === 'note'
        ? { auditorNotes: editor.auditorNotes }
        : {
            description: editor.description,
            monetaryImpact: Number(editor.monetaryImpact),
            controlId: editor.controlId,
          };
    this.setState({ busy: true, error: '', message: '' });
    try {
      const updated = await apiRequest<AuditEntry>(`/audit-entries/${editor.id}`, {
        method: 'PUT',
        body: JSON.stringify(changes),
      });
      this.setState({
        editor: null,
        message:
          editor.kind === 'note'
            ? 'Note saved without queuing enrichment.'
            : updated.evidenceVersion === editor.evidenceVersion
              ? 'No core evidence changed.'
              : 'Evidence updated; enrichment is PENDING.',
      });
      await this.loadEntries();
    } catch (error: unknown) {
      this.setState({ error: errorMessage(error) });
    } finally {
      this.setState({ busy: false });
    }
  };

  showSimilar = async (entry: AuditEntry): Promise<void> => {
    this.setState({ busy: true, error: '', matches: null });
    try {
      const items = await apiRequest<SimilarMatch[]>(`/audit-entries/${entry._id}/similar`);
      this.setState({ matches: { evidenceId: entry.evidenceId, items } });
    } catch (error: unknown) {
      this.setState({ error: errorMessage(error) });
    } finally {
      this.setState({ busy: false });
    }
  };

  retryEnrichment = async (entry: AuditEntry): Promise<void> => {
    this.setState({ busy: true, error: '', message: '' });
    try {
      await apiRequest(`/audit-entries/${entry._id}/retry`, { method: 'POST' });
      this.setState({ message: `Enrichment queued again for ${entry.evidenceId}.` });
      await this.loadEntries();
    } catch (error: unknown) {
      this.setState({ error: errorMessage(error) });
    } finally {
      this.setState({ busy: false });
    }
  };

  renderEditor(): React.ReactNode {
    const { editor, busy } = this.state;
    if (!editor) return null;
    const note = editor.kind === 'note';
    return (
      <section className="panel edit-panel" aria-label="Edit audit entry">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{editor.evidenceId}</p>
            <h2>{note ? 'Edit auditor note' : 'Edit core evidence'}</h2>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => this.setState({ editor: null })}
          >
            Cancel
          </button>
        </div>
        <form onSubmit={this.saveEdit} className="entry-form">
          {note ? (
            <label className="field wide">
              Auditor note
              <textarea
                name="auditorNotes"
                value={editor.auditorNotes}
                onChange={this.changeEditor}
                rows={3}
              />
            </label>
          ) : (
            <div className="form-grid">
              <label className="field wide">
                Description
                <textarea
                  name="description"
                  value={editor.description}
                  onChange={this.changeEditor}
                  rows={3}
                  required
                />
              </label>
              <label className="field">
                Amount (USD)
                <input
                  name="monetaryImpact"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editor.monetaryImpact}
                  onChange={this.changeEditor}
                  required
                />
              </label>
              <label className="field">
                Control ID
                <input
                  name="controlId"
                  value={editor.controlId}
                  onChange={this.changeEditor}
                  required
                />
              </label>
            </div>
          )}
          <button className="primary-button" disabled={busy}>
            Save changes
          </button>
        </form>
      </section>
    );
  }

  render(): React.ReactNode {
    const { entries, loading, apiStatus, error, message, busy, createForm, matches } = this.state;
    return (
      <main className="page">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">S</span> SmartAudit
          </div>
          <div className="connection" aria-live="polite">
            <span className={`connection-dot ${apiStatus.toLowerCase()}`} />
            API {apiStatus.toLowerCase()}
          </div>
        </header>

        <section className="intro">
          <p className="eyebrow">CONTINUOUS AUDIT</p>
          <h1>Audit stream</h1>
          <p>Save evidence now. Review risk insights when enrichment completes.</p>
        </section>

        <div className="workspace">
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice success" role="status">
              {message}
            </div>
          )}

          <section className="panel" aria-labelledby="new-entry-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">INPUT</p>
                <h2 id="new-entry-title">New evidence</h2>
              </div>
            </div>
            <form onSubmit={this.createEntry} className="entry-form">
              <div className="form-grid">
                <label className="field">
                  Evidence ID
                  <input
                    name="evidenceId"
                    value={createForm.evidenceId}
                    onChange={this.changeCreate}
                    required
                  />
                </label>
                <label className="field">
                  Entity
                  <input
                    name="entityName"
                    value={createForm.entityName}
                    onChange={this.changeCreate}
                    placeholder="Vendor or business unit"
                    required
                  />
                </label>
                <label className="field wide">
                  Description
                  <textarea
                    name="description"
                    value={createForm.description}
                    onChange={this.changeCreate}
                    placeholder="What happened?"
                    rows={2}
                    required
                  />
                </label>
                <label className="field">
                  Amount (USD)
                  <input
                    name="monetaryImpact"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.monetaryImpact}
                    onChange={this.changeCreate}
                    required
                  />
                </label>
                <label className="field">
                  Control ID
                  <input
                    name="controlId"
                    value={createForm.controlId}
                    onChange={this.changeCreate}
                    required
                  />
                </label>
                <label className="field">
                  Actor user ID
                  <input
                    name="actorUserId"
                    value={createForm.actorUserId}
                    onChange={this.changeCreate}
                    required
                  />
                </label>
              </div>
              <button className="primary-button" disabled={busy}>
                Save evidence
              </button>
            </form>
          </section>

          <section className="panel" aria-labelledby="entries-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">REVIEW</p>
                <h2 id="entries-title">Audit entries</h2>
              </div>
              <div className="heading-actions">
                <span className="count">{entries.length} records</span>
                <button className="text-button" type="button" onClick={this.loadEntries}>
                  Refresh
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Evidence</th>
                    <th>Entity</th>
                    <th>Amount</th>
                    <th>AI status</th>
                    <th>Risk</th>
                    <th>Summary / note</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry._id}>
                      <td>
                        <strong>{entry.evidenceId}</strong>
                        <small>{entry.description}</small>
                      </td>
                      <td>{entry.entityName}</td>
                      <td>{currency(entry.monetaryImpact)}</td>
                      <td>
                        <span className={`badge ${entry.aiMetadata.status.toLowerCase()}`}>
                          {entry.aiMetadata.status}
                        </span>
                      </td>
                      <td>
                        {entry.aiMetadata.riskScore === null
                          ? '—'
                          : `${entry.aiMetadata.riskLevel} · ${entry.aiMetadata.riskScore}`}
                      </td>
                      <td>
                        <span>
                          {entry.aiMetadata.aiSummary ??
                            (entry.aiMetadata.status === 'FAILED'
                              ? (entry.enrichmentJob.lastError ?? 'Enrichment failed')
                              : entry.aiMetadata.status === 'PROCESSING'
                                ? 'Enriching…'
                                : 'Awaiting enrichment')}
                        </span>
                        {entry.aiMetadata.auditorNotes && (
                          <small>Note: {entry.aiMetadata.auditorNotes}</small>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" onClick={() => this.openEditor(entry, 'note')}>
                            Note
                          </button>
                          <button type="button" onClick={() => this.openEditor(entry, 'core')}>
                            Edit
                          </button>
                          {entry.aiMetadata.status === 'FAILED' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => this.retryEnrichment(entry)}
                            >
                              Retry AI
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy || entry.aiMetadata.status !== 'COMPLETED'}
                            onClick={() => this.showSimilar(entry)}
                          >
                            Similar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && !entries.length && (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        No entries yet. Add evidence above or run <code>npm run seed</code>.
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        Loading entries...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {this.renderEditor()}
          {matches && (
            <section className="panel similar-panel" aria-label="Similar historical exceptions">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">VECTOR SEARCH</p>
                  <h2>Similar to {matches.evidenceId}</h2>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => this.setState({ matches: null })}
                >
                  Close
                </button>
              </div>
              <div className="matches">
                {matches.items.length ? (
                  matches.items.map((item) => (
                    <div className="match" key={item.id}>
                      <strong>
                        {item.evidenceId} · {item.entityName}
                      </strong>
                      <span>{item.description}</span>
                      <small>
                        {Math.round(item.similarityScore * 100)}% similarity · risk {item.riskScore}
                      </small>
                    </div>
                  ))
                ) : (
                  <p>No earlier exceptions found.</p>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    );
  }
}
