import { useState, useEffect } from 'react';
import { Play, Square, Sparkles, Network, Eye, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { CanvasView } from './components/CanvasView';
import { ElementsTree } from './components/ElementsTree';
import { NetworkPanel } from './components/NetworkPanel';
import { WorkflowBuilder } from './components/WorkflowBuilder';
import { CodeRunner } from './components/CodeRunner';
import { SelectorInspector } from './components/SelectorInspector';

interface DOMNode {
  tag: string;
  id: string;
  classes: string;
  text: string;
  selector: string;
  xpath: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children?: DOMNode[];
}

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

interface WorkflowStep {
  action: 'navigate' | 'click' | 'fill' | 'scroll' | 'extract';
  url?: string;
  selector?: string;
  value?: string;
  y?: number;
  name?: string;
  attribute?: string;
}

function App() {
  const [url, setUrl] = useState('https://news.ycombinator.com');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [domTree, setDomTree] = useState<DOMNode | null>(null);
  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
  const [history, setHistory] = useState<WorkflowStep[]>([]);
  const [code, setCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<DOMNode | null>(null);
  
  // Tabs management
  const [topTab, setTopTab] = useState<'elements' | 'network'>('elements');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const handleStateUpdate = (newState: any) => {
    if (newState.screenshot) setScreenshot(newState.screenshot);
    if (newState.dom_tree) setDomTree(newState.dom_tree);
    if (newState.network_logs) setNetworkLogs(newState.network_logs);
    if (newState.history) setHistory(newState.history);
  };

  // Launch browser session
  const handleLaunchSession = async () => {
    if (!url) return;
    setIsLoading(true);
    setSelectedNode(null);
    try {
      const response = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!response.ok) {
        throw new Error('Failed to start scraper session');
      }
      const data = await response.json();
      setSessionId(data.session_id);
      setScreenshot(data.screenshot);
      setDomTree(data.dom_tree);
      setNetworkLogs(data.network_logs);
      setHistory(data.history);
      
      // Load generated code
      await updateGeneratedCode(data.session_id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unknown error starting session');
    } finally {
      setIsLoading(false);
    }
  };

  // Close browser session
  const handleStopSession = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/session/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      if (response.ok) {
        setSessionId(null);
        setScreenshot(null);
        setDomTree(null);
        setNetworkLogs([]);
        setHistory([]);
        setCode('');
        setSelectedNode(null);
      }
    } catch (e) {
      console.error('Error closing session', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute interactive actions (Click, Fill, Scroll)
  const handleExecuteAction = async (actionType: string, selector: string, value?: string) => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/session/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action_type: actionType,
          selector,
          value
        })
      });
      if (!response.ok) {
        throw new Error(`Failed to perform action: ${actionType}`);
      }
      const data = await response.json();
      setScreenshot(data.screenshot);
      setDomTree(data.dom_tree);
      setNetworkLogs(data.network_logs);
      setHistory(data.history);

      // Automatically sync code
      await updateGeneratedCode(sessionId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error executing browser action');
    } finally {
      setIsLoading(false);
    }
  };

  // Add extraction step visually
  const handleAddExtraction = async (selector: string, name: string, attribute: string) => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/session/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action_type: 'extract',
          selector,
          extract_name: name,
          extract_attribute: attribute
        })
      });
      if (!response.ok) {
        throw new Error('Failed to record extraction step');
      }
      const data = await response.json();
      setHistory(data.history);

      // Automatically sync code
      await updateGeneratedCode(sessionId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error adding extraction step');
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll viewport down programmatically
  const handleScroll = async (scrollOffset: number) => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/session/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action_type: 'scroll',
          y: scrollOffset
        })
      });
      if (response.ok) {
        const data = await response.json();
        setScreenshot(data.screenshot);
        setDomTree(data.dom_tree);
        setNetworkLogs(data.network_logs);
        setHistory(data.history);
        
        await updateGeneratedCode(sessionId);
      }
    } catch (e) {
      console.error('Failed to scroll', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch updated code recipe
  const updateGeneratedCode = async (id: string) => {
    try {
      const response = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id })
      });
      if (response.ok) {
        const data = await response.json();
        setCode(data.code);
      }
    } catch (e) {
      console.error('Error generating scrapling code', e);
    }
  };

  // Auto cleanup session if page refreshed/unmounted
  useEffect(() => {
    const handleUnload = () => {
      if (sessionId) {
        navigator.sendBeacon('/api/session/close', JSON.stringify({ session_id: sessionId }));
      }
    };
    window.addEventListener('unload', handleUnload);
    return () => window.removeEventListener('unload', handleUnload);
  }, [sessionId]);

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="logo-section">
          <Sparkles className="logo-icon" size={24} />
          <span className="logo-text">Scrapling UI</span>
        </div>

        <div className="url-bar-container">
          <input
            type="text"
            className="url-input"
            placeholder="Enter URL to scrape (e.g. https://news.ycombinator.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={!!sessionId || isLoading}
            onKeyDown={(e) => e.key === 'Enter' && !sessionId && handleLaunchSession()}
          />
          {!sessionId ? (
            <button
              className="btn btn-primary"
              onClick={handleLaunchSession}
              disabled={isLoading || !url}
            >
              <Play size={16} />
              Launch
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={handleStopSession}
              disabled={isLoading}
              style={{ borderColor: 'var(--accent-error)', color: 'var(--accent-error)' }}
            >
              <Square size={16} />
              Stop Session
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => handleScroll(400)} 
            disabled={!sessionId || isLoading}
            style={{ height: '34px', fontSize: '12px' }}
          >
            Scroll Down
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => handleScroll(-400)} 
            disabled={!sessionId || isLoading}
            style={{ height: '34px', fontSize: '12px' }}
          >
            Scroll Up
          </button>
        </div>
      </header>

      {/* Main Workspace Panels */}
      <main 
        className="main-workspace"
        style={{
          gridTemplateColumns: `${leftCollapsed ? '48px' : '280px'} 1fr ${rightCollapsed ? '48px' : '450px'}`,
          transition: 'grid-template-columns 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Left Side: Recipe / Steps builder */}
        <section className="workspace-column" style={{ width: leftCollapsed ? '48px' : 'auto', overflow: 'hidden' }}>
          <div className="column-header" style={{ padding: leftCollapsed ? '12px 0' : '16px 20px', flexDirection: leftCollapsed ? 'column' : 'row', gap: '8px' }}>
            {leftCollapsed ? (
              <button 
                className="btn btn-secondary" 
                onClick={() => setLeftCollapsed(false)} 
                style={{ width: '32px', height: '32px', padding: 0 }}
                title="Expand Recipe"
              >
                <ChevronRight size={16} />
              </button>
            ) : (
              <>
                <span>Visual Scraper Recipe</span>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setLeftCollapsed(true)} 
                  style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'transparent' }}
                  title="Collapse Recipe"
                >
                  <ChevronLeft size={16} color="var(--text-muted)" />
                </button>
              </>
            )}
          </div>
          {!leftCollapsed && (
            <div className="column-content">
              <WorkflowBuilder history={history} />
            </div>
          )}
        </section>

        {/* Center: Live Frame / Canvas + Code Runner */}
        <div style={{ gridColumn: '2', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRight: '1px solid var(--border-light)' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <CanvasView
              screenshot={screenshot}
              domTree={domTree}
              isLoading={isLoading}
              onExecuteAction={handleExecuteAction}
              selectedNode={selectedNode}
              setSelectedNode={setSelectedNode}
              onAddExtraction={handleAddExtraction}
            />
          </div>
          <div style={{ height: '320px', minHeight: '320px' }}>
            <CodeRunner 
              code={code} 
              sessionId={sessionId}
              onStateUpdate={handleStateUpdate}
            />
          </div>
        </div>

        {/* Right Side: Split Developer Tools */}
        <section className="workspace-column right-sidebar" style={{ width: rightCollapsed ? '48px' : 'auto', overflow: 'hidden' }}>
          {rightCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', paddingTop: '12px', gap: '8px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setRightCollapsed(false)} 
                style={{ width: '32px', height: '32px', padding: 0 }}
                title="Expand DevTools"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          ) : (
            <>
              {/* Top Panel: DOM Tree & Network Logs */}
              <div className="right-sidebar-top" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div className="tabs-header" style={{ justifyContent: 'space-between', paddingRight: '8px', alignItems: 'center' }}>
                  <div style={{ display: 'flex' }}>
                    <button
                      className={`tab-btn ${topTab === 'elements' ? 'active' : ''}`}
                      onClick={() => setTopTab('elements')}
                    >
                      <Layers size={14} />
                      DOM Elements
                    </button>
                    <button
                      className={`tab-btn ${topTab === 'network' ? 'active' : ''}`}
                      onClick={() => setTopTab('network')}
                    >
                      <Network size={14} />
                      Network Traffic
                    </button>
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setRightCollapsed(true)} 
                    style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'transparent' }}
                    title="Collapse DevTools"
                  >
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </button>
                </div>
                <div className="column-content" style={{ flex: 1, overflow: 'auto' }}>
                  {topTab === 'elements' ? (
                    <ElementsTree
                      domTree={domTree}
                      selectedNode={selectedNode}
                      setSelectedNode={setSelectedNode}
                    />
                  ) : (
                    <NetworkPanel logs={networkLogs} />
                  )}
                </div>
              </div>

              {/* Bottom Panel: Selected Element Inspector */}
              <div className="right-sidebar-bottom" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', borderTop: '1px solid var(--border-light)' }}>
                <div className="column-header">
                  <span>Element Inspector</span>
                  <Eye size={16} color="var(--text-muted)" />
                </div>
                <div className="column-content" style={{ flex: 1, overflow: 'auto' }}>
                  <SelectorInspector selectedNode={selectedNode} />
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
