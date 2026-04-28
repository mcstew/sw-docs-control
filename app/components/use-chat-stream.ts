/**
 * useChatStream — React hook that POSTs to /api/chat/stream and consumes
 * the SSE response, surfacing typed events to the component.
 *
 * The agent's transcript is built up incrementally:
 *   - text events append to the trailing assistant bubble
 *   - tool_call / tool_result events become tool cards
 *   - status events update a small "what the agent is doing" indicator
 */

'use client';

import { useCallback, useRef, useState } from 'react';

export type StreamPhase =
  | 'idle'
  | 'materializing'
  | 'thinking'
  | 'streaming'
  | 'persisting'
  | 'done'
  | 'error';

export interface ToolCallView {
  id: string;
  name: string;
  input: unknown;
  result?: string;
  isError?: boolean;
}

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolCalls?: ToolCallView[];
  createdAt: string;
}

export interface ChatStreamState {
  phase: StreamPhase;
  status: string;
  threadId: string | null;
  threadTitle: string | null;
  messages: UiMessage[];
  error: string | null;
  /** True while a turn is in flight. */
  busy: boolean;
  /** Cumulative cost shown in the UI. */
  costUsd: number;
}

interface SendOptions {
  threadId?: string;
  initialMessages?: UiMessage[];
  onSaved?: (info: { id: string; title: string }) => void;
}

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function useChatStream() {
  const [state, setState] = useState<ChatStreamState>({
    phase: 'idle',
    status: '',
    threadId: null,
    threadTitle: null,
    messages: [],
    error: null,
    busy: false,
    costUsd: 0,
  });

  const abortRef = useRef<AbortController | null>(null);

  /** Reset the panel for a fresh chat. */
  const reset = useCallback((seed?: { threadId?: string; messages?: UiMessage[]; title?: string }) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({
      phase: 'idle',
      status: '',
      threadId: seed?.threadId ?? null,
      threadTitle: seed?.title ?? null,
      messages: seed?.messages ?? [],
      error: null,
      busy: false,
      costUsd: 0,
    });
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, busy: false, phase: 'idle', status: 'Cancelled' }));
  }, []);

  const send = useCallback(
    async (message: string, opts: SendOptions = {}) => {
      if (!message.trim()) return;
      const ac = new AbortController();
      abortRef.current = ac;

      // Optimistic local user message
      const userUiMsg: UiMessage = {
        id: newId(),
        role: 'user',
        text: message,
        createdAt: new Date().toISOString(),
      };
      // Seed the assistant bubble that will collect streaming text
      const assistantUiMsg: UiMessage = {
        id: newId(),
        role: 'assistant',
        text: '',
        toolCalls: [],
        createdAt: new Date().toISOString(),
      };

      setState((s) => ({
        ...s,
        threadId: opts.threadId ?? s.threadId,
        messages: [...(opts.initialMessages ?? s.messages), userUiMsg, assistantUiMsg],
        busy: true,
        phase: 'materializing',
        status: 'Preparing workspace...',
        error: null,
      }));

      let res: Response;
      try {
        res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId: opts.threadId, message }),
          signal: ac.signal,
        });
      } catch (e) {
        setState((s) => ({
          ...s,
          busy: false,
          phase: 'error',
          error: (e as Error).message,
        }));
        return;
      }

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        setState((s) => ({
          ...s,
          busy: false,
          phase: 'error',
          error: `Stream failed: ${res.status} ${text || res.statusText}`,
        }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processEvent = (eventName: string, data: any) => {
        switch (eventName) {
          case 'thread': {
            setState((s) => ({
              ...s,
              threadId: data.id,
              threadTitle: data.title,
            }));
            break;
          }
          case 'status': {
            setState((s) => ({
              ...s,
              phase: data.phase as StreamPhase,
              status: data.message,
            }));
            break;
          }
          case 'agent_init': {
            setState((s) => ({
              ...s,
              phase: 'thinking',
              status: 'Agent initialized',
            }));
            break;
          }
          case 'text': {
            setState((s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (last && last.role === 'assistant') {
                msgs[msgs.length - 1] = { ...last, text: last.text + (data.text || '') };
              }
              return { ...s, messages: msgs, phase: 'streaming', status: '' };
            });
            break;
          }
          case 'tool_call': {
            setState((s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (last && last.role === 'assistant') {
                const toolCalls = [
                  ...(last.toolCalls || []),
                  { id: data.id, name: data.name, input: data.input },
                ];
                msgs[msgs.length - 1] = { ...last, toolCalls };
              }
              return { ...s, messages: msgs, phase: 'thinking', status: `Calling ${data.name}...` };
            });
            break;
          }
          case 'tool_result': {
            setState((s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (last && last.role === 'assistant' && last.toolCalls) {
                const toolCalls = last.toolCalls.map((t) =>
                  t.id === data.tool_use_id
                    ? { ...t, result: data.text, isError: data.isError }
                    : t
                );
                msgs[msgs.length - 1] = { ...last, toolCalls };
              }
              return { ...s, messages: msgs };
            });
            break;
          }
          case 'result': {
            setState((s) => ({
              ...s,
              costUsd: s.costUsd + (data.costUsd || 0),
              status: data.isError ? 'Agent reported an error' : '',
            }));
            break;
          }
          case 'saved': {
            opts.onSaved?.({ id: data.id, title: data.title });
            setState((s) => ({ ...s, threadTitle: data.title }));
            break;
          }
          case 'error': {
            setState((s) => ({
              ...s,
              phase: 'error',
              error: data.message,
              busy: false,
            }));
            break;
          }
          case 'done': {
            setState((s) => ({
              ...s,
              phase: 'done',
              busy: false,
              status: '',
            }));
            break;
          }
        }
      };

      try {
        // Standard SSE parsing: events separated by blank lines; each event has
        // optional `event:` line + one or more `data:` lines.
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIdx;
          while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);

            let eventName = 'message';
            const dataLines: string[] = [];
            for (const line of rawEvent.split('\n')) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
            }
            if (dataLines.length === 0) continue;
            const dataStr = dataLines.join('\n');
            try {
              processEvent(eventName, JSON.parse(dataStr));
            } catch {
              // ignore malformed event
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setState((s) => ({
            ...s,
            phase: 'error',
            error: (e as Error).message,
            busy: false,
          }));
        }
      } finally {
        abortRef.current = null;
        setState((s) => (s.busy ? { ...s, busy: false, phase: 'done' } : s));
      }
    },
    []
  );

  return { state, send, cancel, reset };
}
