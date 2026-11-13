import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import PreviewPanel from '../components/PreviewPanel';
import PricingPage from './PricingPage';
import BalancePage from './BalancePage';
import SubscriptionPage from './SubscriptionPage';
import DocsPage from './DocsPage';
import UserPage from './UserPage';
import SkillsPage from './SkillsPage';
import ApiKeysPage from './ApiKeysPage';
import { MODELS, SKILLS } from '../data/skills';
import { chatStream, deleteSession, getSessionMessages, getShareStatus, listModels, listSessions, listSkills, pinSession, setShareIndexing, shareSession, unshareSession } from '../lib/api';
import type { ShareStatus } from '../lib/api';
import type { Attachment, MediaBlock, Message, Session, View } from '../types';
import { uid } from '../lib/utils';

const DEFAULT_MODEL = 'anthropic:claude-opus-5';

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
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [draft, setDraft] = useState('');
  const [pendingAuto, setPendingAuto] = useState<{ skill: string; message: string } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  // Bumped on every conversation change so the composer drops its attachments.
  const [composerKey, setComposerKey] = useState(0);
  // Asset shown in the right-hand preview panel; null keeps the chat full width.
  const [preview, setPreview] = useState<MediaBlock | null>(null);
  // Public share state of the active conversation.
  const [shareInfo, setShareInfo] = useState<ShareStatus>({ shared: false, indexable: false });

  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);

  // Catalogue (anonymous). On failure keep the fallback snapshot. Also used by the
  // account menu after a skill is renamed / disabled / deleted so the composer's
  // skill picker stays in sync.
  const refreshSkills = useCallback(() => {
    listSkills()
      .then((list) => {
        if (!list.length) return;
        setSkills(list);
        // Disabled skills stay in the account menu but must drop out of the
        // composer: picking one would only fail at run time.
        const selectable = new Set(list.filter((s) => s.isActive !== false).map((s) => s.id));
        setSelectedSkills((prev) => prev.filter((id) => selectable.has(id)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshSkills();
    listModels()
      .then((m) => {
        if (!m.length) return;
        setModels(m);
        setModel((prev) =>
          m.some((x) => x.id === prev) ? prev : m.find((x) => x.id === DEFAULT_MODEL)?.id ?? m[0].id,
        );
      })
      .catch(() => {});
  }, [refreshSkills]);

  const refreshSessions = useCallback(() => {
    setLoadingSessions(true);
    listSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  // History needs auth; clear it when the visitor signs out.
  useEffect(() => {
    if (user) refreshSessions();
    else {
      setSessions([]);
      setMessages([]);
      setActiveId(null);
      setPreview(null);
      setShareInfo({ shared: false, indexable: false });
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
    setSelectedSkills([]);
    setPreview(null);
    setShareInfo({ shared: false, indexable: false });
    setDraft('');
    setComposerKey((v) => v + 1);
    navigate('/');
  }, [cancelStream, navigate]);

  const selectSession = useCallback(
    async (id: string) => {
      cancelStream();
      setPreview(null);
      setActiveId(id);
      setShareInfo({ shared: false, indexable: false });
      getShareStatus(id)
        .then(setShareInfo)
        .catch(() => {});
      // Different conversation ⇒ the composer starts clean (no stale attachments).
      if (id !== activeId) setComposerKey((v) => v + 1);
      const s = sessions.find((x) => x.id === id);
      if (s) {
        setSelectedSkills(s.skillIds);
        setModel(s.model && models.some((m) => m.id === s.model) ? s.model : DEFAULT_MODEL);
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
    [cancelStream, sessions, activeId, models],
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
        setPreview(null);
        setShareInfo({ shared: false, indexable: false });
        setComposerKey((v) => v + 1);
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

  const copyShareLink = useCallback(async (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Share link copied — anyone with the link can view this chat');
    } catch {
      // Clipboard API can be unavailable (http, permissions); let the user copy by hand.
      window.prompt('Copy this share link:', url);
    }
  }, []);

  const handleShareClick = useCallback(async () => {
    if (!activeId) {
      toast('Start a conversation first');
      return;
    }
    try {
      const info = await shareSession(activeId);
      setShareInfo(info);
      toast('Sharing enabled — anyone with the link can view this chat');
    } catch {
      toast('Failed to enable sharing');
    }
  }, [activeId]);

  const handleCopyLink = useCallback(async () => {
    if (shareInfo.shareToken) await copyShareLink(shareInfo.shareToken);
  }, [shareInfo.shareToken, copyShareLink]);

  const handleDisableShare = useCallback(async () => {
    if (!activeId) return;
    try {
      await unshareSession(activeId);
      setShareInfo({ shared: false, indexable: false });
      toast('Sharing disabled — the old link no longer works');
    } catch {
      toast('Failed to disable sharing');
    }
  }, [activeId]);

  const handleToggleIndexing = useCallback(
    async (indexable: boolean) => {
      if (!activeId) return;
      try {
        setShareInfo(await setShareIndexing(activeId, indexable));
      } catch {
        toast('Failed to update indexing setting');
      }
    },
    [activeId],
  );

  const sendMessage = useCallback(
    async (
      text: string,
      attachments: Attachment[] = [],
      skillIdsOverride?: string[],
      sessionIdOverride?: string | null,
      modelOverride?: string,
    ) => {
      const skillIds = skillIdsOverride ?? selectedSkills;
      const requestSessionId = sessionIdOverride === undefined ? activeId : sessionIdOverride;
      const requestModel = modelOverride ?? model;
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
          { skillIds, message: content, sessionId: requestSessionId, model: requestModel || undefined },
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
            onPlan: (steps) => {
              patch({ plan: steps, stepCompleted: 0, stepTotal: steps.length });
            },
            onStepDone: (info) => {
              patch({ stepCompleted: info.completed, stepTotal: info.total });
            },
          },
          controller.signal,
        );

        patch({ content: acc || 'The skill finished but returned no displayable content.', media, streaming: false });
        if (sessionId) {
          if (sessionId !== requestSessionId) setShareInfo({ shared: false, indexable: false });
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

  // A shared-page send forks first, then lands here with the new session and
  // the visitor's first message. Explicit overrides avoid using stale state
  // while the newly copied conversation is being opened.
  useEffect(() => {
    const intent = location.state as {
      openSessionId?: string;
      autoMessage?: string;
      skillIds?: string[];
      model?: string | null;
    } | null;
    if (!user || !intent?.openSessionId || !intent.autoMessage) return;

    const { openSessionId, autoMessage, skillIds = [], model: forkedModel } = intent;
    navigate('/', { replace: true, state: null });
    setSelectedSkills(skillIds);
    if (forkedModel) setModel(forkedModel);
    void selectSession(openSessionId).then(() =>
      sendMessage(autoMessage, [], skillIds, openSessionId, forkedModel ?? undefined),
    );
  }, [user, location.state, navigate, selectSession, sendMessage]);

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

  const view: View = (() => {
    const p = location.pathname;
    if (p.startsWith('/pricing')) return 'pricing';
    if (p.startsWith('/balance')) return 'balance';
    if (p.startsWith('/subscription')) return 'subscription';
    if (p.startsWith('/docs')) return 'docs';
    if (p.startsWith('/user')) return 'user';
    if (p.startsWith('/skills')) return 'skills';
    if (p.startsWith('/api-keys')) return 'api-keys';
    return 'chat';
  })();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // The drawer is an overlay; a route change should always dismiss it.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Route titles live here so each page does not have to remember to set one.
  useEffect(() => {
    const titles: Record<View, string> = {
      chat: 'NeoSpark — Chat',
      pricing: 'Pricing — NeoSpark',
      balance: 'Balance & usage — NeoSpark',
      subscription: 'Subscription — NeoSpark',
      docs: 'Docs — NeoSpark',
      user: 'Account — NeoSpark',
      skills: 'Skills — NeoSpark',
      'api-keys': 'API keys — NeoSpark',
    };
    document.title = titles[view];
  }, [view]);

  const go = useCallback(
    (v: View) => {
      navigate(v === 'chat' ? '/' : `/${v}`);
    },
    [navigate],
  );

  const activeTitle = activeId ? sessions.find((s) => s.id === activeId)?.title ?? '' : '';
  const selectableSkills = useMemo(() => skills.filter((s) => s.isActive !== false), [skills]);

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        loadingSessions={loadingSessions}
        onSelectSession={(id) => void selectSession(id)}
        onDeleteSession={(id) => handleDeleteSession(id)}
        onPinSession={(id, pinned) => void handlePinSession(id, pinned)}
        onNewChat={newChat}
        view={view}
        onNavigate={go}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      {view === 'chat' ? (
        <>
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
            onPreview={setPreview}
            authenticated={!!user}
            onRequestLogin={openLogin}
            skills={selectableSkills}
            selectedSkills={selectedSkills}
            onToggleSkill={toggleSkill}
            models={models}
            model={model}
            onModelChange={setModel}
            composerKey={composerKey}
            onOpenNav={() => setMobileNavOpen(true)}
            shareInfo={shareInfo}
            onShareClick={handleShareClick}
            onCopyLink={handleCopyLink}
            onDisableShare={handleDisableShare}
            onToggleIndexing={handleToggleIndexing}
          />
          {preview ? <PreviewPanel asset={preview} onClose={() => setPreview(null)} /> : null}
        </>
      ) : view === 'pricing' ? (
        <PricingPage onBack={() => go('chat')} onOpenNav={() => setMobileNavOpen(true)} />
      ) : view === 'balance' ? (
        <BalancePage onBack={() => go('chat')} onOpenNav={() => setMobileNavOpen(true)} />
      ) : view === 'subscription' ? (
        <SubscriptionPage onBack={() => go('chat')} onOpenNav={() => setMobileNavOpen(true)} />
      ) : view === 'docs' ? (
        <DocsPage onBack={() => go('chat')} onOpenNav={() => setMobileNavOpen(true)} />
      ) : view === 'user' ? (
        <UserPage onBack={() => go('chat')} onOpenNav={() => setMobileNavOpen(true)} />
      ) : view === 'skills' ? (
        <SkillsPage
          onBack={() => go('chat')}
          onOpenNav={() => setMobileNavOpen(true)}
          skills={skills}
          onSkillsChanged={refreshSkills}
        />
      ) : (
        <ApiKeysPage onBack={() => go('chat')} onOpenNav={() => setMobileNavOpen(true)} />
      )}
    </div>
  );
}
