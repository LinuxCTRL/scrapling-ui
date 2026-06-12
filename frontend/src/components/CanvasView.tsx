import React, { useRef, useState, useEffect } from 'react';
import { MousePointerClick, Type, Sparkles, AlertCircle, ArrowLeft, ArrowRight, RotateCw, ChevronUp, ChevronDown } from 'lucide-react';

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

interface CanvasViewProps {
  screenshot: string | null;
  domTree: DOMNode | null;
  isLoading: boolean;
  onExecuteAction: (actionType: string, selector: string, value?: string) => Promise<void>;
  selectedNode: DOMNode | null;
  setSelectedNode: (node: DOMNode | null) => void;
  onAddExtraction: (actionType: 'extract' | 'extract_list', selector: string, name: string, attribute: string) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  screenshot,
  domTree,
  isLoading,
  onExecuteAction,
  selectedNode,
  setSelectedNode,
  onAddExtraction
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [flatNodes, setFlatNodes] = useState<DOMNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<DOMNode | null>(null);
  const [scale, setScale] = useState({ x: 1, y: 1 });
  const [hoverStyle, setHoverStyle] = useState<React.CSSProperties>({ display: 'none' });
  const [selectedStyle, setSelectedStyle] = useState<React.CSSProperties>({ display: 'none' });
  
  // Interactive action menu popup state
  const [actionMenu, setActionMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: DOMNode;
  } | null>(null);
  
  const [inputValue, setInputValue] = useState('');
  const [showInputForm, setShowInputForm] = useState(false);
  
  const [extractName, setExtractName] = useState('');
  const [extractAttr, setExtractAttr] = useState('text');
  const [showExtractForm, setShowExtractForm] = useState(false);
  const [showExtractListForm, setShowExtractListForm] = useState(false);
  const [listSelector, setListSelector] = useState('');

  // Flatten DOM Tree when it changes
  useEffect(() => {
    if (!domTree) {
      setFlatNodes([]);
      setHoveredNode(null);
      return;
    }

    const nodes: DOMNode[] = [];
    const walk = (node: DOMNode) => {
      if (node.rect && node.rect.width > 0 && node.rect.height > 0) {
        nodes.push(node);
      }
      if (node.children) {
        node.children.forEach(walk);
      }
    };
    walk(domTree);
    setFlatNodes(nodes);
  }, [domTree]);

  // Handle resizing or screenshot load to calculate scaling factors
  const updateScaling = () => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    // Use natural image dimensions (support dynamic/full-page screenshots)
    const originalWidth = imgRef.current.naturalWidth || 1280;
    const originalHeight = imgRef.current.naturalHeight || 800;
    
