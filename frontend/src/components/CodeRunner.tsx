import React, { useState, useEffect } from 'react';
import { Play, Copy, Check, Terminal, Loader } from 'lucide-react';

interface CodeRunnerProps {
  code: string;
  sessionId: string | null;
  onStateUpdate: (state: any) => void;
  scrapedData?: any[];
}

export const CodeRunner: React.FC<CodeRunnerProps> = ({ code, sessionId, onStateUpdate, scrapedData = [] }) => {
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string>('Console ready. Click "Run Recipe" to execute the Python script.');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [consoleTab, setConsoleTab] = useState<'console' | 'data'>('console');

  // Auto-switch to data tab when new list data is scraped
  useEffect(() => {
    if (scrapedData.length > 0) {
      setConsoleTab('data');
    }
  }, [scrapedData.length]);
  
  // Local state to hold the editable code
  const [editableCode, setEditableCode] = useState<string>('');

  // Sync with code prop when it changes (e.g. user records new visual steps)
  useEffect(() => {
    setEditableCode(code);
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(editableCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    if (!editableCode || isRunning) return;
    setIsRunning(true);
    setConsoleOutput('🚀 Executing Python Scrapling script on the active page...\n');
    setExitCode(null);
    
    try {
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, code: editableCode })
      });
      
      if (!response.ok) {
        throw new Error('Server returned error executing code');
      }
      
      const data = await response.json();
      
      // Update the parent session state (canvas, DOM, network, etc.)
      if (data.state) {
        onStateUpdate(data.state);
      }
      
      let out = '';
      if (data.stdout) {
        out += data.stdout;
      }
      if (data.stderr) {
        out += (out ? '\n' : '') + '⚠️ ERROR/WARNING LOGS:\n' + data.stderr;
      }
      if (!data.stdout && !data.stderr) {
        out = 'Script executed but returned no output (stdout/stderr empty).';
      }
      
      setConsoleOutput(out);
      setExitCode(data.exit_code);
    } catch (e) {
      setConsoleOutput(`❌ Execution failed:\n${e instanceof Error ? e.message : 'Unknown execution error'}`);
      setExitCode(-1);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-panel)',
      borderTop: '1px solid var(--border-light)',
      overflow: 'hidden'
    }}>
      {/* Code Runner Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderBottom: '1px solid var(--border-light)',
        height: '44px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} color="var(--accent-secondary)" />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Python Recipe & Runner (Editable)</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleCopy}
            style={{ height: '28px', padding: '0 10px', fontSize: '11px', gap: '4px' }}
            disabled={!editableCode}
          >
            {copied ? (
              <>
                <Check size={11} color="var(--accent-secondary)" />
                Copied
              </>
            ) : (
              <>
                <Copy size={11} />
                Copy
              </>
            )}
          </button>
          
          <button
            className="btn btn-primary"
            onClick={handleRun}
            style={{ 
              height: '28px', 
              padding: '0 12px', 
              fontSize: '11px', 
              gap: '4px',
              background: 'linear-gradient(135deg, var(--accent-secondary), #0891b2)',
              boxShadow: '0 2px 6px rgba(6, 182, 212, 0.2)'
            }}
            disabled={!editableCode || isRunning}
          >
            {isRunning ? (
              <>
                <Loader size={12} className="loader" />
                Running...
              </>
            ) : (
              <>
                <Play size={11} fill="white" />
                Run Recipe
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid Layout Split: Textarea Editor on Left, Terminal on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden' }}>
        {/* Left Side: Textarea Editor */}
        <div style={{
          display: 'flex',
          height: '100%',
          background: '#060910',
          overflow: 'hidden'
        }}>
          <textarea
            value={editableCode}
            onChange={(e) => setEditableCode(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              background: 'transparent',
              color: '#e2e8f0',
              fontFamily: 'var(--font-mono)',
              fontSize: '12.5px',
              lineHeight: '1.5',
              padding: '16px 16px 60px 16px',
              border: 'none',
              outline: 'none',
              resize: 'none',
              height: '100%',
              width: '100%',
              overflowY: 'auto'
            }}
            placeholder="Write or edit Python code here..."
          />
        </div>

        {/* Right Side: Terminal / Scraped Data Tabs */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#020408',
          overflow: 'hidden'
        }}>
          {/* Console/Scraped Data Subheader */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.01)',
            borderBottom: '1px solid var(--border-light)',
            height: '28px',
            padding: '0 8px'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setConsoleTab('console')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: consoleTab === 'console' ? 'var(--accent-secondary)' : 'var(--text-muted)',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderBottom: consoleTab === 'console' ? '2px solid var(--accent-secondary)' : 'none'
                }}
              >
                Execution Console
              </button>
              <button
                onClick={() => setConsoleTab('data')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: consoleTab === 'data' ? 'var(--accent-secondary)' : 'var(--text-muted)',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderBottom: consoleTab === 'data' ? '2px solid var(--accent-secondary)' : 'none'
                }}
              >
                Scraped Data ({scrapedData.length})
              </button>
            </div>
            {consoleTab === 'console' && exitCode !== null && (
              <span style={{ 
                fontSize: '10px', 
                color: exitCode === 0 ? '#10b981' : '#ef4444',
                fontWeight: 600 
              }}>
                Process exited with code {exitCode}
              </span>
            )}
          </div>
          
          {consoleTab === 'console' ? (
            /* Console Text Area */
            <div style={{
              flex: 1,
              padding: '12px 12px 60px 12px',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: '#10b981',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              textAlign: 'left'
            }}>
              {consoleOutput}
            </div>
          ) : (
            /* Scraped Data Preview Grid */
            <div style={{
              flex: 1,
              padding: '12px 12px 60px 12px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {scrapedData.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  textAlign: 'center',
                  padding: '24px'
                }}>
                  <p style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>No list data scraped yet.</p>
                  <p style={{ fontSize: '11px' }}>Use "Extract List Column" in the canvas context menu to extract sibling components into structured tables.</p>
                </div>
              ) : (
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '11.5px',
                  color: 'var(--text-primary)',
                  textAlign: 'left'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {Object.keys(scrapedData[0]).map((key) => (
                        <th key={key} style={{ padding: '8px', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scrapedData.map((row, idx) => (
                      <tr key={idx} style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
                      }}>
                        {Object.keys(scrapedData[0]).map((key) => (
                          <td key={key} style={{ 
                            padding: '8px', 
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                            wordBreak: 'break-all',
                            maxWidth: '200px'
                          }}>
                            {row[key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
