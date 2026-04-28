'use client';

/**
 * ChatPanel — agentic chat UI for the docs-control dashboard.
 *
 * Left rail: thread list + "New chat" button.
 * Main area: message stream with tool-call cards, status bar, input.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronLeft,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useChatStream, type UiMessage } from './use-chat-stream';

interface ThreadSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface ServerThread {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'tool';
    text: string;
    toolCall?: { name: string; input: unknown; result?: string; isError?: boolean };
    createdAt: string;
  }>;
  totalCostUsd?: number;
}

/**
 * Convert the server's stored message format (one entry per role) into the
 * UI's grouped format (assistant message owns its tool calls).
 */
function hydrateMessages(serverMessages: ServerThread['messages']): UiMessage[] {
  const out: UiMessage[] = [];
  for (const msg of serverMessages) {
    if (msg.role === 'user') {
      out.push({ id: msg.id, role: 'user', text: msg.text, createdAt: msg.createdAt });
    } else if (msg.role === 'assistant') {
      out.push({
        id: msg.id,
        role: 'assistant',
        text: msg.text,
        toolCalls: [],
        createdAt: msg.createdAt,
      });
    } else if (msg.role === 'tool' && msg.toolCall) {
      // attach to most recent assistant bubble — or create a placeholder
      let last = out[out.length - 1];
      if (!last || last.role !== 'assistant') {
        last = {
          id: `synthetic_${msg.id}`,
          role: 'assistant',
          text: '',
          toolCalls: [],
          createdAt: msg.createdAt,
        };
        out.push(last);
      }
      last.toolCalls = [
        ...(last.toolCalls || []),
        {
          id: msg.id,
          name: msg.toolCall.name,
          input: msg.toolCall.input,
          result: msg.toolCall.result,
          isError: msg.toolCall.isError,
        },
      ];
    }
  }
  return out;
}

