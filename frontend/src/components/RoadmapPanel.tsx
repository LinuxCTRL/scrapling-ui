import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, Flame, Play, CheckSquare, Square, RefreshCw } from 'lucide-react';

interface SubTask {
  text: string;
  checked: boolean;
}

interface Task {
  title: string;
  checked: boolean;
  status: string; // 'TODO' | 'ACTIVE' | 'DONE'
  subtasks: SubTask[];
}

export const RoadmapPanel: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodo = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/todo');
      if (!res.ok) throw new Error('Failed to load roadmap tasks');
      const data = await res.json();
      setTasks(data.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch roadmap');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodo();
  }, []);

  const saveTasks = async (updatedTasks: Task[]) => {
    try {
      const res = await fetch('/api/todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks })
      });
      if (!res.ok) throw new Error('Failed to update roadmap tasks');
      const data = await res.json();
      setTasks(data.tasks);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save roadmap');
    }
  };

  const toggleSubtask = (taskIndex: number, subIndex: number) => {
    const newTasks = [...tasks];
    const sub = newTasks[taskIndex].subtasks[subIndex];
    sub.checked = !sub.checked;

    // Auto update main task checked state if all subtasks are checked
    const allChecked = newTasks[taskIndex].subtasks.every(s => s.checked);
    newTasks[taskIndex].checked = allChecked;
    if (allChecked) {
      newTasks[taskIndex].status = 'DONE';
    } else if (newTasks[taskIndex].status === 'DONE') {
      newTasks[taskIndex].status = 'TODO';
    }

    saveTasks(newTasks);
  };

  const pickActive = (taskIndex: number) => {
    const newTasks = tasks.map((t, idx) => {
      if (idx === taskIndex) {
        return { ...t, status: 'ACTIVE' };
      } else if (t.status === 'ACTIVE') {
        return { ...t, status: 'TODO' };
      }
      return t;
    });
    saveTasks(newTasks);
  };

  const toggleTaskChecked = (taskIndex: number) => {
    const newTasks = [...tasks];
    const t = newTasks[taskIndex];
    t.checked = !t.checked;
    
    // Toggle all subtasks to match
    t.subtasks = t.subtasks.map(s => ({ ...s, checked: t.checked }));
    t.status = t.checked ? 'DONE' : 'TODO';
    
    saveTasks(newTasks);
  };

  if (loading && tasks.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
        <RefreshCw className="loader" size={18} style={{ marginRight: '8px' }} />
        Loading feature roadmap...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px', color: 'var(--accent-error)', fontSize: '12px' }}>
        Failed to load: {error}
        <button className="btn btn-secondary" onClick={fetchTodo} style={{ marginTop: '8px', height: '28px', fontSize: '11px' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', gap: '16px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Roadmap Tracker & Progress
        </span>
        <button 
          onClick={fetchTodo}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          title="Reload Roadmap"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {tasks.map((task, taskIdx) => {
          const isActive = task.status === 'ACTIVE';
          const isDone = task.status === 'DONE';
          
          return (
            <div 
              key={taskIdx}
              style={{
                background: isActive ? 'var(--bg-active)' : 'rgba(255, 255, 255, 0.01)',
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 14px',
                transition: 'all 0.2s ease',
                position: 'relative',
                boxShadow: isActive ? '0 4px 12px var(--accent-primary-glow)' : 'none'
              }}
            >
              {/* Task Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <button 
                    onClick={() => toggleTaskChecked(taskIdx)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: isDone ? '#10b981' : 'var(--text-muted)', marginTop: '2px' }}
                  >
                    {isDone ? <CheckCircle size={16} fill="rgba(16, 185, 129, 0.1)" /> : <Circle size={16} />}
                  </button>
                  <div>
                    <h4 style={{ 
                      fontSize: '12.5px', 
                      fontWeight: 600, 
                      color: isActive ? '#fff' : 'var(--text-primary)',
                      textDecoration: isDone ? 'line-through' : 'none',
                      lineHeight: '1.4'
                    }}>
                      {task.title}
                    </h4>
                  </div>
                </div>

                {/* Badge Status & Active Button */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {isDone ? (
                    <span style={{ 
                      fontSize: '9px', 
                      padding: '2px 6px', 
                      borderRadius: '10px', 
                      background: 'rgba(16, 185, 129, 0.15)', 
                      color: '#10b981', 
                      fontWeight: 700 
                    }}>
                      DONE
                    </span>
                  ) : isActive ? (
                    <span style={{ 
                      fontSize: '9px', 
                      padding: '2px 6px', 
                      borderRadius: '10px', 
                      background: 'var(--accent-primary-glow)', 
                      color: 'var(--accent-primary)', 
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      boxShadow: '0 0 8px var(--accent-primary-glow)'
                    }}>
                      <Flame size={9} fill="var(--accent-primary)" />
                      ACTIVE
                    </span>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      onClick={() => pickActive(taskIdx)}
                      style={{ 
                        height: '20px', 
                        padding: '0 6px', 
                        fontSize: '9px', 
                        borderRadius: '4px',
                        background: 'transparent',
                        borderColor: 'var(--border-light)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <Play size={8} fill="var(--text-secondary)" />
                      Pick
                    </button>
                  )}
                </div>
              </div>

              {/* Subtasks List */}
              {task.subtasks && task.subtasks.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px', 
                  marginLeft: '24px', 
                  marginTop: '10px',
                  borderLeft: '1px solid var(--border-light)',
                  paddingLeft: '10px'
                }}>
                  {task.subtasks.map((sub, subIdx) => (
                    <div 
                      key={subIdx} 
                      onClick={() => toggleSubtask(taskIdx, subIdx)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      {sub.checked ? (
                        <CheckSquare size={13} color="var(--accent-secondary)" />
                      ) : (
                        <Square size={13} color="var(--text-muted)" />
                      )}
                      <span style={{ 
                        fontSize: '11px', 
                        color: sub.checked ? 'var(--text-muted)' : 'var(--text-secondary)',
                        textDecoration: sub.checked ? 'line-through' : 'none'
                      }}>
                        {sub.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
