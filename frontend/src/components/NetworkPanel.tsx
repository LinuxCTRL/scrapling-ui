import React, { useState } from 'react';
import { Search, Filter } from 'lucide-react';

interface NetworkLog {
  id: string;
  url: string;
  method: string;
  resource_type: string;
  request_headers: Record<string, string>;
  post_data: string | null;
  status: number | null;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  size: number;
}

interface NetworkPanelProps {
  logs: NetworkLog[];
}

export const NetworkPanel: React.FC<NetworkPanelProps> = ({ logs }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<NetworkLog | null>(null);
  const [detailTab, setDetailTab] = useState<'headers' | 'response'>('headers');

  // Filter logs
  const filteredLogs = logs.filter(log => {
    // Search filter
    const matchesSearch = log.url.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Type filter
    if (filterType === 'all') return true;
    if (filterType === 'xhr') return log.resource_type === 'xhr' || log.resource_type === 'fetch';
    if (filterType === 'document') return log.resource_type === 'document';
    if (filterType === 'js') return log.resource_type === 'script';
    if (filterType === 'css') return log.resource_type === 'stylesheet';
    if (filterType === 'media') return log.resource_type === 'image' || log.resource_type === 'media';
    return true;
  });

  const getStatusColor = (status: number | null) => {
    if (!status) return 'var(--text-muted)';
    if (status >= 200 && status < 300) return '#10b981'; // Green
    if (status >= 300 && status < 400) return '#3b82f6'; // Blue
    if (status >= 400) return '#ef4444'; // Red
    return 'var(--text-primary)';
  };

  const getFileName = (url: string) => {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const parts = pathname.split('/');
      const last = parts[parts.length - 1];
      return last || parsed.hostname;
    } catch (e) {
      return url;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Filters & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Filter URLs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px 8px 32px',
              color: '#fff',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>

        {/* Network tabs */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
          {['all', 'xhr', 'document', 'js', 'css', 'media'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: filterType === type ? 'var(--bg-panel-hover)' : 'transparent',
                color: filterType === type ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {type === 'xhr' ? 'Fetch/XHR' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Main split display */}
      <div style={{ display: 'grid', gridTemplateRows: selectedLog ? '1fr 220px' : '1fr', flex: 1, overflow: 'hidden', gap: '8px' }}>
        {/* Table View */}
        <div style={{ overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.1)' }}>
          {filteredLogs.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Name</th>
                  <th style={{ padding: '8px 10px' }}>Method</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px' }}>Type</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Size</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      background: selectedLog?.id === log.id ? 'var(--bg-panel-hover)' : 'transparent',
                      transition: 'background 0.1s'
                    }}
                    className="net-row"
                  >
                    <td style={{ padding: '8px 10px', color: 'var(--text-primary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.url}>
                      {getFileName(log.url)}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{log.method}</td>
                    <td style={{ padding: '8px 10px', color: getStatusColor(log.status), fontWeight: 600 }}>
                      {log.status || 'Pending'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{log.resource_type}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatSize(log.size)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px', color: 'var(--text-muted)' }}>
              <Filter size={24} style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '13px' }}>No network logs match filter.</div>
            </div>
          )}
        </div>

        {/* Detailed inspector pane */}
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)', overflow: 'hidden' }}>
            {/* Header of detail panel */}
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)', padding: '0 8px' }}>
              <div style={{ display: 'flex' }}>
                <button
                  onClick={() => setDetailTab('headers')}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    background: 'none',
                    color: detailTab === 'headers' ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderBottom: detailTab === 'headers' ? '2px solid var(--accent-secondary)' : '2px solid transparent'
                  }}
                >
                  Headers
                </button>
                <button
                  onClick={() => setDetailTab('response')}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    background: 'none',
                    color: detailTab === 'response' ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderBottom: detailTab === 'response' ? '2px solid var(--accent-secondary)' : '2px solid transparent'
                  }}
                >
                  Response
                </button>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
              >
                Close
              </button>
            </div>

            {/* Tab contents */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              {detailTab === 'headers' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <h4 style={{ color: 'var(--accent-secondary)', marginBottom: '4px' }}>General</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Request URL:</span> {selectedLog.url}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Request Method:</span> {selectedLog.method}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Status Code:</span> {selectedLog.status}</div>
                    </div>
                  </div>

                  {selectedLog.post_data && (
                    <div>
                      <h4 style={{ color: 'var(--accent-primary)', marginBottom: '4px' }}>Request Payload</h4>
                      <pre style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {selectedLog.post_data}
                      </pre>
                    </div>
                  )}

                  {selectedLog.response_headers && (
                    <div>
                      <h4 style={{ color: 'var(--accent-secondary)', marginBottom: '4px' }}>Response Headers</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px' }}>
                        {Object.entries(selectedLog.response_headers).map(([key, val]) => (
                          <div key={key}>
                            <span style={{ color: 'var(--text-muted)' }}>{key}:</span> {val}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Request Headers</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px' }}>
                      {Object.entries(selectedLog.request_headers).map(([key, val]) => (
                        <div key={key}>
                          <span style={{ color: 'var(--text-muted)' }}>{key}:</span> {val}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {selectedLog.response_body ? (
                    <pre style={{
                      margin: 0,
                      background: 'rgba(0,0,0,0.2)',
                      padding: '8px',
                      borderRadius: '4px',
                      height: '100%',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      {selectedLog.response_body}
                    </pre>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      No response body available for this resource.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