    setScale({
      x: originalWidth / rect.width,
      y: originalHeight / rect.height
    });
  };

  useEffect(() => {
    window.addEventListener('resize', updateScaling);
    return () => window.removeEventListener('resize', updateScaling);
  }, []);

  // Update box highlights relative to current image container scale
  useEffect(() => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const originalWidth = imgRef.current.naturalWidth || 1280;
    const originalHeight = imgRef.current.naturalHeight || 800;
    
    const scX = rect.width / originalWidth;
    const scY = rect.height / originalHeight;

    if (hoveredNode) {
      setHoverStyle({
        display: 'block',
        left: `${hoveredNode.rect.x * scX}px`,
        top: `${hoveredNode.rect.y * scY}px`,
        width: `${hoveredNode.rect.width * scX}px`,
        height: `${hoveredNode.rect.height * scY}px`,
      });
    } else {
      setHoverStyle({ display: 'none' });
    }

    if (selectedNode) {
      setSelectedStyle({
        display: 'block',
        left: `${selectedNode.rect.x * scX}px`,
        top: `${selectedNode.rect.y * scY}px`,
        width: `${selectedNode.rect.width * scX}px`,
        height: `${selectedNode.rect.height * scY}px`,
      });
    } else {
      setSelectedStyle({ display: 'none' });
    }
  }, [hoveredNode, selectedNode, flatNodes, screenshot]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current || flatNodes.length === 0 || isLoading) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * scale.x;
    const y = (e.clientY - rect.top) * scale.y;

    // Find the smallest (leaf-most) bounding box containing x, y
    let bestMatch: DOMNode | null = null;
    let minArea = Infinity;

    for (const node of flatNodes) {
      const { x: nx, y: ny, width: nw, height: nh } = node.rect;
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + nh) {
        const area = nw * nh;
        if (area < minArea) {
          minArea = area;
          bestMatch = node;
        }
      }
    }

    if (bestMatch !== hoveredNode) {
      setHoveredNode(bestMatch);
    }
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
  };

  const handleCanvasClick = () => {
    if (!imgRef.current || isLoading) return;
    
    if (hoveredNode) {
      setSelectedNode(hoveredNode);
      
      // Calculate coordinates relative to screen viewport for the Action Menu popup
      const imgContainer = imgRef.current.parentElement;
      if (imgContainer) {
        const rect = imgRef.current.getBoundingClientRect();
        const originalWidth = imgRef.current.naturalWidth || 1280;
        const originalHeight = imgRef.current.naturalHeight || 800;
        const scX = rect.width / originalWidth;
        const scY = rect.height / originalHeight;
        
        setActionMenu({
          visible: true,
          x: hoveredNode.rect.x * scX,
          y: (hoveredNode.rect.y + hoveredNode.rect.height) * scY + 10,
          node: hoveredNode
        });
        
        // Reset action fields
        setShowInputForm(false);
        setShowExtractForm(false);
        setInputValue('');
        setExtractName(hoveredNode.tag + '_' + Math.floor(Math.random() * 100));
        setExtractAttr('text');
      }
    } else {
      setActionMenu(null);
    }
  };

  const executeClick = async () => {
    if (!actionMenu) return;
    const selector = actionMenu.node.selector;
    setActionMenu(null);
    await onExecuteAction('click', selector);
  };

  const executeFill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionMenu || !inputValue) return;
    const selector = actionMenu.node.selector;
    setActionMenu(null);
    await onExecuteAction('fill', selector, inputValue);
  };

  const executeExtract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionMenu || !extractName) return;
    onAddExtraction('extract', actionMenu.node.selector, extractName, extractAttr);
    setActionMenu(null);
  };

  const executeExtractList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionMenu || !extractName || !listSelector) return;
    onAddExtraction('extract_list', listSelector, extractName, extractAttr);
    setActionMenu(null);
  };

  const generalizeSelector = (sel: string): string => {
    return sel.replace(/:nth-of-type\(\d+\)/g, '');
  };

  return (
    <div className="canvas-container" onMouseLeave={handleMouseLeave}>
      <div className="canvas-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="var(--accent-secondary)" />
            Interactive Headless Canvas (Scrollable Page)
          </span>

          {screenshot && (
            <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid var(--border-light)', paddingLeft: '12px' }}>
              <button
                className="btn btn-secondary"
                disabled={isLoading}
                onClick={() => onExecuteAction('back', '')}
                style={{ width: '24px', height: '24px', padding: 0, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Go Back"
              >
                <ArrowLeft size={12} />
              </button>
              <button
                className="btn btn-secondary"
                disabled={isLoading}
                onClick={() => onExecuteAction('forward', '')}
                style={{ width: '24px', height: '24px', padding: 0, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Go Forward"
              >
                <ArrowRight size={12} />
              </button>
              <button
                className="btn btn-secondary"
                disabled={isLoading}
                onClick={() => onExecuteAction('reload', '')}
                style={{ width: '24px', height: '24px', padding: 0, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Reload Page"
              >
                <RotateCw size={12} />
              </button>
              <button
                className="btn btn-secondary"
                disabled={isLoading}
                onClick={() => onExecuteAction('scroll', '', '-400')}
                style={{ width: '24px', height: '24px', padding: 0, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Scroll Up"
              >
                <ChevronUp size={12} />
              </button>
              <button
                className="btn btn-secondary"
                disabled={isLoading}
                onClick={() => onExecuteAction('scroll', '', '400')}
                style={{ width: '24px', height: '24px', padding: 0, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Scroll Down"
              >
                <ChevronDown size={12} />
              </button>
            </div>
          )}
        </div>
        
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="loader" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Executing browser action...</span>
          </div>
        )}
      </div>

      <div className="canvas-viewport-wrapper">
        {screenshot ? (
          <div 
            className="canvas-frame-outer"
            style={{ position: 'relative', cursor: hoveredNode ? 'pointer' : 'default' }}
            onMouseMove={handleMouseMove}
            onClick={handleCanvasClick}
          >
            <img 
              ref={imgRef}
              src={screenshot}
              alt="Scraper Viewport"
              onLoad={updateScaling}
              style={{ display: 'block', maxWidth: '100%', height: 'auto', userSelect: 'none' }}
            />
            
            {/* Element Hover Highlight */}
            <div className="box-highlight" style={hoverStyle}>
              {hoveredNode && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  backgroundColor: 'var(--bg-panel)',
                  border: '1px solid var(--accent-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '4px',
                  transform: 'translateY(-2px)'
                }}>
                  {hoveredNode.tag}
                  {hoveredNode.id && <span style={{ color: 'var(--accent-secondary)' }}>#{hoveredNode.id}</span>}
                  {hoveredNode.classes && <span style={{ color: 'var(--text-muted)' }}>.{hoveredNode.classes.split(' ')[0]}</span>}
                </div>
              )}
            </div>

            {/* Element Selected Highlight */}
            <div className="box-selected" style={selectedStyle} />

            {/* Action Popup Context Menu */}
            {actionMenu?.visible && (
              <div 
                style={{
                  position: 'absolute',
                  left: `${Math.min(actionMenu.x, (imgRef.current?.clientWidth || 0) - 260)}px`,
                  top: `${actionMenu.y}px`,
                  backgroundColor: 'var(--bg-panel)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px',
                  width: '260px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  zIndex: 100,
                }}
                onClick={(e) => e.stopPropagation()} // Stop menu click closing it
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {actionMenu.node.selector}
                </div>

                {!showInputForm && !showExtractForm && !showExtractListForm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ height: '32px', justifyContent: 'flex-start', fontSize: '12px' }}
                      onClick={executeClick}
                    >
                      <MousePointerClick size={14} color="var(--accent-secondary)" />
                      Click Element
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ height: '32px', justifyContent: 'flex-start', fontSize: '12px' }}
                      onClick={() => setShowInputForm(true)}
                    >
                      <Type size={14} color="var(--accent-primary)" />
                      Type / Fill Text
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ height: '32px', justifyContent: 'flex-start', fontSize: '12px', borderColor: 'var(--accent-warn)' }}
                      onClick={() => {
                        setShowExtractForm(true);
                        setExtractName(actionMenu.node.tag + '_' + Math.floor(Math.random() * 100));
                        setExtractAttr(actionMenu.node.tag === 'a' ? 'href' : 'text');
                      }}
                    >
                      <Sparkles size={14} color="var(--accent-warn)" />
                      Extract Visually
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ height: '32px', justifyContent: 'flex-start', fontSize: '12px', borderColor: 'var(--accent-secondary)' }}
                      onClick={() => {
                        setShowExtractListForm(true);
                        setListSelector(generalizeSelector(actionMenu.node.selector));
                        setExtractName(actionMenu.node.tag + '_list');
                        setExtractAttr(actionMenu.node.tag === 'a' ? 'href' : 'text');
                      }}
                    >
                      <Sparkles size={14} color="var(--accent-secondary)" />
                      Extract List Column
                    </button>
                  </div>
                ) : showInputForm ? (
                  <form onSubmit={executeFill} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Text to input:</label>
                    <input 
                      type="text" 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Enter text..."
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 8px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button type="submit" className="btn btn-primary" style={{ height: '28px', flex: 1, fontSize: '11px' }}>Apply</button>
                      <button type="button" className="btn btn-secondary" style={{ height: '28px', flex: 1, fontSize: '11px' }} onClick={() => setShowInputForm(false)}>Back</button>
                    </div>
                  </form>
                ) : showExtractForm ? (
                  <form onSubmit={executeExtract} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Variable Name:</label>
                    <input 
                      type="text" 
                      value={extractName}
                      onChange={(e) => setExtractName(e.target.value)}
                      placeholder="variable_name"
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 8px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                      autoFocus
                    />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Attribute to Extract:</label>
                    <select
                      value={extractAttr}
                      onChange={(e) => setExtractAttr(e.target.value)}
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 8px',
                        color: '#fff',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                    >
                      <option value="text">Inner Text (::text)</option>
                      <option value="html">Inner HTML</option>
                      <option value="href">Href Link (a)</option>
                      <option value="src">Src Link (img)</option>
                      <option value="placeholder">Placeholder</option>
                      <option value="value">Input Value</option>
                    </select>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button type="submit" className="btn btn-primary" style={{ height: '28px', flex: 1, fontSize: '11px', background: 'var(--accent-warn)' }}>Add Step</button>
                      <button type="button" className="btn btn-secondary" style={{ height: '28px', flex: 1, fontSize: '11px' }} onClick={() => setShowExtractForm(false)}>Back</button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={executeExtractList} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Column/List Name:</label>
                    <input 
                      type="text" 
                      value={extractName}
                      onChange={(e) => setExtractName(e.target.value)}
                      placeholder="col_name"
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 8px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                      autoFocus
                    />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Generalized Selector:</label>
                    <input 
                      type="text" 
                      value={listSelector}
                      onChange={(e) => setListSelector(e.target.value)}
                      placeholder="Generalized CSS Selector"
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 8px',
                        color: '#fff',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Attribute to Extract:</label>
                    <select
                      value={extractAttr}
                      onChange={(e) => setExtractAttr(e.target.value)}
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 8px',
                        color: '#fff',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                    >
                      <option value="text">Inner Text (::text)</option>
                      <option value="html">Inner HTML</option>
                      <option value="href">Href Link (a)</option>
                      <option value="src">Src Link (img)</option>
                      <option value="placeholder">Placeholder</option>
                      <option value="value">Input Value</option>
                    </select>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button type="submit" className="btn btn-primary" style={{ height: '28px', flex: 1, fontSize: '11px', background: 'var(--accent-secondary)' }}>Add Column</button>
                      <button type="button" className="btn btn-secondary" style={{ height: '28px', flex: 1, fontSize: '11px' }} onClick={() => setShowExtractListForm(false)}>Back</button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', padding: '40px' }}>
            <AlertCircle size={48} color="var(--text-muted)" />
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>No Browser Session Active</h3>
              <p style={{ fontSize: '14px', maxWidth: '360px' }}>Enter a URL at the top and click "Launch" to start inspecting endpoints, network traffic, and elements.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
