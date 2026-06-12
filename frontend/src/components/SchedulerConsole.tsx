import React, { useState, useEffect } from 'react';
import { Calendar, Play, Trash2, Plus, Clock, Globe, ToggleLeft, ToggleRight, Loader, Check, AlertCircle } from 'lucide-react';

interface SchedulerConsoleProps {
  sessionId: string | null;
  url: string;
  history: any[];
}

interface ScheduledJob {
  id: string;
  name: string;
  url: string;
  history: any[];
  cron_expression: string;
  webhook_url: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  created_at: string;
}

export const SchedulerConsole: React.FC<SchedulerConsoleProps> = ({ sessionId, url, history }) => {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [jobName, setJobName] = useState('');
  const [cronExpression, setCronExpression] = useState('*/5 * * * *');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/scheduler/jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (e) {
      console.error('Failed to fetch scheduled jobs', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobName || !cronExpression) {
      alert('Job Name and Cron Expression are required.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/scheduler/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingJob?.id || undefined,
          name: jobName,
          url: editingJob?.url || url,
          history: editingJob?.history || history,
          cron_expression: cronExpression,
          webhook_url: webhookUrl,
          enabled: editingJob ? editingJob.enabled : true
        })
      });

      if (response.ok) {
        setShowAddForm(false);
        setEditingJob(null);
        setJobName('');
        setWebhookUrl('');
        fetchJobs();
      } else {
        const err = await response.json();
        alert('Failed to save job: ' + (err.detail || 'Unknown error'));
      }
    } catch (e) {
      console.error('Error saving job', e);
      alert('Error saving job');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleJob = async (job: ScheduledJob) => {
    try {
      const response = await fetch(`/api/scheduler/jobs/${job.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !job.enabled })
      });
      if (response.ok) {
        fetchJobs();
      }
    } catch (e) {
      console.error('Failed to toggle job', e);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled job?')) return;
    try {
      const response = await fetch(`/api/scheduler/jobs/${jobId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchJobs();
      }
    } catch (e) {
      console.error('Failed to delete job', e);
    }
  };

  const handleTriggerRun = async (jobId: string) => {
    setRunningJobId(jobId);
    try {
      const response = await fetch(`/api/scheduler/jobs/${jobId}/run`, {
        method: 'POST'
      });
      if (response.ok) {
        alert('Headless job run triggered successfully in background!');
        setTimeout(fetchJobs, 2000); // refresh to see last run
      }
    } catch (e) {
      console.error('Failed to trigger job run', e);
    } finally {
      setRunningJobId(null);
    }
  };

  const startScheduleNew = () => {
    if (history.length === 0) {
      alert('Please build a scraping recipe first before scheduling!');
      return;
    }
    setEditingJob(null);
    setJobName(`Crawl HN List`);
    setCronExpression('0 * * * *'); // Hourly default
    setWebhookUrl('https://httpbin.org/post');
    setShowAddForm(true);
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Never';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch (_) {
      return 'Never';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-panel)' }}>
      {/* Header bar */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#0a0d16'
      }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <Calendar size={14} color="var(--accent-primary)" />
          Scheduled Crawlers & Webhooks
        </span>
        {!showAddForm && (
          <button
            className="btn btn-primary"
            onClick={startScheduleNew}
            disabled={!sessionId || history.length === 0}
            style={{ padding: '0 8px', height: '26px', fontSize: '11px', gap: '4px' }}
          >
            <Plus size={12} />
            Schedule Recipe
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {showAddForm ? (
          <form onSubmit={handleSaveJob} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#0a0d16', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
            <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--accent-primary)' }}>
              {editingJob ? 'Edit Scheduled Job' : 'Schedule Current Recipe'}
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Job Name:</label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. HN Frontpage Scraper"
                required
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Cron Interval Expression:</span>
                <a href="https://crontab.guru" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-secondary)', textDecoration: 'none' }}>crontab.guru</a>
              </label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="e.g. */5 * * * * (Every 5 minutes)"
                required
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Webhook URL Exporter (POST Scraped Data):</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://yourserver.com/webhook"
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ flex: 1, height: '32px', fontSize: '12px' }}>
                {isSaving ? 'Saving...' : 'Save Job'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddForm(false)}
                style={{ flex: 1, height: '32px', fontSize: '12px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px', gap: '8px', color: 'var(--text-muted)' }}>
            <Loader size={16} className="loader" />
            <span style={{ fontSize: '12px' }}>Loading scheduler configurations...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-md)', padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Clock size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No Background Jobs</div>
            <div style={{ fontSize: '11.5px', maxWidth: '240px', margin: '0 auto' }}>
              Launch a browser session, record list extraction steps, and click "Schedule Recipe" to run it periodically in the background!
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {jobs.map((job) => (
              <div
                key={job.id}
                style={{
                  background: '#0a0d16',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{job.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={job.url}>
                      {job.url}
                    </span>
                  </div>
                  
                  {/* Enable/Disable switch toggle */}
                  <button
                    onClick={() => handleToggleJob(job)}
                    style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: job.enabled ? 'var(--accent-secondary)' : 'var(--text-muted)' }}
                    title={job.enabled ? 'Disable Schedule' : 'Enable Schedule'}
                  >
                    {job.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '8px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Interval (Cron)</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{job.cron_expression}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Steps Count</span>
                    <span style={{ color: 'var(--text-primary)' }}>{job.history.length} steps</span>
                  </div>
                </div>

                {job.webhook_url && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', background: 'rgba(236,72,153,0.06)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(236,72,153,0.1)' }}>
                    <Globe size={11} color="var(--accent-secondary)" />
                    <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                      {job.webhook_url}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10.5px', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '6px 8px', borderRadius: '4px' }}>
                  <div>Last Run: <span style={{ color: 'var(--text-primary)' }}>{formatDate(job.last_run)}</span></div>
                  <div>Next Run: <span style={{ color: job.enabled ? 'var(--accent-primary)' : 'var(--text-muted)' }}>{job.enabled ? formatDate(job.next_run) : 'Disabled'}</span></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '2px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleTriggerRun(job.id)}
                    disabled={runningJobId === job.id}
                    style={{ height: '26px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
                    title="Run Crawler Immediately"
                  >
                    {runningJobId === job.id ? <Loader size={12} className="loader" /> : <Play size={12} color="var(--accent-secondary)" />}
                    Run Now
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleDeleteJob(job.id)}
                    style={{ height: '26px', padding: '0 8px', fontSize: '11px', gap: '4px', borderColor: 'var(--accent-error)' }}
                    title="Delete Job"
                  >
                    <Trash2 size={12} color="var(--accent-error)" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
