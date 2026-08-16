/**
 * Design Templates — génération automatique de 60+ modèles par catégorie
 * Architecture : layout fonctions × thèmes = templates visuels uniques
 */
import { DesignObject } from './design-editor.component';

// ═══════════════════════════════════════════════════════
// THÈMES (10 thèmes × 3 catégories = variations automatiques)
// ═══════════════════════════════════════════════════════

export interface DesignTheme {
  id: string; name: string;
  bg: string; bg2: string; accent: string; accent2: string;
  txt: string; muted: string; txtDim: string;
  isDark: boolean;
}

export const DESIGN_THEMES: DesignTheme[] = [
  { id:'dk-v',  name:'Violet nuit',   bg:'#0f172a', bg2:'#1e1b4b', accent:'#6366f1', accent2:'#a855f7', txt:'#ffffff', muted:'rgba(255,255,255,.42)', txtDim:'rgba(255,255,255,.22)', isDark:true  },
  { id:'dk-b',  name:'Marine',        bg:'#0c1445', bg2:'#1e3a8a', accent:'#3b82f6', accent2:'#60a5fa', txt:'#ffffff', muted:'rgba(255,255,255,.42)', txtDim:'rgba(255,255,255,.22)', isDark:true  },
  { id:'dk-g',  name:'Forêt',         bg:'#052e16', bg2:'#064e3b', accent:'#10b981', accent2:'#34d399', txt:'#ffffff', muted:'rgba(255,255,255,.42)', txtDim:'rgba(255,255,255,.22)', isDark:true  },
  { id:'dk-o',  name:'Or foncé',      bg:'#1c1008', bg2:'#292109', accent:'#f59e0b', accent2:'#fbbf24', txt:'#fef3c7', muted:'rgba(254,243,199,.45)', txtDim:'rgba(254,243,199,.22)', isDark:true  },
  { id:'dk-r',  name:'Rouge nuit',    bg:'#1a0000', bg2:'#300000', accent:'#ef4444', accent2:'#f87171', txt:'#ffffff', muted:'rgba(255,255,255,.42)', txtDim:'rgba(255,255,255,.22)', isDark:true  },
  { id:'dk-t',  name:'Teal nuit',     bg:'#022c22', bg2:'#064e3b', accent:'#0d9488', accent2:'#2dd4bf', txt:'#ffffff', muted:'rgba(255,255,255,.42)', txtDim:'rgba(255,255,255,.22)', isDark:true  },
  { id:'lt-v',  name:'Blanc/Violet',  bg:'#ffffff', bg2:'#f5f3ff', accent:'#6366f1', accent2:'#a5b4fc', txt:'#0f172a', muted:'#64748b', txtDim:'#94a3b8', isDark:false },
  { id:'lt-b',  name:'Blanc/Bleu',    bg:'#ffffff', bg2:'#eff6ff', accent:'#1d4ed8', accent2:'#60a5fa', txt:'#1e293b', muted:'#64748b', txtDim:'#94a3b8', isDark:false },
  { id:'lt-g',  name:'Blanc/Vert',    bg:'#f0fdf4', bg2:'#dcfce7', accent:'#16a34a', accent2:'#4ade80', txt:'#14532d', muted:'#64748b', txtDim:'#94a3b8', isDark:false },
  { id:'lt-p',  name:'Blanc/Rose',    bg:'#fff0f6', bg2:'#fce7f3', accent:'#ec4899', accent2:'#f9a8d4', txt:'#500724', muted:'#9d8fa3', txtDim:'#c4b5c0', isDark:false },
];

// ═══════════════════════════════════════════════════════
// HELPERS — création compacte de DesignObject
// ═══════════════════════════════════════════════════════

let _uid = 1000;
const uid = (pfx='el') => `${pfx}-${_uid++}`;

