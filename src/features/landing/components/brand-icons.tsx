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

// Canada flag — path data from lipis/flag-icons (CC0, flags/4x3/ca.svg).
export function CanadaFlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      aria-hidden
      {...props}
    >
      <path fill="#fff" d="M150.1 0h339.7v480H150z" />
      <path
        fill="#d52b1e"
        d="M-19.7 0h169.8v480H-19.7zm509.5 0h169.8v480H489.9zM201 232l-13.3 4.4 61.4 54c4.7 13.7-1.6 17.8-5.6 25l66.6-8.4-1.6 67 13.9-.3-3.1-66.6 66.7 8c-4.1-8.7-7.8-13.3-4-27.2l61.3-51-10.7-4c-8.8-6.8 3.8-32.6 5.6-48.9 0 0-35.7 12.3-38 5.8l-9.2-17.5-32.6 35.8c-3.5.9-5-.5-5.9-3.5l15-74.8-23.8 13.4q-3.2 1.3-5.2-2.2l-23-46-23.6 47.8q-2.8 2.5-5 .7L264 130.8l13.7 74.1c-1.1 3-3.7 3.8-6.7 2.2l-31.2-35.3c-4 6.5-6.8 17.1-12.2 19.5s-23.5-4.5-35.6-7c4.2 14.8 17 39.6 9 47.7"
      />
    </svg>
  );
}
