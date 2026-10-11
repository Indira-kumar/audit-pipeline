import React from 'react';

export class AuditDashboard extends React.Component {
  state = { apiStatus: 'Connecting' };

  componentDidMount() {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable');
        return response.json();
      })
      .then(() => this.setState({ apiStatus: 'Connected' }))
      .catch(() => this.setState({ apiStatus: 'Offline' }));
  }

  render() {
    const { apiStatus } = this.state;

    return (
      <main className="page">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">S</span> SmartAudit</div>
          <div className="connection" aria-live="polite">
            <span className={`connection-dot ${apiStatus.toLowerCase()}`} />
            API {apiStatus.toLowerCase()}
          </div>
        </header>

        <section className="intro">
          <p className="eyebrow">CONTINUOUS AUDIT</p>
          <h1>Audit stream</h1>
          <p>Evidence arrives first. Risk insights follow in the background.</p>
        </section>

        <section className="panel" aria-labelledby="entries-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">EVIDENCE</p>
              <h2 id="entries-title">Audit entries</h2>
            </div>
            <span className="count">0 records</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Evidence ID</th>
                  <th>Entity</th>
                  <th>Amount</th>
                  <th>AI status</th>
                  <th>Risk</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="6" className="empty-state">
                    <strong>No evidence records yet</strong>
                    <span>The data layer and creation flow are the next increment.</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  }
}

