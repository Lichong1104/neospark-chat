import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import MediaPreviewPanel from '../components/MediaPreviewPanel';
import PricingPage from './PricingPage';
import BalancePage from './BalancePage';
import SubscriptionPage from './SubscriptionPage';
import DocsPage from './DocsPage';
import UserPage from './UserPage';
import SkillsPage from './SkillsPage';
import ApiKeysPage from './ApiKeysPage';
import { MODELS, SKILLS } from '../data/skills';
import {
  absolutizeMarkdownLinks,
  absolutizeUrl,
  chatStream,
  deleteSession,
  getLatestMessage,
  getSessionMessages,
  getVideoTask,
  listModels,
  listSessions,
  listSkills,
  pinSession,
} from '../lib/api';
import type { Attachment, MediaBlock, Message, Session, ThinkingDepth, View } from '../types';
import { normalizeAssistantContent } from '../lib/media';
import { uid } from '../lib/utils';

function buildMessageWithAttachments(text: string, attachments: Attachment[]): string {
  const refs = attachments
    .map((a) => `- ${a.name}（upload_id: ${a.uploadId}，url: ${a.url}）`)
    .join('\n');
  return [text.trim(), 'Reference attachments:', refs].filter(Boolean).join('\n\n');
}

const DEFAULT_MODEL = 'anthropic:claude-opus-5';

