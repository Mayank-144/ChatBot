import { useState, useEffect } from 'react';
import { BACKEND_BASE } from '../../services/api';

export function LeadsPanel({ isOpen, onClose }) {
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('mayanktesting144@gmail.com');
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [emailStatus, setEmailStatus] = useState(null);
  const [error, setError] = useState(null);

  // Schedule states
  const [schedule, setSchedule] = useState('disabled');
  const [cronExpr, setCronExpr] = useState('0 9 * * 1');
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState(null);

  // Quick preset suggestions
  const quickSuggestions = [
    { ind: 'AI Software Companies', loc: 'Bangalore' },
    { ind: 'Multi-Specialty Hospitals', loc: 'Indore' },
    { ind: 'Fintech Startups', loc: 'Mumbai' },
    { ind: 'Cloud & IT Services', loc: 'Pune' },
  ];

  const applySuggestion = (ind, loc) => {
    setIndustry(ind);
    setLocation(loc);
  };

  // Fetch scheduler status on mount and when opened
  useEffect(() => {
    if (isOpen) {
      fetchScheduleStatus();
    }
  }, [isOpen]);

  const fetchScheduleStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/leads/status`);
      if (res.ok) {
        const data = await res.json();
        setScheduleInfo(data);
        if (data.schedule) setSchedule(data.schedule);
        if (data.cronExpr) setCronExpr(data.cronExpr);
      }
    } catch (err) {
      console.warn('Failed to load scheduler status:', err);
    }
  };

  const handleRunLeads = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setEmailStatus(null);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_BASE}/api/leads/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: industry.trim() || 'technology',
          location: location.trim() || 'India',
          sendEmail,
          recipientEmail: recipientEmail.trim() || 'mayanktesting144@gmail.com',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to retrieve business leads');
      }

      setLeads(data.leads || []);
      if (data.emailStatus) {
        setEmailStatus(data.emailStatus);
      }
    } catch (err) {
      setError(err.message || 'Error executing leads discovery');
    } finally {
      setLoading(false);
    }
  };

  const [testRunning, setTestRunning] = useState(false);

  const handleTestScheduleNow = async () => {
    setTestRunning(true);
    setScheduleSuccessMsg(null);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_BASE}/api/leads/schedule/test-now`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to trigger test schedule');
      }
      setScheduleSuccessMsg(`Delivered automated report to ${data.runResult?.recipient || recipientEmail || 'inbox'}!`);
      // Refresh status
      const statusRes = await fetch(`${BACKEND_BASE}/api/leads/status`);
      const statusData = await statusRes.json();
      if (statusData.success) {
        setScheduleInfo(statusData);
      }
    } catch (err) {
      setError(err.message || 'Error running test schedule');
    } finally {
      setTestRunning(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/leads/schedule/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setScheduleInfo(data);
        setScheduleSuccessMsg('Schedule removed successfully');
        setTimeout(() => setScheduleSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to remove schedule');
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setScheduleSaving(true);
    setScheduleSuccessMsg(null);

    try {
      const res = await fetch(`${BACKEND_BASE}/api/leads/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule,
          cronExpr: schedule === 'custom' ? cronExpr : undefined,
          recipientEmail: recipientEmail.trim() || undefined,
          industry: industry.trim() || undefined,
          location: location.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update schedule');
      }

      setScheduleInfo(data);
      setScheduleSuccessMsg(schedule === 'disabled' ? 'All schedules disabled' : 'Schedule added successfully!');
      setTimeout(() => setScheduleSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.message || 'Error updating schedule');
    } finally {
      setScheduleSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="leads-modal-overlay" onClick={onClose}>
      <div className="leads-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="leads-modal-header">
          <div className="leads-header-title">
            <span className="leads-header-icon">🎯</span>
            <div>
              <h3>Business Intelligence & Leads Agent</h3>
              <p>Autonomous company discovery, verified emails & scheduled reports</p>
            </div>
          </div>
          <button className="leads-close-btn" onClick={onClose} title="Close Panel">
            ✕
          </button>
        </div>

        <div className="leads-modal-body">
          {/* Section 1: Manual Run */}
          <div className="leads-section">
            <div className="leads-section-header">
              <h4>🚀 Real-Time Dynamic Discovery</h4>
              <span className="leads-section-subtitle">Extract verified companies & dispatch HTML email</span>
            </div>

            {/* Quick Suggestions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', alignSelf: 'center' }}>Quick Try:</span>
              {quickSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applySuggestion(item.ind, item.loc)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '16px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {item.ind} in {item.loc}
                </button>
              ))}
            </div>

            <form onSubmit={handleRunLeads} className="leads-form">
              <div className="leads-form-row">
                <div className="leads-input-group">
                  <label>Target Industry</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. AI software, hospitals, fintech, consulting"
                    required
                  />
                </div>

                <div className="leads-input-group">
                  <label>City / Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Mumbai, Bangalore, Indore, Delhi"
                    required
                  />
                </div>
              </div>

              <div className="leads-checkbox-row">
                <label className="leads-checkbox-label">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                  />
                  <span>Dispatch HTML Report via Email</span>
                </label>

                {sendEmail && (
                  <input
                    type="email"
                    className="leads-recipient-input"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="Recipient email (e.g. mayanktesting144@gmail.com)"
                    required
                  />
                )}
              </div>

              <div className="leads-form-actions">
                <button type="submit" className="leads-primary-btn" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="leads-spinner"></span>
                      <span>Researching Real Companies & Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>Find 5 Real Leads & Send Report</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Error Message */}
            {error && <div className="leads-error-badge">⚠️ {error}</div>}

            {/* Email Dispatch Status */}
            {emailStatus && (
              <div className={`leads-email-badge ${emailStatus.simulated ? 'simulated' : 'success'}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📧</span>
                  <span>{emailStatus.message}</span>
                </div>
                {emailStatus.previewUrl && (
                  <div>
                    <a
                      href={emailStatus.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        background: '#2563eb',
                        color: '#ffffff',
                        textDecoration: 'none',
                        fontWeight: '600',
                        fontSize: '13px',
                      }}
                    >
                      📬 Open Live Sent Email Preview ↗
                    </a>
                  </div>
                )}
                {emailStatus.isTestMailbox && (
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    💡 <strong>Direct Inbox Note:</strong> This report was delivered via authenticated SMTP. To route directly into your personal Gmail inbox app, set your 16-character Google App Password in <code>backend/.env</code> as <code>EMAIL_PASS</code>.
                  </div>
                )}
              </div>
            )}

            {/* Leads Results Cards */}
            {leads && leads.length > 0 && (
              <div className="leads-results-container">
                <h5 className="leads-results-title">
                  Top 5 Verified Leads for <span>{industry}</span> in <span>{location}</span>:
                </h5>
                <div className="leads-cards-grid">
                  {leads.map((lead, idx) => (
                    <div key={idx} className="lead-card">
                      <div className="lead-card-header">
                        <span className="lead-card-index">#{idx + 1}</span>
                        <h6 className="lead-company-name">{lead.companyName}</h6>
                      </div>

                      <div className="lead-card-details">
                        <div className="lead-field">
                          <span className="lead-field-label">🌐 Website:</span>
                          <a href={lead.website} target="_blank" rel="noreferrer" className="lead-link">
                            {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        </div>

                        <div className="lead-field">
                          <span className="lead-field-label">✉️ Email:</span>
                          <a href={`mailto:${lead.email}`} className="lead-email-link">
                            {lead.email}
                          </a>
                        </div>

                        <div className="lead-field">
                          <span className="lead-field-label">📞 Phone:</span>
                          <span className="lead-phone">{lead.phone}</span>
                        </div>

                        <p className="lead-desc">{lead.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Automated Cron Scheduler */}
          <div className="leads-section scheduler-section">
            <div className="leads-section-header">
              <h4>⏱️ Automated Schedule & Delivery</h4>
              <span className="leads-section-subtitle">Configure recurring background lead extraction</span>
            </div>

            <form onSubmit={handleSaveSchedule} className="leads-schedule-form">
              <div className="leads-form-row">
                <div className="leads-input-group">
                  <label>Automation Schedule</label>
                  <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                    <option value="morning">Morning — Daily at 8:00 AM</option>
                    <option value="evening">Evening — Daily at 6:00 PM</option>
                    <option value="night">Night — Daily at 11:00 PM</option>
                    <option value="midnight">Midnight — Daily at 12:00 AM</option>
                    <option value="custom">Custom Cron Expression</option>
                    <option value="disabled">Disabled (No automatic runs)</option>
                  </select>
                </div>

                {schedule === 'custom' && (
                  <div className="leads-input-group">
                    <label>Time or Cron Expression</label>
                    <input
                      type="text"
                      value={cronExpr}
                      onChange={(e) => setCronExpr(e.target.value)}
                      placeholder="e.g. 12:51 PM, 1:00 PM (or * * * * *)"
                      required
                    />
                    <small className="leads-helper-text">
                      Supports multiple times comma-separated (e.g. <code>12:51 PM, 1:00 PM</code>) OR standard cron (<code>* * * * *</code>)!
                    </small>
                  </div>
                )}
              </div>

              <div className="leads-schedule-actions">
                <button type="submit" className="leads-secondary-btn" disabled={scheduleSaving}>
                  {scheduleSaving ? 'Saving...' : schedule === 'disabled' ? '⏹️ Disable All' : '➕ Add Schedule'}
                </button>

                <button
                  type="button"
                  className="leads-test-schedule-btn"
                  onClick={handleTestScheduleNow}
                  disabled={testRunning}
                  title="Immediately test execution and email delivery without waiting"
                >
                  {testRunning ? '⚡ Sending Test Email...' : '⚡ Test Run Now'}
                </button>

                {scheduleSuccessMsg && (
                  <span className="leads-save-success">✓ {scheduleSuccessMsg}</span>
                )}
              </div>

              {/* Active Recurring Schedules List */}
              {scheduleInfo?.schedules && scheduleInfo.schedules.length > 0 && (
                <div className="active-schedules-list">
                  <div className="active-schedules-header">
                    <h5>Active Recurring Schedules ({scheduleInfo.schedules.length})</h5>
                  </div>
                  {scheduleInfo.schedules.map((s) => (
                    <div key={s.id} className="active-schedule-item">
                      <div className="sched-item-info">
                        <span className="sched-item-time">⏰ {s.nextRun}</span>
                        <span className="sched-item-meta">
                          {s.industry} • {s.location} • {s.recipientEmail}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="sched-item-del-btn"
                        onClick={() => handleDeleteSchedule(s.id)}
                        title="Delete this schedule"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Scheduler Status Summary */}
              {scheduleInfo && (
                <div className="leads-status-box">
                  <div className="leads-status-row">
                    <span>Overall Status:</span>
                    <strong className={scheduleInfo.active ? 'status-active' : 'status-disabled'}>
                      {scheduleInfo.active ? `● ${scheduleInfo.activeCount || 1} Schedule(s) Active` : '○ Inactive'}
                    </strong>
                  </div>
                  <div className="leads-status-row">
                    <span>Last Run:</span>
                    <span>
                      {scheduleInfo.lastRunTime
                        ? new Date(scheduleInfo.lastRunTime).toLocaleString()
                        : 'Never (awaiting trigger)'}
                    </span>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeadsPanel;
