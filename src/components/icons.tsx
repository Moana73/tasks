const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const ArrowUp = () => (
  <svg {...base} strokeWidth={2.4}>
    <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
  </svg>
);

export const Sparkle = () => (
  <svg {...base} strokeWidth={1.9}>
    <path d="M12 3.5c.5 3.9 2.6 6 6.5 6.5-3.9.5-6 2.6-6.5 6.5-.5-3.9-2.6-6-6.5-6.5 3.9-.5 6-2.6 6.5-6.5Z" />
    <path d="M18.5 15.5c.2 1.4.9 2.1 2.3 2.3-1.4.2-2.1.9-2.3 2.3-.2-1.4-.9-2.1-2.3-2.3 1.4-.2 2.1-.9 2.3-2.3Z" />
  </svg>
);

export const Trash = () => (
  <svg {...base}>
    <path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.2A2 2 0 0 0 9 21h6a2 2 0 0 0 2-1.8L18 7M9 7V4.5h6V7" />
  </svg>
);

export const Play = () => (
  <svg {...base}>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none" />
  </svg>
);

export const Check = () => (
  <svg {...base} strokeWidth={2.6}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const Back = () => (
  <svg {...base} strokeWidth={2.4}>
    <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

export const Logout = () => (
  <svg {...base}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
  </svg>
);

export const GoogleG = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export function StatusIcon({ status }: { status: 'todo' | 'doing' | 'done' }) {
  return (
    <span className="status" data-s={status} aria-hidden="true">
      <svg viewBox="0 0 26 26">
        {status !== 'done' && <circle className="ring" cx="13" cy="13" r="11" />}
        {status === 'doing' && <circle className="arc" cx="13" cy="13" r="11" />}
        {status !== 'done' && <circle className="preview" cx="13" cy="13" r="11" />}
        {status === 'done' && (
          <>
            <circle className="fill" cx="13" cy="13" r="12" />
            <path className="check" d="m8 13.4 3.4 3.3L18.2 9.6" />
          </>
        )}
      </svg>
    </span>
  );
}