const R = (x:number,y:number,w:number,h:number,fill:string,z:number,rx=0): DesignObject =>
  ({id:uid('r'),type:'rect',x,y,w,h,fill,stroke:'none',sw:0,opacity:100,text:'',fontSize:14,fontColor:'#fff',textAlign:'left',zIndex:z,isLine:false,borderRadius:rx});

const TB = (x:number,y:number,w:number,h:number,html:string,size:number,color:string,z:number,bold=false,font='Inter,sans-serif',align:'left'|'center'|'right'='left'): DesignObject =>
  ({id:uid('tb'),type:'textbox',x,y,w,h,fill:'none',stroke:'none',sw:0,opacity:100,text:'',fontSize:size,fontColor:color,textAlign:align,zIndex:z,isLine:false,isTextBox:true,content:html,fontFamily:font,bold,paddingPx:4});

const TBC = (x:number,y:number,w:number,h:number,html:string,size:number,color:string,z:number,bold=false) =>
  TB(x,y,w,h,html,size,color,z,bold,'Inter,sans-serif','center');

const L = (x:number,y:number,w:number,color:string,z:number): DesignObject =>
  ({id:uid('l'),type:'line',x,y,w,h:1,fill:'none',stroke:color,sw:1,opacity:100,text:'',fontSize:14,fontColor:'#fff',textAlign:'left',zIndex:z,isLine:true});

const PILL = (x:number,y:number,w:number,h:number,fill:string,text:string,textColor:string,z:number): DesignObject =>
  ({id:uid('p'),type:'rect-rounded',x,y,w,h,fill,stroke:'none',sw:0,opacity:100,text,fontSize:9,fontColor:textColor,textAlign:'center',zIndex:z,isLine:false,borderRadius:20});

// ═══════════════════════════════════════════════════════
// BADGE LAYOUTS (6 layouts × 10 thèmes = 60 badges)
// ═══════════════════════════════════════════════════════

export interface DesignTemplate {
  id: string; name: string; category: 'badge'|'carte'|'logo';
  w: number; h: number; bgColor: string; theme: DesignTheme;
  objects: DesignObject[];
}

type BadgeLayout = { id:string; name:string; fn:(t:DesignTheme,W:number,H:number)=>DesignObject[] };

