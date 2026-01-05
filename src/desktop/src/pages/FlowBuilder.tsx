import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, TrendingUp, Coins, Database, Brain, Search, Box, Plus, X, Play,
  ChevronRight, Trash2, Copy, Settings, Zap, ArrowRight, GripVertical
} from 'lucide-react';
import { GlitchText, CyberButton } from '../components';

interface FlowNode {
  id: string;
  type: string;
  name: string;
  category: string;
  x: number;
  y: number;
  inputs: string[];
  outputs: string[];
  config: Record<string, any>;
}

interface Connection {
  id: string;
  from: { nodeId: string; port: string };
  to: { nodeId: string; port: string };
}

const MODULE_PALETTE = [
  { type: 'llm', name: 'LLM', category: 'ai', icon: Brain, inputs: ['prompt'], outputs: ['response'], color: '#a855f7' },
  { type: 'agent', name: 'Agent', category: 'ai', icon: Bot, inputs: ['task'], outputs: ['result'], color: '#00ffff' },
  { type: 'memory', name: 'Memory', category: 'data', icon: Database, inputs: ['data'], outputs: ['context'], color: '#ff6b6b' },
  { type: 'tool', name: 'Tool', category: 'util', icon: Settings, inputs: ['input'], outputs: ['output'], color: '#fbbf24' },
  { type: 'trading', name: 'Trading', category: 'defi', icon: TrendingUp, inputs: ['signal'], outputs: ['order'], color: '#00ff41' },
  { type: 'search', name: 'Search', category: 'data', icon: Search, inputs: ['query'], outputs: ['results'], color: '#ff00ff' },
];

