import type { SVGProps } from 'react';

// Inline brand SVGs — the installed lucide-react build omits Facebook,
// Instagram, TikTok and WhatsApp glyphs, so we ship small path copies here.
// Each accepts standard SVG props and inherits `currentColor`.

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.87.24-1.46 1.49-1.46H16.5V4.46A20 20 0 0 0 14.37 4.3c-2.1 0-3.54 1.28-3.54 3.64v2.56H8.3v3h2.53V21z" />
    </svg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.75" />
      <circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M19.6 7.1a5.4 5.4 0 0 1-3.6-1.4 5.4 5.4 0 0 1-1.6-3.2h-3V15a2.5 2.5 0 1 1-2.5-2.5c.26 0 .5.04.74.11V9.5a5.6 5.6 0 1 0 4.76 5.5V9.08a8.3 8.3 0 0 0 5.2 1.8z" />
    </svg>
  );
}

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.3 4.7 4.84-1.27A9.9 9.9 0 1 0 12.04 2m0 1.8a8.1 8.1 0 1 1-4.14 15.07l-.3-.17-2.87.75.77-2.8-.19-.3A8.1 8.1 0 0 1 12.04 3.8m-4.5 4.3c-.21 0-.55.08-.84.4-.29.31-1.1 1.08-1.1 2.64 0 1.56 1.13 3.07 1.29 3.28.16.21 2.19 3.5 5.42 4.76 2.68 1.04 3.23.84 3.81.78.58-.05 1.86-.76 2.13-1.5.26-.73.26-1.35.19-1.48-.08-.14-.3-.21-.63-.37s-1.86-.92-2.15-1.03c-.29-.1-.5-.16-.72.16s-.82 1.03-1 1.24c-.19.21-.37.24-.68.08a8.5 8.5 0 0 1-2.52-1.56 9.5 9.5 0 0 1-1.74-2.17c-.19-.32-.02-.5.14-.66.14-.14.32-.37.47-.56.16-.19.21-.32.32-.53.1-.21.05-.4-.03-.56-.08-.16-.72-1.73-.99-2.37-.26-.62-.52-.54-.72-.55h-.65" />
    </svg>
  );
}

export function CanadaFlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 16" aria-hidden {...props}>
      <rect width="6" height="16" fill="#d80027" />
      <rect x="18" width="6" height="16" fill="#d80027" />
      <rect x="6" width="12" height="16" fill="#fff" />
      <path
        d="M12 3.2l-.5 1.2-1.2-.3.4 1.2-1.1.7 1.1.6-.3.9h1.1l-.2 1.4h.3l-.2-1.4h1.1l-.3-.9 1.1-.6-1.1-.7.4-1.2-1.2.3z"
        fill="#d80027"
      />
    </svg>
  );
}
