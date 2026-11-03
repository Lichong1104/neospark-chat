import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import PageShell from '../components/PageShell';
import { cn } from '../lib/utils';
import skillSpecMd from '../docs/skill-spec.md?raw';
import imageApiMd from '../docs/image-api.md?raw';
import videoApiMd from '../docs/video-api.md?raw';
import klingApiMd from '../docs/video-api-kling.md?raw';

interface DocEntry {
  id: string;
  title: string;
  description: string;
  body: string;
}

const DOCS: DocEntry[] = [
  {
    id: 'skill-spec',
    title: 'Skill Specification',
    description: 'Package format, SKILL.md manifest and execution contract for NeoSpark Skills (from the homepage skill-spec).',
    body: skillSpecMd,
  },
  {
    id: 'image-api',
    title: 'Image Generation API',
    description: 'NeoSpark image generation endpoints: sessions, text-to-image, image-to-image with references, billing and storyboard batch generation.',
    body: imageApiMd,
  },
  {
    id: 'video-api',
    title: 'NeoSpark Video Generation API',
    description: 'Integrate NeoSpark video generation with an API key: authentication, task flow, model pricing and asset APIs.',
    body: videoApiMd,
  },
  {
    id: 'video-kling',
    title: 'Video Generation Integration (Kling)',
    description: 'Kling 3.0 / 3.0-omni video generation endpoints: create tasks, poll status, list tasks and supported models.',
    body: klingApiMd,
  },
];

export default function DocsPage({ onBack, onOpenNav }: { onBack: () => void; onOpenNav: () => void }) {
  const [activeId, setActiveId] = useState(DOCS[0].id);
  const active = DOCS.find((d) => d.id === activeId) ?? DOCS[0];

  // The docs double as LLM context: hand the raw markdown to the assistant.
  const copyDoc = async () => {
    try {
      await navigator.clipboard.writeText(active.body);
      toast(`"${active.title}" copied — paste it into your AI assistant as context.`);
    } catch {
      toast('Copy failed — select the text and copy it manually.');
    }
  };

  const downloadDoc = () => {
    const blob = new Blob([active.body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${active.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Downloading ${a.download}`);
  };

  return (
    <PageShell title="Docs" onBack={onBack} onOpenNav={onOpenNav} width="wide">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Document list */}
        <nav aria-label="Documents" className="flex flex-col gap-1 lg:w-64 lg:flex-none lg:sticky lg:top-0">
          <p className="mb-1 hidden px-3 text-micro font-bold uppercase tracking-[0.14em] text-muted-2 lg:block">
            Documentation
          </p>
          {DOCS.map((doc) => {
            const isActive = doc.id === active.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setActiveId(doc.id)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'rounded-xl px-3 py-2.5 text-left transition-colors',
                  isActive ? 'bg-ink text-surface shadow-card' : 'hover:bg-paper',
                )}
              >
                <span className="flex items-center gap-2">
                  <BookOpen className={cn('h-3.5 w-3.5 flex-none', isActive ? 'text-surface/70' : 'text-muted-2')} />
                  <span className="truncate text-sm font-semibold">{doc.title}</span>
                </span>
                <span
                  className={cn(
                    'mt-1 block text-xs leading-relaxed',
                    isActive ? 'text-surface/70' : 'text-muted-2',
                  )}
                >
                  {doc.description}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Document body */}
        <article className="min-w-0 flex-1 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-4">
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight">{active.title}</h1>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-2">
                Copy or download the raw Markdown and paste it into your AI assistant as working context.
              </p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <button
                type="button"
                onClick={() => void copyDoc()}
                className="flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-ink hover:text-ink"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
              <button
                type="button"
                onClick={downloadDoc}
                className="flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-ink hover:text-ink"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>
          </div>
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node: _node, ...props }) => (
                  <div className="markdown-table-wrap">
                    <table {...props} />
                  </div>
                ),
              }}
            >
              {active.body}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </PageShell>
  );
}