const BADGE_LAYOUTS: BadgeLayout[] = [
  {
    id: 'stripe',
    name: 'Bande latérale',
    fn: (t,W,H) => [
      R(0,0,W,H,t.bg,0),
      R(0,0,6,H,t.accent,1),
      R(0,0,W,2,t.accent,2),
      TB(22,34,W-80,36,'<b>Prénom NOM</b>',22,t.txt,3,true),
      TB(22,62,W-50,24,'Rôle / Titre du poste',13,t.accent,4),
      L(22,88,W-44,t.muted,5),
      TB(22,96,W-50,22,'Organisation · Événement',11,t.muted,6),
      TB(22,H-28,120,20,'BADGE-001',9,t.txtDim,7,false,'Courier New,monospace'),
      TB(W-85,H-28,80,20,'Creative AI Studio',8,t.txtDim,8),
    ]
  },
  {
    id: 'header',
    name: 'En-tête colorée',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?'#ffffff':'#0f172a',0),
      R(0,0,W,62,t.bg,0),
      R(0,0,W,62,t.accent,1),
      TB(16,8,W-40,22,'<b>Prénom NOM</b>',18,t.isDark?t.bg:'#fff',2,true),
      TB(16,34,W-40,20,'Rôle / Titre',12,t.isDark?t.bg:'rgba(255,255,255,.8)',3),
      TB(16,74,W-40,22,'Organisation',12,t.isDark?'#374151':'#e2e8f0',4),
      L(16,100,W-32,t.isDark?'#e2e8f0':'#334155',5),
      TB(16,108,W/2-20,20,'✉  email@exemple.com',10.5,t.isDark?'#64748b':'#94a3b8',6),
      TB(16,126,W/2-20,20,'☎  +33 6 00 00 00 00',10.5,t.isDark?'#64748b':'#94a3b8',7),
      TB(W/2,108,W/2-20,20,'⬡  www.exemple.com',10.5,t.isDark?'#64748b':'#94a3b8',8),
      TB(16,H-24,120,18,'BADGE-001',9,t.isDark?'#94a3b8':'#475569',9,false,'Courier New,monospace'),
      R(0,H-4,W,4,t.accent,10),
    ]
  },
  {
    id: 'photo-slot',
    name: 'Emplacement photo',
    fn: (t,W,H) => [
      R(0,0,W,H,t.bg,0),
      R(0,0,5,H,t.accent,1),
      // Zone photo (cercle placeholder)
      R(16,20,72,72,t.accent,2,36),
      TB(20,26,64,60,'Photo',14,t.isDark?'rgba(0,0,0,.3)':'rgba(255,255,255,.5)',3,false,'Inter,sans-serif','center'),
      TB(100,28,W-120,30,'<b>Prénom NOM</b>',21,t.txt,4,true),
      TB(100,60,W-120,22,'Rôle / Titre',13,t.accent,5),
      L(16,100,W-32,t.muted,6),
      TB(16,108,W-32,22,'Organisation · Événement',11,t.muted,7),
      TB(16,H-24,120,18,'BADGE-001',9,t.txtDim,8,false,'Courier New,monospace'),
    ]
  },
  {
    id: 'centered',
    name: 'Centré',
    fn: (t,W,H) => [
      R(0,0,W,H,t.bg,0),
      R(0,0,W,3,t.accent,1),
      R(0,H-3,W,3,t.accent,2),
      TBC(0,18,W,22,'ORGANISATION · 2026',8,t.muted,3),
      TBC(0,42,W,34,'<b>Prénom NOM</b>',24,t.txt,4,true),
      R(W/2-50,80,100,2,t.accent,5),
      TBC(0,88,W,22,'Rôle / Titre du poste',13,t.accent,6),
      L(W/4,112,W/2,t.muted,7),
      TBC(0,120,W,22,'Organisation',11,t.muted,8),
      TBC(0,H-24,W,18,'BADGE-001',9,t.txtDim,9),
    ]
  },
  {
    id: 'split',
    name: 'Fond bicolore',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?'#ffffff':'#0f172a',0),
      R(0,0,W*0.42,H,t.bg,1),
      TBC(0,30,W*0.42,28,'<b>N</b>',28,t.txt,2,true),
      TBC(0,62,W*0.42,20,'Prénom\nNOM',11,t.txt,3),
      TBC(0,H-26,W*0.42,18,'STAFF',8,t.muted,4),
      TB(W*0.42+14,30,W*0.55,28,'<b>Prénom NOM</b>',20,t.isDark?'#0f172a':'#fff',5,true),
      TB(W*0.42+14,62,W*0.55,20,'Rôle / Titre',13,t.accent,6),
      L(W*0.42+14,86,W*0.52,t.isDark?'#cbd5e1':'#334155',7),
      TB(W*0.42+14,94,W*0.52,20,'Organisation',11,t.isDark?'#64748b':'#94a3b8',8),
      TB(W*0.42+14,H-24,W*0.52,18,'BADGE-001',9,t.isDark?'#94a3b8':'#475569',9,false,'Courier New,monospace'),
    ]
  },
  {
    id: 'premium',
    name: 'Premium encadré',
    fn: (t,W,H) => [
      R(0,0,W,H,t.bg,0),
      R(10,10,W-20,H-20,t.accent,1,4),  // border rect
      R(12,12,W-24,H-24,t.bg,2,3),       // inner fill
      R(0,0,W,3,t.accent,3),
      R(0,H-3,W,3,t.accent,4),
      TBC(0,22,W,14,'✦  ' + 'ORGANISATION' + '  ✦',8,t.muted,5),
      TBC(0,44,W,32,'<b>Prénom NOM</b>',22,t.txt,6,true),
      TBC(W/4,82,W/2,2,'', 0, t.accent, 7),
      TBC(0,88,W,22,'Rôle / Titre du poste',13,t.accent,8),
      L(W/4,112,W/2,t.muted,9),
      TBC(0,120,W,20,'Organisation',11,t.muted,10),
      TBC(0,H-26,W,18,'BADGE-001',9,t.txtDim,11),
    ]
  },
];

