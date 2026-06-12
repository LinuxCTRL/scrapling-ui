import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface CodeGeneratorProps {
  code: string;
}

export const CodeGenerator: React.FC<CodeGeneratorProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Terminal size={14} color="var(--accent-secondary)" />
          Python Scrapling Recipe
        </span>
        <button
          className="btn btn-secondary"
          onClick={handleCopy}
          style={{ height: '30px', padding: '0 10px', fontSize: '12px', gap: '4px' }}
        >
          {copied ? (
            <>
              <Check size={12} color="var(--accent-secondary)" />
              Copied!
            </>
          ) : (
            <>
              <Copy size={12} />
              Copy Code
            </>
          )}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: '#070a13' }}>
        <pre style={{
          margin: 0,
          padding: '16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12.5px',
          lineHeight: '1.6',
          color: '#e2e8f0',
          whiteSpace: 'pre',
          textAlign: 'left'
        }}>
          {code.split('\n').map((line, idx) => {
            // Very simple syntax coloring
            let coloredLine: React.ReactNode = line;
            if (line.startsWith('#')) {
              coloredLine = <span style={{ color: '#64748b', fontStyle: 'italic' }}>{line}</span>;
            } else if (line.includes('import ') || line.includes('from ')) {
              coloredLine = (
                <span>
                  <span style={{ color: '#f43f5e' }}>{line.split(' ')[0]}</span>{' '}
                  <span style={{ color: '#38bdf8' }}>{line.split(' ').slice(1).join(' ')}</span>
                </span>
              );
            } else if (line.includes('def ')) {
              coloredLine = (
                <span>
                  <span style={{ color: '#f43f5e' }}>def</span>{' '}
                  <span style={{ color: '#a855f7' }}>{line.substring(4)}</span>
                </span>
              );
            } else if (line.includes('page.click') || line.includes('page.fill') || line.includes('StealthyFetcher.fetch')) {
              // Highlight calls
              const parts = line.split('page.');
              if (parts.length === 2) {
                coloredLine = (
                  <span>
                    {parts[0]}
                    <span style={{ color: '#a855f7' }}>page.</span>
                    <span style={{ color: '#06b6d4' }}>{parts[1]}</span>
                  </span>
                );
              }
            }
            return (
              <div key={idx} style={{ display: 'flex' }}>
                <span style={{ width: '28px', color: '#334155', userSelect: 'none', textAlign: 'right', paddingRight: '8px', fontSize: '11px' }}>
                  {idx + 1}
                </span>
                <span>{coloredLine}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};
