import type { Config } from 'tailwindcss';

// Mirrors the NeoSpark marketing site's tokens (astro-site/src/styles/global.css),
// so the chat reads as the same publication rather than a second product.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0a',
        'ink-2': '#171717',
        muted: '#5a5a57',
        'muted-2': '#737373',
        paper: '#fafafa',
        surface: '#ffffff',
        line: '#e8e8e6',
        'line-soft': '#f1f1ef',
        orange: '#ff793e',
        'orange-deep': '#f05a28',
        'orange-dark': '#e53229',
        purple: '#c98fe2',
        'purple-light': '#df9df4',
        'purple-dark': '#9e71c9',
        yellow: '#ffd939',
        'yellow-mid': '#eec60a',
        'yellow-dark': '#dda61b',
      },
      fontFamily: {
        sans: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xl: '20px',
        '2xl': '28px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,10,10,.04), 0 1px 3px rgba(10,10,10,.05)',
        lift: '0 4px 10px -2px rgba(10,10,10,.06), 0 18px 34px -14px rgba(10,10,10,.14)',
        panel: '0 1px 2px rgba(10,10,10,.03), 0 28px 56px -28px rgba(10,10,10,.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;