export const BADGE_TEMPLATES: DesignTemplate[] = BADGE_LAYOUTS.flatMap(layout =>
  DESIGN_THEMES.map(theme => ({
    id: `badge-${layout.id}-${theme.id}`,
    name: `${layout.name} · ${theme.name}`,
    category: 'badge' as const,
    w: 340, h: 210,
    bgColor: theme.bg,
    theme,
    objects: layout.fn(theme, 340, 210),
  }))
);

// ═══════════════════════════════════════════════════════
// CARTE DE VISITE LAYOUTS (6 × 10 = 60 cartes)
// ═══════════════════════════════════════════════════════

type CarteLayout = { id:string; name:string; fn:(t:DesignTheme,W:number,H:number)=>DesignObject[] };

const CARTE_LAYOUTS: CarteLayout[] = [
  {
    id: 'modern',
    name: 'Moderne',
    fn: (t,W,H) => [
      R(0,0,W,H,t.bg,0),
      R(0,0,5,H,t.accent,1),
      R(0,0,W,2,t.accent,2),
      R(W-85,26,60,60,t.accent,3,30),
      TBC(W-85,26,60,60,'<b>N</b>',24,t.isDark?'#fff':t.bg,4,true),
      TB(22,32,W-120,36,'<b>Prénom NOM</b>',26,t.txt,5,true),
      TB(22,68,W-100,24,'Directeur · Entreprise',13,t.accent,6),
      L(22,100,W-44,t.muted,7),
      TB(22,112,W-44,22,'✉  email@exemple.com',12,t.muted,8),
      TB(22,136,W-44,22,'☎  +33 6 00 00 00 00',12,t.muted,9),
      TB(22,160,W-44,22,'⬡  www.exemple.com',12,t.muted,10),
      TB(22,184,W-44,22,'◉  Paris, France',12,t.txtDim,11),
      TB(W-120,H-20,100,16,'Creative AI Studio',8,t.txtDim,12),
    ]
  },
  {
    id: 'header-band',
    name: 'Bande d\'en-tête',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?'#ffffff':'#f8fafc',0),
      R(0,0,W,100,t.bg,1),
      R(0,0,W,100,t.accent,1),
      TB(22,16,W-90,34,'<b>Prénom NOM</b>',24,t.isDark?'#fff':t.bg,2,true),
      TB(22,52,W-90,24,'Directeur · Entreprise',13,t.isDark?'rgba(255,255,255,.8)':t.bg,3),
      TB(22,118,W/2-10,22,'✉  email@exemple.com',11.5,t.isDark?'#374151':'#e2e8f0',4),
      TB(22,142,W/2-10,22,'☎  +33 6 00 00 00 00',11.5,t.isDark?'#374151':'#e2e8f0',5),
      TB(W/2+8,118,W/2-30,22,'⬡  www.exemple.com',11.5,t.isDark?'#374151':'#e2e8f0',6),
      TB(W/2+8,142,W/2-30,22,'◉  Paris, France',11.5,t.isDark?'#374151':'#e2e8f0',7),
      R(0,H-5,W,5,t.accent,8),
    ]
  },
  {
    id: 'sidebar',
    name: 'Barre latérale',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?'#ffffff':'#f8fafc',0),
      R(0,0,160,H,t.bg,1),
      // Avatar placeholder
      R(44,24,72,72,t.accent,2,36),
      TBC(44,24,72,72,'Photo',14,t.isDark?'rgba(0,0,0,.35)':'rgba(255,255,255,.5)',3),
      TBC(0,108,160,24,'<b>Prénom NOM</b>',14,t.txt,4,true),
      TBC(0,134,160,20,'Rôle / Titre',11,t.accent,5),
      // Right side
      TB(178,36,W-195,26,'Organisation / Entreprise',10,t.accent,6,false,'Inter,sans-serif'),
      L(178,62,W-195,t.isDark?'#e2e8f0':'#334155',7),
      TB(178,72,W-195,22,'✉  email@exemple.com',11.5,t.isDark?'#374151':'#94a3b8',8),
      TB(178,96,W-195,22,'☎  +33 6 00 00 00 00',11.5,t.isDark?'#374151':'#94a3b8',9),
      TB(178,120,W-195,22,'⬡  www.exemple.com',11.5,t.isDark?'#374151':'#94a3b8',10),
      TB(178,144,W-195,22,'◉  Paris, France',11.5,t.isDark?'#374151':'#94a3b8',11),
      R(160,H-5,W-160,5,t.accent,12),
    ]
  },
  {
    id: 'minimal',
    name: 'Minimaliste',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?t.bg:'#ffffff',0),
      TB(36,44,'serif'==t.bg?380:380,36,'<b>Prénom NOM</b>',30,t.isDark?'#fff':'#0f172a',2,true,'Georgia,serif'),
      R(36,88,Math.min(280,12*11),3,t.accent,3),
      TB(36,102,W-72,24,'Directeur Marketing',14,t.isDark?'#94a3b8':'#64748b',4,false,'Georgia,serif'),
      TB(36,154,W/2-40,22,'email@exemple.com',12,t.isDark?'#cbd5e1':'#374151',5),
      TB(36,178,W/2-40,22,'+33 6 00 00 00 00',12,t.isDark?'#cbd5e1':'#374151',6),
      TB(W/2+4,154,W/2-40,22,'www.exemple.com',12,t.isDark?'#cbd5e1':'#374151',7),
      TB(W/2+4,178,W/2-40,22,'Paris, France',12,t.isDark?'#cbd5e1':'#374151',8),
      R(W-60,H-60,44,44,t.accent,9,22),
    ]
  },
  {
    id: 'bold',
    name: 'Bold gradient',
    fn: (t,W,H) => [
      R(0,0,W,H,t.bg,0),
      R(0,0,W,H,t.accent,1),  // will show through gradient
      R(0,0,W,H,t.bg,0),       // re-overlay, gradient handled by bgColor
      L(24,98,W-48,`rgba(${t.isDark?'255,255,255':'0,0,0'},.18)`,6),
      TB(24,28,W-48,42,'<b>Prénom NOM</b>',30,t.txt,2,true),
      TB(24,72,W-48,24,'Directeur · Organisation',14,t.isDark?'rgba(255,255,255,.78)':'rgba(0,0,0,.65)',3),
      TB(24,108,W-48,22,'✉  email@exemple.com',12,t.isDark?'rgba(255,255,255,.65)':'rgba(0,0,0,.55)',4),
      TB(24,132,W-48,22,'☎  +33 6 00 00 00 00',12,t.isDark?'rgba(255,255,255,.65)':'rgba(0,0,0,.55)',5),
      TB(24,156,W-48,22,'⬡  www.exemple.com',12,t.isDark?'rgba(255,255,255,.65)':'rgba(0,0,0,.55)',7),
      TB(24,180,W-48,22,'◉  Paris, France',12,t.isDark?'rgba(255,255,255,.5)':'rgba(0,0,0,.4)',8),
    ]
  },
  {
    id: 'split-v',
    name: 'Split vertical',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?'#ffffff':'#0f172a',0),
      R(0,0,W*0.38,H,t.bg,1),
      TBC(0,30,W*0.38,28,'<b>N</b>',28,t.txt,2,true),
      TBC(0,62,W*0.38,22,'Prénom\nNOM',11,t.txt,3),
      L(0,H*0.55,W*0.38,t.muted,4),
      TBC(0,H*0.57,W*0.38,20,'Entreprise',10,t.muted,5),
      TBC(0,H-26,W*0.38,18,'CARTE PRO',8,t.txtDim,6),
      TB(W*0.38+16,28,W*0.6,32,'<b>Prénom NOM</b>',22,t.isDark?'#0f172a':'#fff',7,true),
      TB(W*0.38+16,62,W*0.6,22,'Directeur · Titre',13,t.accent,8),
      L(W*0.38+16,88,W*0.58,t.isDark?'#cbd5e1':'#475569',9),
      TB(W*0.38+16,98,W*0.58,20,'✉  email@exemple.com',11,t.isDark?'#374151':'#94a3b8',10),
      TB(W*0.38+16,120,W*0.58,20,'☎  +33 6 00 00 00 00',11,t.isDark?'#374151':'#94a3b8',11),
      TB(W*0.38+16,142,W*0.58,20,'⬡  www.exemple.com',11,t.isDark?'#374151':'#94a3b8',12),
      TB(W*0.38+16,164,W*0.58,20,'◉  Paris, France',11,t.isDark?'#94a3b8':'#a0a0b8',13),
    ]
  },
];

