import { PRESETS } from './presets.ts'

/** Inline blocking script injected into index.html to apply saved theme before first paint. */
export function buildThemeBootScript(): string {
  const presetsJson = JSON.stringify(
    PRESETS.map((p) => ({
      id: p.id,
      isDark: p.isDark,
      defaultAccentId: p.defaultAccentId,
      colors: p.colors,
      accentSwatches: p.accentSwatches,
    })),
  )

  return `(function(){try{
var k='oweb-theme',d=${presetsJson},def={presetId:'dark-gold',accentId:'gold'};
var raw=localStorage.getItem(k),cfg=raw?JSON.parse(raw):def;
if(!cfg||typeof cfg.presetId!=='string')cfg=def;
var preset=d.find(function(p){return p.id===cfg.presetId})||d[0];
var accent=preset.accentSwatches.find(function(s){return s.id===cfg.accentId})
  ||preset.accentSwatches.find(function(s){return s.id===preset.defaultAccentId})
  ||preset.accentSwatches[0];
var el=document.documentElement,r=el.style;
Object.keys(preset.colors).forEach(function(key){r.setProperty('--color-'+key,preset.colors[key]);});
var elevated=preset.colors.elevated,tp=preset.colors['text-primary'],root=preset.colors.root;
r.setProperty('--color-hover','color-mix(in srgb, '+tp+' 6%, '+elevated+')');
r.setProperty('--color-on-accent',root);
r.setProperty('--color-accent',accent.accent);
r.setProperty('--color-accent-dim',accent.accentDim);
r.setProperty('--color-accent-bright',accent.accentBright);
var h=accent.accent.replace('#',''),n=parseInt(h,16),rgb=((n>>16)&255)+', '+((n>>8)&255)+', '+(n&255);
var dark=preset.isDark,a=dark?0.12:0.1,b=dark?0.25:0.18;
r.setProperty('--color-border-subtle','rgba('+rgb+', '+a+')');
r.setProperty('--color-border-medium','rgba('+rgb+', '+b+')');
r.setProperty('--glass-bg',dark?'rgba(20,20,20,0.8)':'rgba(255,255,255,0.8)');
r.setProperty('--glass-bg-heavy',dark?'rgba(20,20,20,0.95)':'rgba(255,255,255,0.95)');
r.setProperty('--glass-border','rgba('+rgb+', '+(dark?0.1:0.08)+')');
r.setProperty('--glass-border-heavy','rgba('+rgb+', '+(dark?0.15:0.12)+')');
r.setProperty('--scrollbar-thumb','rgba('+rgb+', 0.2)');
r.setProperty('--scrollbar-thumb-hover','rgba('+rgb+', 0.35)');
r.setProperty('--glow-accent','rgba('+rgb+', 0.15)');
r.setProperty('--glow-accent-strong','rgba('+rgb+', 0.4)');
r.setProperty('--glow-accent-pulse','rgba('+rgb+', 0.6)');
r.setProperty('--color-edge','rgba('+rgb+', 0.3)');
r.setProperty('--color-edge-dim','rgba('+rgb+', 0.08)');
r.setProperty('--color-accent-overlay-bg','rgba('+rgb+', 0.05)');
r.setProperty('--color-accent-overlay-border','rgba('+rgb+', 0.25)');
r.setProperty('--kbd-bg','rgba('+rgb+', 0.1)');
var sem=dark?{success:'#34d399',danger:'#f87171',warning:'#fbbf24',info:'#60a5fa'}:{success:'#059669',danger:'#dc2626',warning:'#d97706',info:'#2563eb'};
Object.keys(sem).forEach(function(key){r.setProperty('--color-'+key,sem[key]);});
el.setAttribute('data-theme',dark?'dark':'light');
}catch(e){}})();`
}
