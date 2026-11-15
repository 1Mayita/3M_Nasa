// Iconos dibujados en SVG, un solo trazo (1.75) y esquinas redondeadas.
const BASE = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false };

export function IconPlay() {
  return (<svg {...BASE}><path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none" /></svg>);
}
export function IconPause() {
  return (<svg {...BASE}><rect x="6.5" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="13.7" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none" /></svg>);
}
export function IconClose() {
  return (<svg {...BASE}><path d="M6 6l12 12M18 6L6 18" /></svg>);
}
export function IconDownload() {
  return (<svg {...BASE}><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" /></svg>);
}
export function IconSheet() {
  return (<svg {...BASE}><rect x="4" y="4.5" width="16" height="15" rx="2" /><path d="M4 10h16M4 14.5h16M10 10v9.5" /></svg>);
}
export function IconOrbit() {
  return (<svg {...BASE}><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20.5 4.5v4h-4" /></svg>);
}
export function IconSearch() {
  return (<svg {...BASE}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>);
}
export function IconSun() {
  return (<svg {...BASE}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></svg>);
}
export function IconMoon() {
  return (<svg {...BASE}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>);
}
export function IconFlame() {
  return (<svg {...BASE}><path d="M12 3c.5 3-1.8 4.6-3.2 6.5C7.5 11.200 7 12.600 7 14a5 5 0 0 0 10 0c0-1.800-.8-3.200-1.800-4.400-.4 1-1.100 1.600-1.800 1.800.3-3-.4-6.200-1.400-8.400z" /></svg>);
}
export function IconPeak() {
  return (<svg {...BASE}><path d="M3 19l6-10 3.500 5.500L15 11l6 8z" /></svg>);
}

export function IconArrow() {
  return (<svg {...BASE}><path d="M5 12h14m0 0l-5.5-5.5M19 12l-5.5 5.5" /></svg>);
}
export function IconCalendar() {
  return (<svg {...BASE}><rect x="4" y="5.5" width="16" height="14" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>);
}
export function IconInfo() {
  return (<svg {...BASE}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.01" /></svg>);
}
export function IconPlus() {
  return (<svg {...BASE}><path d="M12 5v14M5 12h14" /></svg>);
}
export function IconMinus() {
  return (<svg {...BASE}><path d="M5 12h14" /></svg>);
}
export function IconReset() {
  return (<svg {...BASE}><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4.5v4.5h4.5" /></svg>);
}
export function IconTilt() {
  return (<svg {...BASE}><path d="M3 15.5l9-4.5 9 4.5-9 4.5z" /><path d="M3 11.5l9-4.5 9 4.5" /></svg>);
}
export function IconShare() {
  return (<svg {...BASE}><path d="M10 14l4-4M8.5 15.5l-1.5 1.5a3 3 0 0 1-4.2-4.2L5 10.6M15.5 8.5l1.5-1.5a3 3 0 0 1 4.2 4.2L19 13.4" /></svg>);
}
export function IconPrint() {
  return (<svg {...BASE}><path d="M7 9V4.5h10V9M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2" /><rect x="7" y="14" width="10" height="6" rx="1" /></svg>);
}
export function IconExpand() {
  return (<svg {...BASE}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>);
}
