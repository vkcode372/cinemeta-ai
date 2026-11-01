'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { apiRequest, ApiRequestError, createId, type ChatMessage } from '@/lib/api';

interface PersistedChat { conversationId: string; messages: ChatMessage[] }
const welcome: ChatMessage = { id: 'welcome', role: 'assistant', content: 'Hey there. I’m CineMate, your movie-wise sidekick. I can help you find a film, check your bookings, or look up a payment. What are you in the mood for?', createdAt: new Date(0).toISOString() };

function loadSavedChat(storageKey: string): PersistedChat {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw) as PersistedChat;
      if (saved.conversationId && Array.isArray(saved.messages) && saved.messages.length) return saved;
    }
  } catch { /* Start a fresh conversation if local storage is unreadable. */ }
  return { conversationId: createId(), messages: [welcome] };
}

export default function AssistantPage() {
  const [chat, setChat] = useState<PersistedChat>({ conversationId: '', messages: [welcome] });
  const [hydrated, setHydrated] = useState(false);
  const [storageKey, setStorageKey] = useState('');
  const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [status, setStatus] = useState(''); const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void apiRequest<{ id: string }>('/api/auth/me').then(({ id }) => {
      const accountKey = `cinemate-chat-v1:${id}`;
      setStorageKey(accountKey);
      setChat(loadSavedChat(accountKey));
      setHydrated(true);
    }).catch((reason: unknown) => {
      setError(reason instanceof ApiRequestError && reason.status === 401
        ? 'Your sign-in has expired. Sign in again to continue.'
        : reason instanceof Error ? reason.message : 'Sign in to start a conversation.');
      setErrorStatus(reason instanceof ApiRequestError ? reason.status : null);
      setChat({ conversationId: createId(), messages: [welcome] });
      setHydrated(true);
    });
  }, []);
  useEffect(() => { if (hydrated && storageKey && chat.conversationId) localStorage.setItem(storageKey, JSON.stringify(chat)); }, [chat, hydrated, storageKey]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [chat.messages, busy, status]);

  async function sendMessage(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || busy || !chat.conversationId) return;
    const userMessage: ChatMessage = { id: createId(), role: 'user', content: message, createdAt: new Date().toISOString() };
    setChat((current) => ({ ...current, messages: [...current.messages, userMessage] })); setDraft(''); setBusy(true); setError(''); setErrorStatus(null); setStatus('CineMate is thinking');
    const statusTimer = window.setTimeout(() => setStatus('Checking your cinema details'), 700);
    try {
      const response = await apiRequest<{ conversationId: string; text: string; toolCalls: Array<{ name: string; status: 'completed' }>; toolErrors: Array<{ name: string; message: string }> }>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ conversationId: chat.conversationId, message }) });
      const assistantMessage: ChatMessage = {
        id: createId(), role: 'assistant', content: response.text || 'I could not find a response for that. Try asking another way.', createdAt: new Date().toISOString(),
        tools: [...response.toolCalls.map((tool) => ({ name: tool.name, status: 'completed' as const })), ...response.toolErrors.map((tool) => ({ name: tool.name, status: 'error' as const }))],
      };
      setChat((current) => ({ ...current, messages: [...current.messages, assistantMessage] }));
      setStatus('');
    } catch (reason) {
      const messageText = reason instanceof ApiRequestError && reason.status === 401
        ? 'Your sign-in has expired. Sign in again to continue.'
        : reason instanceof Error ? reason.message : 'The assistant could not respond. Please try again.';
      setError(messageText); setErrorStatus(reason instanceof ApiRequestError ? reason.status : null); setStatus('');
      if (!(reason instanceof ApiRequestError && reason.status === 401)) setDraft(message);
      setChat((current) => ({ ...current, messages: [...current.messages, { id: createId(), role: 'assistant', content: `I hit a snag: ${messageText}`, createdAt: new Date().toISOString() }] }));
    } finally { window.clearTimeout(statusTimer); setBusy(false); }
  }

  function newConversation() { setChat({ conversationId: createId(), messages: [welcome] }); setError(''); setErrorStatus(null); }

  return <main className="page-shell chat-page"><div className="chat-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>YOUR PERSONAL MOVIE GUIDE</div><h1>Ask CineMate<span>.</span></h1><p>Movie picks, booking help, and everything in between.</p></div><button className="button button-outline new-chat-button" onClick={newConversation}>＋ New chat</button></div>
    <section className="chat-shell"><aside className="chat-sidebar"><div className="assistant-avatar"><Icon name="spark" size={27}/></div><h2>Your movie-wise<br/>sidekick.</h2><p>Ask me to find a movie, check your booking, or look into a payment.</p><div className="sidebar-rule"/><span className="sidebar-label">TRY ASKING</span><button className="prompt-chip" onClick={() => setDraft('Search Avatar')}>Find something like Avatar <span>↗</span></button><button className="prompt-chip" onClick={() => setDraft('Show my bookings')}>Show my bookings <span>↗</span></button><button className="prompt-chip" onClick={() => setDraft('What is the payment status of my latest booking?')}>Check my latest payment <span>↗</span></button><div className="sidebar-secure"><span className="secure-dot"/> PRIVATE TO YOUR ACCOUNT</div></aside>
      <div className="chat-main"><div className="chat-topbar"><div className="chat-agent-id"><span className="online-indicator"/><div><strong>CineMate AI</strong><small>YOUR CINEMA COMPANION</small></div></div><button className="icon-button" title="Start a new chat" onClick={newConversation}><Icon name="close" size={17}/></button></div>
        <div className="chat-messages" ref={scrollRef}>{chat.messages.map((message) => <div className={`message-row ${message.role}`} key={message.id}>{message.role === 'assistant' && <span className="message-avatar"><Icon name="spark" size={14}/></span>}<article className="message-bubble"><div className="message-content">{message.role === 'assistant' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown> : message.content}</div>{message.tools?.length ? <div className="tool-status-list">{message.tools.map((tool, index) => <span className={tool.status === 'error' ? 'tool-status tool-error' : 'tool-status'} key={`${tool.name}-${index}`}><span className="tool-status-dot"/>{tool.status === 'completed' ? `${tool.name} completed` : `${tool.name} had an issue`}</span>)}</div> : null}<time>{message.role === 'assistant' && message.id === 'welcome' ? 'READY WHEN YOU ARE' : new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></article></div>)}{busy && <div className="message-row assistant"><span className="message-avatar"><Icon name="spark" size={14}/></span><article className="message-bubble typing-bubble"><span className="typing-dots"><i/><i/><i/></span><span>{status}</span></article></div>}</div>
        {error && <div className="chat-error" role="alert"><span>{error}</span>{errorStatus === 401 ? <Link href="/login">Sign in</Link> : <button type="button" onClick={() => void sendMessage()}>Try again</button>}</div>}
        <form className="chat-compose" onSubmit={sendMessage}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Ask about movies, bookings, or payments..." rows={1} aria-label="Message CineMate" disabled={busy}/><button className="send-button" aria-label="Send message" disabled={busy || !draft.trim()}><Icon name="send" size={18}/></button><div className="compose-hint">CINEMATE CAN MAKE MISTAKES. CHECK IMPORTANT DETAILS.</div></form>
      </div></section>
  </main>;
}
