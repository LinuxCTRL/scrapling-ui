import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { DOMNode } from '../types';

interface ElementsTreeProps {
  domTree: DOMNode | null;
  selectedNode: DOMNode | null;
  setSelectedNode: (node: DOMNode | null) => void;
}

const TreeNode: React.FC<{
  node: DOMNode;
  depth: number;
  selectedNode: DOMNode | null;
  setSelectedNode: (node: DOMNode | null) => void;
}> = ({ node, depth, selectedNode, setSelectedNode }) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto expand first few levels
  
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedNode?.selector === node.selector;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(node);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div 
        onClick={handleSelect}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 6px',
          paddingLeft: `${depth * 14 + 6}px`,
          cursor: 'pointer',
          borderRadius: '4px',
          fontSize: '13px',
          fontFamily: 'var(--font-mono)',
          backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--accent-secondary)' : '2px solid transparent',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
        onMouseEnter={() => {
          // Add custom temporary styling or trigger a hover state if desired
        }}
      >
        <span 
          onClick={handleToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            marginRight: '2px',
            visibility: hasChildren ? 'visible' : 'hidden',
            color: 'var(--text-muted)'
          }}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>

        <span style={{ color: '#ec4899', fontWeight: 600 }}>&lt;{node.tag}</span>
        
        {node.id && (
          <span style={{ color: 'var(--accent-secondary)' }}>
            id="{node.id}"
          </span>
        )}
        
        {node.classes && (
          <span style={{ color: 'var(--accent-primary)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
            class="{node.classes.split(' ').slice(0, 3).join(' ')}"
          </span>
        )}
        
        <span style={{ color: '#ec4899', fontWeight: 600 }}>&gt;</span>

        {node.text && !hasChildren && (
          <span style={{ color: 'var(--text-primary)', marginLeft: '6px', fontStyle: 'italic', fontSize: '12px' }}>
            {node.text.slice(0, 30)}
            {node.text.length > 30 ? '...' : ''}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {node.children!.map((child, index) => (
            <TreeNode 
              key={index} 
              node={child} 
              depth={depth + 1} 
              selectedNode={selectedNode}
              setSelectedNode={setSelectedNode}
            />
          ))}
          <div style={{ 
            paddingLeft: `${(depth + 1) * 14 + 6}px`, 
            fontSize: '13px', 
            fontFamily: 'var(--font-mono)', 
            color: '#ec4899', 
            fontWeight: 600,
            opacity: 0.8,
            paddingTop: '2px',
            paddingBottom: '2px'
          }}>
            &lt;/{node.tag}&gt;
          </div>
        </div>
      )}
    </div>
  );
};

interface ElementsTreeProps {
  domTree: DOMNode | null;
  selectedNode: DOMNode | null;
  setSelectedNode: (node: DOMNode | null) => void;
  customSelector: string;
  onCustomSelectorChange: (selector: string) => void;
  customSelectorMatchesCount: number;
}

export const ElementsTree: React.FC<ElementsTreeProps> = ({ 
  domTree, 
  selectedNode, 
  setSelectedNode,
  customSelector,
  onCustomSelectorChange,
  customSelectorMatchesCount
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Selector Tester Box */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid var(--border-light)',
        background: '#0a0d16',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
          <span>LIVE SELECTOR TESTER (CSS/XPATH)</span>
          {customSelector.trim() && (
            <span style={{ color: customSelectorMatchesCount > 0 ? 'var(--accent-secondary)' : 'var(--accent-error)', fontWeight: 'bold' }}>
              {customSelectorMatchesCount} match{customSelectorMatchesCount !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
        <input
          type="text"
          value={customSelector}
          onChange={(e) => onCustomSelectorChange(e.target.value)}
          placeholder="e.g. span.titleline > a or //a[@class='morelink']"
          style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            color: '#fff',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            outline: 'none',
            boxSizing: 'border-box',
            width: '100%'
          }}
        />
      </div>

      {/* DOM Tree Area */}
      <div style={{ 
        overflowX: 'auto', 
        overflowY: 'auto', 
        flex: 1,
        padding: '12px',
        display: 'flex', 
        flexDirection: 'column',
        gap: '4px' 
      }}>
        {domTree ? (
          <TreeNode 
            node={domTree} 
            depth={0} 
            selectedNode={selectedNode} 
            setSelectedNode={setSelectedNode} 
          />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
            No elements loaded. Start a session to view page DOM structure.
          </div>
        )}
      </div>
    </div>
  );
};