export default function ChatPanel() {
  const { state, send, cancel, reset } = useChatStream();
  const [input, setInput] = useState('');
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsOpen, setThreadsOpen] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.messages, state.status]);

  // Refocus input after a turn completes
  useEffect(() => {
    if (!state.busy) inputRef.current?.focus();
  }, [state.busy]);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const res = await fetch('/api/chat/threads');
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const openThread = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/chat/threads?id=${encodeURIComponent(id)}`);
        if (!res.ok) return;
        const data = await res.json();
        const thread: ServerThread = data.thread;
        reset({
          threadId: thread.id,
          title: thread.title,
          messages: hydrateMessages(thread.messages),
        });
      } catch {
        // ignore
      }
    },
    [reset]
  );

  const startNewChat = useCallback(() => {
    reset();
    setInput('');
    inputRef.current?.focus();
  }, [reset]);

  const handleSend = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || state.busy) return;
      const message = input;
      setInput('');
      await send(message, {
        threadId: state.threadId ?? undefined,
        onSaved: () => loadThreads(),
      });
    },
    [input, state.busy, state.threadId, send, loadThreads]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const deleteThread = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Delete this chat thread?')) return;
      await fetch(`/api/chat/threads/${id}`, { method: 'DELETE' });
      if (state.threadId === id) startNewChat();
      loadThreads();
    },
    [state.threadId, loadThreads, startNewChat]
  );

  const phaseLabel = useMemo(() => {
    switch (state.phase) {
      case 'materializing':
        return 'Workspace';
      case 'thinking':
        return 'Thinking';
      case 'streaming':
        return 'Streaming';
      case 'persisting':
        return 'Saving';
      case 'done':
        return 'Done';
      case 'error':
        return 'Error';
      default:
        return 'Idle';
    }
  }, [state.phase]);

  return (
    <div className="flex flex-col h-full bg-[#0d1b1e] rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-[#1a2c35]">
        <button
          onClick={() => setThreadsOpen((v) => !v)}
          className="text-slate-400 hover:text-cyan-400 transition-colors"
          title={threadsOpen ? 'Hide threads' : 'Show threads'}
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${threadsOpen ? '' : 'rotate-180'}`} />
        </button>
        <Bot className="w-5 h-5 text-cyan-400" />
        <div className="flex-1 min-w-0">
          <div className="text-slate-100 font-medium text-sm truncate">
            {state.threadTitle || 'New chat'}
          </div>
        </div>
        <button
          onClick={startNewChat}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-700/40 transition-colors"
          title="Start new chat"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {/* Body: optional thread list + message stream */}
      <div className="flex-1 flex overflow-hidden">
        {threadsOpen && (
          <aside className="w-48 border-r border-slate-800 bg-[#0a1517] flex flex-col">
            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Recent
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingThreads && threads.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500">Loading...</div>
              ) : threads.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500">No chats yet.</div>
              ) : (
                threads.map((t) => {
                  const active = t.id === state.threadId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => openThread(t.id)}
                      className={`group w-full text-left px-3 py-2 text-xs border-l-2 transition-colors flex items-start gap-1.5 ${
                        active
                          ? 'bg-cyan-900/30 border-cyan-400 text-cyan-100'
                          : 'border-transparent text-slate-300 hover:bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <span className="flex-1 min-w-0 truncate">{t.title}</span>
                      <span
                        onClick={(e) => deleteThread(t.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity cursor-pointer"
                        title="Delete thread"
                      >
                        <Trash2 className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* Message stream */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {state.messages.length === 0 ? (
            <EmptyState />
          ) : (
            state.messages.map((msg) =>
              msg.role === 'user' ? <UserBubble key={msg.id} msg={msg} /> : <AssistantBubble key={msg.id} msg={msg} />
            )
          )}
          {state.error && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg p-3">
              <div className="font-mono text-xs uppercase tracking-wide mb-1">Error</div>
              {state.error}
            </div>
          )}
        </div>
      </div>

      {/* Status + input */}
      <div className="border-t border-slate-800 bg-[#0a1517]">
        <div className="px-4 py-1.5 flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest border-b border-slate-800/60">
          <div className="flex items-center gap-1.5">
            {state.busy ? (
              <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />
            ) : (
              <span
                className={`w-2 h-2 rounded-full ${
                  state.phase === 'error'
                    ? 'bg-red-500'
                    : state.phase === 'done'
                    ? 'bg-green-500'
                    : 'bg-slate-600'
                }`}
              />
            )}
            <span className="text-slate-400">{phaseLabel}</span>
          </div>
          {state.status && (
            <span className="text-slate-500 truncate flex-1">{state.status}</span>
          )}
          {!state.status && <span className="flex-1" />}
          {state.costUsd > 0 && (
            <span className="text-slate-500">${state.costUsd.toFixed(4)}</span>
          )}
          {state.busy && (
            <button
              onClick={cancel}
              className="text-red-400 hover:text-red-300 normal-case tracking-normal flex items-center gap-1"
              title="Cancel"
            >
              <X className="w-3 h-3" />
              Stop
            </button>
          )}
        </div>
        <form onSubmit={handleSend} className="p-3">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the agent to audit, edit, research, or compare docs..."
              rows={2}
              className="w-full bg-[#0f1923] border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 pr-12 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none"
              disabled={state.busy}
            />
            <button
              type="submit"
              disabled={!input.trim() || state.busy}
              className="absolute right-2 bottom-2 p-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-600 font-mono">
            Shift+Enter for newline
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState() {
  const examples = [
    'List all articles that mention the Muse model',
    'Compare the local "Story Bible" article against what is live in Featurebase',
    'Audit our docs against this changelog: ...',
    'Find articles older than 6 months that may be stale',
  ];
  return (
    <div className="text-center py-8 px-4">
      <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
      <h3 className="text-slate-200 font-medium text-sm mb-1">Ask the agent</h3>
      <p className="text-slate-500 text-xs mb-4">
        It can read the repo, hit Featurebase, run audits, and commit edits.
      </p>
      <div className="space-y-1.5 text-left">
        {examples.map((ex, i) => (
          <div
            key={i}
            className="text-xs text-slate-500 italic border-l-2 border-slate-800 pl-2 py-0.5"
          >
            "{ex}"
          </div>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ msg }: { msg: UiMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-cyan-900/40 border border-cyan-800/50 rounded-lg px-3 py-2 text-sm text-slate-100 whitespace-pre-wrap">
        {msg.text}
      </div>
    </div>
  );
}

function AssistantBubble({ msg }: { msg: UiMessage }) {
  return (
    <div className="space-y-2">
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <div className="space-y-1.5">
          {msg.toolCalls.map((t) => (
            <ToolCallCard key={t.id} call={t} />
          ))}
        </div>
      )}
      {msg.text && (
        <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
          {msg.text}
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ call }: { call: NonNullable<UiMessage['toolCalls']>[number] }) {
  const [open, setOpen] = useState(false);
  const inputPreview = useMemo(() => {
    try {
      const json = JSON.stringify(call.input);
      return json.length > 80 ? json.slice(0, 77) + '...' : json;
    } catch {
      return '';
    }
  }, [call.input]);

  // Strip MCP server prefix for cleaner display
  const displayName = call.name.replace(/^mcp__[^_]+__/, '');

  return (
    <div
      className={`text-xs rounded-md border ${
        call.isError
          ? 'bg-red-950/20 border-red-900/40'
          : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2 px-2.5 py-1.5 text-left hover:bg-slate-800/40 transition-colors"
      >
        <Wrench className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-500" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-slate-300 truncate">
            <span className="text-cyan-400">{displayName}</span>
            {inputPreview && <span className="text-slate-500 ml-1">({inputPreview})</span>}
          </div>
          {call.result && !open && (
            <div className="text-slate-500 truncate mt-0.5 font-mono">
              {call.result.split('\n')[0].slice(0, 100)}
            </div>
          )}
        </div>
      </button>
      {open && (
        <div className="px-2.5 pb-2 space-y-1.5">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">Input</div>
            <pre className="text-[11px] text-slate-300 bg-black/30 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          {call.result && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">
                {call.isError ? 'Error' : 'Result'}
              </div>
              <pre className="text-[11px] text-slate-300 bg-black/30 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-64">
                {call.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
