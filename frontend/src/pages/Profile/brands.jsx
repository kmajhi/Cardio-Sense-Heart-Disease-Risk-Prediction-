// Small monochrome glyphs for the services the profile links to. They use
// currentColor; each service's colour comes from CSS (.is-gmail, .is-x, ...).

const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
);

export const BRAND_ICONS = {
  gmail: (
    <Svg>
      <path fill="currentColor" d="M3 6.5A1.5 1.5 0 0 1 4.5 5h.3L12 10.4 19.2 5h.3A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H18V9.8l-6 4.5-6-4.5V19H4.5A1.5 1.5 0 0 1 3 17.5v-11Z" />
    </Svg>
  ),
  x: (
    <Svg>
      <path fill="currentColor" d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </Svg>
  ),
  facebook: (
    <Svg>
      <path fill="currentColor" d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4a20 20 0 0 0-2.2-.1c-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </Svg>
  ),
  linkedin: (
    <Svg>
      <path fill="currentColor" d="M4.5 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3 8.5h3V21H3V8.5Zm5 0h2.9v1.7h.1c.4-.8 1.4-1.9 3.2-1.9 3.1 0 3.8 2 3.8 4.7V21h-3v-7.2c0-1.7 0-3.3-2-3.3s-2.1 1.5-2.1 3.2V21H8V8.5Z" />
    </Svg>
  ),
  whatsapp: (
    <Svg>
      <path fill="currentColor" d="M12 3a9 9 0 0 0-7.8 13.4L3 21l4.7-1.2A9 9 0 1 0 12 3Zm0 16.4a7.4 7.4 0 0 1-3.8-1l-.3-.2-2.8.7.8-2.7-.2-.3A7.4 7.4 0 1 1 12 19.4Zm4-5.5c-.2-.1-1.3-.7-1.5-.7-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6 6 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.9 4.4 4.4 0 0 0 .9 2.3 10 10 0 0 0 3.9 3.4c1.4.6 2 .7 2.7.6.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1l-.5-.2Z" />
    </Svg>
  ),
  email: (
    <Svg>
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M3.5 6.5h17v11h-17zM4 7l8 6 8-6" />
    </Svg>
  ),
  copy: (
    <Svg>
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M8 8h11v12H8zM5 16V4h11" />
    </Svg>
  ),
  device: (
    <Svg>
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12L8 7m4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
    </Svg>
  ),
};
