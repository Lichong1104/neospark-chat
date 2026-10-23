import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import PricingPage from './PricingPage';
import BalancePage from './BalancePage';
import SubscriptionPage from './SubscriptionPage';
import { MODELS, SKILLS } from '../data/skills';
import { chatStream, deleteSession, getSessionMessages, listModels, listSessions, listSkills, pinSession } from '../lib/api';
import type { Attachment, MediaBlock, Message, Session } from '../types';
import { uid } from '../lib/utils';

function buildMessageWithAttachments(text: string, attachments: Attachment[]): string {
  const refs = attachments
    .map((a) => `- ${a.name}（upload_id: ${a.uploadId}，url: ${a.url}）`)
    .join('\n');
  return [text.trim(), 'Reference attachments:', refs].filter(Boolean).join('\n\n');
}

export default function ChatPage() {
  const { user, isLoading, openLogin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [skills, setSkills] = useState(SKILLS);
  const [models, setModels] = useState(MODELS);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [model, setModel] = useState('gemini:gemini-4-argon');
  const [draft, setDraft] = useState('');
  const [pendingAuto, setPendingAuto] = useState<{ skill: string; message: string } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);

  // Catalogue (anonymous). On failure keep the fallback snapshot.
  useEffect(() => {
    listSkills()
      .then((s) => s.length && setSkills(s))
      .catch(() => {});
    listModels()
      .then((m) => m.length && setModels(m))
      .catch(() => {});
  }, []);

  const refreshSessions = useCallback(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {});
  }, []);

  // History needs auth; clear it when the visitor signs out.
  useEffect(() => {
    if (user) refreshSessions();
    else {
      setSessions([]);
      setMessages([]);
      setActiveId(null);
    }
  }, [user, refreshSessions]);

  // Jump-in intent from the marketing site (?skill=<id>&message=<text>&auto=1).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const skillParam = params.get('skill');
    const messageParam = params.get('message');
    const auto = params.get('auto') === '1';
    if (messageParam) setDraft(messageParam);
    if (skillParam && SKILLS.some((s) => s.id === skillParam)) {
      setSelectedSkills((prev) => (prev.includes(skillParam) ? prev : [...prev, skillParam]));
    }
    if (auto && skillParam && messageParam) {
      setPendingAuto({ skill: skillParam, message: messageParam });
    }
    // Clear the query now, except for auto intents: those keep it so a
    // full-page Google OAuth redirect can carry the intent back.
    if ((skillParam || messageParam || auto) && !auto) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Entering the chat requires a login — otherwise pop the login dialog.
  useEffect(() => {
    if (!isLoading && !user) openLogin();
  }, [isLoading, user, openLogin]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    setStreaming(false);
  }, []);

  const newChat = useCallback(() => {
    cancelStream();
    setActiveId(null);
    setMessages([]);
    setDraft('');
    navigate('/');
  }, [cancelStream, navigate]);

  const selectSession = useCallback(
    async (id: string) => {
      cancelStream();
      setActiveId(id);
      const s = sessions.find((x) => x.id === id);
      if (s) {
        setSelectedSkills(s.skillIds);
        setModel(s.model ?? '');
      }
      setLoadingHistory(true);
      try {
        setMessages(await getSessionMessages(id));
      } catch {
        setMessages([]);
      } finally {
        setLoadingHistory(false);
      }
    },
    [cancelStream, sessions],
  );

  const toggleSkill = useCallback((id: string) => {
    setSelectedSkills((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id);
      } catch {
        // still remove locally even if the API call fails
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) {
        cancelStream();
        setActiveId(null);
        setMessages([]);
      }
      toast('Conversation deleted');
    },
    [activeId, cancelStream],
  );

  const handlePinSession = useCallback(async (id: string, pinned: boolean) => {
    // Optimistic update; revert on failure.
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, pinned } : s)));
    try {
      await pinSession(id, pinned);
    } catch {
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, pinned: !pinned } : s)));
      toast('Action failed');
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[] = [], skillIdsOverride?: string[]) => {
      const skillIds = skillIdsOverride ?? selectedSkills;
      const content = attachments.length > 0 ? buildMessageWithAttachments(text, attachments) : text.trim();
      if (!content || streamingRef.current) return;
      if (skillIds.length === 0) {
        toast('Select a skill first');
        return;
      }

      const userMsg: Message = { id: uid(), role: 'user', content, createdAt: Date.now() };
      const asstId = uid();
      const asstMsg: Message = { id: asstId, role: 'assistant', content: '', streaming: true, createdAt: Date.now() };
      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setDraft('');
      streamingRef.current = true;
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let acc = '';
      const media: MediaBlock[] = [];
      const patch = (extra: Partial<Message>) => {
        setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, ...extra } : m)));
      };

      try {
        const sessionId = await chatStream(
          { skillIds, message: content, sessionId: activeId, model: model || undefined },
          {
            onText: (t) => {
              acc += t;
              patch({ content: acc, media: [...media] });
            },
            onMedia: (b) => {
              media.push(b);
              patch({ content: acc, media: [...media] });
            },
            onDone: (payload) => {
              // Fall back to the assembled content only when nothing else arrived.
              if (payload.content && !acc && media.length === 0) acc = payload.content;
            },
            onError: (msg) => {
              if (!acc) acc = `Error: ${msg}`;
            },
            onConfirm: (prompt) => {
              patch({ confirm: prompt });
            },
          },
          controller.signal,
        );

        patch({ content: acc || 'The skill finished but returned no displayable content.', media, streaming: false });
        if (sessionId) {
          setActiveId(sessionId);
          refreshSessions();
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        const msg = (e as Error).message || 'Request failed';
        patch({ content: acc || `Error: ${msg}`, media, streaming: false });
        toast(msg);
      } finally {
        abortRef.current = null;
        streamingRef.current = false;
        setStreaming(false);
      }
    },
    [selectedSkills, model, activeId, refreshSessions],
  );

  // Auto-run the jump-in intent once signed in.
  useEffect(() => {
    if (!user || !pendingAuto) return;
    const { skill, message } = pendingAuto;
    setPendingAuto(null);
    setSelectedSkills((prev) => (prev.includes(skill) ? prev : [...prev, skill]));
    window.history.replaceState(null, '', window.location.pathname);
    void sendMessage(message, [], [skill]);
  }, [user, pendingAuto, sendMessage]);

  const contextLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedSkills.length) parts.push(`${selectedSkills.length} skills`);
    if (model) {
      const m = models.find((x) => x.id === model);
      if (m) parts.push(m.label);
    }
    return parts.join(' · ');
  }, [selectedSkills, model, models]);

  const handleConfirmSelect = useCallback(
    (option: string) => {
      void sendMessage(option);
    },
    [sendMessage],
  );

  const view: 'chat' | 'pricing' | 'balance' | 'subscription' = (() => {
    const p = location.pathname;
    if (p.startsWith('/pricing')) return 'pricing';
    if (p.startsWith('/balance')) return 'balance';
    if (p.startsWith('/subscription')) return 'subscription';
    return 'chat';
  })();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const go = useCallback(
    (v: 'chat' | 'pricing' | 'balance' | 'subscription') => {
      navigate(v === 'chat' ? '/' : `/${v}`);
    },
    [navigate],
  );

  const activeTitle = activeId ? sessions.find((s) => s.id === activeId)?.title ?? '' : '';

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelectSession={(id) => void selectSession(id)}
        onDeleteSession={(id) => void handleDeleteSession(id)}
        onPinSession={(id, pinned) => void handlePinSession(id, pinned)}
        onNewChat={newChat}
        view={view}
        onNavigate={go}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
      />
      {view === 'chat' ? (
        <ChatArea
          title={activeTitle}
          contextLabel={contextLabel}
          messages={messages}
          streaming={streaming}
          loadingHistory={loadingHistory}
          draft={draft}
          onDraftChange={setDraft}
          onSend={(t, a) => void sendMessage(t, a)}
          onConfirmSelect={handleConfirmSelect}
          authenticated={!!user}
          onRequestLogin={openLogin}
          skills={skills}
          selectedSkills={selectedSkills}
          onToggleSkill={toggleSkill}
          models={models}
          model={model}
          onModelChange={setModel}
        />
      ) : view === 'pricing' ? (
        <PricingPage onBack={() => go('chat')} />
      ) : view === 'balance' ? (
        <BalancePage onBack={() => go('chat')} />
      ) : (
        <SubscriptionPage onBack={() => go('chat')} />
      )}
    </div>
  );
}
