import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Eye, EyeOff, X } from 'lucide-react';

const STORAGE_KEY = 'scrapling_deepseek_api_key';

interface AISettingsProps {
  onApiKeyChange: (key: string) => void;
}

export const AISettings: React.FC<AISettingsProps> = ({ onApiKeyChange }) => {
  const [showPanel, setShowPanel] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
      onApiKeyChange(stored);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    if (showPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPanel]);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem(STORAGE_KEY, apiKey.trim());
    onApiKeyChange(apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey('');
    onApiKeyChange('');
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary"
        onClick={() => setShowPanel(!showPanel)}
        style={{ height: '34px', padding: '0 10px', fontSize: '12px', gap: '4px' }}
        title="AI Settings"
      >
        <Sparkles size={14} color={apiKey ? 'var(--accent-secondary)' : 'var(--text-muted)'} />
        AI
      </button>

      {showPanel && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '360px',
            background: '#0a0d16',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            zIndex: 1000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              <Sparkles size={13} style={{ marginRight: '6px', color: 'var(--accent-secondary)' }} />
              DeepSeek AI Settings
            </span>
            <button
              onClick={() => setShowPanel(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Used to auto-heal broken selectors when code execution fails. Your key is stored locally in your browser.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>DeepSeek API Key:</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                style={{
                  flex: 1,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 8px' }}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!apiKey.trim()}
              style={{ flex: 1, height: '30px', fontSize: '12px', background: saved ? 'var(--accent-secondary)' : undefined }}
            >
              {saved ? 'Saved!' : 'Save Key'}
            </button>
            {apiKey && (
              <button
                className="btn btn-secondary"
                onClick={handleClear}
                style={{ height: '30px', fontSize: '12px' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