export const CARTE_TEMPLATES: DesignTemplate[] = CARTE_LAYOUTS.flatMap(layout =>
  DESIGN_THEMES.map(theme => ({
    id: `carte-${layout.id}-${theme.id}`,
    name: `${layout.name} · ${theme.name}`,
    category: 'carte' as const,
    w: 530, h: 330,
    bgColor: theme.bg,
    theme,
    objects: layout.fn(theme, 530, 330),
  }))
);

// ═══════════════════════════════════════════════════════
// LOGO LAYOUTS (6 × 10 = 60 logos)
// ═══════════════════════════════════════════════════════

type LogoLayout = { id:string; name:string; fn:(t:DesignTheme,W:number,H:number)=>DesignObject[] };

const LOGO_LAYOUTS: LogoLayout[] = [
  {
    id: 'wordmark',
    name: 'Wordmark',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?t.bg:'#ffffff',0),
      TB(0,H/2-46,W,46,'<b style="color:'+t.accent+'">M</b><span style="color:'+t.txt+'">ediaSearch</span>',54,t.txt,1,false,'Inter,sans-serif','center'),
      R(W/2-120,H/2+8,240,3,t.accent,2),
      TBC(0,H/2+18,W,20,'Intelligence Artificielle',12,t.muted,3,false),
    ]
  },
  {
    id: 'monogram',
    name: 'Monogramme cercle',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?t.bg:'#ffffff',0),
      R(W/2-55,H/2-75,110,110,t.accent,1,55),
      R(W/2-49,H/2-69,98,98,t.isDark?t.bg:'#ffffff',2,49),
      TBC(0,H/2-56,W,80,'<b>MS</b>',44,t.accent,3,true),
      TBC(0,H/2+46,W,26,'CREATIVE AI STUDIO',14,t.txt,4,false),
      TBC(0,H/2+70,W,20,'Intelligence Artificielle',11,t.muted,5),
    ]
  },
  {
    id: 'icon-text',
    name: 'Icône + texte',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?t.bg:'#ffffff',0),
      R(W/2-130,H/2-34,68,68,t.accent,1,14),
      TBC(W/2-130,H/2-34,68,68,'◈',32,t.isDark?'#fff':t.bg,2),
      TB(W/2-52,H/2-30,W/2+52,38,'<b>Creative AI Studio</b>',30,t.txt,3,true),
      R(W/2-52,H/2+12,180,2.5,t.accent,4),
      TB(W/2-52,H/2+20,180,20,'Intelligence Artificielle',11,t.muted,5),
    ]
  },
  {
    id: 'stacked',
    name: 'Empilé',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?t.bg:'#ffffff',0),
      TBC(0,H/2-60,W,52,'<b>MEDIA</b>',50,t.accent,1,true),
      TBC(0,H/2-8,W,52,'<b>SEARCH</b>',50,t.txt,2,true),
      R(40,H/2+46,W-80,2,t.muted,3),
      TBC(0,H/2+54,W,22,'Intelligence Artificielle',12,t.muted,4),
    ]
  },
  {
    id: 'framed',
    name: 'Encadré',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?t.bg:'#0f172a',0),
      R(20,20,W-40,H-40,t.accent,1,4),
      R(24,24,W-48,H-48,t.isDark?t.bg:'#0f172a',2,3),
      TBC(0,H/2-40,W,28,'CREATIVE AI STUDIO',18,t.muted,3,false),
      TBC(0,H/2-12,W,48,'<b>Media<span style="color:'+t.accent+'">Search</span></b>',38,t.txt,4,true),
      TBC(0,H/2+36,W,22,'Intelligence Artificielle',12,t.muted,5),
    ]
  },
  {
    id: 'shield',
    name: 'Bouclier',
    fn: (t,W,H) => [
      R(0,0,W,H,t.isDark?t.bg:'#f8fafc',0),
      R(W/2-48,H/2-62,96,96,t.accent,1,8),
      R(W/2-42,H/2-56,84,84,t.isDark?t.bg:'#f8fafc',2,6),
      TBC(0,H/2-42,W,60,'<b>MS</b>',38,t.accent,3,true),
      TBC(0,H/2+44,W,28,'Creative AI Studio',20,t.txt,4),
      TBC(0,H/2+70,W,20,'Intelligence Artificielle',11,t.muted,5),
    ]
  },
];