/** Union of two media lists, keyed by URL, keeping the current order first. */
function mergeMedia(current: MediaBlock[] | undefined, extra: MediaBlock[]): MediaBlock[] | undefined {
  if (extra.length === 0) return current;
  const merged = [...(current ?? [])];
  const seen = new Set(merged.map((block) => block.url));
  for (const block of extra) {
    if (seen.has(block.url)) continue;
    seen.add(block.url);
    merged.push(block);
  }
  return merged.length ? merged : undefined;
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
  const [thinkingDepth, setThinkingDepth] = useState<ThinkingDepth>('medium');
  const [draft, setDraft] = useState('');
  const [pendingAuto, setPendingAuto] = useState<{ skill: string; message: string } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  // Bumped on every conversation change so the composer drops its attachments.
  const [composerKey, setComposerKey] = useState(0);
  // Asset shown in the right-hand preview panel; null keeps the chat full width.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);
  // Bumped whenever the conversation is abandoned. A late history reconciliation
  // must not write its result into a conversation the reader has moved on from.
  const conversationVersionRef = useRef(0);

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
        // A stored model may have been retired; never keep an unavailable id.
        setModel((prev) => (m.some((x) => x.id === prev) ? prev : m[0].id));
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
      setPreviewUrl(null);
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
    conversationVersionRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    setStreaming(false);
  }, []);

  const newChat = useCallback(() => {
    cancelStream();
    setPreviewUrl(null);
    setActiveId(null);
    setMessages([]);
    setSelectedSkills([]);
    setModel(DEFAULT_MODEL);
    setThinkingDepth('medium');
    setDraft('');
    setComposerKey((v) => v + 1);
    navigate('/');
  }, [cancelStream, navigate]);

  const selectSession = useCallback(
    async (id: string) => {
      cancelStream();
      setPreviewUrl(null);
      setActiveId(id);
      // Different conversation ⇒ the composer starts clean (no stale attachments).
      if (id !== activeId) setComposerKey((v) => v + 1);
      const s = sessions.find((x) => x.id === id);
      if (s) {
        setSelectedSkills(s.skillIds);
        // Sessions remember their model; retired ids (e.g. the old Gemini
        // alias) fall back to the default instead of being sent again.
        setModel(s.model && models.some((m) => m.id === s.model) ? s.model : DEFAULT_MODEL);
        setThinkingDepth(s.thinkingDepth ?? 'medium');
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
        setThinkingDepth('medium');
        setPreviewUrl(null);
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
      const version = conversationVersionRef.current;
      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setDraft('');
      streamingRef.current = true;
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let acc = '';
      const media: MediaBlock[] = [];
      const videoTaskIds: string[] = [];
      const patch = (extra: Partial<Message>) => {
        setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, ...extra } : m)));
      };

      // SSE media events are best-effort: a dropped event leaves the message with
      // text but no image, and the asset only lives in the saved blocks. Once the
      // turn is persisted, top up the local message from those blocks.
      const reconcileMedia = async (sessionId: string): Promise<MediaBlock[]> => {
        for (let attempt = 0; attempt < 4; attempt += 1) {
          if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
          if (version !== conversationVersionRef.current || controller.signal.aborted) return [];
          const last = await getLatestMessage(sessionId).catch(() => null);
          if (!last || last.role !== 'assistant') continue;
          if (version !== conversationVersionRef.current || controller.signal.aborted) return [];
          const persisted = last.media ?? [];
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== asstId) return m;
              const merged = mergeMedia(m.media, persisted);
              return {
                ...m,
                ...(m.content ? {} : { content: last.content }),
                ...(merged ? { media: merged } : {}),
              };
            }),
          );
          return persisted;
        }
        return [];
      };

      // A video Skill can hand back a task_id instead of a file (long renders
      // time out). The turn then ends with no video block, but the task keeps
      // running server-side — follow it and attach the finished video.
      const pollVideoTasks = async (taskIds: string[]) => {
        const pending = new Set(taskIds);
        const deadline = Date.now() + 6 * 60 * 1000;
        let delay = 4000;
        while (pending.size > 0 && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.5, 30000);
          if (version !== conversationVersionRef.current || controller.signal.aborted) return;
          for (const taskId of [...pending]) {
            const task = await getVideoTask(taskId).catch(() => null);
            if (!task) {
              // Not a generations task (e.g. watermark removal) — stop here.
              pending.delete(taskId);
              continue;
            }
            if (task.status === 'completed' && task.video_url) {
              const block: MediaBlock = {
                type: 'video',
                url: absolutizeUrl(String(task.video_url)),
                filename: `video-${taskId}.mp4`,
              };
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== asstId) return m;
                  const merged = mergeMedia(m.media, [block]);
                  return merged ? { ...m, media: merged } : m;
                }),
              );
              pending.delete(taskId);
            } else if (task.status === 'failed' || task.status === 'cancelled') {
              pending.delete(taskId);
            }
          }
        }
      };

      try {
        const sessionId = await chatStream(
          { skillIds, message: content, sessionId: activeId, model: model || undefined, thinkingDepth },
          {
            onText: (t) => {
              acc += t;
              patch({ content: acc, media: [...media] });
            },
            onMedia: (b) => {
              if (!media.some((m) => m.url === b.url)) media.push(b);
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
            onVideoTask: (task) => {
              if (!videoTaskIds.includes(task.task_id)) videoTaskIds.push(task.task_id);
            },
          },
          controller.signal,
        );

        patch({
          content: absolutizeMarkdownLinks(acc || 'The skill finished but returned no displayable content.'),
          media,
          streaming: false,
        });
        if (sessionId) {
          setActiveId(sessionId);
          refreshSessions();
          void (async () => {
            const persisted = await reconcileMedia(sessionId);
            // Poll only when the turn produced no video at all; otherwise the
            // task's file was already collected and polling would duplicate it.
            const hasVideo = [...media, ...persisted].some((block) => block.type === 'video');
            if (videoTaskIds.length > 0 && !hasVideo) void pollVideoTasks(videoTaskIds);
          })();
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
    [selectedSkills, model, thinkingDepth, activeId, refreshSessions],
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

  // Every previewable asset in the conversation, in message order. The panel
  // uses this list for its tabs; the clicked tile only picks the active one.
  const gallery = useMemo(() => {
    const seen = new Set<string>();
    const items: MediaBlock[] = [];
    for (const message of messages) {
      if (message.role !== 'assistant') continue;
      // Includes assets recovered from the message text, so preview tabs line
      // up with the tiles Message renders even when blocks were missing.
      const { media } = normalizeAssistantContent(message.content, message.media ?? []);
      for (const block of media) {
        if (block.type !== 'image' && block.type !== 'video') continue;
        if (!block.url || seen.has(block.url)) continue;
        seen.add(block.url);
        items.push(block);
      }
    }
    return items;
  }, [messages]);

  const openMediaPreview = useCallback((block: MediaBlock) => setPreviewUrl(block.url), []);

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
          onPreviewMedia={openMediaPreview}
          authenticated={!!user}
          onRequestLogin={openLogin}
          skills={selectableSkills}
          selectedSkills={selectedSkills}
          onToggleSkill={toggleSkill}
          models={models}
          model={model}
          onModelChange={setModel}
          thinkingDepth={thinkingDepth}
          onThinkingDepthChange={setThinkingDepth}
          composerKey={composerKey}
          onOpenNav={() => setMobileNavOpen(true)}
        />
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
      {view === 'chat' && previewUrl && gallery.length ? (
        <MediaPreviewPanel
          items={gallery}
          activeUrl={previewUrl}
          onSelect={setPreviewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      ) : null}
    </div>
  );
}