export function FlowBuilder() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<FlowNode[]>([
    {
      id: 'node-1',
      type: 'agent',
      name: 'Eliza Agent',
      category: 'ai',
      x: 100,
      y: 150,
      inputs: ['task'],
      outputs: ['result'],
      config: { model: 'gpt-4' },
    },
    {
      id: 'node-2',
      type: 'memory',
      name: 'Vector Store',
      category: 'data',
      x: 400,
      y: 100,
      inputs: ['data'],
      outputs: ['context'],
      config: { provider: 'pinecone' },
    },
    {
      id: 'node-3',
      type: 'trading',
      name: 'Hyperliquid',
      category: 'defi',
      x: 400,
      y: 280,
      inputs: ['signal'],
      outputs: ['order'],
      config: { pair: 'ETH-USDC' },
    },
  ]);

  const [connections, setConnections] = useState<Connection[]>([
    { id: 'conn-1', from: { nodeId: 'node-1', port: 'result' }, to: { nodeId: 'node-2', port: 'data' } },
    { id: 'conn-1b', from: { nodeId: 'node-1', port: 'result' }, to: { nodeId: 'node-3', port: 'signal' } },
  ]);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [showPalette, setShowPalette] = useState(true);

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const rect = (e.target as HTMLElement).closest('.flow-node')?.getBoundingClientRect();
    if (!rect) return;

    setDragging({
      nodeId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
    setSelectedNode(nodeId);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - canvasRect.left - dragging.offsetX;
    const newY = e.clientY - canvasRect.top - dragging.offsetY;

    setNodes(prev => prev.map(node =>
      node.id === dragging.nodeId
        ? { ...node, x: Math.max(0, newX), y: Math.max(0, newY) }
        : node
    ));
  }, [dragging]);

  const handleMouseUp = () => {
    setDragging(null);
  };

  const addNode = (type: typeof MODULE_PALETTE[0]) => {
    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type: type.type,
      name: type.name,
      category: type.category,
      x: 200 + Math.random() * 200,
      y: 150 + Math.random() * 150,
      inputs: type.inputs,
      outputs: type.outputs,
      config: {},
    };
    setNodes(prev => [...prev, newNode]);
  };

  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.from.nodeId !== nodeId && c.to.nodeId !== nodeId));
    setSelectedNode(null);
  };

  const getNodeColor = (category: string) => {
    switch (category) {
      case 'ai': return '#a855f7';
      case 'data': return '#ff6b6b';
      case 'defi': return '#00ff41';
      case 'util': return '#fbbf24';
      default: return '#00ffff';
    }
  };

  const getNodeIcon = (type: string) => {
    const mod = MODULE_PALETTE.find(m => m.type === type);
    return mod?.icon || Box;
  };

  // Calculate connection paths
  const getConnectionPath = (conn: Connection) => {
    const fromNode = nodes.find(n => n.id === conn.from.nodeId);
    const toNode = nodes.find(n => n.id === conn.to.nodeId);
    if (!fromNode || !toNode) return '';

    const startX = fromNode.x + 200; // Right side of node
    const startY = fromNode.y + 40;
    const endX = toNode.x; // Left side of node
    const endY = toNode.y + 40;

    const midX = (startX + endX) / 2;

    return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
  };

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--gap-md)',
        padding: '0 var(--gap-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          <button
            onClick={() => navigate('/deploy')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <GlitchText text="FLOW BUILDER" as="h2" className="glitch-hover" style={{ fontSize: '1.25rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
          <CyberButton onClick={() => setShowPalette(!showPalette)}>
            {showPalette ? 'HIDE' : 'SHOW'} MODULES
          </CyberButton>
          <CyberButton variant="success" icon={Play}>
            DEPLOY FLOW
          </CyberButton>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div style={{ flex: 1, display: 'flex', gap: 'var(--gap-md)', minHeight: 0 }}>
        {/* Module Palette */}
        {showPalette && (
          <div style={{
            width: 220,
            background: 'var(--bg-surface)',
            border: '1px solid rgba(0, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--gap-md)',
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 'var(--gap-md)',
            }}>
              Drag to Canvas
            </div>

            {MODULE_PALETTE.map(mod => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.type}
                  onClick={() => addNode(mod)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--gap-sm)',
                    padding: 'var(--gap-sm) var(--gap-md)',
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${mod.color}40`,
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 'var(--gap-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover-lift"
                >
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '4px',
                    background: `${mod.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon size={14} style={{ color: mod.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{mod.name}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{mod.category}</div>
                  </div>
                  <Plus size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                </div>
              );
            })}
          </div>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            flex: 1,
            background: 'var(--bg-void)',
            border: '1px solid rgba(0, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            position: 'relative',
            overflow: 'hidden',
            backgroundImage: `
              linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        >
          {/* Connection SVG */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <defs>
              <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0.8" />
                <stop offset="100%" stopColor="var(--neon-magenta)" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            {connections.map(conn => (
              <path
                key={conn.id}
                d={getConnectionPath(conn)}
                fill="none"
                stroke="url(#connectionGradient)"
                strokeWidth="2"
                strokeDasharray="5,5"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="10"
                  to="0"
                  dur="0.5s"
                  repeatCount="indefinite"
                />
              </path>
            ))}
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const Icon = getNodeIcon(node.type);
            const color = getNodeColor(node.category);
            const isSelected = selectedNode === node.id;

            return (
              <div
                key={node.id}
                className="flow-node"
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: 200,
                  background: 'var(--bg-surface)',
                  border: `2px solid ${isSelected ? 'var(--neon-cyan)' : color + '60'}`,
                  borderRadius: 'var(--radius-md)',
                  boxShadow: isSelected ? 'var(--glow-cyan)' : `0 0 20px ${color}20`,
                  cursor: dragging?.nodeId === node.id ? 'grabbing' : 'grab',
                  userSelect: 'none',
                }}
              >
                {/* Node Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-sm)',
                  padding: 'var(--gap-sm) var(--gap-md)',
                  borderBottom: `1px solid ${color}30`,
                  background: `${color}10`,
                }}>
                  <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
                  <Icon size={16} style={{ color }} />
                  <span style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-primary)',
                  }}>
                    {node.name}
                  </span>
                  {isSelected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                      style={{
                        background: 'rgba(255, 0, 0, 0.2)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        cursor: 'pointer',
                        color: '#ff4444',
                        display: 'flex',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Node Body */}
                <div style={{ padding: 'var(--gap-sm) var(--gap-md)' }}>
                  {/* Inputs */}
                  {node.inputs.map(input => (
                    <div key={input} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--gap-xs)',
                      marginBottom: '4px',
                    }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--neon-cyan)',
                        border: '2px solid var(--bg-void)',
                        marginLeft: -16,
                      }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {input}
                      </span>
                    </div>
                  ))}

                  {/* Outputs */}
                  {node.outputs.map(output => (
                    <div key={output} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 'var(--gap-xs)',
                      marginBottom: '4px',
                    }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {output}
                      </span>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--neon-magenta)',
                        border: '2px solid var(--bg-void)',
                        marginRight: -16,
                      }} />
                    </div>
                  ))}
                </div>

                {/* Node Footer */}
                <div style={{
                  padding: '4px var(--gap-md)',
                  borderTop: `1px solid ${color}20`,
                  fontSize: '0.6rem',
                  color: 'var(--text-muted)',
                }}>
                  {node.type} • {node.category}
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {nodes.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}>
              <Box size={48} style={{ margin: '0 auto var(--gap-md)', opacity: 0.3 }} />
              <p>Click modules on the left to add them to your flow</p>
            </div>
          )}
        </div>

        {/* Node Config Panel */}
        {selectedNode && (
          <div style={{
            width: 280,
            background: 'var(--bg-surface)',
            border: '1px solid rgba(0, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--gap-md)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--gap-md)',
            }}>
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                Node Config
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {(() => {
              const node = nodes.find(n => n.id === selectedNode);
              if (!node) return null;
              const Icon = getNodeIcon(node.type);
              const color = getNodeColor(node.category);

              return (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--gap-sm)',
                    marginBottom: 'var(--gap-lg)',
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-sm)',
                      background: `${color}20`,
                      border: `1px solid ${color}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={node.name}
                        onChange={(e) => setNodes(prev => prev.map(n =>
                          n.id === node.id ? { ...n, name: e.target.value } : n
                        ))}
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid rgba(0, 255, 255, 0.2)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 8px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.9rem',
                          width: '100%',
                        }}
                      />
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {node.type} • {node.category}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 'var(--gap-md)' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}>
                      Model / Provider
                    </label>
                    <select
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid rgba(0, 255, 255, 0.2)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <option>GPT-4</option>
                      <option>Claude 3</option>
                      <option>LLaMA 3</option>
                      <option>Mistral</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: 'var(--gap-md)' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}>
                      Temperature
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      defaultValue="0.7"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: 'var(--gap-sm)',
                    marginTop: 'var(--gap-lg)',
                  }}>
                    <CyberButton icon={Copy} style={{ flex: 1 }}>
                      DUPLICATE
                    </CyberButton>
                    <CyberButton
                      icon={Trash2}
                      onClick={() => deleteNode(node.id)}
                      style={{
                        background: 'rgba(255, 0, 0, 0.1)',
                        borderColor: 'rgba(255, 0, 0, 0.3)',
                        color: '#ff4444',
                      }}
                    >
                      DELETE
                    </CyberButton>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
