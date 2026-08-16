/**
 * 56 Logo HTML Templates — visuellement riches (métal, néon, 3D, dégradé, badge)
 * Chaque template est du HTML/CSS pur, rendu tel quel dans l'éditeur.
 */

export interface LogoHtmlTpl {
  id: string; name: string; category: string;
  previewBg: string; w: number; h: number; html: string;
}

// ── Helper ──────────────────────────────────────────────────────────────────
const W = 480, H = 260;
const wrap = (bg: string, content: string) =>
  `<div style="width:${W}px;height:${H}px;background:${bg};display:flex;align-items:center;justify-content:center;font-family:'Inter',Arial,sans-serif;overflow:hidden;position:relative">${content}</div>`;

// ═══════════════════════════════════════════════════════
// 1. MÉTAL & OR (10 templates)
// ═══════════════════════════════════════════════════════
const METAL: LogoHtmlTpl[] = [
  {
    id:'gold-classic', name:'Or Classique', category:'metal', previewBg:'#1a1008', w:W, h:H,
    html: wrap('linear-gradient(135deg,#1a1008,#2d1f0a)',
      `<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#d4a017,transparent)"></div>
       <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#d4a017,transparent)"></div>
       <div style="text-align:center">
         <div style="font-size:52px;font-weight:900;letter-spacing:-1px;background:linear-gradient(180deg,#ffe259 0%,#c8960c 40%,#ffd700 60%,#b8860b 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 2px 8px rgba(255,200,0,.4))">Creative AI Studio</div>
         <div style="font-size:10.5px;letter-spacing:5px;color:#c8960c;text-transform:uppercase;margin-top:6px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'silver-chrome', name:'Chrome Argenté', category:'metal', previewBg:'#111', w:W, h:H,
    html: wrap('linear-gradient(135deg,#111,#1a1a1a)',
      `<div style="text-align:center">
         <div style="font-size:52px;font-weight:900;letter-spacing:-1px;background:linear-gradient(180deg,#e8e8e8 0%,#a0a0a0 30%,#f5f5f5 50%,#888 70%,#d0d0d0 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 2px 10px rgba(180,180,180,.3))">Creative AI Studio</div>
         <div style="font-size:10.5px;letter-spacing:4px;color:#888;text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'gold-3d', name:'Or 3D Extrudé', category:'metal', previewBg:'#0d0d0d', w:W, h:H,
    html: wrap('radial-gradient(ellipse at 30% 40%,#2a1f00,#0d0d0d)',
      `<div style="text-align:center">
         <div style="font-size:58px;font-weight:900;letter-spacing:-1px;color:#ffd700;
           text-shadow:1px 1px 0 #b8860b,2px 2px 0 #a07000,3px 3px 0 #8b6000,4px 4px 0 #7a5200,5px 5px 0 #6b4700,6px 6px 12px rgba(0,0,0,.6);
           -webkit-text-stroke:1px rgba(255,200,0,.3)">MS</div>
         <div style="font-size:22px;font-weight:700;color:#d4a017;letter-spacing:3px;text-shadow:1px 1px 0 #8b6000,2px 2px 4px rgba(0,0,0,.5)">CREATIVE AI STUDIO</div>
         <div style="font-size:10px;letter-spacing:4px;color:#8b6000;text-transform:uppercase;margin-top:4px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'rose-gold', name:'Or Rose', category:'metal', previewBg:'#1a0d10', w:W, h:H,
    html: wrap('linear-gradient(135deg,#1a0d10,#2a1018)',
      `<div style="position:absolute;top:30px;left:30px;right:30px;bottom:30px;border:1px solid rgba(198,124,124,.25);border-radius:4px"></div>
       <div style="text-align:center">
         <div style="font-size:48px;font-weight:900;background:linear-gradient(180deg,#f4c2b5 0%,#d4876e 40%,#f0a898 60%,#c4705a 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Creative AI Studio</div>
         <div style="font-size:10px;letter-spacing:4.5px;color:#c4705a;text-transform:uppercase;margin-top:6px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'black-gold', name:'Noir & Or', category:'metal', previewBg:'#0a0a0a', w:W, h:H,
    html: wrap('#0a0a0a',
      `<div style="display:flex;align-items:center;gap:18px">
         <div style="width:64px;height:64px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#b8860b);display:flex;align-items:center;justify-content:center">
           <span style="font-size:28px;font-weight:900;color:#0a0a0a">M</span>
         </div>
         <div>
           <div style="font-size:30px;font-weight:900;background:linear-gradient(90deg,#ffe259,#ffd700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-0.5px">Creative AI Studio</div>
           <div style="width:100%;height:1.5px;background:linear-gradient(90deg,#d4a017,transparent);margin:5px 0"></div>
           <div style="font-size:9.5px;letter-spacing:3.5px;color:#8b6000;text-transform:uppercase">Intelligence Artificielle</div>
         </div>
       </div>`)
  },
  {
    id:'gold-seal', name:'Sceau Or', category:'metal', previewBg:'#1a1008', w:W, h:H,
    html: wrap('linear-gradient(135deg,#1a1008,#0d0800)',
      `<div style="text-align:center;position:relative">
         <div style="width:140px;height:140px;border-radius:50%;border:3px solid #d4a017;margin:0 auto;position:relative;background:radial-gradient(circle,rgba(212,160,23,.12),transparent);box-shadow:0 0 20px rgba(212,160,23,.2),inset 0 0 20px rgba(212,160,23,.05)">
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-52%);font-size:36px;font-weight:900;color:#ffd700;text-shadow:0 0 10px rgba(255,215,0,.4)">MS</div>
         </div>
         <div style="margin-top:10px;font-size:11px;letter-spacing:4px;color:#d4a017;text-transform:uppercase">Creative AI Studio</div>
         <div style="font-size:9px;letter-spacing:2.5px;color:#8b6000;text-transform:uppercase;margin-top:3px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'copper', name:'Cuivre Embossé', category:'metal', previewBg:'#1a0d00', w:W, h:H,
    html: wrap('linear-gradient(135deg,#1a0d00,#261200)',
      `<div style="text-align:center">
         <div style="font-size:54px;font-weight:900;letter-spacing:-1px;background:linear-gradient(180deg,#e8a060 0%,#b45c20 35%,#d4743c 55%,#8b3a00 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(2px 3px 6px rgba(0,0,0,.5))">MEDIA</div>
         <div style="font-size:22px;font-weight:700;letter-spacing:8px;color:#c06030;margin-top:-8px">SEARCH</div>
         <div style="width:200px;height:1px;background:linear-gradient(90deg,transparent,#b45c20,transparent);margin:8px auto"></div>
         <div style="font-size:9px;letter-spacing:4px;color:#8b3a00;text-transform:uppercase">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'platinum', name:'Platine Luxe', category:'metal', previewBg:'#0a0c10', w:W, h:H,
    html: wrap('linear-gradient(135deg,#0a0c10,#12151a)',
      `<div style="text-align:center">
         <div style="font-size:50px;font-weight:100;letter-spacing:8px;background:linear-gradient(180deg,#e0e4ea 0%,#a0a8b4 40%,#d0d4da 55%,#90979f 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">CREATIVE AI STUDIO</div>
         <div style="width:280px;height:1px;background:linear-gradient(90deg,transparent,#a0a8b4,transparent);margin:10px auto"></div>
         <div style="font-size:9px;letter-spacing:6px;color:#6a7280;text-transform:uppercase">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'gold-circle', name:'Cercle Doré', category:'metal', previewBg:'#0d0800', w:W, h:H,
    html: wrap('#0d0800',
      `<div style="display:flex;align-items:center;gap:20px">
         <div style="width:90px;height:90px;border-radius:50%;background:conic-gradient(#ffd700,#b8860b,#ffe259,#d4a017,#ffd700);display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(255,215,0,.3)">
           <div style="width:74px;height:74px;border-radius:50%;background:#0d0800;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#ffd700">MS</div>
         </div>
         <div>
           <div style="font-size:28px;font-weight:800;background:linear-gradient(90deg,#ffe259,#c8960c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Creative AI Studio</div>
           <div style="font-size:9.5px;letter-spacing:3px;color:#8b6000;text-transform:uppercase;margin-top:6px">Intelligence Artificielle</div>
         </div>
       </div>`)
  },
  {
    id:'double-gold', name:'Double Barre Or', category:'metal', previewBg:'#111', w:W, h:H,
    html: wrap('#111',
      `<div style="text-align:center">
         <div style="display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:10px">
           <div style="height:2px;width:60px;background:linear-gradient(90deg,transparent,#d4a017)"></div>
           <div style="font-size:9px;letter-spacing:5px;color:#8b6000;text-transform:uppercase">Est. 2024</div>
           <div style="height:2px;width:60px;background:linear-gradient(90deg,#d4a017,transparent)"></div>
         </div>
         <div style="font-size:46px;font-weight:900;background:linear-gradient(180deg,#ffe259,#c8960c,#ffd700,#b8860b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-0.5px">CREATIVE AI STUDIO</div>
         <div style="display:flex;align-items:center;gap:12px;justify-content:center;margin-top:10px">
           <div style="height:2px;width:80px;background:linear-gradient(90deg,transparent,#d4a017)"></div>
           <div style="font-size:9px;letter-spacing:4px;color:#8b6000;text-transform:uppercase">IA</div>
           <div style="height:2px;width:80px;background:linear-gradient(90deg,#d4a017,transparent)"></div>
         </div>
       </div>`)
  },
];

// ═══════════════════════════════════════════════════════
// 2. NÉON & GLOW (8 templates)
// ═══════════════════════════════════════════════════════
const NEON: LogoHtmlTpl[] = [
  {
    id:'neon-blue', name:'Néon Bleu', category:'neon', previewBg:'#000014', w:W, h:H,
    html: wrap('#000014',
      `<div style="text-align:center">
         <div style="font-size:56px;font-weight:900;color:#fff;text-shadow:0 0 7px #fff,0 0 14px #fff,0 0 28px #0080ff,0 0 56px #0080ff,0 0 84px #0080ff;letter-spacing:-1px">Creative AI Studio</div>
         <div style="font-size:11px;letter-spacing:4px;color:rgba(0,160,255,.7);text-transform:uppercase;margin-top:10px;text-shadow:0 0 8px #0080ff">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'neon-pink', name:'Néon Rose', category:'neon', previewBg:'#100010', w:W, h:H,
    html: wrap('linear-gradient(135deg,#100010,#180018)',
      `<div style="text-align:center">
         <div style="font-size:52px;font-weight:900;color:#fff;text-shadow:0 0 7px #fff,0 0 14px #ff006e,0 0 28px #ff006e,0 0 56px #ff006e,0 0 84px #ff006e;letter-spacing:-0.5px">Creative AI Studio</div>
         <div style="width:240px;height:1px;background:#ff006e;margin:10px auto;box-shadow:0 0 8px #ff006e,0 0 16px #ff006e"></div>
         <div style="font-size:10px;letter-spacing:4px;color:rgba(255,0,110,.7);text-transform:uppercase;text-shadow:0 0 8px #ff006e">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'neon-green', name:'Néon Vert Cyber', category:'neon', previewBg:'#001400', w:W, h:H,
    html: wrap('linear-gradient(135deg,#001400,#001a00)',
      `<div style="text-align:center;font-family:'Courier New',monospace">
         <div style="font-size:11px;letter-spacing:3px;color:rgba(0,255,65,.5);margin-bottom:8px">&gt; LOADING...</div>
         <div style="font-size:50px;font-weight:900;color:#00ff41;text-shadow:0 0 7px #00ff41,0 0 14px #00ff41,0 0 28px #00ff41;letter-spacing:2px">MEDIA</div>
         <div style="font-size:50px;font-weight:900;color:#00ff41;text-shadow:0 0 7px #00ff41,0 0 14px #00ff41,0 0 28px #00ff41;letter-spacing:2px;margin-top:-10px">SEARCH</div>
         <div style="font-size:10px;letter-spacing:4px;color:rgba(0,255,65,.5);text-transform:uppercase;margin-top:6px">v2.0 IA</div>
       </div>`)
  },
  {
    id:'neon-orange', name:'Néon Orange', category:'neon', previewBg:'#100500', w:W, h:H,
    html: wrap('linear-gradient(135deg,#100500,#180800)',
      `<div style="text-align:center">
         <div style="font-size:54px;font-weight:900;color:#fff;text-shadow:0 0 7px #fff,0 0 14px #ff6000,0 0 28px #ff6000,0 0 56px #ff3000;letter-spacing:-0.5px">Creative AI Studio</div>
         <div style="font-size:10.5px;letter-spacing:4px;color:rgba(255,100,0,.75);text-transform:uppercase;margin-top:8px;text-shadow:0 0 8px #ff6000">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'neon-purple', name:'Néon Violet', category:'neon', previewBg:'#08001a', w:W, h:H,
    html: wrap('linear-gradient(135deg,#08001a,#100028)',
      `<div style="text-align:center">
         <div style="display:inline-block">
           <div style="font-size:56px;font-weight:900;background:linear-gradient(90deg,#bf00ff,#7b00ff,#bf00ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 12px rgba(191,0,255,.6)) drop-shadow(0 0 24px rgba(120,0,255,.4));letter-spacing:-0.5px">Creative AI Studio</div>
         </div>
         <div style="font-size:10px;letter-spacing:4px;color:rgba(150,0,255,.7);text-transform:uppercase;margin-top:8px;text-shadow:0 0 10px rgba(150,0,255,.8)">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'neon-multi', name:'Multi Néon', category:'neon', previewBg:'#000', w:W, h:H,
    html: wrap('#000',
      `<div style="text-align:center">
         <div style="font-size:52px;font-weight:900;letter-spacing:-0.5px">
           <span style="color:#ff0040;text-shadow:0 0 14px #ff0040,0 0 28px #ff0040">M</span>
           <span style="color:#ff8000;text-shadow:0 0 14px #ff8000">e</span>
           <span style="color:#ffff00;text-shadow:0 0 14px #ffff00">d</span>
           <span style="color:#00ff80;text-shadow:0 0 14px #00ff80">i</span>
           <span style="color:#00ffff;text-shadow:0 0 14px #00ffff">a</span>
           <span style="color:#0080ff;text-shadow:0 0 14px #0080ff">S</span>
           <span style="color:#8000ff;text-shadow:0 0 14px #8000ff">e</span>
           <span style="color:#ff0080;text-shadow:0 0 14px #ff0080">a</span>
           <span style="color:#ff4000;text-shadow:0 0 14px #ff4000">r</span>
           <span style="color:#00ff00;text-shadow:0 0 14px #00ff00">c</span>
           <span style="color:#0040ff;text-shadow:0 0 14px #0040ff">h</span>
         </div>
         <div style="font-size:10px;letter-spacing:4px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'neon-white', name:'Lueur Blanche', category:'neon', previewBg:'#0a0a0a', w:W, h:H,
    html: wrap('#0a0a0a',
      `<div style="text-align:center">
         <div style="font-size:54px;font-weight:100;letter-spacing:10px;color:#fff;text-shadow:0 0 10px rgba(255,255,255,.8),0 0 20px rgba(255,255,255,.4),0 0 40px rgba(255,255,255,.2)">MEDIA</div>
         <div style="width:300px;height:1px;background:#fff;margin:8px auto;box-shadow:0 0 10px #fff,0 0 20px rgba(255,255,255,.5)"></div>
         <div style="font-size:54px;font-weight:100;letter-spacing:10px;color:#fff;text-shadow:0 0 10px rgba(255,255,255,.8),0 0 20px rgba(255,255,255,.4),0 0 40px rgba(255,255,255,.2)">SEARCH</div>
       </div>`)
  },
  {
    id:'neon-cyan', name:'Cyan Tech', category:'neon', previewBg:'#001020', w:W, h:H,
    html: wrap('linear-gradient(135deg,#001020,#001828)',
      `<div style="text-align:center;font-family:'Courier New',monospace">
         <div style="font-size:50px;font-weight:900;color:#00e5ff;text-shadow:0 0 10px #00e5ff,0 0 20px #00e5ff,0 0 40px #0080ff,0 0 60px #0040ff;letter-spacing:2px">MEDIA</div>
         <div style="display:flex;align-items:center;gap:8px;justify-content:center;margin:4px 0">
           <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,#00e5ff)"></div>
           <div style="font-size:8px;letter-spacing:2px;color:rgba(0,229,255,.6)">A.I.</div>
           <div style="flex:1;height:1px;background:linear-gradient(90deg,#00e5ff,transparent)"></div>
         </div>
         <div style="font-size:50px;font-weight:900;color:#00e5ff;text-shadow:0 0 10px #00e5ff,0 0 20px #00e5ff,0 0 40px #0080ff;letter-spacing:2px">SEARCH</div>
       </div>`)
  },
];

// ═══════════════════════════════════════════════════════
// 3. EFFETS 3D (8 templates)
// ═══════════════════════════════════════════════════════
const EFFET3D: LogoHtmlTpl[] = [
  {
    id:'3d-dark', name:'3D Extrudé Sombre', category:'3d', previewBg:'#0d0d0d', w:W, h:H,
    html: wrap('radial-gradient(ellipse at 40% 40%,#1a1a2e,#0d0d0d)',
      `<div style="text-align:center">
         <div style="font-size:62px;font-weight:900;letter-spacing:-2px;color:#6366f1;
           text-shadow:1px 1px 0 #4f46e5,2px 2px 0 #4338ca,3px 3px 0 #3730a3,4px 4px 0 #312e81,5px 5px 0 #1e1b4b,8px 8px 16px rgba(0,0,0,.7)">MS</div>
         <div style="font-size:22px;font-weight:700;color:#818cf8;letter-spacing:4px;text-shadow:1px 1px 0 #4338ca,2px 2px 6px rgba(0,0,0,.5)">CREATIVE AI STUDIO</div>
         <div style="font-size:9.5px;letter-spacing:3px;color:#4f46e5;text-transform:uppercase;margin-top:4px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'3d-gold', name:'3D Or Pressé', category:'3d', previewBg:'#080400', w:W, h:H,
    html: wrap('radial-gradient(ellipse at 40% 40%,#1a1008,#080400)',
      `<div style="text-align:center">
         <div style="font-size:64px;font-weight:900;letter-spacing:-1px;color:#ffd700;
           text-shadow:1px 1px 0 #d4a017,2px 2px 0 #b8860b,3px 3px 0 #9a7000,4px 4px 0 #7a5200,5px 5px 0 #5c3c00,7px 7px 14px rgba(0,0,0,.6)">MS</div>
         <div style="font-size:20px;font-weight:700;letter-spacing:6px;color:#c8960c;text-shadow:1px 1px 0 #8b6000,2px 2px 4px rgba(0,0,0,.5)">CREATIVE AI STUDIO</div>
         <div style="font-size:9px;letter-spacing:4px;color:#7a5200;text-transform:uppercase;margin-top:4px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'3d-chrome', name:'Chrome 3D', category:'3d', previewBg:'#0a0a12', w:W, h:H,
    html: wrap('linear-gradient(160deg,#0a0a12,#12121c)',
      `<div style="text-align:center">
         <div style="font-size:58px;font-weight:900;letter-spacing:-0.5px;background:linear-gradient(180deg,#e0e8f0 0%,#8090a0 30%,#d0d8e4 50%,#607080 70%,#b0bac4 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
           filter:drop-shadow(2px 3px 0 rgba(50,60,80,.6)) drop-shadow(4px 5px 0 rgba(30,40,60,.4)) drop-shadow(6px 8px 12px rgba(0,0,0,.5))">Creative AI Studio</div>
         <div style="font-size:10px;letter-spacing:5px;color:#6080a0;text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'3d-red', name:'3D Rouge Impact', category:'3d', previewBg:'#0d0000', w:W, h:H,
    html: wrap('radial-gradient(ellipse at 50% 40%,#1a0000,#0d0000)',
      `<div style="text-align:center">
         <div style="font-size:62px;font-weight:900;letter-spacing:-1px;color:#ef4444;
           text-shadow:1px 1px 0 #dc2626,2px 2px 0 #b91c1c,3px 3px 0 #991b1b,4px 4px 0 #7f1d1d,5px 5px 0 #500000,7px 7px 14px rgba(0,0,0,.7)">MEDIA</div>
         <div style="font-size:62px;font-weight:900;letter-spacing:-1px;color:#ef4444;margin-top:-12px;
           text-shadow:1px 1px 0 #dc2626,2px 2px 0 #b91c1c,3px 3px 0 #991b1b,4px 4px 0 #7f1d1d,5px 5px 0 #500000,7px 7px 14px rgba(0,0,0,.7)">SEARCH</div>
         <div style="font-size:9px;letter-spacing:4px;color:#7f1d1d;text-transform:uppercase;margin-top:4px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'3d-blue', name:'3D Bleu Relief', category:'3d', previewBg:'#00050f', w:W, h:H,
    html: wrap('radial-gradient(ellipse at 40% 40%,#000d20,#00050f)',
      `<div style="text-align:center">
         <div style="font-size:58px;font-weight:900;letter-spacing:-0.5px;color:#3b82f6;
           text-shadow:1px 1px 0 #2563eb,2px 2px 0 #1d4ed8,3px 3px 0 #1e40af,4px 4px 0 #1e3a8a,5px 5px 0 #172554,7px 7px 14px rgba(0,0,0,.7)">Creative AI Studio</div>
         <div style="font-size:10px;letter-spacing:4px;color:#1d4ed8;text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'3d-stacked', name:'3D Empilé', category:'3d', previewBg:'#0d0d0d', w:W, h:H,
    html: wrap('#0d0d0d',
      `<div style="text-align:center">
         <div style="font-size:70px;font-weight:900;letter-spacing:-3px;color:#a855f7;
           text-shadow:2px 2px 0 #7c3aed,4px 4px 0 #5b21b6,6px 6px 0 #3b0764,8px 8px 16px rgba(0,0,0,.7)">MEDIA</div>
         <div style="font-size:70px;font-weight:900;letter-spacing:-3px;color:#ec4899;margin-top:-16px;
           text-shadow:2px 2px 0 #be185d,4px 4px 0 #9d174d,6px 6px 0 #500724,8px 8px 16px rgba(0,0,0,.7)">SEARCH</div>
       </div>`)
  },
  {
    id:'3d-vintage', name:'3D Vintage', category:'3d', previewBg:'#100800', w:W, h:H,
    html: wrap('linear-gradient(160deg,#100800,#180c00)',
      `<div style="text-align:center">
         <div style="font-size:16px;letter-spacing:6px;color:#8b5e00;text-transform:uppercase;margin-bottom:4px">✦ The Original ✦</div>
         <div style="font-size:56px;font-weight:900;font-family:Georgia,serif;letter-spacing:-1px;color:#d4a017;
           text-shadow:2px 2px 0 #8b6000,4px 4px 0 #5c3c00,6px 6px 12px rgba(0,0,0,.6)">Creative AI Studio</div>
         <div style="font-size:10px;letter-spacing:5px;color:#8b5e00;text-transform:uppercase;margin-top:6px">Est. 2024</div>
       </div>`)
  },
  {
    id:'3d-ice', name:'Glace 3D', category:'3d', previewBg:'#001428', w:W, h:H,
    html: wrap('linear-gradient(135deg,#001428,#001f3d)',
      `<div style="text-align:center">
         <div style="font-size:58px;font-weight:900;letter-spacing:-0.5px;background:linear-gradient(180deg,#e0f4ff 0%,#80c4e0 30%,#c0e8f8 55%,#4090b8 80%,#a0d4ec 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
           filter:drop-shadow(2px 3px 0 rgba(0,80,140,.6)) drop-shadow(4px 6px 12px rgba(0,0,0,.5))">Creative AI Studio</div>
         <div style="font-size:10px;letter-spacing:4px;color:#4090b8;text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
];

// ═══════════════════════════════════════════════════════
// 4. MODERNE FLAT (8 templates)
// ═══════════════════════════════════════════════════════
const MODERN: LogoHtmlTpl[] = [
  {
    id:'mod-split', name:'Split Couleur', category:'modern', previewBg:'#ffffff', w:W, h:H,
    html: wrap('#fff',
      `<div style="text-align:center">
         <div style="font-size:58px;font-weight:900;letter-spacing:-1px;line-height:1">
           <span style="color:#6366f1">Media</span><span style="color:#0f172a">Search</span>
         </div>
         <div style="width:240px;height:3px;background:linear-gradient(90deg,#6366f1,#a855f7);margin:8px auto;border-radius:2px"></div>
         <div style="font-size:10.5px;letter-spacing:4px;color:#64748b;text-transform:uppercase">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'mod-boxed', name:'Boîte Lettre', category:'modern', previewBg:'#f8fafc', w:W, h:H,
    html: wrap('#f8fafc',
      `<div style="display:flex;align-items:center;gap:16px">
         <div style="width:80px;height:80px;background:#6366f1;border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(99,102,241,.3)">
           <span style="color:#fff;font-size:38px;font-weight:900">M</span>
         </div>
         <div>
           <div style="font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">Creative AI Studio</div>
           <div style="font-size:10px;letter-spacing:2.5px;color:#6366f1;text-transform:uppercase;margin-top:5px;font-weight:700">Intelligence Artificielle</div>
           <div style="width:120px;height:2.5px;background:linear-gradient(90deg,#6366f1,#a855f7);border-radius:2px;margin-top:6px"></div>
         </div>
       </div>`)
  },
  {
    id:'mod-gradient', name:'Texte Dégradé', category:'modern', previewBg:'#ffffff', w:W, h:H,
    html: wrap('#fff',
      `<div style="text-align:center">
         <div style="font-size:56px;font-weight:900;letter-spacing:-1px;background:linear-gradient(135deg,#6366f1,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Creative AI Studio</div>
         <div style="font-size:10.5px;letter-spacing:4px;color:#94a3b8;text-transform:uppercase;margin-top:6px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'mod-dark-minimal', name:'Dark Minimal', category:'modern', previewBg:'#0f172a', w:W, h:H,
    html: wrap('#0f172a',
      `<div style="text-align:center">
         <div style="font-size:54px;font-weight:900;letter-spacing:-0.5px;color:#f1f5f9">Media<span style="color:#6366f1">.</span></div>
         <div style="font-size:22px;font-weight:300;letter-spacing:8px;color:#64748b;text-transform:uppercase;margin-top:-6px">Search</div>
         <div style="width:60px;height:3px;background:#6366f1;border-radius:2px;margin:10px auto"></div>
       </div>`)
  },
  {
    id:'mod-circle-right', name:'Cercle + Texte', category:'modern', previewBg:'#f8fafc', w:W, h:H,
    html: wrap('#f8fafc',
      `<div style="display:flex;align-items:center;gap:18px">
         <div style="width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(99,102,241,.25)">
           <span style="color:#fff;font-size:26px;font-weight:900">MS</span>
         </div>
         <div>
           <div style="font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">Creative AI Studio</div>
           <div style="font-size:10px;letter-spacing:2.5px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Intelligence Artificielle</div>
         </div>
       </div>`)
  },
  {
    id:'mod-bold-stack', name:'Empilé Bold', category:'modern', previewBg:'#ffffff', w:W, h:H,
    html: wrap('#fff',
      `<div style="text-align:center">
         <div style="font-size:72px;font-weight:900;letter-spacing:-3px;color:#6366f1;line-height:0.9">MEDIA</div>
         <div style="font-size:72px;font-weight:900;letter-spacing:-3px;color:#0f172a;line-height:0.9">SEARCH</div>
         <div style="font-size:9.5px;letter-spacing:5px;color:#94a3b8;text-transform:uppercase;margin-top:10px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'mod-outline', name:'Texte Contour', category:'modern', previewBg:'#0f172a', w:W, h:H,
    html: wrap('#0f172a',
      `<div style="text-align:center">
         <div style="font-size:56px;font-weight:900;letter-spacing:-0.5px;-webkit-text-stroke:2px #6366f1;color:transparent">Creative AI Studio</div>
         <div style="font-size:10px;letter-spacing:4px;color:#334155;text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'mod-tag', name:'Tag / Étiquette', category:'modern', previewBg:'#f8fafc', w:W, h:H,
    html: wrap('#f8fafc',
      `<div style="text-align:center">
         <div style="display:inline-block;background:#0f172a;padding:8px 28px 8px 20px;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 50%,calc(100% - 18px) 100%,0 100%);margin-bottom:10px">
           <span style="font-size:11px;letter-spacing:3px;color:#64748b;text-transform:uppercase">Powered by AI</span>
         </div>
         <div style="font-size:50px;font-weight:900;color:#0f172a;letter-spacing:-1px">Creative AI Studio</div>
         <div style="font-size:10px;letter-spacing:4px;color:#6366f1;text-transform:uppercase;margin-top:6px">Intelligence Artificielle</div>
       </div>`)
  },
];

// ═══════════════════════════════════════════════════════
// 5. BADGE & SCEAU (8 templates)
// ═══════════════════════════════════════════════════════
const BADGE_LOGO: LogoHtmlTpl[] = [
  {
    id:'badge-classic', name:'Sceau Classique', category:'badge', previewBg:'#0f172a', w:W, h:H,
    html: wrap('#0f172a',
      `<div style="text-align:center">
         <div style="width:150px;height:150px;border-radius:50%;border:3px solid #6366f1;margin:0 auto;position:relative;display:flex;align-items:center;justify-content:center;flex-direction:column;background:rgba(99,102,241,.08);box-shadow:0 0 20px rgba(99,102,241,.2)">
           <div style="font-size:40px;font-weight:900;color:#6366f1;line-height:1">MS</div>
           <div style="font-size:8.5px;letter-spacing:2px;color:#4f46e5;text-transform:uppercase">Media</div>
         </div>
         <div style="margin-top:10px;font-size:12px;letter-spacing:3px;color:#818cf8;text-transform:uppercase">Creative AI Studio</div>
         <div style="font-size:9px;letter-spacing:2.5px;color:#4f46e5;text-transform:uppercase;margin-top:3px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'badge-vintage', name:'Badge Vintage', category:'badge', previewBg:'#1a0d00', w:W, h:H,
    html: wrap('linear-gradient(135deg,#1a0d00,#0d0700)',
      `<div style="text-align:center">
         <div style="display:inline-block;border:2.5px solid #d4a017;border-radius:50%;padding:16px;box-shadow:0 0 0 8px rgba(212,160,23,.06),0 0 0 16px rgba(212,160,23,.03)">
           <div style="border:1px solid rgba(212,160,23,.35);border-radius:50%;padding:16px">
             <div style="font-size:34px;font-weight:900;font-family:Georgia,serif;color:#ffd700;text-shadow:1px 1px 2px rgba(0,0,0,.5)">MS</div>
           </div>
         </div>
         <div style="margin-top:10px;font-size:10px;letter-spacing:4px;color:#d4a017;text-transform:uppercase">Creative AI Studio</div>
         <div style="font-size:8.5px;letter-spacing:3px;color:#8b6000;margin-top:3px;text-transform:uppercase">Est. 2024</div>
       </div>`)
  },
  {
    id:'badge-hex', name:'Hexagone Tech', category:'badge', previewBg:'#f0f9ff', w:W, h:H,
    html: wrap('#f0f9ff',
      `<div style="text-align:center;display:flex;align-items:center;gap:16px">
         <div style="position:relative;width:90px;height:102px;flex-shrink:0">
           <svg viewBox="0 0 90 104" style="width:90px;height:104px;position:absolute">
             <polygon points="45,2 87,26 87,78 45,102 3,78 3,26" fill="#0284c7" stroke="#0ea5e9" stroke-width="2"/>
           </svg>
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:26px;font-weight:900">MS</div>
         </div>
         <div style="text-align:left">
           <div style="font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">Creative AI Studio</div>
           <div style="width:130px;height:2.5px;background:#0284c7;border-radius:2px;margin:6px 0"></div>
           <div style="font-size:9.5px;letter-spacing:2.5px;color:#0284c7;text-transform:uppercase">Intelligence Artificielle</div>
         </div>
       </div>`)
  },
  {
    id:'badge-shield', name:'Bouclier Pro', category:'badge', previewBg:'#f8fafc', w:W, h:H,
    html: wrap('#f8fafc',
      `<div style="text-align:center">
         <div style="position:relative;display:inline-block">
           <svg viewBox="0 0 100 110" style="width:100px;height:110px">
             <path d="M50,4 L94,22 L94,58 C94,80 73,98 50,106 C27,98 6,80 6,58 L6,22 Z" fill="#1e3a8a" stroke="#3b82f6" stroke-width="2"/>
           </svg>
           <div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);color:#fff;font-size:28px;font-weight:900;white-space:nowrap">MS</div>
         </div>
         <div style="margin-top:8px;font-size:20px;font-weight:800;color:#1e3a8a;letter-spacing:-0.3px">Creative AI Studio</div>
         <div style="font-size:9px;letter-spacing:2.5px;color:#64748b;text-transform:uppercase;margin-top:4px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'badge-star', name:'Star Burst', category:'badge', previewBg:'#1a1008', w:W, h:H,
    html: wrap('linear-gradient(135deg,#1a1008,#0d0800)',
      `<div style="text-align:center">
         <div style="position:relative;display:inline-block">
           <div style="width:120px;height:120px;background:linear-gradient(135deg,#ffd700,#c8960c);margin:0 auto;clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);display:flex;align-items:center;justify-content:center">
           </div>
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);color:#1a1008;font-size:24px;font-weight:900">MS</div>
         </div>
         <div style="margin-top:8px;font-size:12px;letter-spacing:3px;color:#d4a017;text-transform:uppercase">CREATIVE AI STUDIO</div>
         <div style="font-size:8.5px;letter-spacing:2.5px;color:#8b6000;text-transform:uppercase;margin-top:3px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'badge-diamond', name:'Diamant', category:'badge', previewBg:'#f8fafc', w:W, h:H,
    html: wrap('#f8fafc',
      `<div style="text-align:center">
         <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);width:90px;height:90px;transform:rotate(45deg);border-radius:8px;margin:0 auto;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(99,102,241,.3)">
           <div style="transform:rotate(-45deg);color:#fff;font-size:28px;font-weight:900">MS</div>
         </div>
         <div style="margin-top:14px;font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">Creative AI Studio</div>
         <div style="width:100px;height:2px;background:linear-gradient(90deg,#6366f1,#a855f7);margin:6px auto;border-radius:1px"></div>
         <div style="font-size:9.5px;letter-spacing:2.5px;color:#94a3b8;text-transform:uppercase">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'badge-oval', name:'Tampon Oval', category:'badge', previewBg:'#fff', w:W, h:H,
    html: wrap('#fff',
      `<div style="text-align:center">
         <div style="display:inline-block;border:3px solid #1e3a8a;border-radius:60px;padding:16px 32px;position:relative">
           <div style="position:absolute;top:10px;left:0;right:0;text-align:center;font-size:8px;letter-spacing:3px;color:#1e3a8a;text-transform:uppercase">Intelligence Artificielle</div>
           <div style="font-size:40px;font-weight:900;color:#1e3a8a;letter-spacing:-0.5px;margin-top:12px">Creative AI Studio</div>
           <div style="position:absolute;bottom:10px;left:0;right:0;text-align:center;font-size:8px;letter-spacing:3px;color:#1e3a8a;text-transform:uppercase">Est. 2024</div>
         </div>
       </div>`)
  },
  {
    id:'badge-round-stamp', name:'Cachet Rond', category:'badge', previewBg:'#fff', w:W, h:H,
    html: wrap('#fff',
      `<div style="text-align:center;transform:rotate(-8deg)">
         <div style="width:160px;height:160px;border-radius:50%;border:4px solid #dc2626;margin:0 auto;display:flex;align-items:center;justify-content:center;flex-direction:column;box-shadow:inset 0 0 0 6px rgba(220,38,38,.1),0 0 0 2px rgba(220,38,38,.2)">
           <div style="font-size:34px;font-weight:900;color:#dc2626;line-height:1">MEDIA</div>
           <div style="width:100px;height:2px;background:#dc2626;margin:3px 0"></div>
           <div style="font-size:34px;font-weight:900;color:#dc2626;line-height:1">SEARCH</div>
           <div style="font-size:8px;letter-spacing:2px;color:#dc2626;text-transform:uppercase;margin-top:4px">IA · 2024</div>
         </div>
       </div>`)
  },
];

// ═══════════════════════════════════════════════════════
// 6. DÉGRADÉ & GRADIENT (8 templates)
// ═══════════════════════════════════════════════════════
const GRADIENT: LogoHtmlTpl[] = [
  {
    id:'grad-purple-pink', name:'Violet → Rose', category:'gradient', previewBg:'#7c3aed', w:W, h:H,
    html: wrap('linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7,#ec4899)',
      `<div style="position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.07)"></div>
       <div style="position:absolute;bottom:-40px;left:-40px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.05)"></div>
       <div style="text-align:center">
         <div style="font-size:54px;font-weight:900;color:#fff;letter-spacing:-0.5px;text-shadow:0 2px 20px rgba(0,0,0,.2)">Creative AI Studio</div>
         <div style="font-size:10.5px;letter-spacing:4px;color:rgba(255,255,255,.7);text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'grad-sunset', name:'Coucher de soleil', category:'gradient', previewBg:'#ea580c', w:W, h:H,
    html: wrap('linear-gradient(135deg,#f97316,#ec4899,#f59e0b)',
      `<div style="text-align:center">
         <div style="font-size:56px;font-weight:900;color:#fff;letter-spacing:-1px;text-shadow:0 2px 16px rgba(0,0,0,.2)">Media<span style="opacity:.85">Search</span></div>
         <div style="width:180px;height:2px;background:rgba(255,255,255,.5);margin:10px auto;border-radius:1px"></div>
         <div style="font-size:10.5px;letter-spacing:4px;color:rgba(255,255,255,.75);text-transform:uppercase">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'grad-ocean', name:'Océan', category:'gradient', previewBg:'#0284c7', w:W, h:H,
    html: wrap('linear-gradient(135deg,#0284c7,#0d9488,#06b6d4)',
      `<div style="text-align:center">
         <div style="font-size:54px;font-weight:900;color:#fff;letter-spacing:-0.5px;text-shadow:0 2px 12px rgba(0,0,0,.15)">Creative AI Studio</div>
         <div style="display:flex;align-items:center;gap:10px;justify-content:center;margin:8px 0">
           <div style="flex:1;height:1px;background:rgba(255,255,255,.4)"></div>
           <div style="font-size:9px;letter-spacing:3px;color:rgba(255,255,255,.7);text-transform:uppercase">IA</div>
           <div style="flex:1;height:1px;background:rgba(255,255,255,.4)"></div>
         </div>
         <div style="font-size:10px;letter-spacing:3.5px;color:rgba(255,255,255,.7);text-transform:uppercase">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'grad-forest', name:'Forêt', category:'gradient', previewBg:'#15803d', w:W, h:H,
    html: wrap('linear-gradient(135deg,#15803d,#065f46,#16a34a)',
      `<div style="text-align:center">
         <div style="font-size:54px;font-weight:900;color:#fff;letter-spacing:-0.5px;text-shadow:0 2px 12px rgba(0,0,0,.2)">Creative AI Studio</div>
         <div style="font-size:10.5px;letter-spacing:4px;color:rgba(255,255,255,.7);text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'grad-dark-glow', name:'Sombre Lumineux', category:'gradient', previewBg:'#0f172a', w:W, h:H,
    html: wrap('radial-gradient(ellipse at center,#1e1b4b 0%,#0f172a 70%)',
      `<div style="text-align:center">
         <div style="font-size:56px;font-weight:900;background:linear-gradient(135deg,#e0e7ff,#a5b4fc,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 20px rgba(99,102,241,.4));letter-spacing:-0.5px">Creative AI Studio</div>
         <div style="font-size:10.5px;letter-spacing:4px;color:#4f46e5;text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'grad-rainbow', name:'Arc-en-ciel', category:'gradient', previewBg:'#fff', w:W, h:H,
    html: wrap('#fff',
      `<div style="text-align:center">
         <div style="font-size:56px;font-weight:900;letter-spacing:-0.5px;background:linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Creative AI Studio</div>
         <div style="font-size:10.5px;letter-spacing:4px;color:#94a3b8;text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
  {
    id:'grad-midnight', name:'Minuit', category:'gradient', previewBg:'#030712', w:W, h:H,
    html: wrap('radial-gradient(ellipse at 30% 50%,#1e1b4b,#0f172a,#030712)',
      `<div style="display:flex;align-items:center;gap:18px">
         <div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(99,102,241,.4),0 0 40px rgba(99,102,241,.15)">
           <span style="color:#fff;font-size:26px;font-weight:900">MS</span>
         </div>
         <div>
           <div style="font-size:28px;font-weight:800;color:#e2e8f0;letter-spacing:-0.3px">Creative AI Studio</div>
           <div style="font-size:9.5px;letter-spacing:3px;color:#4f46e5;text-transform:uppercase;margin-top:5px">Intelligence Artificielle</div>
         </div>
       </div>`)
  },
  {
    id:'grad-fire', name:'Feu', category:'gradient', previewBg:'#1a0000', w:W, h:H,
    html: wrap('linear-gradient(160deg,#1a0000,#300800)',
      `<div style="text-align:center">
         <div style="font-size:56px;font-weight:900;letter-spacing:-0.5px;background:linear-gradient(180deg,#fff7ed 0%,#fed7aa 25%,#fb923c 50%,#dc2626 75%,#7f1d1d 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 10px rgba(251,146,60,.3)) drop-shadow(0 0 20px rgba(220,38,38,.2))">Creative AI Studio</div>
         <div style="font-size:10.5px;letter-spacing:4px;color:#b45309;text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
       </div>`)
  },
];

// ═══════════════════════════════════════════════════════
// EXPORT — 56 templates total
// ═══════════════════════════════════════════════════════
export const LOGO_HTML_TPLS: LogoHtmlTpl[] = [
  ...METAL,
  ...NEON,
  ...EFFET3D,
  ...MODERN,
  ...BADGE_LOGO,
  ...GRADIENT,
];

export const LOGO_CATEGORIES = [
  { id: '',         name: 'Tous' },
  { id: 'metal',    name: 'Métal & Or' },
  { id: 'neon',     name: 'Néon & Glow' },
  { id: '3d',       name: '3D & Relief' },
  { id: 'modern',   name: 'Moderne Flat' },
  { id: 'badge',    name: 'Badge & Sceau' },
  { id: 'gradient', name: 'Dégradé' },
];
