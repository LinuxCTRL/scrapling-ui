import { useState, useEffect } from 'react';
import { Play, Square, Sparkles, Network, Eye, Layers, ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react';
import { CanvasView } from './components/CanvasView';
import { ElementsTree } from './components/ElementsTree';
import { NetworkPanel } from './components/NetworkPanel';
import { WorkflowBuilder } from './components/WorkflowBuilder';
import { CodeRunner } from './components/CodeRunner';
import { SelectorInspector } from './components/SelectorInspector';
import { RoadmapPanel } from './components/RoadmapPanel';

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
  const [scrapedData, setScrapedData] = useState<any[]>([]);
  
  // Stealth & Anti-bot Settings
  const [solveCloudflare, setSolveCloudflare] = useState(true);
  const [blockAds, setBlockAds] = useState(true);
  const [disableResources, setDisableResources] = useState(false);
  
  // Tabs management
  const [topTab, setTopTab] = useState<'elements' | 'network' | 'roadmap'>('elements');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const handleStateUpdate = (newState: any) => {
    if (newState.screenshot) setScreenshot(newState.screenshot);
    if (newState.dom_tree) setDomTree(newState.dom_tree);
    if (newState.network_logs) setNetworkLogs(newState.network_logs);
    if (newState.history) setHistory(newState.history);
    if (newState.scraped_data) setScrapedData(newState.scraped_data);
  };

  const handleResetLocalState = () => {
    setSessionId(null);
    setScreenshot(null);
    setDomTree(null);
    setNetworkLogs([]);
    setHistory([]);
    setScrapedData([]);
    setCode('');
    setSelectedNode(null);
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
        body: JSON.stringify({ 
          url,
          solve_cloudflare: solveCloudflare,
          block_ads: blockAds,
          disable_resources: disableResources
        })
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
      if (data.scraped_data) setScrapedData(data.scraped_data);
      
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
      await fetch('/api/session/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
    } catch (e) {
      console.error('Error closing session', e);
    } finally {
      handleResetLocalState();
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
        let errMsg = `Failed to perform action: ${actionType}`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errMsg = `${errMsg} (${errData.detail})`;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      setScreenshot(data.screenshot);
      setDomTree(data.dom_tree);
      setNetworkLogs(data.network_logs);
      setHistory(data.history);
      if (data.scraped_data) setScrapedData(data.scraped_data);

      // Automatically sync code
      await updateGeneratedCode(sessionId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error executing browser action');
      if (e instanceof Error && e.message.includes('Session not found')) {
        handleResetLocalState();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add extraction step visually
  const handleAddExtraction = async (actionType: 'extract' | 'extract_list', selector: string, name: string, attribute: string) => {
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
          extract_name: name,
          extract_attribute: attribute
        })
      });
      if (!response.ok) {
        let errMsg = 'Failed to record extraction step';
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errMsg = `${errMsg} (${errData.detail})`;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      setHistory(data.history);
      if (data.scraped_data) setScrapedData(data.scraped_data);
      if (data.screenshot) setScreenshot(data.screenshot);

      // Automatically sync code
      await updateGeneratedCode(sessionId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error adding extraction step');
      if (e instanceof Error && e.message.includes('Session not found')) {
        handleResetLocalState();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Delete step and rollback/replay session state
  const handleDeleteStep = async (idx: number) => {
    const newHistory = history.filter((_, i) => i !== idx);
    if (!sessionId) {
      setHistory(newHistory);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/session/update-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          history: newHistory
        })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to update recipe history');
      }
      const data = await response.json();
      handleStateUpdate(data);
      await updateGeneratedCode(sessionId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error deleting step');
      if (e instanceof Error && e.message.includes('Session not found')) {
        handleResetLocalState();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reorder steps and rollback/replay session state
  const handleReorderSteps = async (draggedIdx: number, targetIdx: number) => {
    if (draggedIdx === targetIdx) return;
    const newHistory = [...history];
    const [draggedItem] = newHistory.splice(draggedIdx, 1);
    newHistory.splice(targetIdx, 0, draggedItem);
    
    if (!sessionId) {
      setHistory(newHistory);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/session/update-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          history: newHistory
        })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to update recipe history');
      }
      const data = await response.json();
      handleStateUpdate(data);
      await updateGeneratedCode(sessionId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error reordering steps');
      if (e instanceof Error && e.message.includes('Session not found')) {
        handleResetLocalState();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Export current recipe timeline as local JSON file
  const handleExportRecipe = () => {
    if (history.length === 0) {
      alert('No recipe steps to export yet!');
      return;
    }
    const recipeData = {
      url,
      solve_cloudflare: solveCloudflare,
      block_ads: blockAds,
      disable_resources: disableResources,
      history
    };
    const blob = new Blob([JSON.stringify(recipeData, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `scrapling_recipe_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  // Import recipe timeline from JSON file, start browser, and replay
  const handleImportRecipe = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.url || !Array.isArray(data.history)) {
          alert('Invalid recipe format. Must contain a starting URL and step history.');
          return;
        }

        // Apply settings states
        setUrl(data.url);
        if (data.solve_cloudflare !== undefined) setSolveCloudflare(data.solve_cloudflare);
        if (data.block_ads !== undefined) setBlockAds(data.block_ads);
        if (data.disable_resources !== undefined) setDisableResources(data.disable_resources);
        setHistory(data.history);

        setIsLoading(true);

        // Close active session if exists
        if (sessionId) {
          try {
            await fetch('/api/session/close', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: sessionId })
            });
          } catch (err) {
            console.error('Error closing session during import:', err);
          }
          setSessionId(null);
          setScreenshot(null);
          setDomTree(null);
          setNetworkLogs([]);
          setHistory([]);
          setScrapedData([]);
          setCode('');
        }

        // Launch fresh session
        const startRes = await fetch('/api/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: data.url,
            solve_cloudflare: data.solve_cloudflare ?? true,
            block_ads: data.block_ads ?? true,
            disable_resources: data.disable_resources ?? false
          })
        });

        if (!startRes.ok) {
          throw new Error('Failed to auto-launch browser session for recipe');
        }

        const startData = await startRes.json();
        setSessionId(startData.session_id);

        // Replay step actions
        const updateRes = await fetch('/api/session/update-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: startData.session_id,
            history: data.history
          })
        });

        if (!updateRes.ok) {
          const err = await updateRes.json();
          throw new Error(err.detail || 'Failed to replay recipe steps');
        }

        const finalState = await updateRes.json();
        handleStateUpdate(finalState);
        await updateGeneratedCode(startData.session_id);

        alert('Scrapling recipe imported and replayed successfully!');
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to import recipe');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11.5px', color: 'var(--text-secondary)', marginLeft: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }} title="Bypasses Cloudflare Turnstile & bot challenges.">
            <input 
              type="checkbox" 
              checked={solveCloudflare} 
              onChange={(e) => setSolveCloudflare(e.target.checked)}
              disabled={!!sessionId}
              style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            🛡️ Bypasses
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }} title="Blocks ad domains and tracking analytics.">
            <input 
              type="checkbox" 
              checked={blockAds} 
              onChange={(e) => setBlockAds(e.target.checked)}
              disabled={!!sessionId}
              style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            🚫 Block Ads
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }} title="Disables fonts, images, stylesheets, and media for super fast speeds.">
            <input 
              type="checkbox" 
              checked={disableResources} 
              onChange={(e) => setDisableResources(e.target.checked)}
              disabled={!!sessionId}
              style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            ⚡ Speed Mode
          </label>
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
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Visual Recipe</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleExportRecipe}
                    style={{ width: '26px', height: '26px', padding: 0 }}
                    title="Export Recipe (.json)"
                  >
                    <Download size={13} />
                  </button>
                  <label
                    className="btn btn-secondary"
                    style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    title="Import Recipe (.json)"
                  >
                    <Upload size={13} />
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={handleImportRecipe}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setLeftCollapsed(true)} 
                    style={{ width: '26px', height: '26px', padding: 0, border: 'none', background: 'transparent' }}
                    title="Collapse Recipe"
                  >
                    <ChevronLeft size={15} color="var(--text-muted)" />
                  </button>
                </div>
              </>
            )}
          </div>
          {!leftCollapsed && (
            <div className="column-content">
              <WorkflowBuilder 
                history={history} 
                onDeleteStep={handleDeleteStep}
                onReorderSteps={handleReorderSteps}
              />
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
              scrapedData={scrapedData}
              history={history}
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
              {/* Top Panel: DOM Tree & Network Logs & Roadmap */}
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
                    <button
                      className={`tab-btn ${topTab === 'roadmap' ? 'active' : ''}`}
                      onClick={() => setTopTab('roadmap')}
                    >
                      <Sparkles size={14} />
                      Roadmap
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
                  ) : topTab === 'network' ? (
                    <NetworkPanel logs={networkLogs} />
                  ) : (
                    <RoadmapPanel />
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