export const LOGO_TEMPLATES: DesignTemplate[] = LOGO_LAYOUTS.flatMap(layout =>
  DESIGN_THEMES.map(theme => ({
    id: `logo-${layout.id}-${theme.id}`,
    name: `${layout.name} · ${theme.name}`,
    category: 'logo' as const,
    w: 480, h: 260,
    bgColor: theme.bg,
    theme,
    objects: layout.fn(theme, 480, 260),
  }))
);

// ═══════════════════════════════════════════════════════
// DYNAMIC FIELD MAPPING — Excel → template
// ═══════════════════════════════════════════════════════

export const STANDARD_FIELDS = [
  { key: '{{Nom}}',          label: 'Nom complet',    hint: 'Ex: Marie Dupont' },
  { key: '{{Prenom}}',       label: 'Prénom',          hint: 'Ex: Marie' },
  { key: '{{Role}}',         label: 'Rôle / Titre',   hint: 'Ex: Directrice' },
  { key: '{{Organisation}}', label: 'Organisation',   hint: 'Ex: Creative AI Studio' },
  { key: '{{Email}}',        label: 'Email',           hint: 'Ex: m@ex.com' },
  { key: '{{Tel}}',          label: 'Téléphone',       hint: 'Ex: +33 6...' },
  { key: '{{Site}}',         label: 'Site web',        hint: 'Ex: www.ex.com' },
  { key: '{{Adresse}}',      label: 'Adresse',         hint: 'Ex: Paris' },
  { key: '{{Badge_ID}}',     label: 'N° Badge',        hint: 'Ex: BADGE-001' },
  { key: '{{Departement}}',  label: 'Département',     hint: 'Ex: Marketing' },
];

export function applyFields(objects: DesignObject[], row: Record<string, string>): DesignObject[] {
  return objects.map(o => {
    if (!o.isTextBox || !o.content) return o;
    let content = o.content;
    for (const [k, v] of Object.entries(row)) {
      content = content.replaceAll(`{{${k}}}`, v || '');
    }
    return { ...o, content };
  });
}
