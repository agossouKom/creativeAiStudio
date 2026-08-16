import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DesignEditorComponent, DesignEditorResult } from '../../shared/design-editor/design-editor.component';
import { OfficeEditorComponent, OfficeEditorConfig } from '../../shared/office-editor/office-editor.component';
import { htmlToWordCompatible } from '../../shared/office-editor/html-to-word.util';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface CvInfo {
  prenom: string; nom: string; titre: string;
  email: string; telephone: string;
  ville: string; adresse: string;
  linkedin: string; github: string; portfolio: string;
  apropos: string; photoUrl: string;
}
interface CvExp {
  id: string; poste: string; entreprise: string;
  debut: string; fin: string; actuel: boolean; description: string[];
}
interface CvFormation {
  id: string; diplome: string; ecole: string;
  debut: string; fin: string; actuel: boolean; detail: string;
}
interface CvCompetence { id: string; nom: string; }
interface CvLangue    { id: string; nom: string; niveau: string; }
interface CvCertif    { id: string; nom: string; org: string; annee: string; }

interface CvData {
  info: CvInfo;
  experiences: CvExp[];
  formations: CvFormation[];
  competences: CvCompetence[];
  langues: CvLangue[];
  certifications: CvCertif[];
}

interface CvTheme {
  couleurPrimaire: string;
  couleurSecondaire: string;
  police: string;
  photoShape: 'circle' | 'square' | 'rect' | 'hex';
  photoBorder: 'none' | 'single' | 'double' | 'shadow' | 'inset';
  photoZoom: number;
}

interface CvLayout {
  colonnes: 1 | 2;
  barreGauche: boolean;
  espacement: 'compact' | 'normal' | 'aere';
}

interface TplDef {
  id: string; nom: string; categorie: string;
  avecPhoto: boolean; scoreAts: number; isNew: boolean;
  couleurDefaut: string; popularite: number;
  render: (d: CvData, th?: Partial<CvTheme>) => string;
}

interface SavedCreation {
  id: string;
  tplId: string;
  tplName: string;
  html: string;
  savedAt: string;
}

// ═══════════════════════════════════════════════════════════
// DATA PAR DÉFAUT
// ═══════════════════════════════════════════════════════════

const DEFAULT_DATA: CvData = {
  info: {
    prenom: 'Sacha', nom: 'Dubois', titre: 'Chargée de Projet',
    email: 'sacha.dubois@mail.com', telephone: '07 58 34 21 01',
    ville: 'Paris, France', adresse: 'Paris, France',
    linkedin: 'linkedin.com/in/sachadubois', github: '', portfolio: '',
    apropos: 'Professionnelle avec 4 ans d\'expérience en gestion de projet. Spécialisée dans la coordination d\'équipes multidisciplinaires et le pilotage de projets complexes dans les délais et budgets impartis. Orientée résultats, avec une forte capacité d\'adaptation.',
    photoUrl: ''
  },
  experiences: [
    {
      id: 'e1', poste: 'Chargée de Projet', entreprise: 'Lorem Ipsum SARL',
      debut: '2021', fin: '', actuel: true,
      description: [
        'Coordination de projets transversaux avec 6 parties prenantes',
        'Réduction des délais de livraison de 20% sur l\'exercice',
        'Mise en place d\'outils de suivi Agile (Jira, Confluence)'
      ]
    },
    {
      id: 'e2', poste: 'Assistante Cheffe de Projet', entreprise: 'Plongée Fontaine',
      debut: '2019', fin: '2021', actuel: false,
      description: ['Suivi budgétaire et reporting mensuel', 'Organisation de comités de pilotage']
    }
  ],
  formations: [
    { id: 'f1', diplome: 'Master Gestion de Projet', ecole: 'IAE Paris', debut: '2017', fin: '2019', actuel: false, detail: 'Major de promotion' },
    { id: 'f2', diplome: 'Licence Administration des Entreprises', ecole: 'Université Paris I', debut: '2014', fin: '2017', actuel: false, detail: '' }
  ],
  competences: [
    { id: 'c1', nom: 'Gestion de projet' }, { id: 'c2', nom: 'Planification' },
    { id: 'c3', nom: 'Communication' },     { id: 'c4', nom: 'Leadership' },
    { id: 'c5', nom: 'Excel' },             { id: 'c6', nom: 'Google Sheets' }
  ],
  langues: [
    { id: 'l1', nom: 'Français', niveau: 'Natif' },
    { id: 'l2', nom: 'Anglais', niveau: 'Courant (C1)' }
  ],
  certifications: [
    { id: 'cert1', nom: 'PMP - Project Management Professional', org: 'PMI', annee: '2022' }
  ]
};

// ═══════════════════════════════════════════════════════════
// RENDER CONTEXT (shared theme for all template calls)
// ═══════════════════════════════════════════════════════════
let _ctx: Partial<CvTheme> | undefined;

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function uid(): string { return Math.random().toString(36).slice(2, 9); }

function period(debut: string, fin: string, actuel: boolean): string {
  return actuel ? `${debut} – Aujourd'hui` : `${debut}${fin ? ' – ' + fin : ''}`;
}

function secH(label: string, color: string, extra = ''): string {
  return `<h2 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:${color};margin:0 0 7px;border-bottom:1.5px solid ${color};padding-bottom:3px;${extra}">${label}</h2>`;
}

function photo(url: string, size = 88, extra = '', th?: Partial<CvTheme>): string {
  const t      = th ?? _ctx;                         // prefer explicit, fallback to render context
  const shape  = t?.photoShape  ?? 'circle';
  const bord   = t?.photoBorder ?? 'none';
  const zoom   = t?.photoZoom   ?? 100;
  const ac     = t?.couleurPrimaire ?? '#6366f1';
  // If a custom border is set, strip any hardcoded border/box-shadow from extra
  if (bord !== 'none') extra = extra.replace(/border:[^;]+;?/g, '').replace(/box-shadow:[^;]+;?/g, '');

  let radius = '50%', clip = '', bStyle = '';
  if (shape === 'square') radius = '8px';
  if (shape === 'rect')   { radius = '6px'; size = Math.round(size * 1.28); }
  if (shape === 'hex')    { clip = 'clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);'; radius = '0'; }

  if (bord === 'single') bStyle = `border:3px solid ${ac};`;
  else if (bord === 'double') bStyle = `border:2px solid ${ac};box-shadow:0 0 0 5px ${ac}40,0 0 0 7px ${ac};`;
  else if (bord === 'shadow') bStyle = `box-shadow:0 4px 20px rgba(0,0,0,.28);`;
  else if (bord === 'inset')  bStyle = `box-shadow:inset 0 0 0 3px ${ac};`;

  const sc = zoom !== 100 ? `transform:scale(${zoom/100});transform-origin:center;` : '';
  const base = `width:${size}px;height:${size}px;object-fit:cover;border-radius:${radius};display:block;overflow:hidden;${clip}${bStyle}${sc}${extra}`;
  return url
    ? `<img src="${url}" style="${base}" />`
    : `<div style="${base};background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size/2.5)}px;color:#94a3b8;font-family:sans-serif">👤</div>`;
}

/* ── Generalized section heading ── */
function secA(label: string, color: string, style: 'under'|'left'|'box'|'dot' = 'under'): string {
  if (style === 'left')  return `<h2 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:${color};border-left:3px solid ${color};padding-left:8px;margin:0 0 10px">${label}</h2>`;
  if (style === 'box')   return `<h2 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#fff;background:${color};padding:3px 10px;border-radius:3px;display:inline-block;margin:0 0 10px">${label}</h2>`;
  if (style === 'dot')   return `<h2 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:${color};margin:0 0 10px;display:flex;align-items:center;gap:6px"><span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>${label}</h2>`;
  return `<h2 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:${color};border-bottom:2px solid ${color};padding-bottom:3px;margin:0 0 10px">${label}</h2>`;
}

/* ── Generalized LEFT sidebar renderer ── */
function genSidebar(side: 'left'|'right', d: CvData, bg: string, ac: string, fn: string, secStyle: 'under'|'left'|'box'|'dot', th?: Partial<CvTheme>): string {
  const isDk = parseInt(bg.slice(1,3),16)*299+parseInt(bg.slice(3,5),16)*587+parseInt(bg.slice(5,7),16)*114 < 128*1000;
  const sT = isDk ? '#fff' : '#1a202c'; const sM = isDk ? 'rgba(255,255,255,.65)' : '#4a5568';
  const sidebar = `
  <div style="width:250px;background:${bg};padding:32px 20px;flex-shrink:0;box-sizing:border-box;">
    ${d.info.photoUrl||!d.info.photoUrl?`<div style="margin:0 auto 16px;width:88px">${photo(d.info.photoUrl,88,'margin:0 auto',th)}</div>`:''}
    <h1 style="font-size:16px;font-weight:800;color:${sT};margin:0 0 3px;text-align:center;line-height:1.2">${d.info.prenom} ${d.info.nom}</h1>
    <p style="font-size:10px;color:${ac==='#fff'?'rgba(255,255,255,.8)':ac};font-weight:600;margin:0 0 18px;text-align:center">${d.info.titre}</p>
    <div style="border-top:1px solid ${isDk?'rgba(255,255,255,.15)':'rgba(0,0,0,.1)'};padding-top:14px;margin-bottom:14px;">
      <p style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;color:${sM};text-transform:uppercase;margin:0 0 8px">Contact</p>
      ${d.info.email?`<p style="font-size:9px;margin:0 0 5px;color:${sT};word-break:break-all">✉ ${d.info.email}</p>`:''}
      ${d.info.telephone?`<p style="font-size:9px;margin:0 0 5px;color:${sT}">☎ ${d.info.telephone}</p>`:''}
      ${d.info.ville?`<p style="font-size:9px;margin:0 0 5px;color:${sT}">◉ ${d.info.ville}</p>`:''}
      ${d.info.linkedin?`<p style="font-size:9px;margin:0 0 5px;color:${sT};word-break:break-all">in ${d.info.linkedin}</p>`:''}
    </div>
    ${d.competences.length?`<p style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;color:${sM};text-transform:uppercase;margin:0 0 8px">Compétences</p>${d.competences.map(c=>`<div style="background:${isDk?'rgba(255,255,255,.12)':'rgba(0,0,0,.06)'};border-radius:20px;padding:3px 9px;font-size:9px;color:${sT};margin-bottom:4px;display:inline-block;margin-right:3px">${c.nom}</div>`).join('')}`:''}
    ${d.langues.length?`<p style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;color:${sM};text-transform:uppercase;margin:14px 0 8px">Langues</p>${d.langues.map(l=>`<p style="font-size:9px;margin:0 0 4px;color:${sT}">${l.nom} <span style="opacity:.65">(${l.niveau})</span></p>`).join('')}`:''}
    ${d.certifications.length?`<p style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;color:${sM};text-transform:uppercase;margin:14px 0 8px">Certifications</p>${d.certifications.map(c=>`<p style="font-size:9px;margin:0 0 4px;color:${sT}">${c.nom}</p>`).join('')}`:''}
  </div>`;
  const body = `
  <div style="flex:1;padding:32px 26px;box-sizing:border-box;font-family:${fn}">
    ${d.info.apropos?`${secA('À Propos',ac,secStyle)}<p style="font-size:10.5px;line-height:1.68;margin:0 0 20px;color:#444">${d.info.apropos}</p>`:''}
    ${d.experiences.length?`${secA('Expériences',ac,secStyle)}${d.experiences.map(e=>expBlock(e,ac,fn)).join('')}`:''}
    ${d.formations.length?`<div style="margin-top:8px">${secA('Formation',ac,secStyle)}${d.formations.map(f=>eduBlock(f,ac,fn)).join('')}</div>`:''}
  </div>`;
  return `<div style="font-family:${fn};display:flex;width:794px;min-height:1123px;background:#fff;">${side==='left'?sidebar+body:body+sidebar}</div>`;
}

/* ── Generalized HEADER renderer ── */
function genHeader(d: CvData, hbg: string, ac: string, fn: string, hStyle: 'flat'|'grad'|'split', secStyle: 'under'|'left'|'box'|'dot', th?: Partial<CvTheme>): string {
  const hbg2 = hStyle==='grad' ? ac : hbg;
  const gradStyle = hStyle==='grad' ? `background:linear-gradient(135deg,${hbg},${hbg2}dd)` : `background:${hbg}`;
  return `<div style="font-family:${fn};width:794px;min-height:1123px;background:#fff;box-sizing:border-box;">
  <div style="${gradStyle};padding:30px 46px;color:#fff">
    ${d.info.photoUrl?`<div style="float:right;margin-left:16px">${photo(d.info.photoUrl,80,'',th)}</div>`:''}
    <h1 style="font-size:24px;font-weight:800;margin:0 0 4px;letter-spacing:-.3px">${d.info.prenom} ${d.info.nom}</h1>
    <p style="font-size:11.5px;opacity:.88;margin:0 0 12px;font-weight:500">${d.info.titre}</p>
    <div style="display:flex;flex-wrap:wrap;gap:0 16px;font-size:9.5px;opacity:.78">
      ${[d.info.email,d.info.telephone,d.info.ville,d.info.linkedin].filter(Boolean).join(' · ')}
    </div>
  </div>
  <div style="padding:28px 46px">
    ${d.info.apropos?`<div style="margin-bottom:20px"><p style="font-size:10.5px;line-height:1.68;color:#444;margin:0">${d.info.apropos}</p></div>`:''}
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
      <div>
        ${d.experiences.length?`${secA('Expériences',ac,secStyle)}${d.experiences.map(e=>expBlock(e,ac,fn)).join('')}`:''}
        ${d.formations.length?`<div style="margin-top:10px">${secA('Formation',ac,secStyle)}${d.formations.map(f=>eduBlock(f,ac,fn)).join('')}</div>`:''}
      </div>
      <div>
        ${d.competences.length?`${secA('Compétences',ac,secStyle)}${d.competences.map(c=>`<div style="background:${ac}18;color:${ac};padding:3px 9px;border-radius:4px;font-size:9px;margin-bottom:4px;font-weight:600">${c.nom}</div>`).join('')}`:''}
        ${d.langues.length?`<div style="margin-top:12px">${secA('Langues',ac,secStyle)}${d.langues.map(l=>`<p style="font-size:10px;margin:0 0 4px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
        ${d.certifications.length?`<div style="margin-top:12px">${secA('Certifs',ac,secStyle)}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#444">${c.nom}</p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>
</div>`;
}

/* ── Generalized ONE-COLUMN renderer ── */
function genOneCol(d: CvData, ac: string, fn: string, headerStyle: 'border'|'bg'|'center', secStyle: 'under'|'left'|'box'|'dot', th?: Partial<CvTheme>): string {
  const hdr = headerStyle === 'center'
    ? `<div style="text-align:center;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid ${ac}">
        ${d.info.photoUrl?`<div style="margin:0 auto 12px;width:80px">${photo(d.info.photoUrl,80,'margin:0 auto',th)}</div>`:''}
        <h1 style="font-size:26px;font-weight:700;color:#1a1a1a;margin:0 0 4px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:12px;color:${ac};font-weight:600;margin:0 0 10px">${d.info.titre}</p>
        <p style="font-size:9.5px;color:#555">${[d.info.email,d.info.telephone,d.info.ville].filter(Boolean).join(' · ')}</p>
      </div>`
    : `<div style="margin-bottom:26px;padding-bottom:16px;border-bottom:3px solid ${ac};display:flex;justify-content:space-between;align-items:flex-end">
        <div>
          <h1 style="font-size:26px;font-weight:700;color:#1a1a1a;margin:0 0 4px">${d.info.prenom} ${d.info.nom}</h1>
          <p style="font-size:12px;color:${ac};font-weight:600;margin:0">${d.info.titre}</p>
        </div>
        <div style="text-align:right;font-size:9.5px;color:#555;line-height:1.8">
          ${[d.info.email,d.info.telephone,d.info.ville].filter(Boolean).join('<br>')}
        </div>
      </div>`;
  return `<div style="font-family:${fn};width:794px;min-height:1123px;background:#fff;padding:50px 58px;box-sizing:border-box;">
  ${hdr}
  ${d.info.apropos?`<div style="margin-bottom:22px"><p style="font-size:10.5px;line-height:1.7;color:#444;margin:0">${d.info.apropos}</p></div>`:''}
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
    <div>
      ${d.experiences.length?`${secA('Expériences',ac,secStyle)}${d.experiences.map(e=>expBlock(e,ac,fn)).join('')}`:''}
      ${d.formations.length?`<div style="margin-top:10px">${secA('Formation',ac,secStyle)}${d.formations.map(f=>eduBlock(f,ac,fn)).join('')}</div>`:''}
    </div>
    <div>
      ${d.competences.length?`${secA('Compétences',ac,secStyle)}${d.competences.map(c=>`<p style="font-size:10px;margin:0 0 5px;color:#333">• ${c.nom}</p>`).join('')}`:''}
      ${d.langues.length?`<div style="margin-top:14px">${secA('Langues',ac,secStyle)}${d.langues.map(l=>`<p style="font-size:10px;margin:0 0 5px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
      ${d.certifications.length?`<div style="margin-top:14px">${secA('Certifications',ac,secStyle)}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#444">${c.nom}</p>`).join('')}</div>`:''}
    </div>
  </div>
</div>`;
}

/* ── Timeline renderer ── */
function genTimeline(d: CvData, ac: string, fn: string, th?: Partial<CvTheme>): string {
  const expTl = d.experiences.map((e,i)=>`
  <div style="display:flex;gap:14px;margin-bottom:16px;position:relative">
    <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center">
      <div style="width:12px;height:12px;border-radius:50%;background:${ac};border:2px solid #fff;box-shadow:0 0 0 2px ${ac};flex-shrink:0;margin-top:2px"></div>
      ${i<d.experiences.length-1?`<div style="width:2px;flex:1;background:${ac}30;margin-top:4px"></div>`:''}
    </div>
    <div style="flex:1;padding-bottom:4px">
      <div style="font-weight:700;font-size:11.5px;color:#1a1a1a">${e.poste}</div>
      <div style="font-size:10px;color:${ac};font-weight:600;margin:2px 0">${e.entreprise} ${e.debut?'· '+e.debut+(e.actuel?' – Aujourd\'hui':e.fin?' – '+e.fin:''):''}  </div>
      ${e.description.length?`<ul style="margin:4px 0 0;padding-left:14px;font-size:10px;line-height:1.55;color:#555">${e.description.map(b=>`<li style="margin-bottom:2px">${b}</li>`).join('')}</ul>`:''}
    </div>
  </div>`).join('');
  return `<div style="font-family:${fn};width:794px;min-height:1123px;background:#fff;padding:50px 58px;box-sizing:border-box;">
  <div style="margin-bottom:28px;padding-bottom:16px;border-bottom:3px solid ${ac}">
    <div style="display:flex;align-items:center;gap:20px">
      ${d.info.photoUrl?photo(d.info.photoUrl,80,'flex-shrink:0',th):''}
      <div>
        <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;margin:0 0 4px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:12px;color:${ac};font-weight:600;margin:0 0 8px">${d.info.titre}</p>
        <p style="font-size:9.5px;color:#555;margin:0">${[d.info.email,d.info.telephone,d.info.ville,d.info.linkedin].filter(Boolean).join(' · ')}</p>
      </div>
    </div>
  </div>
  ${d.info.apropos?`<div style="background:${ac}10;border-left:3px solid ${ac};padding:10px 14px;margin-bottom:22px;border-radius:0 4px 4px 0"><p style="font-size:10.5px;line-height:1.65;color:#444;margin:0">${d.info.apropos}</p></div>`:''}
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
    <div>
      ${d.experiences.length?`${secA('Parcours',ac,'left')}<div style="padding-left:4px">${expTl}</div>`:''}
      ${d.formations.length?`<div style="margin-top:12px">${secA('Formation',ac,'left')}${d.formations.map(f=>eduBlock(f,ac,fn)).join('')}</div>`:''}
    </div>
    <div>
      ${d.competences.length?`${secA('Compétences',ac,'dot')}${d.competences.map(c=>`<div style="background:${ac}15;color:${ac};padding:3px 9px;border-radius:20px;font-size:9px;font-weight:600;margin-bottom:4px;display:inline-block;margin-right:4px">${c.nom}</div>`).join('')}`:''}
      ${d.langues.length?`<div style="margin-top:14px">${secA('Langues',ac,'dot')}${d.langues.map(l=>`<p style="font-size:10px;margin:0 0 5px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
      ${d.certifications.length?`<div style="margin-top:14px">${secA('Certifications',ac,'dot')}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#444">${c.nom}</p>`).join('')}</div>`:''}
    </div>
  </div>
</div>`;
}

function expBlock(e: CvExp, accent: string, font: string): string {
  return `<div style="margin-bottom:13px;font-family:${font}">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px">
      <strong style="font-size:11.5px;color:#1a1a1a">${e.poste}</strong>
      <span style="font-size:9px;color:#888;white-space:nowrap">${period(e.debut, e.fin, e.actuel)}</span>
    </div>
    <p style="font-size:10px;color:${accent};margin:2px 0 5px;font-weight:600">${e.entreprise}</p>
    ${e.description.length ? `<ul style="margin:0;padding-left:15px;font-size:10px;line-height:1.55;color:#444">${e.description.map(b => `<li style="margin-bottom:2px">${b}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function eduBlock(f: CvFormation, accent: string, font: string): string {
  return `<div style="margin-bottom:10px;font-family:${font}">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px">
      <strong style="font-size:11px;color:#1a1a1a">${f.diplome}</strong>
      <span style="font-size:9px;color:#888">${period(f.debut, f.fin, f.actuel)}</span>
    </div>
    <p style="font-size:10px;color:#555;margin:2px 0 0">${f.ecole}${f.detail ? ` · <em style="color:#888">${f.detail}</em>` : ''}</p>
  </div>`;
}

function tags(items: CvCompetence[], bg: string, fg: string): string {
  return items.map(c => `<span style="display:inline-block;background:${bg};color:${fg};padding:2px 8px;border-radius:3px;font-size:9px;margin:2px 2px 2px 0;font-weight:600">${c.nom}</span>`).join('');
}

// ═══════════════════════════════════════════════════════════
// TEMPLATES (15)
// ═══════════════════════════════════════════════════════════

function tModerneBeige(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#9c7c5a';
  const fn = th?.police ?? 'Calibri, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#333;background:#fff;display:flex;box-sizing:border-box">
    <div style="width:245px;background:#f5f0e8;padding:36px 22px;flex-shrink:0;box-sizing:border-box">
      <div style="margin:0 auto 16px;width:84px">${photo(d.info.photoUrl, 84, 'margin:0 auto')}</div>
      <h1 style="font-size:16px;font-weight:700;color:#2c2c2c;margin:0 0 3px;text-align:center">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:10px;color:${pc};font-weight:600;margin:0 0 18px;text-align:center">${d.info.titre}</p>
      ${secH('Contact', pc)}
      ${d.info.email ? `<p style="font-size:9.5px;margin:0 0 4px;color:#555">📧 ${d.info.email}</p>` : ''}
      ${d.info.telephone ? `<p style="font-size:9.5px;margin:0 0 4px;color:#555">📞 ${d.info.telephone}</p>` : ''}
      ${d.info.ville ? `<p style="font-size:9.5px;margin:0 0 4px;color:#555">📍 ${d.info.ville}</p>` : ''}
      ${d.info.linkedin ? `<p style="font-size:9.5px;margin:0 0 18px;color:#555;word-break:break-all">🔗 ${d.info.linkedin}</p>` : ''}
      ${d.competences.length ? `${secH('Compétences', pc)}${d.competences.map(c => `<p style="font-size:9.5px;margin:0 0 4px;color:#444">• ${c.nom}</p>`).join('')}` : ''}
      ${d.langues.length ? `<div style="margin-top:16px">${secH('Langues', pc)}${d.langues.map(l => `<p style="font-size:9.5px;margin:0 0 4px;color:#444">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>` : ''}
    </div>
    <div style="flex:1;padding:36px 28px;box-sizing:border-box">
      ${d.info.apropos ? `${secH('À Propos', pc)}<p style="font-size:10.5px;line-height:1.65;margin:0 0 20px;color:#444">${d.info.apropos}</p>` : ''}
      ${d.experiences.length ? `${secH('Expériences Professionnelles', pc)}${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
      ${d.formations.length ? `<div style="margin-top:4px">${secH('Formation', pc)}${d.formations.map(f => eduBlock(f, pc, fn)).join('')}</div>` : ''}
      ${d.certifications.length ? `<div style="margin-top:8px">${secH('Certifications', pc)}${d.certifications.map(c => `<p style="font-size:10px;margin:0 0 4px">${c.nom} · <em style="color:#888">${c.org}, ${c.annee}</em></p>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

function tBordeaux(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#881337';
  const fn = th?.police ?? 'Georgia, serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#1a1a1a;background:#fff;box-sizing:border-box">
    <div style="background:${pc};padding:32px 48px;color:#fff">
      <h1 style="font-size:26px;font-weight:700;letter-spacing:.5px;margin:0 0 4px">${d.info.prenom.toUpperCase()} ${d.info.nom.toUpperCase()}</h1>
      <p style="font-size:12px;opacity:.85;letter-spacing:.5px;margin:0 0 14px">${d.info.titre}</p>
      <div style="display:flex;flex-wrap:wrap;gap:0 20px;font-size:10px;opacity:.8">
        ${d.info.email ? `<span>✉ ${d.info.email}</span>` : ''}
        ${d.info.telephone ? `<span>☎ ${d.info.telephone}</span>` : ''}
        ${d.info.ville ? `<span>◉ ${d.info.ville}</span>` : ''}
        ${d.info.linkedin ? `<span>in ${d.info.linkedin}</span>` : ''}
      </div>
    </div>
    <div style="padding:32px 48px">
      ${d.info.apropos ? `<div style="border-left:3px solid ${pc};padding-left:14px;margin-bottom:24px"><p style="font-size:11px;line-height:1.7;color:#374151;font-style:italic;margin:0">${d.info.apropos}</p></div>` : ''}
      ${d.experiences.length ? `<div style="margin-bottom:20px">${secH('Expériences Professionnelles', pc)}<div style="height:1px;background:#f0e8e8;margin-bottom:14px"></div>${d.experiences.map(e => expBlock(e, pc, fn)).join('')}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div>
          ${d.formations.length ? `${secH('Formation', pc)}${d.formations.map(f => eduBlock(f, pc, fn)).join('')}` : ''}
          ${d.certifications.length ? `<div style="margin-top:12px">${secH('Certifications', pc)}${d.certifications.map(c => `<p style="font-size:10px;margin:0 0 4px">${c.nom}</p><p style="font-size:9px;color:#888;margin:0 0 6px">${c.org} · ${c.annee}</p>`).join('')}</div>` : ''}
        </div>
        <div>
          ${d.competences.length ? `${secH('Compétences', pc)}${tags(d.competences, '#fce7f3', pc)}` : ''}
          ${d.langues.length ? `<div style="margin-top:14px">${secH('Langues', pc)}${d.langues.map(l => `<p style="font-size:10px;margin:0 0 4px">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function tBleuPro(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#1d4ed8';
  const fn = th?.police ?? 'Arial, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;display:flex;box-sizing:border-box">
    <div style="width:235px;background:${pc};padding:36px 20px;flex-shrink:0;box-sizing:border-box;color:#fff">
      <div style="margin:0 auto 16px">${photo(d.info.photoUrl, 90, 'margin:0 auto;border:3px solid rgba(255,255,255,.4)')}</div>
      <h1 style="font-size:15px;font-weight:800;color:#fff;margin:0 0 3px;text-align:center;line-height:1.2">${d.info.prenom}<br>${d.info.nom}</h1>
      <p style="font-size:9.5px;color:rgba(255,255,255,.75);margin:0 0 20px;text-align:center">${d.info.titre}</p>
      <h3 style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.55);margin:0 0 6px;border-bottom:1px solid rgba(255,255,255,.2);padding-bottom:3px">Contact</h3>
      ${d.info.email ? `<p style="font-size:9px;margin:0 0 5px;color:rgba(255,255,255,.85);word-break:break-all">✉ ${d.info.email}</p>` : ''}
      ${d.info.telephone ? `<p style="font-size:9px;margin:0 0 5px;color:rgba(255,255,255,.85)">☎ ${d.info.telephone}</p>` : ''}
      ${d.info.ville ? `<p style="font-size:9px;margin:0 0 5px;color:rgba(255,255,255,.85)">◉ ${d.info.ville}</p>` : ''}
      ${d.info.linkedin ? `<p style="font-size:9px;margin:0 0 18px;color:rgba(255,255,255,.85);word-break:break-all">🔗 ${d.info.linkedin}</p>` : ''}
      ${d.competences.length ? `<h3 style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.55);margin:0 0 6px;border-bottom:1px solid rgba(255,255,255,.2);padding-bottom:3px">Compétences</h3>${d.competences.map(c => `<div style="background:rgba(255,255,255,.15);border-radius:3px;padding:2px 7px;font-size:9px;margin-bottom:3px;color:#fff">${c.nom}</div>`).join('')}` : ''}
      ${d.langues.length ? `<h3 style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.55);margin:14px 0 6px;border-bottom:1px solid rgba(255,255,255,.2);padding-bottom:3px">Langues</h3>${d.langues.map(l => `<p style="font-size:9px;margin:0 0 4px;color:rgba(255,255,255,.85)">${l.nom} <span style="opacity:.6">(${l.niveau})</span></p>`).join('')}` : ''}
    </div>
    <div style="flex:1;padding:36px 28px;box-sizing:border-box">
      ${d.info.apropos ? `${secH('Profil', pc)}<p style="font-size:10.5px;line-height:1.65;margin:0 0 20px;color:#444">${d.info.apropos}</p>` : ''}
      ${d.experiences.length ? `${secH('Expériences', pc)}${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
      ${d.formations.length ? `<div style="margin-top:6px">${secH('Formation', pc)}${d.formations.map(f => eduBlock(f, pc, fn)).join('')}</div>` : ''}
      ${d.certifications.length ? `<div style="margin-top:8px">${secH('Certifications', pc)}${d.certifications.map(c => `<p style="font-size:10px;margin:0 0 4px">${c.nom} <span style="color:#888">· ${c.annee}</span></p>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

function tMinimalisteGris(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#475569';
  const fn = th?.police ?? 'Helvetica Neue, Helvetica, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#1a1a1a;background:#fff;padding:52px 60px;box-sizing:border-box">
    <div style="margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #e2e8f0">
      <h1 style="font-size:26px;font-weight:300;letter-spacing:1px;margin:0 0 5px;color:#1a1a1a">${d.info.prenom} <strong style="font-weight:700">${d.info.nom}</strong></h1>
      <p style="font-size:12px;color:${pc};margin:0 0 10px;font-weight:500">${d.info.titre}</p>
      <div style="display:flex;flex-wrap:wrap;gap:0 16px;font-size:9.5px;color:#64748b">
        ${d.info.email ? `<span>${d.info.email}</span>` : ''}
        ${d.info.telephone ? `<span>${d.info.telephone}</span>` : ''}
        ${d.info.ville ? `<span>${d.info.ville}</span>` : ''}
        ${d.info.linkedin ? `<span>${d.info.linkedin}</span>` : ''}
      </div>
    </div>
    ${d.info.apropos ? `<div style="margin-bottom:22px"><p style="font-size:10.5px;line-height:1.7;color:#444;margin:0">${d.info.apropos}</p></div>` : ''}
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
      <div>
        ${d.experiences.length ? `<div style="margin-bottom:20px"><h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.8px;color:${pc};margin:0 0 14px">Expériences</h2>${d.experiences.map(e => expBlock(e, pc, fn)).join('')}</div>` : ''}
        ${d.formations.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.8px;color:${pc};margin:0 0 14px">Formation</h2>${d.formations.map(f => eduBlock(f, pc, fn)).join('')}` : ''}
      </div>
      <div>
        ${d.competences.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.8px;color:${pc};margin:0 0 10px">Compétences</h2>${d.competences.map(c => `<p style="font-size:10px;margin:0 0 5px;padding-bottom:5px;border-bottom:1px solid #f1f5f9;color:#333">• ${c.nom}</p>`).join('')}` : ''}
        ${d.langues.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.8px;color:${pc};margin:16px 0 10px">Langues</h2>${d.langues.map(l => `<p style="font-size:10px;margin:0 0 5px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}` : ''}
      </div>
    </div>
  </div>`;
}

function tMinimalisteNoir(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#000000';
  const fn = th?.police ?? 'Times New Roman, serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#111;background:#fff;padding:60px 72px;box-sizing:border-box">
    <div style="text-align:center;margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid #111">
      <h1 style="font-size:28px;font-weight:700;text-transform:uppercase;letter-spacing:3px;margin:0 0 6px">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#555;margin:0 0 10px">${d.info.titre}</p>
      <p style="font-size:9.5px;color:#777;margin:0;letter-spacing:.5px">
        ${[d.info.email, d.info.telephone, d.info.ville, d.info.linkedin].filter(Boolean).join(' · ')}
      </p>
    </div>
    ${d.info.apropos ? `<p style="font-size:11px;line-height:1.8;margin:0 0 28px;color:#333;text-align:justify">${d.info.apropos}</p>` : ''}
    ${d.experiences.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;border-bottom:1px solid #111;padding-bottom:4px">Expériences</h2>${d.experiences.map(e => expBlock(e, pc, fn)).join('')}<div style="height:20px"></div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>
        ${d.formations.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;border-bottom:1px solid #111;padding-bottom:4px">Formation</h2>${d.formations.map(f => eduBlock(f, pc, fn)).join('')}` : ''}
      </div>
      <div>
        ${d.competences.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;border-bottom:1px solid #111;padding-bottom:4px">Compétences</h2>${d.competences.map(c => `<p style="font-size:10px;margin:0 0 4px">• ${c.nom}</p>`).join('')}` : ''}
        ${d.langues.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:14px 0 12px;border-bottom:1px solid #111;padding-bottom:4px">Langues</h2>${d.langues.map(l => `<p style="font-size:10px;margin:0 0 4px">${l.nom} (${l.niveau})</p>`).join('')}` : ''}
      </div>
    </div>
  </div>`;
}

function tVertModerne(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#059669';
  const fn = th?.police ?? 'Calibri, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;display:flex;box-sizing:border-box">
    <div style="width:8px;background:${pc};flex-shrink:0"></div>
    <div style="width:220px;background:#f0fdf4;padding:36px 18px;flex-shrink:0;box-sizing:border-box">
      <div style="margin-bottom:16px">${photo(d.info.photoUrl, 80, 'margin:0 auto;border:3px solid ' + pc)}</div>
      <h1 style="font-size:15px;font-weight:800;color:#14532d;margin:0 0 3px;text-align:center">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:9.5px;color:${pc};font-weight:600;margin:0 0 18px;text-align:center">${d.info.titre}</p>
      ${secH('Contact', pc)}
      ${d.info.email ? `<p style="font-size:9px;margin:0 0 4px;color:#374151;word-break:break-all">✉ ${d.info.email}</p>` : ''}
      ${d.info.telephone ? `<p style="font-size:9px;margin:0 0 4px;color:#374151">☎ ${d.info.telephone}</p>` : ''}
      ${d.info.ville ? `<p style="font-size:9px;margin:0 0 4px;color:#374151">◉ ${d.info.ville}</p>` : ''}
      ${d.info.linkedin ? `<p style="font-size:9px;margin:0 0 16px;color:#374151;word-break:break-all">🔗 ${d.info.linkedin}</p>` : ''}
      ${d.competences.length ? `${secH('Compétences', pc)}${tags(d.competences, '#dcfce7', pc)}` : ''}
      ${d.langues.length ? `<div style="margin-top:14px">${secH('Langues', pc)}${d.langues.map(l => `<p style="font-size:9px;margin:0 0 4px;color:#374151">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>` : ''}
    </div>
    <div style="flex:1;padding:36px 28px;box-sizing:border-box">
      ${d.info.apropos ? `${secH('Profil', pc)}<p style="font-size:10.5px;line-height:1.65;margin:0 0 20px;color:#374151">${d.info.apropos}</p>` : ''}
      ${d.experiences.length ? `${secH('Expériences', pc)}${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
      ${d.formations.length ? `${secH('Formation', pc)}${d.formations.map(f => eduBlock(f, pc, fn)).join('')}` : ''}
      ${d.certifications.length ? `${secH('Certifications', pc)}${d.certifications.map(c => `<p style="font-size:10px;margin:0 0 4px">${c.nom} <span style="color:#888">(${c.annee})</span></p>`).join('')}` : ''}
    </div>
  </div>`;
}

function tBleuClair(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#0ea5e9';
  const fn = th?.police ?? 'Verdana, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;box-sizing:border-box">
    <div style="background:linear-gradient(135deg,${pc},#38bdf8);padding:36px 48px;color:#fff">
      ${d.info.photoUrl ? `<div style="float:right;margin-left:16px">${photo(d.info.photoUrl, 80, 'border:3px solid rgba(255,255,255,.5)')}</div>` : ''}
      <h1 style="font-size:24px;font-weight:800;margin:0 0 4px">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:11.5px;opacity:.9;margin:0 0 12px;font-weight:500">${d.info.titre}</p>
      <div style="display:flex;flex-wrap:wrap;gap:0 16px;font-size:9.5px;opacity:.8">
        ${[d.info.email, d.info.telephone, d.info.ville].filter(Boolean).join(' · ')}
      </div>
    </div>
    <div style="padding:32px 48px">
      ${d.info.apropos ? `<div style="background:#f0f9ff;border-left:3px solid ${pc};padding:12px 16px;margin-bottom:22px;border-radius:0 6px 6px 0"><p style="font-size:10.5px;line-height:1.65;color:#0c4a6e;margin:0">${d.info.apropos}</p></div>` : ''}
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
        <div>
          ${d.experiences.length ? `${secH('Expériences', pc)}${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
          ${d.formations.length ? `<div style="margin-top:8px">${secH('Formation', pc)}${d.formations.map(f => eduBlock(f, pc, fn)).join('')}</div>` : ''}
        </div>
        <div>
          ${d.competences.length ? `${secH('Compétences', pc)}${d.competences.map(c => `<div style="background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:4px;font-size:9px;margin-bottom:4px;font-weight:600">${c.nom}</div>`).join('')}` : ''}
          ${d.langues.length ? `<div style="margin-top:14px">${secH('Langues', pc)}${d.langues.map(l => `<p style="font-size:10px;margin:0 0 5px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function tBeigeElegant(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#92400e';
  const fn = th?.police ?? 'Palatino Linotype, Palatino, serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fdfaf5;box-sizing:border-box">
    <div style="background:#1c1208;padding:28px 52px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <h1 style="font-size:22px;font-weight:700;color:#fef3c7;letter-spacing:.5px;margin:0 0 5px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:11px;color:#f59e0b;letter-spacing:.5px;margin:0">${d.info.titre}</p>
      </div>
      <div style="text-align:right;font-size:9.5px;color:#d97706;line-height:2">
        ${[d.info.email, d.info.telephone, d.info.ville].filter(Boolean).join('<br>')}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:0">
      <div style="padding:32px 32px 32px 52px;border-right:1px solid #e9d9c0">
        ${d.info.apropos ? `<div style="border-left:3px solid ${pc};padding-left:14px;margin-bottom:24px"><p style="font-size:10.5px;line-height:1.7;color:#44311a;font-style:italic;margin:0">${d.info.apropos}</p></div>` : ''}
        ${d.experiences.length ? `${secH('Parcours Professionnel', pc)}<div style="height:1px;background:#e9d9c0;margin-bottom:14px"></div>${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
        ${d.formations.length ? `<div style="margin-top:16px">${secH('Formation', pc)}<div style="height:1px;background:#e9d9c0;margin-bottom:14px"></div>${d.formations.map(f => eduBlock(f, pc, fn)).join('')}</div>` : ''}
      </div>
      <div style="padding:32px 32px 32px 24px">
        ${d.info.photoUrl ? `<div style="margin-bottom:20px">${photo(d.info.photoUrl, 90, 'margin:0 auto;border:4px solid #e9d9c0')}</div>` : ''}
        ${d.competences.length ? `${secH('Compétences', pc)}${tags(d.competences, '#fef3c7', pc)}` : ''}
        ${d.langues.length ? `<div style="margin-top:16px">${secH('Langues', pc)}${d.langues.map(l => `<p style="font-size:10px;margin:0 0 5px;color:#44311a">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>` : ''}
        ${d.certifications.length ? `<div style="margin-top:16px">${secH('Certifications', pc)}${d.certifications.map(c => `<p style="font-size:10px;margin:0 0 4px;color:#44311a">${c.nom}</p>`).join('')}</div>` : ''}
        ${d.info.linkedin ? `<div style="margin-top:16px"><p style="font-size:9px;color:#888;word-break:break-all">🔗 ${d.info.linkedin}</p></div>` : ''}
      </div>
    </div>
  </div>`;
}

function tVertPastel(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#16a34a';
  const fn = th?.police ?? 'Trebuchet MS, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;box-sizing:border-box;padding:0">
    <div style="background:#f0fdf4;border-bottom:3px solid ${pc};padding:32px 48px;display:flex;align-items:center;gap:20px">
      ${d.info.photoUrl ? photo(d.info.photoUrl, 80, 'flex-shrink:0') : ''}
      <div style="flex:1">
        <h1 style="font-size:22px;font-weight:800;color:#14532d;margin:0 0 4px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:11px;color:${pc};font-weight:600;margin:0 0 10px">${d.info.titre}</p>
        <div style="display:flex;flex-wrap:wrap;gap:0 14px;font-size:9.5px;color:#555">
          ${[d.info.email, d.info.telephone, d.info.ville, d.info.linkedin].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
    <div style="padding:32px 48px">
      ${d.info.apropos ? `<div style="background:#f0fdf4;border-radius:6px;padding:14px 16px;margin-bottom:22px"><p style="font-size:10.5px;line-height:1.65;color:#166534;margin:0">${d.info.apropos}</p></div>` : ''}
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
        <div>
          ${d.experiences.length ? `${secH('Expériences', pc)}${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
          ${d.formations.length ? `<div style="margin-top:8px">${secH('Formation', pc)}${d.formations.map(f => eduBlock(f, pc, fn)).join('')}</div>` : ''}
        </div>
        <div>
          ${d.competences.length ? `${secH('Compétences', pc)}${d.competences.map(c => `<div style="background:#dcfce7;color:#15803d;padding:3px 9px;border-radius:20px;font-size:9px;margin-bottom:4px;font-weight:600;display:inline-block;margin-right:4px">${c.nom}</div>`).join('')}` : ''}
          ${d.langues.length ? `<div style="margin-top:14px">${secH('Langues', pc)}${d.langues.map(l => `<p style="font-size:10px;margin:0 0 5px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function tPhotographe(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#f97316';
  const fn = th?.police ?? 'Helvetica Neue, Helvetica, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;display:flex;box-sizing:border-box">
    <div style="width:260px;background:#1e293b;padding:36px 22px;flex-shrink:0;box-sizing:border-box;color:#fff">
      <div style="margin-bottom:18px">${photo(d.info.photoUrl, 100, 'margin:0 auto;border:4px solid ' + pc + ';border-radius:8px')}</div>
      <h1 style="font-size:15px;font-weight:800;color:#f1f5f9;margin:0 0 3px;text-align:center">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:9.5px;color:${pc};font-weight:600;margin:0 0 20px;text-align:center">${d.info.titre}</p>
      <div style="border-top:1px solid #334155;padding-top:16px">
        <h3 style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:${pc};margin:0 0 8px">Contact</h3>
        ${d.info.email ? `<p style="font-size:9px;margin:0 0 5px;color:#94a3b8;word-break:break-all">✉ ${d.info.email}</p>` : ''}
        ${d.info.telephone ? `<p style="font-size:9px;margin:0 0 5px;color:#94a3b8">☎ ${d.info.telephone}</p>` : ''}
        ${d.info.ville ? `<p style="font-size:9px;margin:0 0 5px;color:#94a3b8">◉ ${d.info.ville}</p>` : ''}
        ${d.info.portfolio ? `<p style="font-size:9px;margin:0 0 5px;color:#94a3b8;word-break:break-all">🌐 ${d.info.portfolio}</p>` : ''}
        ${d.info.linkedin ? `<p style="font-size:9px;margin:0 0 16px;color:#94a3b8;word-break:break-all">🔗 ${d.info.linkedin}</p>` : ''}
        ${d.competences.length ? `<h3 style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:${pc};margin:0 0 8px">Compétences</h3>${d.competences.map(c => `<div style="background:#334155;border-left:2px solid ${pc};padding:3px 8px;font-size:9px;margin-bottom:3px;color:#e2e8f0">${c.nom}</div>`).join('')}` : ''}
        ${d.langues.length ? `<h3 style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:${pc};margin:14px 0 8px">Langues</h3>${d.langues.map(l => `<p style="font-size:9px;margin:0 0 4px;color:#94a3b8">${l.nom} <span style="color:#64748b">(${l.niveau})</span></p>`).join('')}` : ''}
      </div>
    </div>
    <div style="flex:1;padding:36px 28px;box-sizing:border-box">
      ${d.info.apropos ? `${secH('À Propos', pc)}<p style="font-size:10.5px;line-height:1.65;margin:0 0 20px;color:#374151">${d.info.apropos}</p>` : ''}
      ${d.experiences.length ? `${secH('Expériences', pc)}${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
      ${d.formations.length ? `<div style="margin-top:6px">${secH('Formation', pc)}${d.formations.map(f => eduBlock(f, pc, fn)).join('')}</div>` : ''}
      ${d.certifications.length ? `<div style="margin-top:8px">${secH('Certifications', pc)}${d.certifications.map(c => `<p style="font-size:10px;margin:0 0 4px">${c.nom} <span style="color:#888">· ${c.annee}</span></p>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

function tViolet(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#7c3aed';
  const fn = th?.police ?? 'Calibri, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;box-sizing:border-box">
    <div style="background:linear-gradient(135deg,${pc},#a855f7);padding:36px 48px;color:#fff">
      ${d.info.photoUrl ? `<div style="float:right">${photo(d.info.photoUrl, 78, 'border:3px solid rgba(255,255,255,.4)')}</div>` : ''}
      <h1 style="font-size:26px;font-weight:900;letter-spacing:-1px;margin:0 0 5px">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:12px;opacity:.88;margin:0 0 14px;font-weight:500">${d.info.titre}</p>
      <div style="display:flex;flex-wrap:wrap;gap:0 16px;font-size:9.5px;opacity:.75">
        ${[d.info.email, d.info.telephone, d.info.ville, d.info.linkedin].filter(Boolean).join(' · ')}
      </div>
    </div>
    <div style="padding:28px 48px">
      ${d.info.apropos ? `<p style="font-size:10.5px;line-height:1.65;margin:0 0 22px;color:#374151;border-left:3px solid #ede9fe;padding-left:14px">${d.info.apropos}</p>` : ''}
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
        <div>
          ${d.experiences.length ? `${secH('Expériences', pc)}${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
          ${d.formations.length ? `<div style="margin-top:8px">${secH('Formation', pc)}${d.formations.map(f => eduBlock(f, pc, fn)).join('')}</div>` : ''}
        </div>
        <div>
          ${d.competences.length ? `${secH('Compétences', pc)}${tags(d.competences, '#f3f0ff', pc)}` : ''}
          ${d.langues.length ? `<div style="margin-top:16px">${secH('Langues', pc)}${d.langues.map(l => `<p style="font-size:10px;margin:0 0 5px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>` : ''}
          ${d.certifications.length ? `<div style="margin-top:14px">${secH('Certifications', pc)}${d.certifications.map(c => `<p style="font-size:9.5px;margin:0 0 5px;color:#333">${c.nom}</p>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function tOrange(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#ea580c';
  const fn = th?.police ?? 'Arial, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;box-sizing:border-box">
    <div style="background:#fff7ed;border-bottom:3px solid ${pc};padding:28px 48px;display:flex;align-items:center;gap:20px">
      ${d.info.photoUrl ? photo(d.info.photoUrl, 82, 'flex-shrink:0;border:3px solid ' + pc) : ''}
      <div>
        <h1 style="font-size:22px;font-weight:800;color:#431407;margin:0 0 4px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:11px;color:${pc};font-weight:600;margin:0 0 8px">${d.info.titre}</p>
        <div style="font-size:9.5px;color:#78350f">${[d.info.email, d.info.telephone, d.info.ville].filter(Boolean).join(' · ')}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:0">
      <div style="padding:28px 28px 28px 48px;border-right:1px solid #fed7aa">
        ${d.info.apropos ? `<div style="margin-bottom:20px"><p style="font-size:10.5px;line-height:1.65;color:#374151;margin:0">${d.info.apropos}</p></div>` : ''}
        ${d.experiences.length ? `${secH('Expériences', pc)}${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
        ${d.formations.length ? `<div style="margin-top:8px">${secH('Formation', pc)}${d.formations.map(f => eduBlock(f, pc, fn)).join('')}</div>` : ''}
      </div>
      <div style="padding:28px 28px 28px 24px">
        ${d.info.linkedin ? `<p style="font-size:9px;color:#78350f;margin:0 0 16px;word-break:break-all">🔗 ${d.info.linkedin}</p>` : ''}
        ${d.competences.length ? `${secH('Compétences', pc)}${d.competences.map(c => `<div style="border-bottom:1px solid #fed7aa;padding:4px 0;font-size:9.5px;color:#374151">• ${c.nom}</div>`).join('')}` : ''}
        ${d.langues.length ? `<div style="margin-top:14px">${secH('Langues', pc)}${d.langues.map(l => `<p style="font-size:10px;margin:0 0 5px;color:#374151">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>` : ''}
        ${d.certifications.length ? `<div style="margin-top:14px">${secH('Certifications', pc)}${d.certifications.map(c => `<p style="font-size:9.5px;margin:0 0 4px;color:#374151">${c.nom}</p>`).join('')}</div>` : ''}
      </div>
    </div>
  </div>`;
}

function tBleuMarine(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#0f2444';
  const ac = '#3b82f6';
  const fn = th?.police ?? 'Georgia, serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;box-sizing:border-box">
    <div style="background:${pc};padding:32px 52px;color:#fff">
      <h1 style="font-size:24px;font-weight:700;margin:0 0 5px;letter-spacing:.5px">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:11.5px;color:${ac};margin:0 0 12px;font-weight:500;letter-spacing:.5px">${d.info.titre}</p>
      <div style="display:flex;flex-wrap:wrap;gap:0 20px;font-size:9.5px;color:rgba(255,255,255,.7)">
        ${[d.info.email, d.info.telephone, d.info.ville, d.info.linkedin].filter(Boolean).join(' · ')}
      </div>
    </div>
    <div style="padding:28px 52px">
      ${d.info.apropos ? `<div style="background:#f0f4ff;border-left:4px solid ${ac};padding:12px 16px;margin-bottom:22px;border-radius:0 4px 4px 0"><p style="font-size:10.5px;line-height:1.65;color:#1e3a5f;margin:0">${d.info.apropos}</p></div>` : ''}
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
        <div>
          ${d.experiences.length ? `${secH('Expériences', ac)}<div style="border-top:1px solid #e2e8f0;margin-bottom:14px"></div>${d.experiences.map(e => expBlock(e, ac, fn)).join('')}` : ''}
          ${d.formations.length ? `<div style="margin-top:8px">${secH('Formation', ac)}<div style="border-top:1px solid #e2e8f0;margin-bottom:14px"></div>${d.formations.map(f => eduBlock(f, ac, fn)).join('')}</div>` : ''}
        </div>
        <div>
          ${d.competences.length ? `${secH('Compétences', ac)}${tags(d.competences, '#dbeafe', ac)}` : ''}
          ${d.langues.length ? `<div style="margin-top:14px">${secH('Langues', ac)}${d.langues.map(l => `<p style="font-size:10px;margin:0 0 5px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>` : ''}
          ${d.certifications.length ? `<div style="margin-top:14px">${secH('Certifications', ac)}${d.certifications.map(c => `<p style="font-size:9.5px;margin:0 0 4px;color:#333">${c.nom}</p>`).join('')}</div>` : ''}
          ${d.info.photoUrl ? `<div style="margin-top:14px">${photo(d.info.photoUrl, 80, 'border:3px solid ' + ac)}</div>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function tRouge(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#dc2626';
  const fn = th?.police ?? 'Arial, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;box-sizing:border-box">
    <div style="background:linear-gradient(90deg,${pc},#ef4444);padding:28px 48px;color:#fff">
      ${d.info.photoUrl ? `<div style="float:right">${photo(d.info.photoUrl, 76, 'border:3px solid rgba(255,255,255,.4)')}</div>` : ''}
      <h1 style="font-size:22px;font-weight:800;margin:0 0 5px">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:11px;opacity:.9;margin:0 0 10px;font-weight:600">${d.info.titre}</p>
      <p style="font-size:9.5px;opacity:.75;margin:0">${[d.info.email, d.info.telephone, d.info.ville].filter(Boolean).join(' · ')}</p>
    </div>
    <div style="padding:28px 48px">
      ${d.info.apropos ? `<div style="margin-bottom:22px"><h2 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${pc};margin:0 0 8px;border-left:3px solid ${pc};padding-left:8px">Profil</h2><p style="font-size:10.5px;line-height:1.65;color:#374151;margin:0">${d.info.apropos}</p></div>` : ''}
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
        <div>
          ${d.experiences.length ? `<h2 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${pc};margin:0 0 14px;border-left:3px solid ${pc};padding-left:8px">Expériences</h2>${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
          ${d.formations.length ? `<div style="margin-top:8px"><h2 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${pc};margin:0 0 14px;border-left:3px solid ${pc};padding-left:8px">Formation</h2>${d.formations.map(f => eduBlock(f, pc, fn)).join('')}</div>` : ''}
        </div>
        <div>
          ${d.competences.length ? `<h2 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${pc};margin:0 0 10px;border-left:3px solid ${pc};padding-left:8px">Compétences</h2>${d.competences.map(c => `<div style="padding:4px 0;font-size:9.5px;color:#374151;border-bottom:1px solid #fee2e2">• ${c.nom}</div>`).join('')}` : ''}
          ${d.langues.length ? `<div style="margin-top:14px"><h2 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${pc};margin:0 0 10px;border-left:3px solid ${pc};padding-left:8px">Langues</h2>${d.langues.map(l => `<p style="font-size:10px;margin:0 0 5px;color:#374151">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>` : ''}
          ${d.info.linkedin ? `<p style="font-size:9px;color:#888;margin:14px 0 0;word-break:break-all">🔗 ${d.info.linkedin}</p>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function tGrisCorp(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#374151';
  const fn = th?.police ?? 'Calibri, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;padding:52px 60px;box-sizing:border-box">
    <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${pc};display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <h1 style="font-size:24px;font-weight:700;color:#111;margin:0 0 4px;letter-spacing:.3px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:11px;color:${pc};font-weight:600;margin:0;letter-spacing:.5px">${d.info.titre}</p>
      </div>
      ${d.info.photoUrl ? photo(d.info.photoUrl, 72, 'border:2px solid ' + pc) : ''}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:0 20px;font-size:9.5px;color:#555;margin-bottom:22px;padding-bottom:12px;border-bottom:1px solid #e5e7eb">
      ${[d.info.email, d.info.telephone, d.info.ville, d.info.linkedin].filter(Boolean).join(' · ')}
    </div>
    ${d.info.apropos ? `<div style="margin-bottom:22px"><p style="font-size:10.5px;line-height:1.7;color:#444;margin:0">${d.info.apropos}</p></div>` : ''}
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
      <div>
        ${d.experiences.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${pc};margin:0 0 12px;padding-bottom:4px;border-bottom:1px solid #e5e7eb">Expériences</h2>${d.experiences.map(e => expBlock(e, pc, fn)).join('')}` : ''}
        ${d.formations.length ? `<div style="margin-top:16px"><h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${pc};margin:0 0 12px;padding-bottom:4px;border-bottom:1px solid #e5e7eb">Formation</h2>${d.formations.map(f => eduBlock(f, pc, fn)).join('')}</div>` : ''}
      </div>
      <div>
        ${d.competences.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${pc};margin:0 0 12px;padding-bottom:4px;border-bottom:1px solid #e5e7eb">Compétences</h2>${d.competences.map(c => `<p style="font-size:10px;margin:0 0 5px;color:#374151">• ${c.nom}</p>`).join('')}` : ''}
        ${d.langues.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${pc};margin:14px 0 12px;padding-bottom:4px;border-bottom:1px solid #e5e7eb">Langues</h2>${d.langues.map(l => `<p style="font-size:10px;margin:0 0 5px;color:#374151">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}` : ''}
        ${d.certifications.length ? `<h2 style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${pc};margin:14px 0 12px;padding-bottom:4px;border-bottom:1px solid #e5e7eb">Certifications</h2>${d.certifications.map(c => `<p style="font-size:9.5px;margin:0 0 4px;color:#374151">${c.nom}</p>`).join('')}` : ''}
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// CATALOGUE
// ═══════════════════════════════════════════════════════════

const CATEGORIES = [
  { id: 'all',       label: 'Tous les modèles' },
  { id: 'cv2026',    label: '✨ CV 2026' },
  { id: 'moderne',   label: 'Moderne' },
  { id: 'minimaliste', label: 'Minimaliste' },
  { id: 'creatif',   label: 'Créatif' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'dev',       label: 'IT / Développeur' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'designer',  label: 'Designer' },
  { id: 'etudiant',  label: 'Étudiant' },
  { id: 'executive', label: 'Executive' }
];

const COLOR_SWATCHES = [
  '#3b82f6','#06b6d4','#0d9488','#16a34a',
  '#7c3aed','#ec4899','#dc2626','#ea580c',
  '#ca8a04','#9c7c5a','#475569','#0f172a'
];

const FONTS = [
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica Neue, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Palatino', value: 'Palatino Linotype, Palatino, serif' },
  { label: 'Trebuchet', value: 'Trebuchet MS, sans-serif' }
];

// ═══════════════════════════════════════════════════════════
// TEMPLATES PARAMÉTRIQUES (25 nouveaux)
// ═══════════════════════════════════════════════════════════

// ── Sidebar gauche ──────────────────────────────────────────
const tChocolat     = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#2d1506','#c9863e','Palatino Linotype,Palatino,serif','under',th);
const tForetProfond = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#0a2416','#22c55e','Trebuchet MS,sans-serif','dot',th);
const tMinuitElec   = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#0f0b2e','#818cf8','Calibri,sans-serif','left',th);
const tCorailVif    = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#c94a2e','#ff6b4a','Arial,sans-serif','under',th);
const tOrElegant    = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#1a1202','#d4a017','Georgia,serif','box',th);
const tCobaltPro    = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#0c1d3d','#60a5fa','Calibri,sans-serif','left',th);
const tArdoise      = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#1e2d3d','#67e8f9','Helvetica Neue,Helvetica,sans-serif','dot',th);
const tPruneSombre  = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#1a0a2e','#a855f7','Calibri,sans-serif','left',th);
const tRoseElegante = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#3d0a1a','#f43f5e','Georgia,serif','under',th);
const tMentheFraich = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#042d1e','#10b981','Trebuchet MS,sans-serif','dot',th);
const tGraphiteElite= (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#1a1d22','#94a3b8','Arial,sans-serif','under',th);
const tTerracotta   = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('left',d,'#3d1505','#c2553f','Georgia,serif','left',th);

// ── Sidebar droite ──────────────────────────────────────────
const tSideRight1   = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('right',d,'#1e3a5f','#3b82f6','Arial,sans-serif','under',th);
const tSideRight2   = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('right',d,'#4a1942','#e879f9','Calibri,sans-serif','dot',th);
const tSideRight3   = (d:CvData,th?:Partial<CvTheme>)=>genSidebar('right',d,'#14532d','#4ade80','Trebuchet MS,sans-serif','left',th);

// ── Header focus ────────────────────────────────────────────
const tSunset       = (d:CvData,th?:Partial<CvTheme>)=>genHeader(d,'#c2410c','#f59e0b','Arial,sans-serif','grad','under',th);
const tOceanProfond = (d:CvData,th?:Partial<CvTheme>)=>genHeader(d,'#0c4a6e','#0891b2','Calibri,sans-serif','grad','dot',th);
const tSakura       = (d:CvData,th?:Partial<CvTheme>)=>genHeader(d,'#9d174d','#fb7185','Georgia,serif','flat','under',th);
const tLuxeAnthrac  = (d:CvData,th?:Partial<CvTheme>)=>genHeader(d,'#111827','#d4a017','Palatino Linotype,Palatino,serif','flat','left',th);
const tCyberpunk    = (d:CvData,th?:Partial<CvTheme>)=>genHeader(d,'#0f0f1a','#7c3aed','Verdana,sans-serif','flat','dot',th);
const tFuchsia      = (d:CvData,th?:Partial<CvTheme>)=>genHeader(d,'#701a75','#e879f9','Calibri,sans-serif','grad','under',th);
const tJadeAsiat    = (d:CvData,th?:Partial<CvTheme>)=>genHeader(d,'#064e3b','#34d399','Trebuchet MS,sans-serif','flat','left',th);

// ── Une colonne & timeline ───────────────────────────────────
const tTimelineIndigo = (d:CvData,th?:Partial<CvTheme>)=>genTimeline(d,'#4f46e5','Calibri,sans-serif',th);
const tAcademique     = (d:CvData,th?:Partial<CvTheme>)=>genOneCol(d,'#1e3a6e','Georgia,serif','center','under',th);
const tJuridique      = (d:CvData,th?:Partial<CvTheme>)=>genOneCol(d,'#1f2937','Times New Roman,serif','border','left',th);
const tTechDev        = (d:CvData,th?:Partial<CvTheme>)=>genOneCol(d,'#7c3aed','Verdana,sans-serif','border','dot',th);
const tModernisteUlt  = (d:CvData,th?:Partial<CvTheme>)=>genOneCol(d,'#0f172a','Helvetica Neue,Helvetica,sans-serif','center','box',th);

// ═══════════════════════════════════════════════════════════
// CV 2026 — 8 modèles reproduits fidèlement
// ═══════════════════════════════════════════════════════════

// ── helpers locaux ──────────────────────────────────────────
function sideSecLabel(label: string, ac: string, dark = true): string {
  const c = dark ? ac : ac;
  return `<p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:${c};text-transform:uppercase;margin:0 0 8px;border-bottom:1px solid rgba(255,255,255,.2);padding-bottom:4px">${label}</p>`;
}
function langDots(nom: string, niv: string, ac: string): string {
  const levels: Record<string,number> = {'Natif':5,'Courant':5,'C2':5,'C1':4,'B2':3,'B1':3,'A2':2,'A1':1,'Intermédiaire':3,'Débutant':2};
  const fill = levels[niv] ?? 3;
  const dots = Array.from({length:5},(_,i)=>`<span style="display:inline-block;width:10px;height:6px;border-radius:1px;background:${i<fill?ac:'rgba(255,255,255,.25)'}"></span>`).join('');
  return `<div style="margin-bottom:7px"><div style="font-size:9px;color:#fff;margin-bottom:4px">${nom}</div><div style="display:flex;gap:3px">${dots}</div></div>`;
}

// 1 — Raphaël Martin : sidebar navy, en-têtes pleine largeur
function tCV26Raphael(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#1b2a4a';
  const fn = th?.police ?? 'Arial, sans-serif';
  const ac = '#4a9fd4';
  const sHead = (t: string) => `<div style="background:${pc};color:#fff;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:5px 14px;margin:0 0 10px">${t}</div>`;
  const lbar = (nom: string, pct: number) =>
    `<div style="margin-bottom:7px"><div style="font-size:8.5px;color:#fff;margin-bottom:3px">${nom}</div><div style="height:4px;background:rgba(255,255,255,.2);border-radius:2px"><div style="height:4px;background:${ac};border-radius:2px;width:${pct}%"></div></div></div>`;
  const langPcts = [95,80,60,40,30];
  return `<div style="width:794px;min-height:1123px;font-family:${fn};display:flex;background:#fff;box-sizing:border-box;">
    <div style="width:235px;background:${pc};padding:28px 18px;flex-shrink:0;box-sizing:border-box;">
      <div style="margin:0 auto 14px;width:84px">${photo(d.info.photoUrl,84,'margin:0 auto',th)}</div>
      <h1 style="font-size:14px;font-weight:700;color:#fff;margin:0 0 2px;text-align:center;text-transform:uppercase;letter-spacing:.5px">${d.info.prenom} ${d.info.nom.toUpperCase()}</h1>
      <p style="font-size:9px;color:${ac};font-style:italic;margin:0 0 18px;text-align:center">${d.info.titre}</p>
      <div style="margin-bottom:14px">
        ${sideSecLabel('Contact',ac)}
        ${d.info.telephone?`<p style="font-size:8.5px;color:#fff;margin:0 0 4px">📞 ${d.info.telephone}</p>`:''}
        ${d.info.email?`<p style="font-size:8.5px;color:#fff;margin:0 0 4px;word-break:break-all">✉ ${d.info.email}</p>`:''}
        ${d.info.ville?`<p style="font-size:8.5px;color:#fff;margin:0 0 4px">◉ ${d.info.ville}</p>`:''}
        ${d.info.linkedin?`<p style="font-size:8.5px;color:#fff;margin:0;word-break:break-all">🔗 ${d.info.linkedin}</p>`:''}
      </div>
      ${d.langues.length?`<div style="margin-bottom:14px">${sideSecLabel('Langues',ac)}${d.langues.map((l,i)=>lbar(l.nom,langPcts[i]??60)).join('')}</div>`:''}
      ${d.competences.length?`<div style="margin-bottom:14px">${sideSecLabel('Compétences',ac)}${d.competences.map(c=>`<p style="font-size:8.5px;color:#fff;margin:0 0 4px">• ${c.nom}</p>`).join('')}</div>`:''}
      ${d.certifications.length?`<div>${sideSecLabel("Centres d'intérêt",ac)}${d.certifications.map(c=>`<p style="font-size:8.5px;color:#fff;margin:0 0 4px">• ${c.nom}</p>`).join('')}</div>`:''}
    </div>
    <div style="flex:1;box-sizing:border-box;">
      ${d.info.apropos?`${sHead('Profil')}<div style="padding:0 18px 14px"><p style="font-size:10px;line-height:1.65;color:#333;margin:0">${d.info.apropos}</p></div>`:''}
      ${d.experiences.length?`${sHead('Expérience')}<div style="padding:0 18px 14px">${d.experiences.map(e=>`<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10.5px;color:#1a1a1a">${e.poste}</strong><span style="font-size:8.5px;color:#888;white-space:nowrap">${period(e.debut,e.fin,e.actuel)}</span></div><p style="font-size:9.5px;color:${ac};font-weight:600;margin:2px 0 4px">${e.entreprise}</p>${e.description.length?`<ul style="margin:0;padding-left:14px;font-size:9.5px;color:#444;line-height:1.5">${e.description.map(b=>`<li style="margin-bottom:2px">${b}</li>`).join('')}</ul>`:''}</div>`).join('')}</div>`:''}
      ${d.formations.length?`${sHead('Formation')}<div style="padding:0 18px 14px">${d.formations.map(f=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10.5px;color:#1a1a1a">${f.diplome}</strong><span style="font-size:8.5px;color:#888">${period(f.debut,f.fin,f.actuel)}</span></div><p style="font-size:9.5px;color:#555;margin:2px 0 0">${f.ecole}</p></div>`).join('')}</div>`:''}
    </div>
  </div>`;
}

// 2 — Prénom NOM Teal : sidebar teal, nom typographique, barre droite
function tCV26PrenomNom(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#1a6060';
  const fn = th?.police ?? 'Calibri, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};display:flex;background:#fff;box-sizing:border-box;">
    <div style="width:220px;background:${pc};padding:28px 18px;flex-shrink:0;box-sizing:border-box;">
      <div style="margin:0 auto 14px;width:80px">${photo(d.info.photoUrl,80,'margin:0 auto',th)}</div>
      ${sideSecLabel('Contact','rgba(255,255,255,.8)')}
      ${d.info.email?`<p style="font-size:8.5px;color:#fff;margin:0 0 4px;word-break:break-all">✉ ${d.info.email}</p>`:''}
      ${d.info.telephone?`<p style="font-size:8.5px;color:#fff;margin:0 0 4px">☎ ${d.info.telephone}</p>`:''}
      ${d.info.ville?`<p style="font-size:8.5px;color:#fff;margin:0 0 12px">◉ ${d.info.ville}</p>`:''}
      ${d.info.apropos?`<div style="margin-bottom:14px">${sideSecLabel('Mon Profil','rgba(255,255,255,.8)')}<p style="font-size:8.5px;color:#fff;line-height:1.55;margin:0">${d.info.apropos}</p></div>`:''}
      ${d.competences.length?`<div style="margin-bottom:14px">${sideSecLabel('Logiciels / Outils','rgba(255,255,255,.8)')}${d.competences.map(c=>`<p style="font-size:8.5px;color:#fff;margin:0 0 4px">• ${c.nom}</p>`).join('')}</div>`:''}
      ${d.langues.length?`<div>${sideSecLabel('Langues','rgba(255,255,255,.8)')}${d.langues.map(l=>langDots(l.nom,l.niveau,'#fff')).join('')}</div>`:''}
    </div>
    <div style="flex:1;padding:28px 20px 28px 24px;box-sizing:border-box;border-right:6px solid ${pc}">
      <div style="margin-bottom:20px">
        <p style="font-size:13px;font-weight:400;color:${pc};margin:0;text-transform:uppercase;letter-spacing:2px">${d.info.prenom}</p>
        <h1 style="font-size:28px;font-weight:900;color:#0f1a1a;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;line-height:1">${d.info.nom}</h1>
        <p style="font-size:10px;color:#555;letter-spacing:.5px;margin:0;text-transform:uppercase">${d.info.titre}</p>
      </div>
      ${d.experiences.length?`<div style="margin-bottom:16px">${secA('Expériences Professionnelles',pc,'under')}${d.experiences.map(e=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10px;color:#1a1a1a">${e.poste}</strong><span style="font-size:8.5px;color:#888">${period(e.debut,e.fin,e.actuel)}</span></div><p style="font-size:9px;color:${pc};font-weight:600;margin:2px 0 3px">${e.entreprise}</p>${e.description.length?`<ul style="margin:0;padding-left:14px;font-size:9px;color:#444;line-height:1.5">${e.description.map(b=>`<li style="margin-bottom:2px">${b}</li>`).join('')}</ul>`:''}</div>`).join('')}</div>`:''}
      ${d.formations.length?`<div>${secA('Formation',pc,'under')}${d.formations.map(f=>`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10px;color:#1a1a1a">${f.diplome}</strong><span style="font-size:8.5px;color:#888">${period(f.debut,f.fin,f.actuel)}</span></div><p style="font-size:9px;color:#555;margin:2px 0 0">${f.ecole}</p></div>`).join('')}</div>`:''}
    </div>
  </div>`;
}

// 3 — Sophie Dupont Marketing : 2-col, réalisations colorées
function tCV26SophieMarketing(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#0d9488';
  const fn = th?.police ?? 'Arial, sans-serif';
  const coral = '#e76f51';
  const cardColors = ['#0d9488','#e76f51','#2d6a9f','#6c757d'];
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;padding:36px 40px;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div>
        <h1 style="font-size:26px;font-weight:900;color:#111;margin:0 0 2px;letter-spacing:-.3px">${d.info.prenom.toUpperCase()} ${d.info.nom.toUpperCase()}</h1>
        <p style="font-size:10px;color:${pc};font-weight:700;margin:0 0 6px">${d.info.titre}</p>
        <p style="font-size:8.5px;color:${pc};margin:0">${[d.info.telephone,d.info.email,d.info.ville,d.info.linkedin].filter(Boolean).join(' · ')}</p>
      </div>
      ${d.info.photoUrl?`<div style="flex-shrink:0">${photo(d.info.photoUrl,68,'',th)}</div>`:''}
    </div>
    <div style="height:2px;background:${pc};margin:10px 0 18px"></div>
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:24px">
      <div>
        ${d.info.apropos?`<div style="margin-bottom:16px"><p style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:0 0 6px">Résumé</p><p style="font-size:10px;line-height:1.65;color:#333;margin:0">${d.info.apropos}</p></div>`:''}
        ${d.experiences.length?`<div style="margin-bottom:14px"><p style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:0 0 8px;border-bottom:1.5px solid ${pc};padding-bottom:3px">Expérience</p>${d.experiences.map(e=>`<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10.5px;color:#111">${e.poste}</strong><span style="font-size:8.5px;color:#888">${period(e.debut,e.fin,e.actuel)}</span></div><p style="font-size:9px;color:${coral};font-weight:700;margin:2px 0 4px">${e.entreprise}${d.info.ville?' · '+d.info.ville:''}</p>${e.description.length?`<ul style="margin:0;padding-left:14px;font-size:9px;color:#444;line-height:1.5">${e.description.map(b=>`<li style="margin-bottom:2px">${b}</li>`).join('')}</ul>`:''}</div>`).join('')}</div>`:''}
        ${d.formations.length?`<div><p style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:0 0 8px;border-bottom:1.5px solid ${pc};padding-bottom:3px">Éducation</p>${d.formations.map(f=>`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10px;color:#111">${f.diplome}</strong><span style="font-size:8.5px;color:#888">${period(f.debut,f.fin,f.actuel)}</span></div><p style="font-size:9px;color:#555;margin:2px 0 0">${f.ecole}</p></div>`).join('')}</div>`:''}
      </div>
      <div>
        ${d.certifications.length?`<div style="margin-bottom:14px"><p style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:0 0 8px;border-bottom:1.5px solid ${pc};padding-bottom:3px">Réalisations</p>${d.certifications.map((c,i)=>`<div style="background:${cardColors[i%cardColors.length]};color:#fff;border-radius:5px;padding:8px 10px;margin-bottom:8px"><p style="font-size:9px;font-weight:700;margin:0 0 3px">${c.nom}</p><p style="font-size:8.5px;opacity:.85;margin:0">${c.org}</p></div>`).join('')}</div>`:''}
        ${d.competences.length?`<div style="margin-bottom:14px"><p style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:0 0 8px;border-bottom:1.5px solid ${pc};padding-bottom:3px">Compétences</p>${d.competences.map(c=>`<span style="display:inline-block;background:${pc}18;color:${pc};border:1px solid ${pc}40;padding:2px 8px;border-radius:12px;font-size:8.5px;font-weight:600;margin:0 4px 4px 0">${c.nom}</span>`).join('')}</div>`:''}
        ${d.langues.length?`<div><p style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:0 0 8px;border-bottom:1.5px solid ${pc};padding-bottom:3px">Langues</p>${d.langues.map(l=>`<p style="font-size:9.5px;margin:0 0 4px">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// 4 — Camille Dupont Pro : 2-col, réalisations cercles bleus
function tCV26CamillePro(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#1a365d';
  const fn = th?.police ?? 'Calibri, sans-serif';
  const circle = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${pc};flex-shrink:0;margin-top:2px"></span>`;
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;padding:36px 40px;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <h1 style="font-size:24px;font-weight:900;color:#0f1a2e;margin:0 0 3px;text-transform:uppercase;letter-spacing:-.2px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:10px;color:${pc};font-weight:600;margin:0 0 6px">${d.info.titre}</p>
        <p style="font-size:8.5px;color:#555;margin:0">${[d.info.telephone,d.info.email,d.info.ville].filter(Boolean).join(' · ')}</p>
      </div>
      ${d.info.photoUrl?`<div style="flex-shrink:0">${photo(d.info.photoUrl,68,'',th)}</div>`:''}
    </div>
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:24px">
      <div>
        ${d.info.apropos?`<div style="margin-bottom:14px"><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:8px">Résumé</div><p style="font-size:10px;line-height:1.65;color:#333;margin:0">${d.info.apropos}</p></div>`:''}
        ${d.experiences.length?`<div style="margin-bottom:14px"><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:10px">Expérience</div>${d.experiences.map(e=>`<div style="margin-bottom:12px;padding-left:4px;border-left:2px solid ${pc}30"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10.5px;color:#111">${e.poste}</strong><span style="font-size:8.5px;color:#888;white-space:nowrap">${period(e.debut,e.fin,e.actuel)}</span></div><p style="font-size:9px;color:${pc};font-weight:600;margin:2px 0 4px">${e.entreprise}</p>${e.description.length?`<ul style="margin:0;padding-left:14px;font-size:9px;color:#444;line-height:1.5">${e.description.map(b=>`<li style="margin-bottom:2px">${b}</li>`).join('')}</ul>`:''}</div>`).join('')}</div>`:''}
        ${d.formations.length?`<div><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:10px">Éducation</div>${d.formations.map(f=>`<div style="margin-bottom:8px;padding-left:4px;border-left:2px solid ${pc}30"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10px;color:#111">${f.diplome}</strong><span style="font-size:8.5px;color:#888">${period(f.debut,f.fin,f.actuel)}</span></div><p style="font-size:9px;color:#555;margin:2px 0 0">${f.ecole}</p></div>`).join('')}</div>`:''}
      </div>
      <div>
        ${d.certifications.length?`<div style="margin-bottom:14px"><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:10px">Réalisations</div>${d.certifications.map(c=>`<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:9px">${circle}<div><p style="font-size:9.5px;font-weight:700;color:#111;margin:0 0 2px">${c.nom}</p><p style="font-size:8.5px;color:#555;margin:0">${c.org}</p></div></div>`).join('')}</div>`:''}
        ${d.competences.length?`<div style="margin-bottom:14px"><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:8px">Compétences</div>${d.competences.map(c=>`<span style="display:inline-block;background:${pc}15;color:${pc};padding:2px 8px;border-radius:12px;font-size:8.5px;font-weight:600;margin:0 4px 4px 0">${c.nom}</span>`).join('')}</div>`:''}
        ${d.langues.length?`<div><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:8px">Langues</div>${d.langues.map(l=>`<p style="font-size:9.5px;margin:0 0 4px;padding-left:4px">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// 5 — Camille Dupont ESG (variante teal, même structure)
function tCV26CamilleESG(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#0f766e';
  const fn = th?.police ?? 'Calibri, sans-serif';
  const circle = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${pc};flex-shrink:0;margin-top:2px"></span>`;
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;padding:36px 40px;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <h1 style="font-size:24px;font-weight:900;color:#0f2620;margin:0 0 3px;text-transform:uppercase;letter-spacing:-.2px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:10px;color:${pc};font-weight:600;margin:0 0 6px">${d.info.titre}</p>
        <p style="font-size:8.5px;color:#555;margin:0">${[d.info.telephone,d.info.email,d.info.ville].filter(Boolean).join(' · ')}</p>
      </div>
      ${d.info.photoUrl?`<div style="flex-shrink:0">${photo(d.info.photoUrl,68,'',th)}</div>`:''}
    </div>
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:24px">
      <div>
        ${d.info.apropos?`<div style="margin-bottom:14px"><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:8px">Résumé</div><p style="font-size:10px;line-height:1.65;color:#333;margin:0">${d.info.apropos}</p></div>`:''}
        ${d.experiences.length?`<div style="margin-bottom:14px"><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:10px">Expérience</div>${d.experiences.map(e=>`<div style="margin-bottom:12px;padding-left:4px;border-left:2px solid ${pc}40"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10.5px;color:#111">${e.poste}</strong><span style="font-size:8.5px;color:#888;white-space:nowrap">${period(e.debut,e.fin,e.actuel)}</span></div><p style="font-size:9px;color:${pc};font-weight:600;margin:2px 0 4px">${e.entreprise}</p>${e.description.length?`<ul style="margin:0;padding-left:14px;font-size:9px;color:#444;line-height:1.5">${e.description.map(b=>`<li style="margin-bottom:2px">${b}</li>`).join('')}</ul>`:''}</div>`).join('')}</div>`:''}
        ${d.formations.length?`<div><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:10px">Éducation</div>${d.formations.map(f=>`<div style="margin-bottom:8px;padding-left:4px;border-left:2px solid ${pc}40"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10px;color:#111">${f.diplome}</strong><span style="font-size:8.5px;color:#888">${period(f.debut,f.fin,f.actuel)}</span></div><p style="font-size:9px;color:#555;margin:2px 0 0">${f.ecole}</p></div>`).join('')}</div>`:''}
      </div>
      <div>
        ${d.certifications.length?`<div style="margin-bottom:14px"><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:10px">Réalisations</div>${d.certifications.map(c=>`<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:9px">${circle}<div><p style="font-size:9.5px;font-weight:700;color:#111;margin:0 0 2px">${c.nom}</p><p style="font-size:8.5px;color:#555;margin:0">${c.org}</p></div></div>`).join('')}</div>`:''}
        ${d.competences.length?`<div style="margin-bottom:14px"><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:8px">Compétences</div>${d.competences.map(c=>`<span style="display:inline-block;background:${pc}15;color:${pc};padding:2px 8px;border-radius:12px;font-size:8.5px;font-weight:600;margin:0 4px 4px 0">${c.nom}</span>`).join('')}</div>`:''}
        ${d.langues.length?`<div><div style="background:${pc};color:#fff;font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;margin-bottom:8px">Langues</div>${d.langues.map(l=>`<p style="font-size:9.5px;margin:0 0 4px;padding-left:4px">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// 6 — Julie Duval : photo header gauche, 2-col, dot section labels
function tCV26JulieDuval(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#00a896';
  const fn = th?.police ?? 'Arial, sans-serif';
  const dotSec = (label: string) => `<div style="display:flex;align-items:center;gap:7px;margin:0 0 8px"><span style="width:8px;height:8px;border-radius:50%;background:${pc};display:inline-block;flex-shrink:0"></span><h2 style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${pc};margin:0">${label}</h2></div>`;
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;padding:36px 40px;box-sizing:border-box;">
    <div style="display:flex;align-items:flex-start;gap:18px;margin-bottom:14px;padding-bottom:14px;border-bottom:1.5px solid ${pc}">
      ${photo(d.info.photoUrl,80,'flex-shrink:0',th)}
      <div style="flex:1">
        <h1 style="font-size:22px;font-weight:800;color:#111;margin:0 0 3px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:10.5px;color:${pc};font-weight:600;margin:0 0 8px">${d.info.titre}</p>
        <p style="font-size:9px;color:#555;margin:0">${[d.info.telephone?`☎ ${d.info.telephone}`:'', d.info.email?`✉ ${d.info.email}`:'', d.info.linkedin?`in ${d.info.linkedin}`:''].filter(Boolean).join('  ·  ')}</p>
      </div>
    </div>
    ${d.info.apropos?`<p style="font-size:10px;line-height:1.7;color:#333;margin:0 0 16px;border-bottom:1px solid #e2e8f0;padding-bottom:14px">${d.info.apropos}</p>`:''}
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:24px">
      <div>
        ${d.experiences.length?`<div style="margin-bottom:14px">${dotSec('Expérience Professionnelle')}${d.experiences.map(e=>`<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10.5px;color:#111">${e.poste}</strong><span style="font-size:8.5px;color:#888">${period(e.debut,e.fin,e.actuel)}</span></div><p style="font-size:9px;color:${pc};font-weight:600;margin:2px 0 4px">${e.entreprise}</p>${e.description.length?`<ul style="margin:0;padding-left:14px;font-size:9px;color:#444;line-height:1.55">${e.description.map(b=>`<li style="margin-bottom:2px">${b}</li>`).join('')}</ul>`:''}</div>`).join('')}</div>`:''}
      </div>
      <div>
        ${d.formations.length?`<div style="margin-bottom:14px">${dotSec('Formation')}${d.formations.map(f=>`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10px;color:#111">${f.diplome}</strong><span style="font-size:8.5px;color:#888">${period(f.debut,f.fin,f.actuel)}</span></div><p style="font-size:9px;color:#555;margin:2px 0 0">${f.ecole}</p></div>`).join('')}</div>`:''}
        ${d.competences.length?`<div style="margin-bottom:14px">${dotSec('Compétences')}${d.competences.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#333">• ${c.nom}</p>`).join('')}</div>`:''}
        ${d.langues.length?`<div style="margin-bottom:14px">${dotSec('Langues')}${d.langues.map(l=>`<p style="font-size:9.5px;margin:0 0 4px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
        ${d.certifications.length?`<div>${dotSec("Centres d'intérêt")}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#333">• ${c.nom}</p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// 7 — Sophie Morceau : panneau gris haut-gauche, section teal underline
function tCV26SophieMorceau(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#2196a3';
  const fn = th?.police ?? 'Trebuchet MS, sans-serif';
  const panelBg = '#3d5564';
  const tSec = (label: string) => `<p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:0 0 6px;border-bottom:1.5px solid ${pc};padding-bottom:3px">${label}</p>`;
  const sqDots = (nom: string, niv: string) => {
    const lvl = ['Natif','C2','Courant','C1'].includes(niv)?5:['B2','B1'].includes(niv)?4:['A2','Intermédiaire'].includes(niv)?3:2;
    const sq = Array.from({length:5},(_,i)=>`<span style="display:inline-block;width:12px;height:6px;border-radius:1px;margin-right:2px;background:${i<lvl?pc:'#d0e8ea'}"></span>`).join('');
    return `<div style="margin-bottom:6px"><div style="font-size:9px;color:#333;margin-bottom:3px">${nom}</div><div>${sq}</div></div>`;
  };
  return `<div style="width:794px;min-height:1123px;font-family:${fn};display:flex;background:#fff;box-sizing:border-box;">
    <div style="width:220px;flex-shrink:0;box-sizing:border-box;display:flex;flex-direction:column;">
      <div style="background:${panelBg};padding:28px 18px;flex-shrink:0;">
        <div style="margin:0 auto 14px;width:84px">${photo(d.info.photoUrl,84,'margin:0 auto',th)}</div>
        ${d.info.telephone?`<p style="font-size:8.5px;color:#e2e8f0;margin:0 0 4px">☎ ${d.info.telephone}</p>`:''}
        ${d.info.email?`<p style="font-size:8.5px;color:#e2e8f0;margin:0 0 4px;word-break:break-all">✉ ${d.info.email}</p>`:''}
        ${d.info.ville?`<p style="font-size:8.5px;color:#e2e8f0;margin:0 0 4px">◉ ${d.info.ville}</p>`:''}
        ${d.info.linkedin?`<p style="font-size:8.5px;color:#e2e8f0;margin:0;word-break:break-all">🔗 ${d.info.linkedin}</p>`:''}
      </div>
      <div style="padding:16px 18px;flex:1;">
        ${d.info.apropos?`<div style="margin-bottom:14px"><p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:0 0 6px;border-bottom:1.5px solid ${pc};padding-bottom:3px">Profil professionnel</p><p style="font-size:9px;line-height:1.55;color:#333;margin:0">${d.info.apropos}</p></div>`:''}
        ${d.competences.length?`<div><p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:0 0 6px;border-bottom:1.5px solid ${pc};padding-bottom:3px">Compétences</p>${d.competences.map(c=>`<p style="font-size:9px;margin:0 0 4px;color:#333">• ${c.nom}</p>`).join('')}</div>`:''}
      </div>
    </div>
    <div style="flex:1;padding:28px 24px;box-sizing:border-box;">
      <div style="margin-bottom:16px">
        <h1 style="font-size:22px;font-weight:800;color:#111;margin:0 0 3px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:10px;color:${pc};font-weight:600;margin:0">${d.info.titre}</p>
      </div>
      ${d.experiences.length?`<div style="margin-bottom:14px">${tSec('Parcours Professionnel')}${d.experiences.map(e=>`<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10px;color:#111">${e.poste}</strong><span style="font-size:8.5px;color:#888">${period(e.debut,e.fin,e.actuel)}</span></div><p style="font-size:9px;color:${pc};font-weight:600;margin:2px 0 3px">${e.entreprise}</p>${e.description.length?`<ul style="margin:0;padding-left:14px;font-size:9px;color:#444;line-height:1.5">${e.description.map(b=>`<li style="margin-bottom:2px">${b}</li>`).join('')}</ul>`:''}</div>`).join('')}</div>`:''}
      ${d.formations.length?`<div style="margin-bottom:14px">${tSec('Formation')}${d.formations.map(f=>`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10px;color:#111">${f.diplome}</strong><span style="font-size:8.5px;color:#888">${period(f.debut,f.fin,f.actuel)}</span></div><p style="font-size:9px;color:#555;margin:2px 0 0">${f.ecole}</p></div>`).join('')}</div>`:''}
      ${d.langues.length?`<div style="margin-bottom:14px">${tSec('Langues')}<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${d.langues.map(l=>sqDots(l.nom,l.niveau)).join('')}</div></div>`:''}
      ${d.certifications.length?`<div>${tSec('Informatique')}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#333">• ${c.nom}</p>`).join('')}</div>`:''}
    </div>
  </div>`;
}

// 8 — Sophie Michel ATS : bordure bordeaux, 2-col, headers sombres
function tCV26SophieMichelATS(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#6b1f3a';
  const fn = th?.police ?? 'Arial, sans-serif';
  const sHead = (t: string) => `<div style="background:#2d2d2d;color:#fff;font-size:8.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:5px 10px;margin:0 0 8px">${t}</div>`;
  return `<div style="width:794px;min-height:1123px;font-family:${fn};background:#fff;box-sizing:border-box;border:6px solid ${pc};padding:28px 32px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:10px;border-bottom:1.5px solid ${pc}">
      <div>
        <h1 style="font-size:22px;font-weight:800;color:#111;margin:0 0 2px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:10px;color:${pc};font-weight:600;margin:0">${d.info.titre}</p>
      </div>
      <div style="text-align:right;font-size:8.5px;color:#555;line-height:1.7">
        ${d.info.email?`<p style="margin:0">${d.info.email}</p>`:''}
        ${d.info.telephone?`<p style="margin:0">${d.info.telephone}</p>`:''}
        ${d.info.ville?`<p style="margin:0">${d.info.ville}</p>`:''}
        ${d.info.linkedin?`<p style="margin:0">${d.info.linkedin}</p>`:''}
      </div>
    </div>
    ${d.info.apropos?`<p style="font-size:10px;line-height:1.65;color:#333;margin:0 0 14px">${d.info.apropos}</p>`:''}
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:20px">
      <div>
        ${d.experiences.length?`<div style="margin-bottom:14px">${sHead('Expériences Professionnelles')}${d.experiences.map(e=>`<div style="margin-bottom:11px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10.5px;color:#111">${e.poste}</strong><span style="font-size:8.5px;color:#888;white-space:nowrap">${period(e.debut,e.fin,e.actuel)}</span></div><p style="font-size:9px;color:${pc};font-weight:600;margin:2px 0 4px">${e.entreprise}</p>${e.description.length?`<ul style="margin:0;padding-left:14px;font-size:9px;color:#444;line-height:1.5">${e.description.map(b=>`<li style="margin-bottom:2px">${b}</li>`).join('')}</ul>`:''}</div>`).join('')}</div>`:''}
        ${d.formations.length?`<div>${sHead('Systèmes & Formations')}${d.formations.map(f=>`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:10px;color:#111">${f.diplome}</strong><span style="font-size:8.5px;color:#888">${period(f.debut,f.fin,f.actuel)}</span></div><p style="font-size:9px;color:#555;margin:2px 0 0">${f.ecole}</p></div>`).join('')}</div>`:''}
      </div>
      <div>
        ${d.competences.length?`<div style="margin-bottom:12px">${sHead('Compétences')}${d.competences.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#333">• ${c.nom}</p>`).join('')}</div>`:''}
        ${d.langues.length?`<div style="margin-bottom:12px">${sHead('Langues')}${d.langues.map(l=>`<p style="font-size:9.5px;margin:0 0 4px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
        ${d.certifications.length?`<div>${sHead("Centres d'intérêt")}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#333">• ${c.nom}</p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// NOUVEAUX TEMPLATES 2026 (10)
// ═══════════════════════════════════════════════════════════

// 1 — Classique Épuré : 1-colonne, serif, 100% ATS
function tClassiqueEpure(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#1a1a2e';
  const fn = th?.police ?? 'Times New Roman, serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#222;background:#fff;padding:54px 62px;box-sizing:border-box;">
    <div style="margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid ${pc}">
      <h1 style="font-size:27px;font-weight:700;margin:0 0 4px;color:#0f0f0f;letter-spacing:-.3px">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:11.5px;color:${pc};font-weight:600;margin:0 0 8px">${d.info.titre}</p>
      <p style="font-size:9.5px;color:#555;margin:0">${[d.info.email,d.info.telephone,d.info.ville,d.info.linkedin].filter(Boolean).join(' · ')}</p>
    </div>
    ${d.info.apropos?`<p style="font-size:10.5px;line-height:1.72;color:#333;margin:0 0 18px">${d.info.apropos}</p>`:''}
    ${d.experiences.length?`<div style="margin-bottom:16px">${secA('Expériences Professionnelles',pc,'under')}${d.experiences.map(e=>expBlock(e,pc,fn)).join('')}</div>`:''}
    ${d.formations.length?`<div style="margin-bottom:16px">${secA('Formation',pc,'under')}${d.formations.map(f=>eduBlock(f,pc,fn)).join('')}</div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px">
      ${d.competences.length?`<div>${secA('Compétences',pc,'under')}${d.competences.map(c=>`<p style="font-size:10px;margin:0 0 4px;color:#333">• ${c.nom}</p>`).join('')}</div>`:''}
      <div>
        ${d.langues.length?`${secA('Langues',pc,'under')}${d.langues.map(l=>`<p style="font-size:10px;margin:0 0 4px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}`:''}
        ${d.certifications.length?`<div style="margin-top:12px">${secA('Certifications',pc,'under')}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#444">${c.nom}</p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// 2 — Français Classique : 2-col sans sidebar, photo header
function tFrancaisClassique(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#1d3461';
  const fn = th?.police ?? 'Arial, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#222;background:#fff;padding:44px 52px;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:1.5px solid ${pc}">
      <div>
        <h1 style="font-size:26px;font-weight:700;margin:0 0 4px;color:#0f0f0f">${d.info.prenom} <span style="text-transform:uppercase">${d.info.nom}</span></h1>
        <p style="font-size:11px;color:${pc};font-weight:600;margin:0 0 10px">${d.info.titre}</p>
        <div style="font-size:9.5px;color:#555;line-height:1.8">
          ${d.info.email?`<span>✉ ${d.info.email}</span>`:''}
          ${d.info.telephone?`<span style="margin-left:12px">☎ ${d.info.telephone}</span>`:''}
          ${d.info.ville?`<span style="margin-left:12px">◉ ${d.info.ville}</span>`:''}
          ${d.info.linkedin?`<span style="margin-left:12px">in ${d.info.linkedin}</span>`:''}
        </div>
      </div>
      ${d.info.photoUrl?`<div style="flex-shrink:0">${photo(d.info.photoUrl,80,'',th)}</div>`:''}
    </div>
    ${d.info.apropos?`<p style="font-size:10.5px;line-height:1.7;color:#333;margin:0 0 18px;font-style:italic;border-left:3px solid ${pc};padding-left:12px">${d.info.apropos}</p>`:''}
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:28px">
      <div>
        ${d.experiences.length?`${secA('Expériences Professionnelles',pc,'under')}${d.experiences.map(e=>expBlock(e,pc,fn)).join('')}`:''}
        ${d.formations.length?`<div style="margin-top:12px">${secA('Formation',pc,'under')}${d.formations.map(f=>eduBlock(f,pc,fn)).join('')}</div>`:''}
      </div>
      <div>
        ${d.competences.length?`${secA('Compétences',pc,'under')}${d.competences.map(c=>`<p style="font-size:10px;margin:0 0 5px;color:#333">• ${c.nom}</p>`).join('')}`:''}
        ${d.langues.length?`<div style="margin-top:14px">${secA('Langues',pc,'under')}${d.langues.map(l=>`<p style="font-size:10px;margin:0 0 5px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
        ${d.certifications.length?`<div style="margin-top:14px">${secA('Certifications',pc,'under')}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#444">${c.nom}</p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// 3 — Bicolore Split : header coloré + panneau droit clair
function tBicoloreSplit(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#1e3a5f';
  const fn = th?.police ?? 'Calibri, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#222;background:#fff;box-sizing:border-box;">
    <div style="background:${pc};padding:28px 44px;color:#fff">
      <div style="display:flex;align-items:center;gap:18px">
        ${d.info.photoUrl?`<div style="flex-shrink:0">${photo(d.info.photoUrl,76,'',th)}</div>`:''}
        <div>
          <h1 style="font-size:24px;font-weight:800;margin:0 0 3px;letter-spacing:-.2px">${d.info.prenom} ${d.info.nom}</h1>
          <p style="font-size:11px;opacity:.85;font-weight:500;margin:0">${d.info.titre}</p>
        </div>
      </div>
    </div>
    <div style="display:flex">
      <div style="flex:1;padding:28px 32px">
        ${d.info.apropos?`<div style="background:${pc}0d;border-left:3px solid ${pc};padding:9px 13px;margin-bottom:20px"><p style="font-size:10.5px;line-height:1.68;color:#333;margin:0">${d.info.apropos}</p></div>`:''}
        ${d.experiences.length?`${secA('Expériences',pc,'left')}${d.experiences.map(e=>expBlock(e,pc,fn)).join('')}`:''}
        ${d.formations.length?`<div style="margin-top:12px">${secA('Formation',pc,'left')}${d.formations.map(f=>eduBlock(f,pc,fn)).join('')}</div>`:''}
      </div>
      <div style="width:218px;background:${pc}0a;padding:28px 20px;flex-shrink:0;border-left:2px solid ${pc}18;box-sizing:border-box">
        <p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:0 0 8px">Contact</p>
        ${d.info.email?`<p style="font-size:9px;margin:0 0 5px;color:#333;word-break:break-all">✉ ${d.info.email}</p>`:''}
        ${d.info.telephone?`<p style="font-size:9px;margin:0 0 5px;color:#333">☎ ${d.info.telephone}</p>`:''}
        ${d.info.ville?`<p style="font-size:9px;margin:0 0 5px;color:#333">◉ ${d.info.ville}</p>`:''}
        ${d.info.linkedin?`<p style="font-size:9px;margin:0;color:#333;word-break:break-all">in ${d.info.linkedin}</p>`:''}
        ${d.competences.length?`<p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:16px 0 8px">Compétences</p>${d.competences.map(c=>`<div style="background:${pc};color:#fff;padding:3px 8px;border-radius:3px;font-size:9px;margin-bottom:4px">${c.nom}</div>`).join('')}`:''}
        ${d.langues.length?`<p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:16px 0 8px">Langues</p>${d.langues.map(l=>`<p style="font-size:9px;margin:0 0 5px;color:#333">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}`:''}
        ${d.certifications.length?`<p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:${pc};text-transform:uppercase;margin:16px 0 8px">Certifications</p>${d.certifications.map(c=>`<p style="font-size:9px;margin:0 0 5px;color:#333">${c.nom}</p>`).join('')}`:''}
      </div>
    </div>
  </div>`;
}

// 4 — International Minimal : grand nom, double filet léger, ultra épuré
function tInternationalMin(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#111827';
  const fn = th?.police ?? 'Helvetica Neue, Helvetica, Arial, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#111;background:#fff;padding:52px 60px;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:6px">
      <h1 style="font-size:32px;font-weight:300;letter-spacing:2px;text-transform:uppercase;margin:0;color:#0f0f0f">${d.info.prenom} <strong style="font-weight:700">${d.info.nom}</strong></h1>
      ${d.info.photoUrl?`<div style="flex-shrink:0">${photo(d.info.photoUrl,72,'',th)}</div>`:''}
    </div>
    <p style="font-size:11px;color:#555;letter-spacing:.5px;margin:0 0 5px;font-weight:400">${d.info.titre}</p>
    <div style="height:2px;background:${pc};margin-bottom:3px"></div>
    <div style="height:1px;background:${pc}33;margin-bottom:16px"></div>
    <p style="font-size:9px;color:#888;margin:0 0 20px;letter-spacing:.5px">${[d.info.email,d.info.telephone,d.info.ville,d.info.linkedin].filter(Boolean).join(' · ')}</p>
    ${d.info.apropos?`<p style="font-size:10.5px;line-height:1.7;color:#333;margin:0 0 20px">${d.info.apropos}</p>`:''}
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:32px">
      <div>
        ${d.experiences.length?`${secA('Expériences',pc,'left')}${d.experiences.map(e=>expBlock(e,pc,fn)).join('')}`:''}
        ${d.formations.length?`<div style="margin-top:12px">${secA('Formation',pc,'left')}${d.formations.map(f=>eduBlock(f,pc,fn)).join('')}</div>`:''}
      </div>
      <div>
        ${d.competences.length?`${secA('Compétences',pc,'left')}${d.competences.map(c=>`<p style="font-size:10px;margin:0 0 5px;color:#333">— ${c.nom}</p>`).join('')}`:''}
        ${d.langues.length?`<div style="margin-top:14px">${secA('Langues',pc,'left')}${d.langues.map(l=>`<p style="font-size:10px;margin:0 0 4px">${l.nom} <span style="color:#888">${l.niveau}</span></p>`).join('')}</div>`:''}
        ${d.certifications.length?`<div style="margin-top:14px">${secA('Certifications',pc,'left')}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#555">${c.nom}</p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// 5 — Barres Compétences : sidebar sombre avec skill bars
function tBarresSkills(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#2563eb';
  const fn = th?.police ?? 'Calibri, sans-serif';
  const pcts = [88,76,90,68,82,72,85,65,78,93];
  const bar = (nom: string, i: number) =>
    `<div style="margin-bottom:9px"><span style="font-size:9px;color:#e2e8f0">${nom}</span>
     <div style="height:4px;background:rgba(255,255,255,.15);border-radius:2px;margin-top:4px">
       <div style="height:4px;background:${pc};border-radius:2px;width:${pcts[i%pcts.length]}%"></div>
     </div></div>`;
  return `<div style="width:794px;min-height:1123px;font-family:${fn};display:flex;background:#fff;box-sizing:border-box;">
    <div style="width:238px;background:#1e293b;padding:32px 20px;flex-shrink:0;box-sizing:border-box">
      <div style="margin:0 auto 16px;width:86px">${photo(d.info.photoUrl,86,'margin:0 auto',th)}</div>
      <h1 style="font-size:15px;font-weight:800;color:#f1f5f9;margin:0 0 2px;text-align:center">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:9.5px;color:${pc};font-weight:600;margin:0 0 18px;text-align:center">${d.info.titre}</p>
      <div style="border-top:1px solid rgba(255,255,255,.15);padding-top:14px;margin-bottom:14px">
        <p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,.45);text-transform:uppercase;margin:0 0 8px">Contact</p>
        ${d.info.email?`<p style="font-size:8.5px;margin:0 0 5px;color:#e2e8f0;word-break:break-all">✉ ${d.info.email}</p>`:''}
        ${d.info.telephone?`<p style="font-size:8.5px;margin:0 0 5px;color:#e2e8f0">☎ ${d.info.telephone}</p>`:''}
        ${d.info.ville?`<p style="font-size:8.5px;margin:0 0 5px;color:#e2e8f0">◉ ${d.info.ville}</p>`:''}
        ${d.info.linkedin?`<p style="font-size:8.5px;margin:0;color:#e2e8f0;word-break:break-all">in ${d.info.linkedin}</p>`:''}
      </div>
      ${d.competences.length?`<p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,.45);text-transform:uppercase;margin:0 0 10px">Compétences</p>${d.competences.map((c,i)=>bar(c.nom,i)).join('')}`:''}
      ${d.langues.length?`<p style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,.45);text-transform:uppercase;margin:16px 0 8px">Langues</p>${d.langues.map(l=>`<p style="font-size:9px;margin:0 0 4px;color:#e2e8f0">${l.nom} <span style="opacity:.6">(${l.niveau})</span></p>`).join('')}`:''}
    </div>
    <div style="flex:1;padding:32px 28px;box-sizing:border-box">
      ${d.info.apropos?`<div style="background:${pc}10;border-left:3px solid ${pc};padding:10px 14px;margin-bottom:20px"><p style="font-size:10.5px;line-height:1.65;color:#334155;margin:0">${d.info.apropos}</p></div>`:''}
      ${d.experiences.length?`${secA('Expériences',pc,'left')}${d.experiences.map(e=>expBlock(e,pc,fn)).join('')}`:''}
      ${d.formations.length?`<div style="margin-top:12px">${secA('Formation',pc,'left')}${d.formations.map(f=>eduBlock(f,pc,fn)).join('')}</div>`:''}
      ${d.certifications.length?`<div style="margin-top:12px">${secA('Certifications',pc,'left')}${d.certifications.map(c=>`<p style="font-size:10px;margin:0 0 4px">${c.nom} · <em style="color:#888">${c.org}, ${c.annee}</em></p>`).join('')}</div>`:''}
    </div>
  </div>`;
}

// 6 — Finance Prestige : header noir, or, serif, solennité
function tFinancePrestige(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#b8960c';
  const fn = th?.police ?? 'Palatino Linotype, Palatino, serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#1a1a1a;background:#fff;box-sizing:border-box;">
    <div style="background:#0f1923;padding:36px 52px;color:#fff">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <h1 style="font-size:26px;font-weight:700;letter-spacing:.5px;margin:0 0 4px;text-transform:uppercase">${d.info.prenom} ${d.info.nom}</h1>
          <p style="font-size:11px;color:${pc};letter-spacing:1px;margin:0;font-style:italic">${d.info.titre}</p>
        </div>
        ${d.info.photoUrl?`<div style="flex-shrink:0">${photo(d.info.photoUrl,74,'',th)}</div>`:''}
      </div>
      <div style="height:1px;background:${pc}55;margin:14px 0 12px"></div>
      <div style="font-size:9.5px;color:rgba(255,255,255,.7)">${[d.info.email,d.info.telephone,d.info.ville,d.info.linkedin].filter(Boolean).join(' · ')}</div>
    </div>
    <div style="padding:30px 52px">
      ${d.info.apropos?`<div style="margin-bottom:20px;border-left:2px solid ${pc};padding-left:14px"><p style="font-size:10.5px;line-height:1.72;color:#334155;font-style:italic;margin:0">${d.info.apropos}</p></div>`:''}
      <div style="display:grid;grid-template-columns:3fr 2fr;gap:28px">
        <div>
          ${d.experiences.length?`${secA('Expériences Professionnelles',pc,'under')}${d.experiences.map(e=>expBlock(e,pc,fn)).join('')}`:''}
          ${d.formations.length?`<div style="margin-top:12px">${secA('Formation',pc,'under')}${d.formations.map(f=>eduBlock(f,pc,fn)).join('')}</div>`:''}
        </div>
        <div>
          ${d.competences.length?`${secA('Compétences',pc,'under')}${d.competences.map(c=>`<div style="background:${pc}18;border-left:2px solid ${pc};padding:3px 8px;font-size:9.5px;margin-bottom:5px;color:#1a1a1a">${c.nom}</div>`).join('')}`:''}
          ${d.langues.length?`<div style="margin-top:14px">${secA('Langues',pc,'under')}${d.langues.map(l=>`<p style="font-size:10px;margin:0 0 5px">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
          ${d.certifications.length?`<div style="margin-top:14px">${secA('Certifications',pc,'under')}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#444">${c.nom}</p>`).join('')}</div>`:''}
        </div>
      </div>
    </div>
  </div>`;
}

// 7 — Double Filet : encadrement double ligne, centré, élégant
function tDoubleFilet(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#7c2d12';
  const fn = th?.police ?? 'Georgia, serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#1a1a1a;background:#fff;padding:50px 58px;box-sizing:border-box;">
    <div style="border-top:3px solid ${pc};border-bottom:3px solid ${pc};padding:16px 0;margin-bottom:22px;text-align:center">
      <h1 style="font-size:28px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;color:#0f0f0f">${d.info.prenom} ${d.info.nom}</h1>
      <p style="font-size:11px;color:${pc};letter-spacing:1.5px;text-transform:uppercase;font-weight:600;margin:0 0 8px">${d.info.titre}</p>
      <p style="font-size:9px;color:#666;letter-spacing:.5px;margin:0">${[d.info.email,d.info.telephone,d.info.ville,d.info.linkedin].filter(Boolean).join(' · ')}</p>
    </div>
    ${d.info.apropos?`<p style="font-size:10.5px;line-height:1.72;color:#333;text-align:center;font-style:italic;margin:0 0 22px">${d.info.apropos}</p>`:''}
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:30px">
      <div>
        ${d.experiences.length?`${secA('Expériences Professionnelles',pc,'under')}${d.experiences.map(e=>expBlock(e,pc,fn)).join('')}`:''}
        ${d.formations.length?`<div style="margin-top:12px">${secA('Formation',pc,'under')}${d.formations.map(f=>eduBlock(f,pc,fn)).join('')}</div>`:''}
      </div>
      <div>
        ${d.competences.length?`${secA('Compétences',pc,'under')}${tags(d.competences,'#fef3c7',pc)}`:''}
        ${d.langues.length?`<div style="margin-top:14px">${secA('Langues',pc,'under')}${d.langues.map(l=>`<p style="font-size:10px;margin:0 0 5px">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
        ${d.certifications.length?`<div style="margin-top:14px">${secA('Certifications',pc,'under')}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#444">${c.nom}</p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// 8 — Douceur Pastel : dégradé violet doux, badges arrondis
function tPastelDoux(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#7c3aed';
  const fn = th?.police ?? 'Trebuchet MS, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#2d1b69;background:#fff;box-sizing:border-box;">
    <div style="background:linear-gradient(135deg,${pc},${pc}cc);padding:32px 44px;color:#fff">
      <div style="display:flex;align-items:center;gap:18px">
        ${d.info.photoUrl?`<div style="flex-shrink:0">${photo(d.info.photoUrl,78,'',th)}</div>`:''}
        <div>
          <h1 style="font-size:24px;font-weight:700;margin:0 0 3px">${d.info.prenom} ${d.info.nom}</h1>
          <p style="font-size:11px;opacity:.88;margin:0 0 8px;font-weight:500">${d.info.titre}</p>
          <p style="font-size:9px;opacity:.75;margin:0">${[d.info.email,d.info.telephone,d.info.ville].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    </div>
    <div style="background:#faf5ff;padding:18px 44px">
      ${d.info.apropos?`<p style="font-size:10.5px;line-height:1.7;color:#4c1d95;background:#ede9fe;border-radius:8px;padding:12px 16px;margin:0">${d.info.apropos}</p>`:''}
    </div>
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:0;background:#fff">
      <div style="padding:20px 32px 32px 44px">
        ${d.experiences.length?`${secA('Expériences',pc,'dot')}${d.experiences.map(e=>expBlock(e,pc,fn)).join('')}`:''}
        ${d.formations.length?`<div style="margin-top:12px">${secA('Formation',pc,'dot')}${d.formations.map(f=>eduBlock(f,pc,fn)).join('')}</div>`:''}
      </div>
      <div style="padding:20px 32px 32px 24px;background:#faf5ff">
        ${d.competences.length?`${secA('Compétences',pc,'dot')}${d.competences.map(c=>`<div style="background:#ede9fe;color:${pc};padding:3px 10px;border-radius:20px;font-size:9px;font-weight:600;margin-bottom:5px;display:inline-block;margin-right:4px">${c.nom}</div>`).join('')}`:''}
        ${d.langues.length?`<div style="margin-top:16px">${secA('Langues',pc,'dot')}${d.langues.map(l=>`<p style="font-size:10px;margin:0 0 5px;color:#4c1d95">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
        ${d.certifications.length?`<div style="margin-top:16px">${secA('Certifications',pc,'dot')}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#444">${c.nom}</p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// 9 — Tech Badges : header sombre, badges monospace, style dev
function tTechBadges(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#06b6d4';
  const fn = th?.police ?? 'Verdana, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#0f172a;background:#fff;box-sizing:border-box;">
    <div style="background:#0f172a;padding:28px 44px;display:flex;align-items:center;gap:20px">
      ${d.info.photoUrl?`<div style="flex-shrink:0">${photo(d.info.photoUrl,70,'',th)}</div>`:''}
      <div style="flex:1">
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 3px;letter-spacing:-.3px">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:11px;color:${pc};font-weight:600;margin:0 0 8px">${d.info.titre}</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${[d.info.email,d.info.telephone,d.info.ville].filter(Boolean).map(v=>`<span style="font-size:8.5px;color:#94a3b8;background:#1e293b;padding:2px 8px;border-radius:4px">${v}</span>`).join('')}
        </div>
      </div>
    </div>
    ${d.info.apropos?`<div style="padding:18px 44px;background:#f8fafc;border-bottom:1px solid #e2e8f0"><p style="font-size:10.5px;line-height:1.65;color:#334155;margin:0">${d.info.apropos}</p></div>`:''}
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:0">
      <div style="padding:24px 32px 32px 44px;border-right:1px solid #e2e8f0">
        ${d.experiences.length?`${secA('Expériences',pc,'left')}${d.experiences.map(e=>expBlock(e,pc,fn)).join('')}`:''}
        ${d.formations.length?`<div style="margin-top:14px">${secA('Formation',pc,'left')}${d.formations.map(f=>eduBlock(f,pc,fn)).join('')}</div>`:''}
      </div>
      <div style="padding:24px 28px 32px 24px">
        ${d.competences.length?`${secA('Stack & Skills',pc,'left')}${d.competences.map(c=>`<div style="background:#0f172a;color:${pc};padding:3px 9px;border-radius:4px;font-size:8.5px;font-family:monospace;margin-bottom:5px;display:inline-block;margin-right:4px">${c.nom}</div>`).join('')}`:''}
        ${d.langues.length?`<div style="margin-top:16px">${secA('Langues',pc,'left')}${d.langues.map(l=>`<p style="font-size:9.5px;margin:0 0 4px">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
        ${d.certifications.length?`<div style="margin-top:16px">${secA('Certifications',pc,'left')}${d.certifications.map(c=>`<p style="font-size:9px;margin:0 0 5px;color:#475569;background:#e2e8f0;padding:3px 8px;border-radius:3px">${c.nom}</p>`).join('')}</div>`:''}
      </div>
    </div>
  </div>`;
}

// 10 — Commercial Dynamique : bandeau couleur, impact, puces rondes
function tCommercialDyn(d: CvData, th?: Partial<CvTheme>): string {
  const pc = th?.couleurPrimaire ?? '#ea580c';
  const fn = th?.police ?? 'Arial, sans-serif';
  return `<div style="width:794px;min-height:1123px;font-family:${fn};color:#1a1a1a;background:#fff;box-sizing:border-box;">
    <div style="background:${pc};display:flex;align-items:stretch;min-height:108px">
      <div style="flex:1;padding:24px 0 24px 44px;display:flex;flex-direction:column;justify-content:center">
        <h1 style="font-size:26px;font-weight:900;color:#fff;margin:0 0 4px;letter-spacing:-.3px;text-transform:uppercase">${d.info.prenom} ${d.info.nom}</h1>
        <p style="font-size:11px;color:rgba(255,255,255,.9);font-weight:600;margin:0">${d.info.titre}</p>
      </div>
      <div style="background:rgba(0,0,0,.15);padding:18px 26px;display:flex;flex-direction:column;justify-content:center;min-width:196px;box-sizing:border-box">
        ${d.info.email?`<p style="font-size:9px;margin:0 0 4px;color:#fff">✉ ${d.info.email}</p>`:''}
        ${d.info.telephone?`<p style="font-size:9px;margin:0 0 4px;color:#fff">☎ ${d.info.telephone}</p>`:''}
        ${d.info.ville?`<p style="font-size:9px;margin:0;color:#fff">◉ ${d.info.ville}</p>`:''}
      </div>
    </div>
    <div style="padding:26px 44px">
      ${d.info.apropos?`<div style="border-left:4px solid ${pc};padding-left:14px;margin-bottom:22px"><p style="font-size:10.5px;line-height:1.7;color:#333;margin:0">${d.info.apropos}</p></div>`:''}
      <div style="display:grid;grid-template-columns:3fr 2fr;gap:28px">
        <div>
          ${d.experiences.length?`${secA('Expériences',pc,'box')}${d.experiences.map(e=>expBlock(e,pc,fn)).join('')}`:''}
          ${d.formations.length?`<div style="margin-top:12px">${secA('Formation',pc,'box')}${d.formations.map(f=>eduBlock(f,pc,fn)).join('')}</div>`:''}
        </div>
        <div>
          ${d.competences.length?`${secA('Compétences',pc,'box')}${d.competences.map(c=>`<p style="font-size:10px;margin:0 0 5px;color:#333;display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${pc};display:inline-block;flex-shrink:0"></span>${c.nom}</p>`).join('')}`:''}
          ${d.langues.length?`<div style="margin-top:14px">${secA('Langues',pc,'box')}${d.langues.map(l=>`<p style="font-size:10px;margin:0 0 5px">${l.nom} <span style="color:#888">(${l.niveau})</span></p>`).join('')}</div>`:''}
          ${d.certifications.length?`<div style="margin-top:14px">${secA('Certifications',pc,'box')}${d.certifications.map(c=>`<p style="font-size:9.5px;margin:0 0 4px;color:#444">${c.nom}</p>`).join('')}</div>`:''}
        </div>
      </div>
    </div>
  </div>`;
}

const ALL_TEMPLATES: TplDef[] = [
  { id: 'moderne-beige',   nom: 'Moderne Beige',     categorie: 'moderne',     avecPhoto: true,  scoreAts: 80, isNew: false, couleurDefaut: '#9c7c5a', popularite: 95, render: tModerneBeige },
  { id: 'bordeaux',        nom: 'Bordeaux',           categorie: 'executive',   avecPhoto: false, scoreAts: 88, isNew: false, couleurDefaut: '#881337', popularite: 88, render: tBordeaux },
  { id: 'bleu-pro',        nom: 'Bleu Professionnel', categorie: 'corporate',   avecPhoto: true,  scoreAts: 90, isNew: false, couleurDefaut: '#1d4ed8', popularite: 92, render: tBleuPro },
  { id: 'minimaliste-gris',nom: 'Minimaliste Gris',   categorie: 'minimaliste', avecPhoto: false, scoreAts: 94, isNew: false, couleurDefaut: '#475569', popularite: 87, render: tMinimalisteGris },
  { id: 'minimaliste-noir',nom: 'Minimaliste Noir',   categorie: 'minimaliste', avecPhoto: false, scoreAts: 96, isNew: false, couleurDefaut: '#0f172a', popularite: 82, render: tMinimalisteNoir },
  { id: 'vert-moderne',    nom: 'Vert Moderne',       categorie: 'moderne',     avecPhoto: true,  scoreAts: 82, isNew: false, couleurDefaut: '#059669', popularite: 78, render: tVertModerne },
  { id: 'bleu-clair',      nom: 'Bleu Clair',         categorie: 'moderne',     avecPhoto: true,  scoreAts: 78, isNew: false, couleurDefaut: '#0ea5e9', popularite: 83, render: tBleuClair },
  { id: 'beige-elegant',   nom: 'Beige Élégant',      categorie: 'executive',   avecPhoto: true,  scoreAts: 76, isNew: false, couleurDefaut: '#92400e', popularite: 74, render: tBeigeElegant },
  { id: 'vert-pastel',     nom: 'Vert Pastel',        categorie: 'etudiant',    avecPhoto: true,  scoreAts: 85, isNew: false, couleurDefaut: '#16a34a', popularite: 80, render: tVertPastel },
  { id: 'photographe',     nom: 'Photographe',        categorie: 'creatif',     avecPhoto: true,  scoreAts: 62, isNew: false, couleurDefaut: '#f97316', popularite: 72, render: tPhotographe },
  { id: 'violet',          nom: 'Violet',             categorie: 'designer',    avecPhoto: true,  scoreAts: 75, isNew: false, couleurDefaut: '#7c3aed', popularite: 86, render: tViolet },
  { id: 'orange',          nom: 'Orange',             categorie: 'marketing',   avecPhoto: true,  scoreAts: 79, isNew: true,  couleurDefaut: '#ea580c', popularite: 70, render: tOrange },
  { id: 'bleu-marine',     nom: 'Bleu Marine',        categorie: 'corporate',   avecPhoto: true,  scoreAts: 91, isNew: false, couleurDefaut: '#0f2444', popularite: 84, render: tBleuMarine },
  { id: 'rouge',           nom: 'Rouge',              categorie: 'marketing',   avecPhoto: true,  scoreAts: 77, isNew: true,  couleurDefaut: '#dc2626', popularite: 75, render: tRouge },
  { id: 'gris-corp',       nom: 'Gris Corporate',     categorie: 'corporate',   avecPhoto: false, scoreAts: 93, isNew: false, couleurDefaut: '#374151', popularite: 89, render: tGrisCorp },
  // ── Sidebar gauche (12 nouveaux) ──
  { id: 'chocolat',        nom: 'Chocolat Profond',   categorie: 'executive',   avecPhoto: true,  scoreAts: 78, isNew: true,  couleurDefaut: '#c9863e', popularite: 81, render: tChocolat },
  { id: 'foret-profond',   nom: 'Forêt Profonde',     categorie: 'moderne',     avecPhoto: true,  scoreAts: 82, isNew: true,  couleurDefaut: '#22c55e', popularite: 76, render: tForetProfond },
  { id: 'minuit-elec',     nom: 'Minuit Électrique',  categorie: 'dev',         avecPhoto: true,  scoreAts: 80, isNew: true,  couleurDefaut: '#818cf8', popularite: 88, render: tMinuitElec },
  { id: 'corail-vif',      nom: 'Corail Vif',         categorie: 'creatif',     avecPhoto: true,  scoreAts: 70, isNew: true,  couleurDefaut: '#ff6b4a', popularite: 74, render: tCorailVif },
  { id: 'or-elegant',      nom: 'Or Élégant',         categorie: 'executive',   avecPhoto: true,  scoreAts: 76, isNew: true,  couleurDefaut: '#d4a017', popularite: 85, render: tOrElegant },
  { id: 'cobalt-pro',      nom: 'Cobalt Pro',         categorie: 'corporate',   avecPhoto: true,  scoreAts: 88, isNew: true,  couleurDefaut: '#60a5fa', popularite: 82, render: tCobaltPro },
  { id: 'ardoise',         nom: 'Ardoise',            categorie: 'moderne',     avecPhoto: true,  scoreAts: 84, isNew: true,  couleurDefaut: '#67e8f9', popularite: 79, render: tArdoise },
  { id: 'prune-sombre',    nom: 'Prune Sombre',       categorie: 'designer',    avecPhoto: true,  scoreAts: 73, isNew: true,  couleurDefaut: '#a855f7', popularite: 77, render: tPruneSombre },
  { id: 'rose-elegante',   nom: 'Rose Élégante',      categorie: 'creatif',     avecPhoto: true,  scoreAts: 71, isNew: true,  couleurDefaut: '#f43f5e', popularite: 80, render: tRoseElegante },
  { id: 'menthe-fraiche',  nom: 'Menthe Fraîche',     categorie: 'etudiant',    avecPhoto: true,  scoreAts: 83, isNew: true,  couleurDefaut: '#10b981', popularite: 78, render: tMentheFraich },
  { id: 'graphite-elite',  nom: 'Graphite Elite',     categorie: 'corporate',   avecPhoto: true,  scoreAts: 91, isNew: true,  couleurDefaut: '#94a3b8', popularite: 86, render: tGraphiteElite },
  { id: 'terracotta-pro',  nom: 'Terracotta Pro',     categorie: 'moderne',     avecPhoto: true,  scoreAts: 75, isNew: true,  couleurDefaut: '#c2553f', popularite: 73, render: tTerracotta },
  // ── Sidebar droite (3 nouveaux) ──
  { id: 'marine-droit',    nom: 'Marine Droite',      categorie: 'corporate',   avecPhoto: true,  scoreAts: 87, isNew: true,  couleurDefaut: '#3b82f6', popularite: 83, render: tSideRight1 },
  { id: 'fuchsia-droit',   nom: 'Fuchsia Inversé',    categorie: 'designer',    avecPhoto: true,  scoreAts: 69, isNew: true,  couleurDefaut: '#e879f9', popularite: 75, render: tSideRight2 },
  { id: 'vert-droit',      nom: 'Vert Inversé',       categorie: 'etudiant',    avecPhoto: true,  scoreAts: 84, isNew: true,  couleurDefaut: '#4ade80', popularite: 77, render: tSideRight3 },
  // ── Header focus (7 nouveaux) ──
  { id: 'sunset',          nom: 'Sunset',             categorie: 'creatif',     avecPhoto: true,  scoreAts: 73, isNew: true,  couleurDefaut: '#f59e0b', popularite: 82, render: tSunset },
  { id: 'ocean-profond',   nom: 'Océan Profond',      categorie: 'moderne',     avecPhoto: true,  scoreAts: 80, isNew: true,  couleurDefaut: '#0891b2', popularite: 85, render: tOceanProfond },
  { id: 'sakura',          nom: 'Sakura',             categorie: 'creatif',     avecPhoto: true,  scoreAts: 72, isNew: true,  couleurDefaut: '#fb7185', popularite: 79, render: tSakura },
  { id: 'luxe-anthrac',    nom: 'Luxe Anthracite',    categorie: 'executive',   avecPhoto: true,  scoreAts: 85, isNew: true,  couleurDefaut: '#d4a017', popularite: 91, render: tLuxeAnthrac },
  { id: 'cyberpunk',       nom: 'Cyberpunk',          categorie: 'dev',         avecPhoto: true,  scoreAts: 68, isNew: true,  couleurDefaut: '#7c3aed', popularite: 76, render: tCyberpunk },
  { id: 'fuchsia-top',     nom: 'Fuchsia Gradient',   categorie: 'designer',    avecPhoto: true,  scoreAts: 70, isNew: true,  couleurDefaut: '#e879f9', popularite: 74, render: tFuchsia },
  { id: 'jade',            nom: 'Jade Asiatique',     categorie: 'moderne',     avecPhoto: true,  scoreAts: 79, isNew: true,  couleurDefaut: '#34d399', popularite: 77, render: tJadeAsiat },
  // ── Une colonne & timeline (5 nouveaux) ──
  { id: 'timeline-indigo', nom: 'Timeline Indigo',    categorie: 'moderne',     avecPhoto: true,  scoreAts: 86, isNew: true,  couleurDefaut: '#4f46e5', popularite: 88, render: tTimelineIndigo },
  { id: 'academique',      nom: 'Académique',         categorie: 'etudiant',    avecPhoto: false, scoreAts: 95, isNew: true,  couleurDefaut: '#1e3a6e', popularite: 84, render: tAcademique },
  { id: 'juridique',       nom: 'Juridique',          categorie: 'corporate',   avecPhoto: false, scoreAts: 97, isNew: true,  couleurDefaut: '#1f2937', popularite: 80, render: tJuridique },
  { id: 'tech-dev',        nom: 'Tech Développeur',   categorie: 'dev',         avecPhoto: false, scoreAts: 89, isNew: true,  couleurDefaut: '#7c3aed', popularite: 86, render: tTechDev },
  { id: 'moderniste-ult',  nom: 'Moderniste Ultra',   categorie: 'minimaliste', avecPhoto: false, scoreAts: 92, isNew: true,  couleurDefaut: '#0f172a', popularite: 83, render: tModernisteUlt },
  // ── Nouveaux 2026 ──────────────────────────────────────────
  { id: 'classique-epure',  nom: 'Classique Épuré',     categorie: 'minimaliste', avecPhoto: false, scoreAts: 98, isNew: true,  couleurDefaut: '#1a1a2e', popularite: 91, render: tClassiqueEpure },
  { id: 'francais-classiq', nom: 'Français Classique',  categorie: 'moderne',     avecPhoto: true,  scoreAts: 92, isNew: true,  couleurDefaut: '#1d3461', popularite: 89, render: tFrancaisClassique },
  { id: 'bicolore-split',   nom: 'Bicolore Split',      categorie: 'corporate',   avecPhoto: true,  scoreAts: 86, isNew: true,  couleurDefaut: '#1e3a5f', popularite: 85, render: tBicoloreSplit },
  { id: 'international-m',  nom: 'International Min.',  categorie: 'minimaliste', avecPhoto: true,  scoreAts: 95, isNew: true,  couleurDefaut: '#111827', popularite: 87, render: tInternationalMin },
  { id: 'barres-skills',    nom: 'Barres Compétences',  categorie: 'moderne',     avecPhoto: true,  scoreAts: 78, isNew: true,  couleurDefaut: '#2563eb', popularite: 84, render: tBarresSkills },
  { id: 'finance-prestige', nom: 'Finance Prestige',    categorie: 'executive',   avecPhoto: true,  scoreAts: 89, isNew: true,  couleurDefaut: '#b8960c', popularite: 88, render: tFinancePrestige },
  { id: 'double-filet',     nom: 'Double Filet',        categorie: 'executive',   avecPhoto: false, scoreAts: 88, isNew: true,  couleurDefaut: '#7c2d12', popularite: 82, render: tDoubleFilet },
  { id: 'pastel-doux',      nom: 'Douceur Pastel',      categorie: 'etudiant',    avecPhoto: true,  scoreAts: 80, isNew: true,  couleurDefaut: '#7c3aed', popularite: 83, render: tPastelDoux },
  { id: 'tech-badges',      nom: 'Tech Badges',         categorie: 'dev',         avecPhoto: true,  scoreAts: 84, isNew: true,  couleurDefaut: '#06b6d4', popularite: 86, render: tTechBadges },
  { id: 'commercial-dyn',   nom: 'Commercial Dyn.',     categorie: 'marketing',   avecPhoto: false, scoreAts: 77, isNew: true,  couleurDefaut: '#ea580c', popularite: 80, render: tCommercialDyn },
  // ── CV 2026 — 8 modèles reproduits ────────────────────────
  { id: 'cv26-raphael',     nom: 'Raphaël Martin',      categorie: 'cv2026',      avecPhoto: true,  scoreAts: 82, isNew: true,  couleurDefaut: '#1b2a4a', popularite: 90, render: tCV26Raphael },
  { id: 'cv26-prenomnom',   nom: 'Prénom NOM Teal',     categorie: 'cv2026',      avecPhoto: true,  scoreAts: 80, isNew: true,  couleurDefaut: '#1a6060', popularite: 87, render: tCV26PrenomNom },
  { id: 'cv26-sophie-mktg', nom: 'Sophie Dupont Mktg',  categorie: 'cv2026',      avecPhoto: true,  scoreAts: 83, isNew: true,  couleurDefaut: '#0d9488', popularite: 89, render: tCV26SophieMarketing },
  { id: 'cv26-camille-pro', nom: 'Camille Dupont Pro',  categorie: 'cv2026',      avecPhoto: true,  scoreAts: 86, isNew: true,  couleurDefaut: '#1a365d', popularite: 88, render: tCV26CamillePro },
  { id: 'cv26-camille-esg', nom: 'Camille Dupont ESG',  categorie: 'cv2026',      avecPhoto: true,  scoreAts: 85, isNew: true,  couleurDefaut: '#0f766e', popularite: 86, render: tCV26CamilleESG },
  { id: 'cv26-julie',       nom: 'Julie Duval',          categorie: 'cv2026',      avecPhoto: true,  scoreAts: 88, isNew: true,  couleurDefaut: '#00a896', popularite: 91, render: tCV26JulieDuval },
  { id: 'cv26-morceau',     nom: 'Sophie Morceau',       categorie: 'cv2026',      avecPhoto: true,  scoreAts: 76, isNew: true,  couleurDefaut: '#2196a3', popularite: 84, render: tCV26SophieMorceau },
  { id: 'cv26-ats',         nom: 'Sophie Michel ATS',    categorie: 'cv2026',      avecPhoto: false, scoreAts: 94, isNew: true,  couleurDefaut: '#6b1f3a', popularite: 85, render: tCV26SophieMichelATS }
];

// ═══════════════════════════════════════════════════════════
// AI ASSISTANT TYPES
// ═══════════════════════════════════════════════════════════

const AI_PROVIDER_NAMES = ['OpenAI', 'DeepSeek', 'Mistral', 'Anthropic', 'Ollama', 'Personnalisé'] as const;
const AI_USE_CATEGORIES = ['all','text','images','integrations','audio','moderation','realtime','coding','vision'] as const;
const AI_USE_LABELS: Record<string, string> = {
  all:'All', text:'Texte', images:'Images', integrations:'Intégrations',
  audio:'Traitement de l\'audio', moderation:'Modération du contenu',
  realtime:'Tâches en temps réel', coding:'Aide au codage', vision:'Analyse visuelle'
};
const AI_DEFAULT_URLS: Record<string, string> = {
  'OpenAI':'https://api.openai.com/v1', 'DeepSeek':'https://api.deepseek.com/v1',
  'Mistral':'https://api.mistral.ai/v1', 'Anthropic':'https://api.anthropic.com/v1',
  'Ollama':'http://localhost:11434/v1', 'Personnalisé':''
};
const AI_TRANSLATE_LANGS = [
  { code:'en', label:'English', native:'English' },
  { code:'ru', label:'Russian', native:'Русский' },
  { code:'de', label:'German',  native:'Deutsch' },
  { code:'fr', label:'French',  native:'Français' },
  { code:'es', label:'Spanish', native:'Español' },
  { code:'ar', label:'Arabic',  native:'العربية' },
  { code:'zh', label:'Chinese', native:'中文' },
  { code:'pt', label:'Portuguese', native:'Português' },
];
const CHAT_QUICK_PROMPTS = [
  'Améliorer mon résumé', 'Rédiger des bullet points d\'expérience',
  'Générer un profil professionnel', 'Optimiser pour ATS',
  'Reformuler en anglais', 'Raccourcir le texte',
  'Rendre plus percutant', 'Obtenir des conseils CV'
];

interface AiProvider {
  id: string;
  name: string;
  url: string;
  key: string;
  model: string;
  usedFor: string[];
}
type AiFn = 'chatbot' | 'summary' | 'translate' | 'analyze' | 'image' | 'grammar';
interface AiConfig { chatbot: string; summary: string; translate: string; analyze: string; image: string; grammar: string; }
interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string; }

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

@Component({
  selector: 'app-cv-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, DesignEditorComponent, OfficeEditorComponent],
  template: `
<div class="cvb-root" [style.grid-template-columns]="sidebarCollapsed ? '44px 1fr 320px' : '220px 1fr 320px'">

  <!-- ░░ SIDEBAR ░░ -->
  <aside class="cvb-sidebar" [class.cvb-sidebar--collapsed]="sidebarCollapsed">

    <!-- Toggle button -->
    <button class="cvb-sidebar-toggle" (click)="sidebarCollapsed=!sidebarCollapsed"
            [title]="sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu'">
      <span class="cvb-toggle-icon">{{sidebarCollapsed ? '›' : '‹'}}</span>
    </button>

    <div class="cvb-sidebar-content">
    <div class="cvb-logo">
      <span class="cvb-logo-icon">📄</span>
      <div>
        <div class="cvb-logo-title">CV BUILDER</div>
        <div class="cvb-logo-sub">100+ Modèles professionnels</div>
      </div>
    </div>

    <nav class="cvb-nav">
      <button class="cvb-nav-btn" [class.active]="activeNav==='all'" (click)="setNav('all')">
        <span>🗂</span> Tous les modèles <span class="cvb-badge">{{allTpls.length}}</span>
      </button>
      <button class="cvb-nav-btn" [class.active]="activeNav==='recent'" (click)="setNav('recent')">
        <span>🕑</span> Récents <span class="cvb-badge" *ngIf="recentIds.length">{{recentIds.length}}</span>
      </button>
      <button class="cvb-nav-btn" [class.active]="activeNav==='favorites'" (click)="setNav('favorites')">
        <span>⭐</span> Favoris <span class="cvb-badge" *ngIf="favoriteIds.size">{{favoriteIds.size}}</span>
      </button>
      <button class="cvb-nav-btn cvb-nav-btn--creations" [class.active]="activeNav==='mes-creations'" (click)="setNav('mes-creations')">
        <span>🎨</span> Mes Créations <span class="cvb-badge" *ngIf="savedCreations.length">{{savedCreations.length}}</span>
      </button>
    </nav>

    <div class="cvb-sec-label">CATÉGORIES</div>
    <nav class="cvb-cats">
      <button *ngFor="let c of cats" class="cvb-cat-btn" [class.active]="activeCategory===c.id" (click)="setCategory(c.id)">
        <span>{{c.label}}</span>
        <span class="cvb-cat-count">{{countByCategory(c.id)}}</span>
      </button>
    </nav>

    <div class="cvb-sec-label" style="margin-top:12px">COULEURS</div>
    <div class="cvb-swatches">
      <button *ngFor="let sw of swatches" class="cvb-swatch"
        [style.background]="sw"
        [class.active]="filterColor===sw"
        (click)="toggleColor(sw)"
        [title]="sw"></button>
      <button class="cvb-swatch-more" (click)="filterColor=null">Réinitialiser</button>
    </div>

    <div class="cvb-sec-label" style="margin-top:12px">OPTIONS</div>
    <div class="cvb-opts">
      <label class="cvb-opt-row">
        <span>Avec photo</span>
        <input type="checkbox" [checked]="filterAvecPhoto===true" (change)="togglePhotoOpt(true)">
      </label>
      <label class="cvb-opt-row">
        <span>Sans photo</span>
        <input type="checkbox" [checked]="filterAvecPhoto===false" (change)="togglePhotoOpt(false)">
      </label>
      <label class="cvb-opt-row">
        <span>ATS Friendly</span>
        <input type="checkbox" [(ngModel)]="filterAts">
      </label>
      <label class="cvb-opt-row">
        <span>Nouveautés <span class="badge-new">NEW</span></span>
        <input type="checkbox" [(ngModel)]="filterNew">
      </label>
    </div>
    </div><!-- /cvb-sidebar-content -->
  </aside>

  <!-- ░░ MAIN GRID ░░ -->
  <main class="cvb-main">
    <div class="cvb-main-head">
      <h1 class="cvb-main-title">{{filteredTpls.length}} Modèles de CV Professionnels</h1>
      <div class="cvb-main-controls">
        <div class="cvb-search-wrap">
          <span class="cvb-search-ico">🔍</span>
          <input class="cvb-search" type="text" placeholder="Rechercher un modèle…" [(ngModel)]="searchQuery">
        </div>
        <div class="cvb-sort-wrap">
          <span style="font-size:.75rem;color:#64748b">Trier par :</span>
          <select class="cvb-sort" [(ngModel)]="sortBy">
            <option value="popular">Populaire</option>
            <option value="ats">Score ATS</option>
            <option value="new">Nouveau</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ── Galerie modèles ── -->
    <div class="cvb-grid" *ngIf="activeNav !== 'mes-creations'">
      <div *ngFor="let tpl of filteredTpls; trackBy: trackById" class="tpl-card"
           [class.tpl-card--selected]="selectedTpl?.id===tpl.id"
           (click)="selectTpl(tpl)">
        <div class="tpl-thumb">
          <div class="tpl-thumb-inner" [innerHTML]="getThumbnail(tpl)"></div>
          <div class="tpl-overlay">
            <button class="tpl-action-btn tpl-btn-preview" title="Aperçu" (click)="$event.stopPropagation(); openPreview(tpl)">👁</button>
            <button class="tpl-action-btn tpl-btn-edit" title="Éditer" (click)="$event.stopPropagation(); selectTpl(tpl)">✏</button>
            <button class="tpl-action-btn" title="Favori"
              [class.tpl-btn-fav-on]="favoriteIds.has(tpl.id)"
              (click)="$event.stopPropagation(); toggleFav(tpl.id)">{{favoriteIds.has(tpl.id)?'♥':'♡'}}</button>
          </div>
          <div *ngIf="tpl.isNew" class="tpl-new-badge">NEW</div>
          <div class="tpl-ats-badge" [style.background]="atsColor(tpl.scoreAts)">ATS {{tpl.scoreAts}}%</div>
        </div>
        <div class="tpl-foot">
          <span class="tpl-name">{{tpl.nom}}</span>
          <div class="tpl-actions">
            <button class="tpl-btn" title="Favori"
              [class.tpl-btn--fav]="favoriteIds.has(tpl.id)"
              (click)="$event.stopPropagation(); toggleFav(tpl.id)">{{favoriteIds.has(tpl.id)?'★':'☆'}}</button>
          </div>
        </div>
      </div>

      <div *ngIf="filteredTpls.length===0" class="cvb-empty">
        <div style="font-size:3rem">🔍</div>
        <p>Aucun modèle ne correspond à vos filtres.</p>
        <button (click)="resetFilters()">Réinitialiser les filtres</button>
      </div>
    </div>

    <!-- ── Mes Créations ── -->
    <div *ngIf="activeNav === 'mes-creations'" class="mc-panel">
      <div *ngIf="savedCreations.length === 0" class="cvb-empty">
        <div style="font-size:3rem">🎨</div>
        <p>Aucune création sauvegardée.</p>
        <p style="font-size:.8rem;color:#94a3b8">Ouvrez un modèle en aperçu, activez le mode ✏ et cliquez sur 💾 Sauvegarder.</p>
      </div>
      <div class="mc-grid">
        <div *ngFor="let cr of savedCreations" class="mc-card">
          <div class="mc-thumb">
            <div class="mc-thumb-inner" [innerHTML]="getSavedThumb(cr)"></div>
            <div class="mc-overlay">
              <button class="tpl-action-btn tpl-btn-preview" title="Ouvrir" (click)="loadCreation(cr)">📂</button>
              <button class="tpl-action-btn" style="background:rgba(239,68,68,.7)" title="Supprimer" (click)="deleteCreation(cr.id)">🗑</button>
            </div>
          </div>
          <div class="mc-foot">
            <span class="mc-name">{{cr.tplName}}</span>
            <span class="mc-date">{{cr.savedAt | date:'dd/MM/yyyy HH:mm'}}</span>
            <div style="display:flex;gap:6px;margin-top:6px">
              <button class="mc-load-btn" (click)="loadCreation(cr)">📂 Charger</button>
              <button class="mc-del-btn" (click)="deleteCreation(cr.id)">🗑</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- ░░ EDITOR PANEL ░░ -->
  <aside class="cvb-editor" [class.cvb-editor--open]="!!selectedTpl">
    <ng-container *ngIf="selectedTpl; else noTpl">

      <div class="cvb-ed-head">
        <span class="cvb-ed-tpl-name">{{selectedTpl.nom}}</span>
        <div class="cvb-ed-head-actions">
          <button class="cvb-ed-ico-btn" title="Aperçu" (click)="openPreview(selectedTpl!)">🔍</button>
          <button class="cvb-ed-ico-btn" title="Fermer" (click)="closeTpl()">✕</button>
        </div>
      </div>

      <button class="cvb-dl-btn" (click)="downloadPdf()">
        ⬇ Télécharger en PDF
      </button>

      <div class="cvb-tabs">
        <button class="cvb-tab" [class.active]="edTab==='content'" (click)="edTab='content'">CONTENU</button>
        <button class="cvb-tab" [class.active]="edTab==='layout'" (click)="edTab='layout'">MISE EN PAGE</button>
        <button class="cvb-tab" [class.active]="edTab==='theme'" (click)="edTab='theme'">THÈME</button>
      </div>

      <!-- ── CONTENT TAB ── -->
      <div class="cvb-ed-body" *ngIf="edTab==='content'">

        <!-- Photo + Nom -->
        <div class="cvb-section">
          <div class="cvb-section-title">INFORMATIONS PERSONNELLES</div>

          <div class="photo-row">
            <div class="photo-preview" (click)="photoInput.click()">
              <img *ngIf="cvData.info.photoUrl" [src]="cvData.info.photoUrl" alt="Photo">
              <span *ngIf="!cvData.info.photoUrl" class="photo-placeholder">👤</span>
            </div>
            <div class="photo-btns">
              <button class="photo-btn" (click)="photoInput.click()">⬆ Changer la photo</button>
              <button class="photo-btn photo-btn--del" *ngIf="cvData.info.photoUrl" (click)="cvData.info.photoUrl=''">🗑</button>
            </div>
            <input #photoInput type="file" accept="image/*" style="display:none" (change)="onPhoto($event)">
          </div>

          <label class="cvb-label">Nom complet</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <input class="cvb-input" placeholder="Prénom" [(ngModel)]="cvData.info.prenom">
            <input class="cvb-input" placeholder="Nom" [(ngModel)]="cvData.info.nom">
          </div>

          <label class="cvb-label">Métier / Titre</label>
          <input class="cvb-input" placeholder="ex. Chargée de Projet" [(ngModel)]="cvData.info.titre">

          <label class="cvb-label">Email</label>
          <input class="cvb-input" type="email" placeholder="email@exemple.com" [(ngModel)]="cvData.info.email">

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label class="cvb-label">Téléphone</label>
              <input class="cvb-input" placeholder="06 00 00 00 00" [(ngModel)]="cvData.info.telephone">
            </div>
            <div>
              <label class="cvb-label">Ville</label>
              <input class="cvb-input" placeholder="Paris, France" [(ngModel)]="cvData.info.ville">
            </div>
          </div>

          <label class="cvb-label">LinkedIn</label>
          <input class="cvb-input" placeholder="linkedin.com/in/profil" [(ngModel)]="cvData.info.linkedin">

          <label class="cvb-label">GitHub</label>
          <input class="cvb-input" placeholder="github.com/handle" [(ngModel)]="cvData.info.github">

          <label class="cvb-label">Portfolio / Site</label>
          <input class="cvb-input" placeholder="mon-portfolio.fr" [(ngModel)]="cvData.info.portfolio">

          <label class="cvb-label">À Propos</label>
          <textarea class="cvb-textarea" rows="4" maxlength="500" placeholder="Courte présentation…" [(ngModel)]="cvData.info.apropos"></textarea>
          <div class="cvb-char-count">{{cvData.info.apropos.length}} / 500</div>
        </div>

        <!-- Photo style -->
        <div class="cvb-section">
          <div class="cvb-section-title">FORME DE LA PHOTO</div>
          <div class="cvb-shape-grid">
            <button class="shape-btn" [class.active]="cvTheme.photoShape==='circle'" (click)="cvTheme.photoShape='circle'">
              <span class="shape-icon shape-circle-ico"></span><span>Rond</span>
            </button>
            <button class="shape-btn" [class.active]="cvTheme.photoShape==='square'" (click)="cvTheme.photoShape='square'">
              <span class="shape-icon shape-square-ico"></span><span>Carré</span>
            </button>
            <button class="shape-btn" [class.active]="cvTheme.photoShape==='rect'" (click)="cvTheme.photoShape='rect'">
              <span class="shape-icon shape-rect-ico"></span><span>Rect.</span>
            </button>
            <button class="shape-btn" [class.active]="cvTheme.photoShape==='hex'" (click)="cvTheme.photoShape='hex'">
              <span class="shape-icon shape-hex-ico"></span><span>Hexa</span>
            </button>
          </div>

          <label class="cvb-label" style="margin-top:14px">CONTOUR</label>
          <div class="cvb-border-grid">
            <button class="border-btn" [class.active]="cvTheme.photoBorder==='none'"   (click)="cvTheme.photoBorder='none'">Aucun</button>
            <button class="border-btn" [class.active]="cvTheme.photoBorder==='single'" (click)="cvTheme.photoBorder='single'">Simple</button>
            <button class="border-btn" [class.active]="cvTheme.photoBorder==='double'" (click)="cvTheme.photoBorder='double'">Double</button>
            <button class="border-btn" [class.active]="cvTheme.photoBorder==='shadow'" (click)="cvTheme.photoBorder='shadow'">Ombre</button>
            <button class="border-btn" [class.active]="cvTheme.photoBorder==='inset'"  (click)="cvTheme.photoBorder='inset'">Inset</button>
          </div>

          <label class="cvb-label" style="margin-top:14px">ZOOM PHOTO — {{cvTheme.photoZoom}}%</label>
          <input type="range" class="cvb-range" min="70" max="150" step="5" [(ngModel)]="cvTheme.photoZoom">
        </div>

        <!-- Experiences -->
        <div class="cvb-section">
          <div class="cvb-section-title">
            EXPÉRIENCES PROFESSIONNELLES
            <button class="cvb-add-btn" (click)="addExp()">+ Ajouter</button>
          </div>
          <div *ngFor="let exp of cvData.experiences; trackBy: trackById; let i = index"
               class="cvb-list-item" [class.drag-over]="dragType==='exp' && dragOverIdx===i"
               draggable="true"
               (dragstart)="onDragStart('exp',i)" (dragover)="onDragOver(i,$event)"
               (drop)="onDrop('exp',i)" (dragend)="onDragEnd()">
            <div class="cvb-list-item-head" (click)="toggleExpand('exp_'+exp.id)">
              <span class="drag-handle" title="Glisser pour réordonner">⠿</span>
              <span>{{exp.poste || 'Nouvelle expérience'}}</span>
              <div style="display:flex;gap:6px">
                <span class="cvb-expand-ico">{{expanded.has('exp_'+exp.id)?'▲':'▼'}}</span>
                <button class="cvb-del-btn" (click)="$event.stopPropagation(); removeExp(exp.id)">✕</button>
              </div>
            </div>
            <div class="cvb-list-item-body" *ngIf="expanded.has('exp_'+exp.id)">
              <label class="cvb-label">Titre du poste</label>
              <input class="cvb-input" [(ngModel)]="exp.poste">
              <label class="cvb-label">Entreprise</label>
              <input class="cvb-input" [(ngModel)]="exp.entreprise">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div>
                  <label class="cvb-label">Début</label>
                  <input class="cvb-input" placeholder="2021" [(ngModel)]="exp.debut">
                </div>
                <div>
                  <label class="cvb-label">Fin</label>
                  <input class="cvb-input" placeholder="Aujourd'hui" [(ngModel)]="exp.fin" [disabled]="exp.actuel">
                </div>
              </div>
              <label class="cvb-opt-row" style="margin-bottom:8px;cursor:pointer">
                <span style="font-size:.75rem;color:#64748b">Poste actuel</span>
                <input type="checkbox" [(ngModel)]="exp.actuel">
              </label>
              <label class="cvb-label">Description (une ligne par •)</label>
              <textarea class="cvb-textarea" rows="4" [value]="exp.description.join('\n')" (input)="onExpDesc(exp, $event)"></textarea>
            </div>
          </div>
        </div>

        <!-- Formation -->
        <div class="cvb-section">
          <div class="cvb-section-title">
            FORMATION
            <button class="cvb-add-btn" (click)="addEdu()">+ Ajouter</button>
          </div>
          <div *ngFor="let edu of cvData.formations; trackBy: trackById; let i = index"
               class="cvb-list-item" [class.drag-over]="dragType==='edu' && dragOverIdx===i"
               draggable="true"
               (dragstart)="onDragStart('edu',i)" (dragover)="onDragOver(i,$event)"
               (drop)="onDrop('edu',i)" (dragend)="onDragEnd()">
            <div class="cvb-list-item-head" (click)="toggleExpand('edu_'+edu.id)">
              <span class="drag-handle" title="Glisser pour réordonner">⠿</span>
              <span>{{edu.diplome || 'Nouvelle formation'}}</span>
              <div style="display:flex;gap:6px">
                <span class="cvb-expand-ico">{{expanded.has('edu_'+edu.id)?'▲':'▼'}}</span>
                <button class="cvb-del-btn" (click)="$event.stopPropagation(); removeEdu(edu.id)">✕</button>
              </div>
            </div>
            <div class="cvb-list-item-body" *ngIf="expanded.has('edu_'+edu.id)">
              <label class="cvb-label">Diplôme / Titre</label>
              <input class="cvb-input" [(ngModel)]="edu.diplome">
              <label class="cvb-label">École / Université</label>
              <input class="cvb-input" [(ngModel)]="edu.ecole">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div>
                  <label class="cvb-label">Début</label>
                  <input class="cvb-input" placeholder="2019" [(ngModel)]="edu.debut">
                </div>
                <div>
                  <label class="cvb-label">Fin</label>
                  <input class="cvb-input" placeholder="2021" [(ngModel)]="edu.fin" [disabled]="edu.actuel">
                </div>
              </div>
              <label class="cvb-opt-row" style="cursor:pointer;margin-bottom:8px">
                <span style="font-size:.75rem;color:#64748b">En cours</span>
                <input type="checkbox" [(ngModel)]="edu.actuel">
              </label>
              <label class="cvb-label">Mention / détail</label>
              <input class="cvb-input" placeholder="Major de promotion…" [(ngModel)]="edu.detail">
            </div>
          </div>
        </div>

        <!-- Compétences -->
        <div class="cvb-section">
          <div class="cvb-section-title">COMPÉTENCES</div>
          <div class="cvb-tags-wrap">
            <span *ngFor="let sk of cvData.competences" class="cvb-tag">
              {{sk.nom}} <button (click)="removeSkill(sk.id)">✕</button>
            </span>
          </div>
          <div class="cvb-add-row">
            <input class="cvb-input" placeholder="Ajouter une compétence" [(ngModel)]="newSkill" (keydown.enter)="addSkill()">
            <button class="cvb-add-inline-btn" (click)="addSkill()">+</button>
          </div>
        </div>

        <!-- Langues -->
        <div class="cvb-section">
          <div class="cvb-section-title">LANGUES</div>
          <div *ngFor="let lang of cvData.langues; trackBy: trackById" class="cvb-lang-row">
            <input class="cvb-input" style="flex:2" placeholder="Langue" [(ngModel)]="lang.nom">
            <input class="cvb-input" style="flex:1" placeholder="Niveau" [(ngModel)]="lang.niveau">
            <button class="cvb-del-btn" (click)="removeLang(lang.id)">✕</button>
          </div>
          <button class="cvb-add-btn" style="margin-top:6px;display:block" (click)="addLang()">+ Ajouter une langue</button>
        </div>

        <!-- Certifications -->
        <div class="cvb-section">
          <div class="cvb-section-title">
            CERTIFICATIONS
            <button class="cvb-add-btn" (click)="addCertif()">+ Ajouter</button>
          </div>
          <div *ngFor="let cert of cvData.certifications; trackBy: trackById; let i = index"
               class="cvb-list-item" [class.drag-over]="dragType==='cert' && dragOverIdx===i"
               draggable="true"
               (dragstart)="onDragStart('cert',i)" (dragover)="onDragOver(i,$event)"
               (drop)="onDrop('cert',i)" (dragend)="onDragEnd()">
            <div class="cvb-list-item-head" (click)="toggleExpand('cert_'+cert.id)">
              <span class="drag-handle" title="Glisser pour réordonner">⠿</span>
              <span>{{cert.nom || 'Nouvelle certification'}}</span>
              <div style="display:flex;gap:6px">
                <span class="cvb-expand-ico">{{expanded.has('cert_'+cert.id)?'▲':'▼'}}</span>
                <button class="cvb-del-btn" (click)="$event.stopPropagation(); removeCertif(cert.id)">✕</button>
              </div>
            </div>
            <div class="cvb-list-item-body" *ngIf="expanded.has('cert_'+cert.id)">
              <label class="cvb-label">Certification</label>
              <input class="cvb-input" [(ngModel)]="cert.nom">
              <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">
                <div>
                  <label class="cvb-label">Organisation</label>
                  <input class="cvb-input" [(ngModel)]="cert.org">
                </div>
                <div>
                  <label class="cvb-label">Année</label>
                  <input class="cvb-input" placeholder="2022" [(ngModel)]="cert.annee">
                </div>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /content -->

      <!-- ── LAYOUT TAB ── -->
      <div class="cvb-ed-body" *ngIf="edTab==='layout'">
        <div class="cvb-section">
          <div class="cvb-section-title">MISE EN PAGE</div>

          <label class="cvb-label">Colonnes</label>
          <div class="cvb-radio-group">
            <label class="cvb-radio" [class.active]="cvLayout.colonnes===1">
              <input type="radio" name="cols" [value]="1" [(ngModel)]="cvLayout.colonnes">
              <span>▌ 1 colonne</span>
            </label>
            <label class="cvb-radio" [class.active]="cvLayout.colonnes===2">
              <input type="radio" name="cols" [value]="2" [(ngModel)]="cvLayout.colonnes">
              <span>▌▌ 2 colonnes</span>
            </label>
          </div>

          <label class="cvb-label" style="margin-top:16px">Espacement</label>
          <div class="cvb-radio-group">
            <label class="cvb-radio" [class.active]="cvLayout.espacement==='compact'" (click)="cvLayout.espacement='compact'">
              <input type="radio" name="esp" value="compact" [(ngModel)]="cvLayout.espacement">Compact
            </label>
            <label class="cvb-radio" [class.active]="cvLayout.espacement==='normal'" (click)="cvLayout.espacement='normal'">
              <input type="radio" name="esp" value="normal" [(ngModel)]="cvLayout.espacement">Normal
            </label>
            <label class="cvb-radio" [class.active]="cvLayout.espacement==='aere'" (click)="cvLayout.espacement='aere'">
              <input type="radio" name="esp" value="aere" [(ngModel)]="cvLayout.espacement">Aéré
            </label>
          </div>
        </div>
      </div>

      <!-- ── THEME TAB ── -->
      <div class="cvb-ed-body" *ngIf="edTab==='theme'">
        <div class="cvb-section">
          <div class="cvb-section-title">THÈME</div>

          <label class="cvb-label">Couleur principale</label>
          <div class="cvb-swatches" style="margin-bottom:12px">
            <button *ngFor="let sw of swatches" class="cvb-swatch"
              [style.background]="sw"
              [class.active]="cvTheme.couleurPrimaire===sw"
              (click)="cvTheme.couleurPrimaire=sw"></button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <input type="color" [(ngModel)]="cvTheme.couleurPrimaire" style="width:36px;height:36px;border:none;border-radius:6px;cursor:pointer;padding:0">
            <input class="cvb-input" style="max-width:120px" [(ngModel)]="cvTheme.couleurPrimaire" placeholder="#000000">
          </div>

          <label class="cvb-label">Police</label>
          <select class="cvb-input" [(ngModel)]="cvTheme.police">
            <option *ngFor="let f of fonts" [value]="f.value">{{f.label}}</option>
          </select>

          <div style="margin-top:20px">
            <button class="cvb-reset-btn" (click)="resetTheme()">↺ Réinitialiser le thème</button>
          </div>
        </div>
      </div>

      <!-- ── AI TOOLBAR ── -->
      <div class="ai-toolbar">
        <span class="ai-tb-label">✦ IA</span>

        <!-- Base de connaissance -->
        <button class="ait" [class.ait--active]="!!knowledgeBase" (click)="openKbModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
          <div class="ait-tip">Base de connaissance{{knowledgeBase ? ' ✓' : ''}}</div>
          <span *ngIf="knowledgeBase" class="ait-dot"></span>
        </button>

        <!-- Chatbot -->
        <button class="ait" (click)="openChatbot()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div class="ait-tip">Assistant IA</div>
        </button>

        <!-- Analyser & remplir -->
        <button class="ait" [class.ait--disabled]="!knowledgeBase" (click)="analyzeAndFill()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <div class="ait-tip">Auto-remplir depuis le document</div>
        </button>

        <div class="ait-sep"></div>

        <!-- Résumer -->
        <button class="ait" (click)="aiSummarize()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="9" y2="18"/></svg>
          <div class="ait-tip">Résumer le profil</div>
        </button>

        <!-- Traduire -->
        <button class="ait" (click)="openTranslate()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <div class="ait-tip">Traduire</div>
        </button>

        <!-- Grammaire -->
        <button class="ait" (click)="aiGrammar()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <div class="ait-tip">Corriger la grammaire</div>
        </button>

        <div class="ait-sep"></div>

        <!-- Paramètres -->
        <button class="ait ait--config" (click)="openAddProvider()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <div class="ait-tip">Configurer l'IA</div>
        </button>
      </div>

    </ng-container>
    <ng-template #noTpl>
      <div class="cvb-no-tpl">
        <div style="font-size:3rem">👈</div>
        <p>Sélectionnez un modèle dans la grille pour l'éditer.</p>
      </div>
    </ng-template>
  </aside>

</div>

<!-- ░░ TOAST ░░ -->
<div class="cvb-toast" [class.cvb-toast--show]="toastVisible">{{toastMsg}}</div>

<!-- ░░ PREVIEW MODAL ░░ -->
<div class="cvb-preview-overlay" *ngIf="previewOpen">
  <div class="cvb-preview-modal"
       [class.cvb-preview-modal--edit]="previewEditable || officeEditorOpen">

    <!-- ── Aperçu normal ── -->
    <ng-container *ngIf="!previewEditable && !officeEditorOpen">
      <div class="cvb-preview-head">
        <span class="cvb-preview-title">{{previewTpl?.nom}}</span>
        <div class="prev-toolbar">
          <button class="prev-ctrl" (click)="previewZoom=previewZoom>40?previewZoom-10:previewZoom" title="Dézoomer">−</button>
          <span class="prev-zoom-lbl">{{previewZoom}}%</span>
          <button class="prev-ctrl" (click)="previewZoom=previewZoom<130?previewZoom+10:previewZoom" title="Zoomer">+</button>
          <button class="prev-ctrl prev-ctrl-a4" (click)="previewZoom=75" title="A4">A4</button>
          <button class="prev-ctrl prev-edit-open-btn" (click)="togglePreviewEdit()" title="Éditeur graphique avancé">✏ Éditer</button>
          <button class="prev-ctrl prev-office-btn" (click)="openInOffice()" title="Éditer dans OnlyOffice (Word complet)">📝 Office</button>
          <button class="cvb-dl-btn" style="padding:.35rem .9rem;font-size:.72rem;margin:0;white-space:nowrap" (click)="downloadPdf()">⬇ PDF</button>
          <button class="cvb-preview-close" (click)="closePreview()">✕</button>
        </div>
      </div>
      <div class="cvb-preview-body">
        <div class="cvb-prev-zoom-wrap" [style.transform]="'scale('+previewZoom/100+')'" style="transform-origin:top center">
          <div class="cvb-preview-page" [innerHTML]="getPreviewHtml()"></div>
        </div>
      </div>
    </ng-container>

    <!-- ── Éditeur graphique avancé (plein écran) ── -->
    <app-design-editor
      *ngIf="previewEditable"
      [baseHtml]="getPreviewBase()"
      [width]="794"
      [height]="1123"
      (savedEvent)="onDesignSave($event)"
      (cancelEvent)="closePreview()"
      style="flex:1;display:flex;flex-direction:column;min-height:0">
    </app-design-editor>

    <!-- ── Éditeur OnlyOffice (plein écran) ── -->
    <app-office-editor
      *ngIf="officeEditorOpen && officeConfig"
      [config]="officeConfig!"
      (cancel)="officeEditorOpen=false; officeConfig=null"
      (saved)="onOfficeSaved($event)"
      style="flex:1;display:flex;flex-direction:column;min-height:0">
    </app-office-editor>

  </div>
</div>

<!-- ░░ AI CONFIG MODAL ░░ -->
<div class="ai-overlay" *ngIf="showAiConfigModal" (click)="closeAiConfig()">
  <div class="ai-modal" (click)="$event.stopPropagation()">
    <div class="ai-modal-head">
      <span>Configuration de l'IA</span>
      <button class="ai-modal-close" (click)="closeAiConfig()">✕</button>
    </div>
    <div class="ai-modal-body">
      <div *ngFor="let fn of aiFunctions" class="ai-cfg-row">
        <span class="ai-cfg-label">
          <span class="ai-cfg-ico">{{fn==='chatbot'?'💬':fn==='summary'?'📝':fn==='translate'?'🌐':fn==='analyze'?'🔍':fn==='image'?'🖼':fn==='grammar'?'✅':'🤖'}}</span>
          {{fnLabel(fn)}}
        </span>
        <select class="ai-cfg-select" [(ngModel)]="aiConfig[fn]" (change)="saveAiConfig()">
          <option value="">— Choisir —</option>
          <option *ngFor="let p of aiProviders" [value]="p.id">{{p.name}} [{{p.model.slice(0,14)}}]</option>
        </select>
      </div>
      <div *ngIf="aiProviders.length===0" class="ai-empty-hint">
        Aucun modèle configuré. Cliquez sur « Modifier les modèles » ci-dessous.
      </div>
    </div>
    <div class="ai-modal-foot">
      <button class="ai-link-btn" (click)="showAiConfigModal=false; openAddProvider()">Modifier les modèles d'IA</button>
      <button class="ai-modal-ok" (click)="closeAiConfig()">OK</button>
    </div>
  </div>
</div>

<!-- ░░ CHATBOT MODAL ░░ -->
<div class="ai-overlay" *ngIf="showChatbotModal" (click)="closeChatbot()">
  <div class="ai-modal ai-modal--chatbot" (click)="$event.stopPropagation()">

    <!-- Head -->
    <div class="ai-modal-head">
      <div style="display:flex;align-items:center;gap:8px">
        <span>🤖 Assistant IA</span>
        <span *ngIf="knowledgeBase" class="ai-kb-badge">📎 Doc chargé</span>
      </div>
      <div style="display:flex;gap:6px">
        <button class="ai-modal-close" title="Effacer la conversation" (click)="chatMessages=[]">🗑</button>
        <button class="ai-modal-close" (click)="closeChatbot()">✕</button>
      </div>
    </div>

    <!-- Section cible -->
    <div class="ai-section-bar">
      <span class="ai-section-lbl">Cible :</span>
      <div class="ai-section-btns">
        <button *ngFor="let s of chatSections" class="ai-sec-btn"
          [class.active]="chatApplySection===s.key" (click)="chatApplySection=s.key">{{s.label}}</button>
      </div>
    </div>

    <!-- Messages -->
    <div class="ai-chat-body" #chatBody>
      <div *ngFor="let m of chatMessages; let i=index" class="ai-chat-msg" [class.ai-chat-msg--user]="m.role==='user'">
        <div class="ai-chat-bubble" [class.ai-chat-bubble--user]="m.role==='user'">
          <div class="ai-chat-text" style="white-space:pre-wrap">{{m.content}}</div>
          <div *ngIf="m.role==='assistant'" class="ai-apply-row">
            <button class="ai-apply-btn" (click)="applyToSection(m.content, chatApplySection)">
              ↳ Appliquer à «&nbsp;{{getSectionLabel(chatApplySection)}}&nbsp;»
            </button>
            <button class="ai-apply-btn ai-apply-btn--copy" (click)="copyToClipboard(m.content)" title="Copier">📋</button>
          </div>
        </div>
      </div>
      <div *ngIf="aiLoading" class="ai-chat-msg">
        <div class="ai-chat-bubble"><span class="ai-typing">●●●</span></div>
      </div>
    </div>

    <!-- Quick prompts -->
    <div class="ai-quick-prompts" *ngIf="chatMessages.length<=1">
      <button *ngFor="let p of aiQuickPrompts" class="ai-qp-btn" (click)="useQuickPrompt(p)">{{p}}</button>
    </div>

    <!-- Input -->
    <div class="ai-chat-input-row">
      <button class="ai-mic-btn" [class.ai-mic-btn--rec]="isRecording"
        (click)="toggleVoice()" title="Saisie vocale">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
      <input class="ai-chat-input" placeholder="Demandez à l'IA…" [(ngModel)]="chatInput"
        (keydown.enter)="sendChat()" [disabled]="aiLoading">
      <button class="ai-send-btn" (click)="sendChat()" [disabled]="aiLoading || !chatInput.trim()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>
</div>

<!-- ░░ KNOWLEDGE BASE MODAL ░░ -->
<div class="ai-overlay" *ngIf="showKbModal" (click)="closeKbModal()">
  <div class="ai-modal ai-modal--kb" (click)="$event.stopPropagation()">
    <div class="ai-modal-head">
      <span>📎 Base de connaissance</span>
      <button class="ai-modal-close" (click)="closeKbModal()">✕</button>
    </div>
    <div class="ai-modal-body">
      <p class="ai-kb-desc">Téléversez un document décrivant votre parcours. L'IA l'utilisera pour rédiger votre CV et pourra auto-remplir tous les champs.</p>

      <!-- Drop zone -->
      <label class="ai-kb-drop" [class.ai-kb-drop--active]="!!knowledgeBase"
        (dragover)="$event.preventDefault()" (drop)="onKbDrop($event)">
        <input type="file" style="display:none" #kbInput
          accept=".txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.bmp,.tiff"
          (change)="onKbFile($event)">
        <div *ngIf="!kbFileName && !kbExtracting" class="ai-kb-drop-inner" (click)="kbInput.click()">
          <div class="ai-kb-drop-ico">📂</div>
          <div class="ai-kb-drop-lbl">Cliquer ou glisser un fichier ici</div>
          <div class="ai-kb-drop-sub">PDF · DOCX · TXT · Image (JPG/PNG) · Manuscrit scanné</div>
        </div>
        <div *ngIf="kbExtracting" class="ai-kb-drop-inner">
          <div class="ai-typing" style="font-size:1.5rem">●●●</div>
          <div class="ai-kb-drop-lbl">Extraction en cours…</div>
        </div>
        <div *ngIf="kbFileName && !kbExtracting" class="ai-kb-loaded">
          <div class="ai-kb-file-row">
            <span class="ai-kb-file-ico">📄</span>
            <span class="ai-kb-file-name">{{kbFileName}}</span>
            <button class="ai-kb-del" (click)="$event.stopPropagation();clearKb()">✕</button>
          </div>
          <div class="ai-kb-preview">{{knowledgeBase.slice(0,400)}}{{knowledgeBase.length>400?'…':''}}</div>
          <button class="ai-kb-reload" (click)="$event.stopPropagation();kbInput.click()">🔄 Changer de fichier</button>
        </div>
      </label>

      <div *ngIf="kbError" class="ai-kb-error">❌ {{kbError}}</div>

      <!-- Image preview -->
      <div *ngIf="kbImageData" class="ai-kb-img-wrap">
        <img [src]="kbImageData" class="ai-kb-img" alt="Document chargé">
      </div>

      <div *ngIf="knowledgeBase" class="ai-kb-info">
        ✅ {{knowledgeBase.length | number}} caractères extraits — l'IA utilisera ce contexte pour toutes les générations.
      </div>
    </div>
    <div class="ai-modal-foot">
      <button *ngIf="knowledgeBase" class="ai-modal-cancel" (click)="clearKb();closeKbModal()">Supprimer</button>
      <button *ngIf="knowledgeBase && !kbExtracting" class="ai-modal-ok" (click)="analyzeAndFill()">
        ✨ Analyser et remplir mon CV
      </button>
      <button *ngIf="!knowledgeBase" class="ai-modal-ok" (click)="closeKbModal()">Fermer</button>
    </div>
  </div>
</div>

<!-- ░░ TRANSLATE MODAL ░░ -->
<div class="ai-overlay" *ngIf="showTranslateModal" (click)="closeTranslate()">
  <div class="ai-modal ai-modal--sm" (click)="$event.stopPropagation()">
    <div class="ai-modal-head">
      <span>Paramètres de traduction</span>
      <button class="ai-modal-close" (click)="closeTranslate()">✕</button>
    </div>
    <div class="ai-modal-body">
      <p style="font-size:.8rem;color:#94a3b8;margin:0 0 12px">Choisir la langue cible pour la traduction IA.</p>
      <div class="ai-lang-list">
        <div *ngFor="let l of aiTranslateLangs" class="ai-lang-item"
          [class.ai-lang-item--sel]="aiTranslateLang===l.code" (click)="aiTranslateLang=l.code">
          <span class="ai-lang-native">{{l.native}}</span>
          <span class="ai-lang-en">{{l.label}}</span>
        </div>
      </div>
    </div>
    <div class="ai-modal-foot">
      <button class="ai-modal-cancel" (click)="closeTranslate()">Annuler</button>
      <button class="ai-modal-ok" (click)="doTranslate()">OK</button>
    </div>
  </div>
</div>

<!-- ░░ ADD PROVIDER MODAL ░░ -->
<div class="ai-overlay" *ngIf="showAddProviderModal" (click)="showAddProviderModal=false">
  <div class="ai-modal ai-modal--provider" (click)="$event.stopPropagation()">
    <div class="ai-modal-head">
      <span>{{editingProvider ? 'Modifier' : 'Ajouter'}} un modèle d'IA</span>
      <button class="ai-modal-close" (click)="showAddProviderModal=false">✕</button>
    </div>
    <div class="ai-modal-body">
      <!-- Existing providers -->
      <div *ngIf="aiProviders.length" style="margin-bottom:14px">
        <p style="font-size:.75rem;font-weight:700;color:#94a3b8;margin:0 0 6px;text-transform:uppercase;letter-spacing:.8px">Modèles configurés</p>
        <div *ngFor="let p of aiProviders" class="ai-prov-row">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:.82rem;color:#f1f5f9">{{p.name}}</div>
            <div style="font-size:.72rem;color:#64748b">{{p.model}}</div>
          </div>
          <button class="ai-prov-edit" (click)="openAddProvider(p)">✏</button>
          <button class="ai-prov-del" (click)="deleteProvider(p.id)">🗑</button>
        </div>
        <hr style="border:none;border-top:1px solid #2d3548;margin:14px 0">
      </div>
      <!-- Form -->
      <label class="ai-form-label">Nom <span style="color:#ef4444">*</span></label>
      <select class="ai-form-select" [(ngModel)]="newProvider.name" (change)="onProviderNameChange()">
        <option *ngFor="let n of aiProviderNames" [value]="n">{{n}}</option>
      </select>

      <label class="ai-form-label" style="margin-top:10px">URL <span style="color:#ef4444">*</span></label>
      <input class="ai-form-input" placeholder="https://api.openai.com/v1" [(ngModel)]="newProvider.url">

      <label class="ai-form-label" style="margin-top:10px">Clé API</label>
      <input class="ai-form-input" type="password" placeholder="sk-…" [(ngModel)]="newProvider.key">

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
        <label class="ai-form-label" style="margin:0">Modèle <span style="color:#ef4444">*</span></label>
        <button class="ai-link-btn" (click)="fetchModels()" [disabled]="newProviderModelsLoading">
          {{newProviderModelsLoading ? '⏳ Chargement…' : 'Actualiser la liste des modèles'}}
        </button>
      </div>
      <select *ngIf="newProviderModels.length" class="ai-form-select" [(ngModel)]="newProvider.model">
        <option value="">— Sélectionner —</option>
        <option *ngFor="let m of newProviderModels" [value]="m">{{m}}</option>
      </select>
      <input *ngIf="!newProviderModels.length" class="ai-form-input" placeholder="ex. gpt-4o, deepseek-chat…" [(ngModel)]="newProvider.model">

      <label class="ai-form-label" style="margin-top:14px">Utiliser le modèle pour</label>
      <div class="ai-use-grid">
        <button *ngFor="let cat of aiUseCategories" class="ai-use-btn"
          [class.ai-use-btn--on]="(newProvider.usedFor??[]).includes(cat)"
          (click)="toggleProviderUse(cat)">{{aiUseLabels[cat]}}</button>
      </div>
    </div>
    <div class="ai-modal-foot">
      <button *ngIf="editingProvider" class="ai-modal-cancel" (click)="deleteProvider(editingProvider!.id); showAddProviderModal=false">Supprimer</button>
      <button class="ai-modal-ok" (click)="saveProvider()">OK</button>
    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Root layout ── */
    .cvb-root {
      display: grid;
      grid-template-columns: 220px 1fr 320px;
      height: calc(100vh - 64px);
      overflow: hidden;
      background: #f8fafc;
      font-family: 'Inter', 'Segoe UI', sans-serif;
    }

    /* ── SIDEBAR ── */
    .cvb-sidebar {
      background: #1a1f2e;
      color: #c9d1e0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0 0 24px;
      display: flex;
      flex-direction: column;
      scrollbar-width: thin;
      scrollbar-color: #334155 transparent;
      transition: width .2s ease;
      position: relative;
    }
    .cvb-sidebar::-webkit-scrollbar { width: 4px; }
    .cvb-sidebar::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }

    .cvb-sidebar-toggle {
      position: sticky; top: 0; z-index: 10;
      display: flex; align-items: center; justify-content: flex-end;
      width: 100%; padding: 8px 6px 6px;
      background: #1a1f2e; border: none; cursor: pointer;
      border-bottom: 1px solid #2d3548;
      flex-shrink: 0;
    }
    .cvb-toggle-icon {
      display: flex; align-items: center; justify-content: center;
      width: 26px; height: 26px;
      background: #243044; border: 1px solid #334155;
      border-radius: 6px; color: #94a3b8;
      font-size: 1rem; font-weight: 700; line-height: 1;
      transition: .15s;
    }
    .cvb-sidebar-toggle:hover .cvb-toggle-icon {
      background: #2d3f5c; color: #60a5fa; border-color: #4f6c9f;
    }

    .cvb-sidebar-content { display: flex; flex-direction: column; flex: 1; }

    .cvb-sidebar--collapsed .cvb-sidebar-content { display: none; }
    .cvb-sidebar--collapsed .cvb-sidebar-toggle { justify-content: center; border-bottom: none; }
    .cvb-sidebar--collapsed { overflow: hidden; }

    .cvb-logo {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 14px 12px;
      border-bottom: 1px solid #2d3548;
    }
    .cvb-logo-icon { font-size: 1.4rem; }
    .cvb-logo-title { font-size: .85rem; font-weight: 800; color: #f1f5f9; }
    .cvb-logo-sub { font-size: .65rem; color: #64748b; }

    .cvb-nav { padding: 8px 8px 4px; }
    .cvb-nav-btn {
      display: flex; align-items: center; gap: 8px;
      width: 100%; background: transparent; border: none;
      color: #94a3b8; font-size: .78rem; padding: 7px 8px;
      border-radius: 7px; cursor: pointer; text-align: left;
      transition: all .15s;
    }
    .cvb-nav-btn:hover { background: #243044; color: #f1f5f9; }
    .cvb-nav-btn.active { background: #2d3f5c; color: #60a5fa; font-weight: 700; }

    .cvb-badge {
      margin-left: auto; background: #334155; color: #94a3b8;
      font-size: .62rem; font-weight: 700; padding: 1px 6px;
      border-radius: 10px; min-width: 20px; text-align: center;
    }
    .cvb-nav-btn.active .cvb-badge { background: #1e40af; color: #bfdbfe; }

    .cvb-sec-label {
      font-size: .6rem; font-weight: 800; letter-spacing: 1.5px;
      color: #475569; text-transform: uppercase; padding: 14px 14px 4px;
    }

    .cvb-cats { padding: 0 8px; }
    .cvb-cat-btn {
      display: flex; justify-content: space-between; align-items: center;
      width: 100%; background: transparent; border: none;
      color: #94a3b8; font-size: .76rem; padding: 5px 8px;
      border-radius: 6px; cursor: pointer; text-align: left;
      transition: all .12s;
    }
    .cvb-cat-btn:hover { background: #243044; color: #f1f5f9; }
    .cvb-cat-btn.active { background: #1e3a5f; color: #93c5fd; font-weight: 700; }
    .cvb-cat-count { font-size: .62rem; color: #475569; }

    .cvb-swatches { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 14px 2px; }
    .cvb-swatch {
      width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent;
      cursor: pointer; transition: all .12s;
    }
    .cvb-swatch:hover, .cvb-swatch.active { border-color: #fff; transform: scale(1.15); }
    .cvb-swatch-more {
      font-size: .6rem; color: #64748b; background: #2d3548;
      border: none; border-radius: 10px; padding: 2px 8px;
      cursor: pointer; white-space: nowrap; margin-top: 2px;
    }
    .cvb-swatch-more:hover { color: #f1f5f9; }

    .cvb-opts { padding: 4px 14px; }
    .cvb-opt-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: .76rem; color: #94a3b8; padding: 5px 0;
      border-bottom: 1px solid #2d3548;
    }
    .badge-new {
      background: #dc2626; color: #fff; font-size: .55rem;
      font-weight: 800; padding: 1px 5px; border-radius: 3px;
      vertical-align: middle; margin-left: 4px;
    }

    /* ── MAIN ── */
    .cvb-main {
      overflow-y: auto; display: flex; flex-direction: column;
      background: #f1f5f9;
    }
    .cvb-main::-webkit-scrollbar { width: 6px; }
    .cvb-main::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

    .cvb-main-head {
      background: #fff; padding: 16px 20px 12px;
      border-bottom: 1px solid #e2e8f0;
      position: sticky; top: 0; z-index: 10;
    }
    .cvb-main-title { font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 10px; }
    .cvb-main-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

    .cvb-search-wrap { position: relative; flex: 1; min-width: 180px; }
    .cvb-search-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: .8rem; pointer-events: none; }
    .cvb-search {
      width: 100%; padding: 7px 10px 7px 32px; border: 1px solid #e2e8f0;
      border-radius: 8px; font-size: .78rem; outline: none; background: #f8fafc;
      color: #0f172a;
    }
    .cvb-search:focus { border-color: #6366f1; }

    .cvb-sort-wrap { display: flex; align-items: center; gap: 6px; }
    .cvb-sort {
      border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px;
      font-size: .78rem; background: #f8fafc; cursor: pointer; outline: none;
      color: #0f172a;
    }

    /* ── GRID ── */
    .cvb-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(195px, 1fr));
      gap: 14px; padding: 16px;
    }

    /* ── TEMPLATE CARD ── */
    .tpl-card {
      background: #fff; border-radius: 10px;
      border: 2px solid #e2e8f0; overflow: hidden;
      cursor: pointer; transition: all .2s;
    }
    .tpl-card:hover { border-color: #6366f1; box-shadow: 0 4px 20px rgba(99,102,241,.15); transform: translateY(-2px); }
    .tpl-card--selected { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.25); }

    .tpl-thumb {
      width: 100%; height: 263px; overflow: hidden; position: relative;
      background: #f8fafc; cursor: pointer;
    }
    .tpl-thumb-inner {
      width: 794px; height: 1123px;
      transform: scale(0.2442);
      transform-origin: top left;
      pointer-events: none; user-select: none;
    }
    .tpl-new-badge {
      position: absolute; top: 8px; left: 8px;
      background: #dc2626; color: #fff; font-size: .55rem;
      font-weight: 800; padding: 2px 7px; border-radius: 3px; letter-spacing: .5px;
    }
    .tpl-ats-badge {
      position: absolute; bottom: 8px; right: 8px;
      color: #fff; font-size: .58rem; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }

    .tpl-foot {
      padding: 7px 10px; display: flex; align-items: center;
      justify-content: space-between; background: #fff;
      border-top: 1px solid #f1f5f9;
    }
    .tpl-name { font-size: .75rem; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tpl-actions { display: flex; gap: 3px; flex-shrink: 0; }
    .tpl-btn {
      background: #f1f5f9; border: none; border-radius: 5px;
      width: 26px; height: 26px; cursor: pointer; font-size: .75rem;
      display: flex; align-items: center; justify-content: center;
      transition: all .12s;
    }
    .tpl-btn:hover { background: #e0e7ff; }
    .tpl-btn--edit { background: #6366f1; color: #fff; }
    .tpl-btn--edit:hover { background: #4f46e5; }
    .tpl-btn--fav { background: #fef9c3; color: #ca8a04; }

    .cvb-empty {
      grid-column: 1/-1; text-align: center; padding: 48px;
      color: #64748b; font-size: .9rem;
    }
    .cvb-empty button {
      margin-top: 12px; background: #6366f1; color: #fff; border: none;
      padding: .5rem 1.25rem; border-radius: 8px; cursor: pointer; font-size: .8rem;
    }

    /* ── EDITOR ── */
    .cvb-editor {
      background: #fff; border-left: 1px solid #e2e8f0;
      overflow-y: auto; display: flex; flex-direction: column;
      transform: translateX(100%); transition: transform .25s ease;
    }
    .cvb-editor::-webkit-scrollbar { width: 5px; }
    .cvb-editor::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
    .cvb-editor--open { transform: translateX(0); }

    .cvb-ed-head {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 16px 10px; border-bottom: 1px solid #f1f5f9;
      position: sticky; top: 0; background: #fff; z-index: 5;
    }
    .cvb-ed-tpl-name { font-size: .82rem; font-weight: 800; color: #0f172a; }
    .cvb-ed-head-actions { display: flex; gap: 6px; }
    .cvb-ed-ico-btn {
      background: #f1f5f9; border: none; border-radius: 6px;
      width: 28px; height: 28px; cursor: pointer; font-size: .75rem;
      display: flex; align-items: center; justify-content: center;
      transition: background .12s;
    }
    .cvb-ed-ico-btn:hover { background: #e0e7ff; }

    .cvb-dl-btn {
      margin: 10px 16px; background: #6366f1; color: #fff; border: none;
      border-radius: 9px; padding: .55rem 1rem; font-size: .78rem;
      font-weight: 700; cursor: pointer; width: calc(100% - 32px);
      transition: background .15s;
    }
    .cvb-dl-btn:hover { background: #4f46e5; }

    .cvb-tabs {
      display: flex; border-bottom: 1.5px solid #e2e8f0;
      padding: 0 16px;
    }
    .cvb-tab {
      background: transparent; border: none; border-bottom: 2.5px solid transparent;
      padding: 8px 10px; font-size: .7rem; font-weight: 700; cursor: pointer;
      color: #94a3b8; letter-spacing: .5px; margin-bottom: -1.5px;
      transition: all .15s;
    }
    .cvb-tab.active { border-bottom-color: #6366f1; color: #6366f1; }

    .cvb-ed-body { overflow-y: auto; flex: 1; }
    .cvb-section { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; }
    .cvb-section-title {
      font-size: .65rem; font-weight: 900; text-transform: uppercase;
      letter-spacing: 1.2px; color: #64748b; margin-bottom: 12px;
      display: flex; justify-content: space-between; align-items: center;
    }

    .photo-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .photo-preview {
      width: 64px; height: 64px; border-radius: 50%; background: #f1f5f9;
      border: 2px solid #e2e8f0; overflow: hidden; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: border-color .12s;
    }
    .photo-preview:hover { border-color: #6366f1; }
    .photo-preview img { width: 100%; height: 100%; object-fit: cover; }
    .photo-placeholder { font-size: 1.5rem; }
    .photo-btns { display: flex; flex-direction: column; gap: 5px; }
    .photo-btn {
      background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 4px 10px; font-size: .7rem; cursor: pointer; white-space: nowrap;
      transition: all .12s;
    }
    .photo-btn:hover { border-color: #6366f1; color: #6366f1; }
    .photo-btn--del { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }
    .photo-btn--del:hover { background: #fee2e2; }

    .cvb-label { display: block; font-size: .7rem; font-weight: 600; color: #64748b; margin-bottom: 4px; margin-top: 8px; }
    .cvb-input {
      width: 100%; padding: 7px 10px; border: 1px solid #e2e8f0;
      border-radius: 7px; font-size: .78rem; outline: none; color: #0f172a;
      background: #f8fafc; box-sizing: border-box; transition: border-color .12s;
    }
    .cvb-input:focus { border-color: #6366f1; background: #fff; }
    .cvb-input:disabled { opacity: .5; cursor: not-allowed; }
    .cvb-textarea {
      width: 100%; padding: 7px 10px; border: 1px solid #e2e8f0;
      border-radius: 7px; font-size: .78rem; outline: none; color: #0f172a;
      background: #f8fafc; box-sizing: border-box; resize: vertical;
      transition: border-color .12s; line-height: 1.5;
    }
    .cvb-textarea:focus { border-color: #6366f1; background: #fff; }
    .cvb-char-count { font-size: .65rem; color: #94a3b8; text-align: right; margin-top: 2px; }

    .cvb-list-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; overflow: hidden; transition: border-color .15s, background .15s; }
    .cvb-list-item.drag-over { border: 2px dashed #6366f1; background: #ede9fe; }
    .drag-handle { color: #cbd5e1; cursor: grab; padding: 0 6px 0 0; font-size: 1rem; flex-shrink: 0; user-select: none; }
    .drag-handle:active { cursor: grabbing; }
    .cvb-list-item-head {
      display: flex; justify-content: space-between; align-items: center;
      padding: 9px 12px; cursor: pointer; font-size: .78rem; font-weight: 600;
      color: #1e293b;
    }
    .cvb-list-item-head:hover { background: #f0f4ff; }
    .cvb-list-item-body { padding: 0 12px 12px; border-top: 1px solid #e2e8f0; }
    .cvb-expand-ico { color: #94a3b8; font-size: .6rem; }
    .cvb-del-btn {
      background: #fee2e2; color: #dc2626; border: none; border-radius: 4px;
      width: 20px; height: 20px; cursor: pointer; font-size: .65rem;
      display: flex; align-items: center; justify-content: center;
    }
    .cvb-del-btn:hover { background: #fca5a5; }

    .cvb-add-btn {
      background: transparent; border: none; color: #6366f1; font-size: .72rem;
      font-weight: 700; cursor: pointer; padding: 2px 0;
    }
    .cvb-add-btn:hover { color: #4f46e5; }

    .cvb-tags-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .cvb-tag {
      display: flex; align-items: center; gap: 5px;
      background: #ede9fe; color: #6d28d9; font-size: .72rem; font-weight: 600;
      padding: 3px 9px; border-radius: 6px;
    }
    .cvb-tag button { background: none; border: none; cursor: pointer; color: #7c3aed; font-size: .7rem; padding: 0; line-height: 1; }
    .cvb-add-row { display: flex; gap: 6px; }
    .cvb-add-inline-btn {
      background: #6366f1; color: #fff; border: none; border-radius: 7px;
      width: 34px; cursor: pointer; font-size: 1rem; flex-shrink: 0;
    }
    .cvb-add-inline-btn:hover { background: #4f46e5; }

    .cvb-lang-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }

    .cvb-radio-group { display: flex; gap: 8px; flex-wrap: wrap; }
    .cvb-radio {
      display: flex; align-items: center; gap: 6px;
      border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 7px 12px;
      cursor: pointer; font-size: .78rem; color: #475569; flex: 1;
      transition: all .12s;
    }
    .cvb-radio input { display: none; }
    .cvb-radio.active { border-color: #6366f1; background: #ede9fe; color: #4f46e5; font-weight: 600; }

    .cvb-reset-btn {
      background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 7px 14px; font-size: .76rem; cursor: pointer; color: #475569;
    }
    .cvb-reset-btn:hover { border-color: #6366f1; color: #6366f1; }

    .cvb-no-tpl {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center; padding: 32px 24px;
      color: #64748b; gap: 10px;
    }
    .cvb-no-tpl p { font-size: .82rem; line-height: 1.6; }

    /* ── PREVIEW MODAL ── */
    .cvb-preview-overlay {
      position: fixed; inset: 0; background: rgba(15,23,42,.7);
      backdrop-filter: blur(4px); display: flex; align-items: center;
      justify-content: center; z-index: 9999; padding: 20px;
    }
    .cvb-preview-modal {
      background: #1e293b; border-radius: 14px; overflow: hidden;
      display: flex; flex-direction: column;
      width: 90vw; max-width: 900px; height: 92vh;
      box-shadow: 0 24px 60px rgba(0,0,0,.5);
    }
    .cvb-preview-modal--edit {
      width: 100vw !important; max-width: 100vw !important;
      height: 100vh !important; border-radius: 0 !important;
      margin: 0;
    }
    .prev-edit-open-btn { width: auto !important; padding: 0 10px !important; font-size: .72rem !important; font-weight: 700; }
    .prev-office-btn {
      width: auto !important; padding: 0 10px !important; font-size: .72rem !important; font-weight: 700;
      background: linear-gradient(135deg, #16a34a, #15803d) !important;
      color: white !important; border-color: #15803d !important;
    }
    .prev-office-btn:hover { filter: brightness(1.1); }
    .cvb-preview-head {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 18px; background: #0f172a;
    }
    .cvb-preview-title { font-size: .85rem; font-weight: 700; color: #f1f5f9; }
    .cvb-preview-close {
      background: rgba(255,255,255,.1); border: none; color: #f1f5f9;
      width: 30px; height: 30px; border-radius: 6px; cursor: pointer; font-size: .85rem;
    }
    .cvb-preview-close:hover { background: #dc2626; }
    .cvb-preview-body {
      flex: 1; overflow: auto; display: flex; align-items: flex-start;
      justify-content: center; padding: 24px; background: #374151;
    }
    .cvb-preview-page {
      width: 794px;
      min-height: 1123px;
      background: #fff;
      box-shadow: 0 4px 40px rgba(0,0,0,.5);
    }

    /* ── Photo shape selector ── */
    .cvb-shape-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; }
    .shape-btn {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 8px 4px;
      background: #f8fafc; cursor: pointer; font-size: .7rem; color: #64748b;
      transition: all .15s;
    }
    .shape-btn:hover { border-color: #6366f1; color: #6366f1; }
    .shape-btn.active { border-color: #6366f1; background: #ede9fe; color: #4f46e5; font-weight: 600; }
    .shape-icon { width: 24px; height: 24px; background: #6366f1; display: block; }
    .shape-circle-ico { border-radius: 50%; }
    .shape-square-ico { border-radius: 3px; }
    .shape-rect-ico   { width: 18px; height: 26px; border-radius: 3px; }
    .shape-hex-ico    { clip-path: polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%); border-radius: 0; }

    /* ── Photo border selector ── */
    .cvb-border-grid { display: flex; flex-wrap: wrap; gap: 5px; }
    .border-btn {
      padding: 5px 10px; border: 1.5px solid #e2e8f0; border-radius: 7px;
      background: #f8fafc; cursor: pointer; font-size: .7rem; color: #64748b;
      transition: all .15s;
    }
    .border-btn:hover { border-color: #6366f1; color: #6366f1; }
    .border-btn.active { border-color: #6366f1; background: #ede9fe; color: #4f46e5; font-weight: 600; }

    /* ── Range slider ── */
    .cvb-range { width: 100%; accent-color: #6366f1; margin-top: 4px; }

    /* ── Preview toolbar ── */
    .prev-toolbar { display: flex; align-items: center; gap: 5px; }
    .prev-ctrl {
      width: 28px; height: 28px; border: none; background: rgba(255,255,255,.1);
      color: #f1f5f9; border-radius: 6px; cursor: pointer; font-size: .85rem;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
    }
    .prev-ctrl:hover { background: rgba(255,255,255,.2); }
    .prev-ctrl-a4 { width: auto; padding: 0 8px; font-size: .72rem; font-weight: 700; }
    .prev-ctrl-on { background: #6366f1 !important; }
    .prev-zoom-lbl { font-size: .75rem; color: #94a3b8; min-width: 34px; text-align: center; }
    .prev-save-btn {
      padding: 4px 14px; background: #6366f1; color: #fff; border: none;
      border-radius: 6px; font-size: .72rem; font-weight: 700; cursor: pointer; white-space: nowrap;
      transition: background .15s;
    }
    .prev-save-btn:hover { background: #4f46e5; }

    .cvb-prev-zoom-wrap { transform-origin: top center; }

    .prev-edit-hint {
      background: #312e81; color: #e0e7ff; font-size: .76rem; padding: 8px 16px;
      text-align: center; flex-shrink: 0;
    }

    /* ── Card overlay ── */
    .tpl-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0);
      display: flex; align-items: center; justify-content: center; gap: 10px;
      transition: all .25s; opacity: 0;
    }
    .tpl-card:hover .tpl-overlay { opacity: 1; background: rgba(0,0,0,0.48); }
    .tpl-action-btn {
      width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 16px;
      color: #fff; transition: transform .2s; background: rgba(255,255,255,0.18);
      backdrop-filter: blur(4px);
    }
    .tpl-action-btn:hover { transform: scale(1.18); }
    .tpl-btn-edit { background: #6366f1 !important; }
    .tpl-btn-fav-on { background: rgba(239,68,68,0.7) !important; }

    /* ── Mes Créations nav button ── */
    .cvb-nav-btn--creations { border-top: 1px solid #2d3548; margin-top: 4px; padding-top: 10px; }
    .cvb-nav-btn--creations.active { background: #3b1f6e; color: #c084fc; }
    .cvb-nav-btn--creations.active .cvb-badge { background: #6d28d9; color: #e9d5ff; }

    /* ── Mes Créations panel ── */
    .mc-panel { padding: 4px 0 24px; }
    .mc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      padding: 16px;
    }
    .mc-card {
      background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px;
      overflow: hidden; transition: box-shadow .2s, transform .2s;
    }
    .mc-card:hover { box-shadow: 0 6px 24px rgba(99,102,241,.18); transform: translateY(-2px); }
    .mc-thumb {
      position: relative; height: 160px; overflow: hidden; background: #f8fafc;
    }
    .mc-thumb-inner {
      width: 794px; transform-origin: top left;
      transform: scale(0.252); pointer-events: none;
    }
    .mc-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0);
      display: flex; align-items: center; justify-content: center; gap: 10px;
      opacity: 0; transition: all .25s;
    }
    .mc-card:hover .mc-overlay { opacity: 1; background: rgba(0,0,0,.42); }
    .mc-foot { padding: 10px 12px; }
    .mc-name { display: block; font-size: .8rem; font-weight: 700; color: #1e293b; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mc-date { display: block; font-size: .68rem; color: #94a3b8; }
    .mc-load-btn {
      flex: 1; padding: 5px 8px; background: #6366f1; color: #fff; border: none;
      border-radius: 6px; font-size: .72rem; font-weight: 700; cursor: pointer;
    }
    .mc-load-btn:hover { background: #4f46e5; }
    .mc-del-btn {
      width: 30px; background: #fee2e2; color: #dc2626; border: none;
      border-radius: 6px; cursor: pointer; font-size: .78rem;
    }
    .mc-del-btn:hover { background: #fca5a5; }

    /* ── Toast ── */
    .cvb-toast {
      position: fixed; bottom: 28px; right: 28px; background: #1e293b;
      color: #f1f5f9; padding: 12px 22px; border-radius: 10px; font-size: 13px;
      font-weight: 500; transform: translateY(80px); opacity: 0;
      transition: all .3s cubic-bezier(.4,0,.2,1); z-index: 99999; pointer-events: none;
      box-shadow: 0 6px 24px rgba(0,0,0,.35);
    }
    .cvb-toast--show { transform: translateY(0) !important; opacity: 1 !important; }

    /* ── AI TOOLBAR ── */
    /* ── AI Toolbar (icon-only) ── */
    .ai-toolbar {
      display: flex; align-items: center; gap: 2px;
      background: #0f172a; border-top: 1px solid #1e2a3a;
      padding: 5px 8px; flex-shrink: 0;
    }
    .ai-tb-label {
      font-size: .6rem; font-weight: 800; color: #4f6c9f;
      letter-spacing: .8px; padding: 0 6px 0 2px; white-space: nowrap;
    }
    .ai-tb-sep { width: 1px; height: 20px; background: #1e2a3a; margin: 0 3px; }
    /* icon button */
    .ait {
      position: relative; display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; background: none; border: none; cursor: pointer;
      border-radius: 8px; color: #94a3b8; transition: .15s; flex-shrink: 0;
    }
    .ait svg { width: 16px; height: 16px; pointer-events: none; }
    .ait:hover { background: rgba(99,102,241,.18); color: #a5b4fc; }
    .ait--active { color: #34d399 !important; }
    .ait--active:hover { background: rgba(52,211,153,.12) !important; }
    .ait--config:hover { background: rgba(245,158,11,.12); color: #fbbf24; }
    .ait--disabled { opacity: .35; cursor: not-allowed; }
    .ait-sep { width: 1px; height: 20px; background: #1e2a3a; margin: 0 2px; flex-shrink: 0; }
    /* tooltip */
    .ait-tip {
      position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
      background: #0f172a; color: #e2e8f0; border: 1px solid #334155;
      border-radius: 7px; padding: 4px 9px; font-size: .65rem; font-weight: 600;
      white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .15s;
      box-shadow: 0 4px 16px rgba(0,0,0,.5); z-index: 9999;
    }
    .ait:hover .ait-tip { opacity: 1; }
    /* active dot */
    .ait-dot {
      position: absolute; top: 5px; right: 5px; width: 6px; height: 6px;
      background: #34d399; border-radius: 50%; border: 1.5px solid #0f172a;
    }

    /* ── Section bar ── */
    .ai-section-bar {
      display: flex; align-items: center; gap: 6px; padding: 6px 14px;
      background: #0f172a; border-bottom: 1px solid #1e2a3a; flex-shrink: 0;
    }
    .ai-section-lbl { font-size: .65rem; color: #4f6c9f; font-weight: 700; white-space: nowrap; }
    .ai-section-btns { display: flex; gap: 4px; flex-wrap: wrap; }
    .ai-sec-btn {
      padding: 3px 9px; border-radius: 20px; border: 1px solid #2d3548;
      background: none; color: #64748b; font-size: .65rem; font-weight: 600;
      cursor: pointer; transition: .12s; white-space: nowrap;
    }
    .ai-sec-btn:hover { border-color: #4f6c9f; color: #94a3b8; }
    .ai-sec-btn.active { background: #6366f1; border-color: #6366f1; color: #fff; }
    /* KB badge */
    .ai-kb-badge {
      font-size: .62rem; padding: 2px 7px; border-radius: 10px;
      background: rgba(52,211,153,.15); color: #34d399; border: 1px solid rgba(52,211,153,.3);
    }
    /* Apply row */
    .ai-apply-row { display: flex; gap: 6px; margin-top: 7px; flex-wrap: wrap; }
    .ai-apply-btn {
      background: rgba(99,102,241,.15); border: 1px solid rgba(99,102,241,.3);
      color: #a5b4fc; border-radius: 7px; padding: 4px 10px;
      font-size: .68rem; font-weight: 600; cursor: pointer; transition: .12s;
    }
    .ai-apply-btn:hover { background: #6366f1; color: #fff; border-color: #6366f1; }
    .ai-apply-btn--copy { background: rgba(30,41,59,.8); border-color: #334155; color: #64748b; }
    .ai-apply-btn--copy:hover { background: #334155; color: #e2e8f0; border-color: #475569; }
    /* Mic button */
    .ai-mic-btn {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; background: #1e293b; border: 1px solid #334155;
      border-radius: 8px; color: #64748b; cursor: pointer; flex-shrink: 0; transition: .15s;
    }
    .ai-mic-btn:hover { border-color: #6366f1; color: #a5b4fc; background: rgba(99,102,241,.1); }
    .ai-mic-btn--rec { background: rgba(239,68,68,.15); border-color: #ef4444; color: #ef4444; animation: mic-pulse .8s ease infinite; }
    @keyframes mic-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)} }
    /* Send button overrides */
    .ai-send-btn {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; background: #6366f1; border: none;
      border-radius: 8px; color: #fff; cursor: pointer; flex-shrink: 0; transition: .15s;
    }
    .ai-send-btn:hover:not(:disabled) { background: #4f46e5; }
    .ai-send-btn:disabled { opacity: .4; cursor: not-allowed; }

    /* ── KB Modal ── */
    .ai-modal--kb { width: 480px; }
    .ai-kb-desc { font-size: .78rem; color: #94a3b8; margin: 0 0 14px; line-height: 1.6; }
    .ai-kb-drop {
      display: block; border: 2px dashed #334155; border-radius: 12px;
      min-height: 130px; cursor: pointer; transition: .15s;
      overflow: hidden;
    }
    .ai-kb-drop:hover { border-color: #6366f1; background: rgba(99,102,241,.04); }
    .ai-kb-drop--active { border-color: #34d399; background: rgba(52,211,153,.04); }
    .ai-kb-drop-inner {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 28px 16px; gap: 6px;
    }
    .ai-kb-drop-ico { font-size: 2rem; }
    .ai-kb-drop-lbl { font-size: .82rem; font-weight: 700; color: #e2e8f0; }
    .ai-kb-drop-sub { font-size: .7rem; color: #4f6c9f; text-align: center; }
    .ai-kb-loaded { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
    .ai-kb-file-row {
      display: flex; align-items: center; gap: 8px;
      background: rgba(99,102,241,.1); border-radius: 8px; padding: 8px 12px;
    }
    .ai-kb-file-ico { font-size: 1.2rem; }
    .ai-kb-file-name { flex: 1; font-size: .78rem; font-weight: 700; color: #e2e8f0; word-break: break-all; }
    .ai-kb-del {
      background: none; border: none; color: #64748b; cursor: pointer; font-size: .9rem;
      padding: 2px 4px; border-radius: 4px;
    }
    .ai-kb-del:hover { color: #ef4444; }
    .ai-kb-preview {
      font-size: .7rem; color: #64748b; line-height: 1.5; white-space: pre-wrap;
      word-break: break-word; max-height: 100px; overflow: hidden;
      background: #0f172a; border-radius: 6px; padding: 8px; border: 1px solid #1e293b;
    }
    .ai-kb-reload {
      background: none; border: 1px solid #334155; color: #64748b; border-radius: 6px;
      padding: 4px 10px; font-size: .7rem; cursor: pointer; transition: .12s; align-self: flex-start;
    }
    .ai-kb-reload:hover { border-color: #6366f1; color: #a5b4fc; }
    .ai-kb-error { color: #f87171; font-size: .75rem; margin-top: 8px; }
    .ai-kb-info { font-size: .72rem; color: #34d399; margin-top: 10px; }
    .ai-kb-img-wrap { margin-top: 10px; border-radius: 8px; overflow: hidden; }
    .ai-kb-img { max-width: 100%; max-height: 140px; object-fit: contain; border-radius: 8px; }

    /* ── AI OVERLAY / MODAL ── */
    .ai-overlay {
      position: fixed; inset: 0; background: rgba(15,23,42,.65);
      backdrop-filter: blur(3px); display: flex; align-items: center;
      justify-content: center; z-index: 99999; padding: 20px;
    }
    .ai-modal {
      background: #1e293b; border-radius: 14px; width: 420px; max-width: 96vw;
      max-height: 90vh; display: flex; flex-direction: column;
      box-shadow: 0 24px 60px rgba(0,0,0,.6); overflow: hidden;
    }
    .ai-modal--sm   { width: 380px; }
    .ai-modal--chatbot { width: 520px; max-height: 86vh; }
    .ai-modal--provider { width: 460px; }
    .ai-modal-head {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px; background: #0f172a; flex-shrink: 0;
      font-size: .9rem; font-weight: 700; color: #f1f5f9;
    }
    .ai-modal-close {
      background: rgba(255,255,255,.08); border: none; color: #94a3b8;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: .8rem;
    }
    .ai-modal-close:hover { background: #dc2626; color: #fff; }
    .ai-modal-body { padding: 16px 18px; overflow-y: auto; flex: 1; }
    .ai-modal-foot {
      display: flex; justify-content: flex-end; align-items: center; gap: 8px;
      padding: 12px 18px; background: #0f172a; flex-shrink: 0;
    }
    .ai-modal-ok {
      background: #6366f1; color: #fff; border: none; border-radius: 8px;
      padding: 8px 28px; font-size: .82rem; font-weight: 700; cursor: pointer;
    }
    .ai-modal-ok:hover { background: #4f46e5; }
    .ai-modal-cancel {
      background: #334155; color: #94a3b8; border: none; border-radius: 8px;
      padding: 8px 18px; font-size: .82rem; cursor: pointer;
    }
    .ai-modal-cancel:hover { background: #475569; }
    .ai-link-btn {
      background: none; border: none; color: #6366f1; font-size: .78rem;
      font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0;
    }
    .ai-link-btn:hover { color: #818cf8; }
    .ai-link-btn:disabled { opacity: .5; cursor: default; }

    /* ── AI Config modal rows ── */
    .ai-cfg-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 0; border-bottom: 1px solid #2d3548; gap: 10px;
    }
    .ai-cfg-row:last-child { border-bottom: none; }
    .ai-cfg-label { display: flex; align-items: center; gap: 8px; font-size: .82rem; color: #e2e8f0; font-weight: 600; }
    .ai-cfg-ico   { font-size: 1rem; }
    .ai-cfg-select {
      background: #0f172a; border: 1px solid #334155; color: #e2e8f0;
      border-radius: 7px; padding: 5px 8px; font-size: .78rem; min-width: 160px; max-width: 200px;
    }
    .ai-empty-hint { color: #64748b; font-size: .8rem; text-align: center; padding: 12px 0; }

    /* ── Chat modal ── */
    .ai-chat-body { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; min-height: 200px; }
    .ai-chat-msg { display: flex; }
    .ai-chat-msg--user { justify-content: flex-end; }
    .ai-chat-bubble {
      max-width: 85%; background: #0f172a; border-radius: 12px 12px 12px 4px;
      padding: 10px 14px; color: #e2e8f0; font-size: .82rem; line-height: 1.55;
    }
    .ai-chat-bubble--user { background: #6366f1; border-radius: 12px 12px 4px 12px; color: #fff; }
    .ai-chat-text { white-space: pre-wrap; word-break: break-word; }
    .ai-apply-btn {
      display: block; margin-top: 8px; background: rgba(99,102,241,.2);
      border: 1px solid #6366f1; color: #a5b4fc; border-radius: 6px;
      padding: 3px 10px; font-size: .72rem; cursor: pointer; width: 100%;
    }
    .ai-apply-btn:hover { background: rgba(99,102,241,.35); }
    .ai-typing { color: #64748b; font-size: 1.2rem; letter-spacing: 4px; animation: blink 1.2s infinite; }
    @keyframes blink { 0%,80%,100%{opacity:1} 40%{opacity:.2} }
    .ai-quick-prompts { padding: 8px 14px; display: flex; flex-wrap: wrap; gap: 6px; border-top: 1px solid #1e2a3a; }
    .ai-qp-btn {
      background: #1e2a3a; border: 1px solid #334155; color: #94a3b8;
      border-radius: 20px; padding: 5px 12px; font-size: .72rem; cursor: pointer;
    }
    .ai-qp-btn:hover { background: #334155; color: #e2e8f0; }
    .ai-chat-input-row { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid #1e2a3a; flex-shrink: 0; }
    .ai-chat-input {
      flex: 1; background: #0f172a; border: 1.5px solid #334155; color: #e2e8f0;
      border-radius: 24px; padding: 8px 16px; font-size: .82rem; outline: none;
    }
    .ai-chat-input:focus { border-color: #6366f1; }
    .ai-send-btn {
      background: #6366f1; color: #fff; border: none; border-radius: 50%;
      width: 38px; height: 38px; font-size: 1.1rem; cursor: pointer; flex-shrink: 0;
    }
    .ai-send-btn:hover { background: #4f46e5; }
    .ai-send-btn:disabled { opacity: .4; cursor: default; }

    /* ── Translate modal ── */
    .ai-lang-list { border: 1px solid #334155; border-radius: 8px; overflow: hidden; }
    .ai-lang-item {
      display: flex; justify-content: space-between; padding: 10px 14px;
      cursor: pointer; font-size: .82rem; color: #e2e8f0; border-bottom: 1px solid #334155;
    }
    .ai-lang-item:last-child { border-bottom: none; }
    .ai-lang-item:hover { background: #2d3548; }
    .ai-lang-item--sel { background: #1e3a5f; border-left: 3px solid #6366f1; }
    .ai-lang-native { font-weight: 700; }
    .ai-lang-en { color: #64748b; font-size: .76rem; }

    /* ── Provider modal ── */
    .ai-form-label { display: block; font-size: .75rem; font-weight: 700; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .5px; }
    .ai-form-input {
      width: 100%; box-sizing: border-box;
      background: #0f172a; border: 1.5px solid #334155; color: #e2e8f0;
      border-radius: 7px; padding: 8px 12px; font-size: .82rem; outline: none;
    }
    .ai-form-input:focus { border-color: #6366f1; }
    .ai-form-select {
      width: 100%; box-sizing: border-box;
      background: #0f172a; border: 1.5px solid #334155; color: #e2e8f0;
      border-radius: 7px; padding: 8px 12px; font-size: .82rem;
    }
    .ai-use-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .ai-use-btn {
      background: #0f172a; border: 1.5px solid #334155; color: #94a3b8;
      border-radius: 20px; padding: 5px 12px; font-size: .75rem; cursor: pointer;
    }
    .ai-use-btn--on { background: rgba(99,102,241,.2); border-color: #6366f1; color: #a5b4fc; font-weight: 600; }
    .ai-prov-row { display: flex; align-items: center; gap: 8px; padding: 8px; background: #0f172a; border-radius: 8px; margin-bottom: 6px; }
    .ai-prov-edit { background: #1e293b; border: none; color: #94a3b8; border-radius: 5px; padding: 4px 8px; cursor: pointer; font-size: .78rem; }
    .ai-prov-edit:hover { background: #6366f1; color: #fff; }
    .ai-prov-del  { background: #1e293b; border: none; color: #ef4444; border-radius: 5px; padding: 4px 8px; cursor: pointer; font-size: .78rem; }
    .ai-prov-del:hover { background: #ef4444; color: #fff; }
  `]
})
export class CvBuilderComponent implements OnInit, OnDestroy {
  private san = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  // ── State ──
  allTpls = ALL_TEMPLATES;
  cats    = CATEGORIES;
  swatches = COLOR_SWATCHES;
  fonts   = FONTS;

  activeNav: 'all' | 'recent' | 'favorites' | 'mes-creations' = 'all';
  sidebarCollapsed = false;
  savedCreations: SavedCreation[] = [];
  activeCategory  = 'all';
  filterColor: string | null = null;
  filterAvecPhoto: boolean | null = null;
  filterAts  = false;
  filterNew  = false;
  searchQuery = '';
  sortBy: 'popular' | 'ats' | 'new' = 'popular';

  selectedTpl: TplDef | null = null;
  edTab: 'content' | 'layout' | 'theme' = 'content';

  cvData: CvData = JSON.parse(JSON.stringify(DEFAULT_DATA));
  cvTheme: CvTheme = { couleurPrimaire: '#6366f1', couleurSecondaire: '#f1f5f9', police: 'Calibri, sans-serif', photoShape: 'circle', photoBorder: 'single', photoZoom: 100 };
  cvLayout: CvLayout = { colonnes: 2, barreGauche: true, espacement: 'normal' };

  favoriteIds = new Set<string>();
  recentIds: string[] = [];
  expanded = new Set<string>();

  previewOpen = false;
  previewTpl: TplDef | null = null;
  previewZoom = 75;
  previewEditable = false;

  // ── OnlyOffice Editor ──
  officeEditorOpen = false;
  officeConfig: OfficeEditorConfig | null = null;

  newSkill = '';

  toastMsg = '';
  toastVisible = false;
  private toastTimer: any;

  editedPreviewHtml: string | null = null;

  // ── AI Assistant ──
  aiProviders: AiProvider[] = [];
  aiConfig: AiConfig = { chatbot:'', summary:'', translate:'', analyze:'', image:'', grammar:'' };
  aiFunctions: AiFn[] = ['chatbot','summary','translate','analyze','image','grammar'];
  showAiConfigModal   = false;
  showChatbotModal    = false;
  showTranslateModal  = false;
  showAddProviderModal = false;
  editingProvider: AiProvider | null = null;
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  aiLoading = false;
  aiApplyField: 'apropos' | null = null;
  aiTranslateLang = 'fr';
  aiTranslateLangs = AI_TRANSLATE_LANGS;
  aiQuickPrompts   = CHAT_QUICK_PROMPTS;
  aiProviderNames  = AI_PROVIDER_NAMES;
  aiUseCategories  = AI_USE_CATEGORIES;
  aiUseLabels      = AI_USE_LABELS;
  aiError = '';
  newProvider: Partial<AiProvider> = {};
  newProviderModels: string[] = [];
  newProviderModelsLoading = false;

  // ── Knowledge Base ──
  knowledgeBase       = '';
  kbFileName          = '';
  kbImageData: string | null = null;
  showKbModal         = false;
  kbExtracting        = false;
  kbError             = '';

  // ── Voice Recognition ──
  isRecording         = false;
  recognition: any    = null;

  // ── Chat section targeting ──
  chatApplySection    = 'apropos';
  readonly chatSections = [
    { key: 'apropos',      label: 'Profil' },
    { key: 'exp-new',      label: '+ Expérience' },
    { key: 'exp-last',     label: 'Exp. actuelle' },
    { key: 'comp',         label: 'Compétences' },
    { key: 'formation',    label: 'Formation' },
    { key: 'centres',      label: 'Intérêts' },
  ];

  dragType: 'exp' | 'edu' | 'cert' | null = null;
  dragFromIdx = -1;
  dragOverIdx = -1;

  // ── Lifecycle ──
  ngOnInit() {
    const favs = localStorage.getItem('cvb_favorites');
    if (favs) this.favoriteIds = new Set(JSON.parse(favs));
    const recents = localStorage.getItem('cvb_recents');
    if (recents) this.recentIds = JSON.parse(recents);
    const creations = localStorage.getItem('cvb_creations');
    if (creations) this.savedCreations = JSON.parse(creations);
    const providers = localStorage.getItem('cvb_ai_providers');
    if (providers) this.aiProviders = JSON.parse(providers);
    const aiCfg = localStorage.getItem('cvb_ai_config');
    if (aiCfg) this.aiConfig = { ...this.aiConfig, ...JSON.parse(aiCfg) };
    if (!this.aiConfig.chatbot && this.aiProviders.length)
      Object.keys(this.aiConfig).forEach(k => (this.aiConfig as any)[k] = this.aiProviders[0].id);
  }

  ngOnDestroy() {}

  getThumbnail(tpl: TplDef): SafeHtml {
    _ctx = this.cvTheme;
    const html = tpl.render(this.cvData, this.cvTheme);
    _ctx = undefined;
    return this.san.bypassSecurityTrustHtml(html);
  }

  // ── Filtered list ──
  get filteredTpls(): TplDef[] {
    let list = [...ALL_TEMPLATES];

    if (this.activeNav === 'favorites') {
      list = list.filter(t => this.favoriteIds.has(t.id));
    } else if (this.activeNav === 'recent') {
      list = list.filter(t => this.recentIds.includes(t.id));
    }

    if (this.activeCategory !== 'all') list = list.filter(t => t.categorie === this.activeCategory);
    if (this.filterAvecPhoto !== null)  list = list.filter(t => t.avecPhoto === this.filterAvecPhoto);
    if (this.filterAts)                 list = list.filter(t => t.scoreAts >= 85);
    if (this.filterNew)                 list = list.filter(t => t.isNew);

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(t => t.nom.toLowerCase().includes(q) || t.categorie.includes(q));
    }

    if (this.sortBy === 'popular') list.sort((a, b) => b.popularite - a.popularite);
    else if (this.sortBy === 'ats') list.sort((a, b) => b.scoreAts - a.scoreAts);
    else if (this.sortBy === 'new') list.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));

    return list;
  }

  countByCategory(catId: string): number {
    if (catId === 'all') return ALL_TEMPLATES.length;
    return ALL_TEMPLATES.filter(t => t.categorie === catId).length;
  }

  // ── Navigation ──
  setNav(nav: 'all' | 'recent' | 'favorites' | 'mes-creations') {
    this.activeNav = nav;
    this.activeCategory = 'all';
  }

  setCategory(catId: string) {
    this.activeCategory = catId;
    if (this.activeNav !== 'all') this.activeNav = 'all';
  }

  toggleColor(color: string) {
    this.filterColor = this.filterColor === color ? null : color;
  }

  togglePhotoOpt(val: boolean) {
    this.filterAvecPhoto = this.filterAvecPhoto === val ? null : val;
  }

  resetFilters() {
    this.activeCategory  = 'all';
    this.activeNav       = 'all';
    this.filterColor     = null;
    this.filterAvecPhoto = null;
    this.filterAts       = false;
    this.filterNew       = false;
    this.searchQuery     = '';
  }

  // ── Template selection ──
  selectTpl(tpl: TplDef) {
    this.selectedTpl = tpl;
    this.cvTheme.couleurPrimaire = tpl.couleurDefaut;
    if (!this.recentIds.includes(tpl.id)) {
      this.recentIds.unshift(tpl.id);
      if (this.recentIds.length > 12) this.recentIds.pop();
      localStorage.setItem('cvb_recents', JSON.stringify(this.recentIds));
    }
  }

  closeTpl() { this.selectedTpl = null; }

  toggleFav(id: string) {
    if (this.favoriteIds.has(id)) {
      this.favoriteIds.delete(id);
      this.showToast('Retiré des favoris');
    } else {
      this.favoriteIds.add(id);
      this.showToast('❤️ Ajouté aux favoris');
    }
    localStorage.setItem('cvb_favorites', JSON.stringify([...this.favoriteIds]));
  }

  // ── Preview ──
  openPreview(tpl: TplDef) {
    this.previewTpl    = tpl;
    this.previewOpen   = true;
    this.previewEditable = true;   // Ouvrir directement en mode éditeur avancé
  }

  closePreview() {
    this.previewOpen = false; this.previewTpl = null;
    this.previewEditable = false; this.editedPreviewHtml = null;
    this.officeEditorOpen = false; this.officeConfig = null;
  }

  getPreviewHtml(): SafeHtml {
    if (!this.previewTpl) return '';
    if (this.editedPreviewHtml) {
      return this.san.bypassSecurityTrustHtml(this.editedPreviewHtml);
    }
    _ctx = this.cvTheme;
    const html = this.previewTpl.render(this.cvData, this.cvTheme);
    _ctx = undefined;
    return this.san.bypassSecurityTrustHtml(html);
  }

  // ── ATS color helper ──
  atsColor(score: number): string {
    if (score >= 90) return '#16a34a';
    if (score >= 75) return '#ca8a04';
    return '#dc2626';
  }

  // ── PDF Download ──
  downloadPdf() {
    const tpl = this.previewTpl ?? this.selectedTpl;
    if (!tpl) { this.showToast('⚠️ Sélectionnez un modèle d\'abord'); return; }
    _ctx = this.cvTheme;
    const html = this.editedPreviewHtml ?? tpl.render(this.cvData, this.cvTheme);
    _ctx = undefined;
    const name = `CV_${this.cvData.info.prenom}_${this.cvData.info.nom}`.trim();
    this.showToast('📄 Génération du PDF…');

    const el = document.createElement('div');
    el.innerHTML = html;

    const h2pdf = (window as any)['html2pdf'];
    if (h2pdf) {
      h2pdf().set({
        margin: 0,
        filename: `${name}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait' }
      }).from(el).save().then(() => this.showToast('✅ PDF téléchargé !'));
    } else {
      const win = window.open('', '_blank');
      if (!win) { this.showToast('⚠️ Autorisez les pop-ups'); return; }
      win.document.open();
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0}</style></head><body>${html}</body></html>`);
      win.document.close();
      setTimeout(() => { win.print(); }, 600);
    }
  }

  // ── Photo ──
  onPhoto(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.cvData.info.photoUrl = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  // ── Experiences ──
  addExp() {
    const id = uid();
    this.cvData.experiences.push({ id, poste: '', entreprise: '', debut: '', fin: '', actuel: false, description: [] });
    this.expanded.add('exp_' + id);
  }

  removeExp(id: string) { this.cvData.experiences = this.cvData.experiences.filter(e => e.id !== id); }

  onExpDesc(exp: CvExp, ev: Event) {
    const val = (ev.target as HTMLTextAreaElement).value;
    exp.description = val.split('\n').filter(l => l.trim() !== '');
  }

  // ── Education ──
  addEdu() {
    const id = uid();
    this.cvData.formations.push({ id, diplome: '', ecole: '', debut: '', fin: '', actuel: false, detail: '' });
    this.expanded.add('edu_' + id);
  }

  removeEdu(id: string) { this.cvData.formations = this.cvData.formations.filter(f => f.id !== id); }

  // ── Skills ──
  addSkill() {
    const nom = this.newSkill.trim();
    if (!nom) return;
    this.cvData.competences.push({ id: uid(), nom });
    this.newSkill = '';
  }

  removeSkill(id: string) { this.cvData.competences = this.cvData.competences.filter(s => s.id !== id); }

  // ── Languages ──
  addLang() { this.cvData.langues.push({ id: uid(), nom: '', niveau: '' }); }
  removeLang(id: string) { this.cvData.langues = this.cvData.langues.filter(l => l.id !== id); }

  // ── Certifications ──
  addCertif() {
    const id = uid();
    this.cvData.certifications.push({ id, nom: '', org: '', annee: '' });
    this.expanded.add('cert_' + id);
  }

  removeCertif(id: string) { this.cvData.certifications = this.cvData.certifications.filter(c => c.id !== id); }

  // ── Expand toggle ──
  toggleExpand(key: string) {
    if (this.expanded.has(key)) this.expanded.delete(key);
    else this.expanded.add(key);
  }

  // ── Theme ──
  resetTheme() {
    if (this.selectedTpl) this.cvTheme.couleurPrimaire = this.selectedTpl.couleurDefaut;
    this.cvTheme.police = 'Calibri, sans-serif';
  }

  // ── Toast ──
  showToast(msg: string) {
    this.toastMsg = msg;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastVisible = false; }, 3000);
  }

  // ── Preview edit ──
  togglePreviewEdit() {
    this.previewEditable = true;
  }

  // ── OnlyOffice Editor ──
  async openInOffice() {
    const tpl = this.previewTpl;
    if (!tpl) { this.showToast('⚠️ Sélectionnez un modèle d\'abord'); return; }

    this.showToast('⏳ Conversion du CV en Word…');

    // Transformer le HTML complexe (flexbox, CSS moderne) en HTML compatible Word
    // → tableaux pour les colonnes, suppression des styles non supportés, base64 → placeholder
    let html = htmlToWordCompatible(this.getPreviewBase());

    try {
      // Upload + conversion HTML → DOCX via ConvertService OnlyOffice
      const resp = await fetch('/api/office/upload-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html,
      });
      if (!resp.ok) throw new Error('Upload failed: ' + resp.status);
      const result = await resp.json() as { key: string; docUrl: string; proxyUrl?: string; fileType: string };

      // documentUrl DOIT être accessible depuis le container OnlyOffice (réseau Docker)
      // docUrl = URL interne (http://onlyoffice/cache/...) ou http://api-gateway:8080/...
      // callbackUrl = URL interne Docker
      const callbackUrl = `http://api-gateway:8080/api/office/callback?key=${result.key}`;

      this.officeConfig = {
        docType:     'word',
        fileType:    result.fileType as 'docx' | 'html',
        title:       `CV — ${tpl.nom}`,
        documentUrl: result.docUrl,    // URL interne Docker → téléchargé par le serveur OnlyOffice
        callbackUrl,
        downloadKey: result.key,
        lang:        'fr',
      };
      this.officeEditorOpen = true;

      // Sauvegarder dans "Mes Créations" dès maintenant avec l'URL de téléchargement
      // (le proxyUrl pointe vers le DOCX converti, téléchargeable depuis le navigateur)
      if (result.fileType === 'docx' && result.proxyUrl) {
        const creation: SavedCreation = {
          id:        result.key,
          tplId:     tpl.id,
          tplName:   tpl.nom + ' (Office)',
          html:      result.proxyUrl,  // stocke l'URL de téléchargement DOCX
          savedAt:   new Date().toISOString(),
        };
        const idx = this.savedCreations.findIndex(c => c.id === result.key);
        if (idx === -1) this.savedCreations.unshift(creation);
        localStorage.setItem('cvb_creations', JSON.stringify(this.savedCreations));
      }
      this.showToast('📝 CV chargé dans Word');
    } catch (e) {
      console.error('openInOffice error', e);
      this.showToast('❌ Impossible d\'ouvrir l\'éditeur Office');
    }
  }

  // Sauvegarde depuis l'éditeur Office → localStorage "Mes Créations"
  async onOfficeSaved(key: string) {
    if (!key || !this.previewTpl) return;
    // Polling jusqu'à ce que le DOCX soit disponible (max 30s)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const r = await fetch(`/api/office/result/${key}`);
        if (r.status === 200) {
          const { url } = await r.json() as { url: string };
          if (url) {
            const creation: SavedCreation = {
              id: key,
              tplId: this.previewTpl!.id,
              tplName: this.previewTpl!.nom + ' (Office)',
              html: url, // on stocke l'URL de téléchargement
              savedAt: new Date().toISOString(),
            };
            this.savedCreations.unshift(creation);
            localStorage.setItem('cvb_creations', JSON.stringify(this.savedCreations));
            this.showToast('✅ CV Office sauvegardé dans Mes Créations');
            return;
          }
        }
      } catch {}
    }
    this.showToast('ℹ️ Document sauvegardé dans OnlyOffice');
  }

  getPreviewBase(): string {
    if (!this.previewTpl) return '';
    if (this.editedPreviewHtml) return this.editedPreviewHtml;
    _ctx = this.cvTheme;
    const html = this.previewTpl.render(this.cvData, this.cvTheme);
    _ctx = undefined;
    return html;
  }

  onDesignSave(result: DesignEditorResult) {
    this.editedPreviewHtml = result.html;
    // On reste dans l'éditeur avancé — pas de retour au modal aperçu
    // this.previewEditable reste true
    if (this.previewTpl) this.saveToMyCreations(result.html, this.previewTpl);
    this.showToast('✅ Modifications sauvegardées');
  }

  getSavedThumb(cr: SavedCreation): SafeHtml {
    return this.san.bypassSecurityTrustHtml(cr.html);
  }

  saveToMyCreations(html: string, tpl: TplDef) {
    const creation: SavedCreation = {
      id: uid(),
      tplId: tpl.id,
      tplName: tpl.nom,
      html,
      savedAt: new Date().toISOString()
    };
    this.savedCreations.unshift(creation);
    localStorage.setItem('cvb_creations', JSON.stringify(this.savedCreations));
    this.showToast('✅ Sauvegardé dans Mes Créations');
  }

  isOfficeCreation(cr: SavedCreation): boolean {
    return cr.tplName.endsWith('(Office)') || cr.html.startsWith('http');
  }

  loadCreation(creation: SavedCreation) {
    if (this.isOfficeCreation(creation)) {
      // Créations Office → téléchargement direct du DOCX
      const url = creation.html.startsWith('http')
        ? `/api/office/download/${creation.id}`
        : creation.html;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${creation.tplName}.docx`;
      a.click();
      this.showToast('⬇ Téléchargement du fichier Office…');
      return;
    }
    this.editedPreviewHtml = creation.html;
    const tpl = ALL_TEMPLATES.find(t => t.id === creation.tplId);
    if (tpl) {
      this.selectedTpl = tpl;
      this.previewTpl  = tpl;
      this.previewOpen = true;
    }
    this.showToast('📂 Création chargée');
  }

  deleteCreation(id: string) {
    this.savedCreations = this.savedCreations.filter(c => c.id !== id);
    localStorage.setItem('cvb_creations', JSON.stringify(this.savedCreations));
    this.showToast('Création supprimée');
  }

  // ── Drag & Drop ──
  onDragStart(type: 'exp' | 'edu' | 'cert', idx: number) {
    this.dragType = type;
    this.dragFromIdx = idx;
  }

  onDragOver(idx: number, event: DragEvent) {
    event.preventDefault();
    this.dragOverIdx = idx;
  }

  onDrop(type: 'exp' | 'edu' | 'cert', toIdx: number) {
    if (this.dragType !== type || this.dragFromIdx < 0 || this.dragFromIdx === toIdx) {
      this.dragType = null; this.dragFromIdx = -1; this.dragOverIdx = -1;
      return;
    }
    const arr: any[] = type === 'exp' ? this.cvData.experiences
      : type === 'edu' ? this.cvData.formations
      : this.cvData.certifications;
    const [item] = arr.splice(this.dragFromIdx, 1);
    arr.splice(toIdx, 0, item);
    this.dragType = null; this.dragFromIdx = -1; this.dragOverIdx = -1;
  }

  onDragEnd() {
    this.dragType = null; this.dragFromIdx = -1; this.dragOverIdx = -1;
  }

  // ── AI Assistant ──

  getProviderForFn(fn: AiFn): AiProvider | null {
    const id = this.aiConfig[fn];
    return this.aiProviders.find(p => p.id === id) ?? this.aiProviders[0] ?? null;
  }

  async callAi(fn: AiFn, messages: ChatMessage[]): Promise<string> {
    const prov = this.getProviderForFn(fn);
    if (!prov) throw new Error('Aucun modèle d\'IA configuré. Cliquez sur ⚙ Paramètres pour en ajouter un.');
    const url = prov.url.replace(/\/$/, '') + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${prov.key}` },
      body: JSON.stringify({ model: prov.model, messages, stream: false })
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Erreur API (${res.status}): ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  openAiConfig() { this.showAiConfigModal = true; }
  closeAiConfig() { this.showAiConfigModal = false; this.saveAiConfig(); }

  openChatbot() {
    if (this.chatMessages.length === 0) {
      const kbNote = this.knowledgeBase ? `\n\n📎 J'ai accès à votre document (${this.kbFileName}) — je l'utiliserai comme contexte pour mieux personnaliser votre CV.` : '';
      this.chatMessages = [{ role: 'assistant', content:
        `Bonjour ${this.cvData.info.prenom || ''} ! Je suis votre assistant IA CV.\n\nJe peux rédiger votre profil, vos expériences, compétences, ou optimiser votre CV pour les ATS. Utilisez les boutons de section pour diriger le résultat.${kbNote}\n\nQue souhaitez-vous faire ?` }];
    }
    this.showChatbotModal = true;
  }
  closeChatbot() { this.showChatbotModal = false; }

  useQuickPrompt(p: string) { this.chatInput = p; }

  async sendChat() {
    const msg = this.chatInput.trim();
    if (!msg || this.aiLoading) return;
    this.chatInput = '';
    if (this.isRecording) this.stopVoice();
    this.chatMessages.push({ role: 'user', content: msg });
    this.aiLoading = true; this.aiError = '';
    try {
      const history: ChatMessage[] = [
        { role: 'system', content: this.buildSystemPrompt() },
        ...this.chatMessages.slice(-10)
      ];
      const reply = await this.callAi('chatbot', history);
      this.chatMessages.push({ role: 'assistant', content: reply });
    } catch (e: any) {
      this.aiError = e.message;
      this.chatMessages.push({ role: 'assistant', content: `❌ ${e.message}` });
    } finally { this.aiLoading = false; this.cdr.detectChanges(); }
  }

  async aiSummarize() {
    const text = this.cvData.info.apropos;
    if (!text.trim()) { this.showToast('⚠️ Le champ "À Propos" est vide'); return; }
    this.showToast('⏳ Résumé en cours…');
    try {
      const res = await this.callAi('summary', [
        { role: 'system', content: 'Tu es un expert en CV. Résume le texte de façon concise, professionnelle, max 3 phrases.' },
        { role: 'user', content: text }
      ]);
      this.cvData.info.apropos = res.trim();
      this.showToast('✅ Résumé appliqué');
    } catch (e: any) { this.showToast('❌ ' + e.message); }
    this.cdr.detectChanges();
  }

  openTranslate() { this.showTranslateModal = true; }
  closeTranslate() { this.showTranslateModal = false; }

  async doTranslate() {
    this.showTranslateModal = false;
    const text = this.cvData.info.apropos;
    if (!text.trim()) { this.showToast('⚠️ Le champ "À Propos" est vide'); return; }
    const lang = AI_TRANSLATE_LANGS.find(l => l.code === this.aiTranslateLang);
    this.showToast(`⏳ Traduction en ${lang?.label ?? this.aiTranslateLang}…`);
    try {
      const res = await this.callAi('translate', [
        { role: 'system', content: `Tu es un traducteur professionnel. Traduis le texte en ${lang?.label ?? this.aiTranslateLang}. Ne donne que la traduction, sans commentaire.` },
        { role: 'user', content: text }
      ]);
      this.cvData.info.apropos = res.trim();
      this.showToast('✅ Traduction appliquée');
    } catch (e: any) { this.showToast('❌ ' + e.message); }
    this.cdr.detectChanges();
  }

  async aiGrammar() {
    const text = this.cvData.info.apropos;
    if (!text.trim()) { this.showToast('⚠️ Le champ "À Propos" est vide'); return; }
    this.showToast('⏳ Correction grammaticale…');
    try {
      const res = await this.callAi('grammar', [
        { role: 'system', content: 'Tu es un correcteur orthographique et grammatical. Corrige les fautes sans changer le sens ni le style. Ne donne que le texte corrigé.' },
        { role: 'user', content: text }
      ]);
      this.cvData.info.apropos = res.trim();
      this.showToast('✅ Correction appliquée');
    } catch (e: any) { this.showToast('❌ ' + e.message); }
    this.cdr.detectChanges();
  }

  openAddProvider(existing?: AiProvider) {
    this.editingProvider = existing ?? null;
    this.newProvider = existing
      ? { ...existing }
      : { id: uid(), name: 'OpenAI', url: AI_DEFAULT_URLS['OpenAI'], key: '', model: '', usedFor: ['all'] };
    this.newProviderModels = [];
    this.showAddProviderModal = true;
  }

  onProviderNameChange() {
    const name = this.newProvider.name ?? '';
    if (AI_DEFAULT_URLS[name]) this.newProvider.url = AI_DEFAULT_URLS[name];
    this.newProviderModels = [];
  }

  async fetchModels() {
    if (!this.newProvider.url || !this.newProvider.key) {
      this.showToast('⚠️ Renseignez l\'URL et la Clé d\'abord'); return;
    }
    this.newProviderModelsLoading = true;
    try {
      const url = (this.newProvider.url ?? '').replace(/\/$/, '') + '/models';
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.newProvider.key}` } });
      if (!res.ok) throw new Error(res.status + '');
      const data = await res.json();
      this.newProviderModels = (data.data ?? []).map((m: any) => m.id ?? m).filter(Boolean);
    } catch (e: any) {
      this.showToast('❌ Impossible de récupérer les modèles: ' + e.message);
    } finally { this.newProviderModelsLoading = false; this.cdr.detectChanges(); }
  }

  toggleProviderUse(cat: string) {
    const uses: string[] = this.newProvider.usedFor ?? [];
    const idx = uses.indexOf(cat);
    if (idx >= 0) uses.splice(idx, 1); else uses.push(cat);
    this.newProvider.usedFor = [...uses];
  }

  saveProvider() {
    if (!this.newProvider.name || !this.newProvider.url || !this.newProvider.model) {
      this.showToast('⚠️ Nom, URL et Modèle sont requis'); return;
    }
    const prov = { id: this.newProvider.id ?? uid(), name: this.newProvider.name!, url: this.newProvider.url!, key: this.newProvider.key ?? '', model: this.newProvider.model!, usedFor: this.newProvider.usedFor ?? ['all'] };
    const idx = this.aiProviders.findIndex(p => p.id === prov.id);
    if (idx >= 0) this.aiProviders[idx] = prov; else this.aiProviders.push(prov);
    this.saveAiProviders();
    if (!this.aiConfig.chatbot) Object.keys(this.aiConfig).forEach(k => (this.aiConfig as any)[k] = prov.id);
    this.saveAiConfig();
    this.showAddProviderModal = false;
    this.showToast('✅ Modèle IA sauvegardé');
  }

  deleteProvider(id: string) {
    this.aiProviders = this.aiProviders.filter(p => p.id !== id);
    this.saveAiProviders();
    if (this.aiProviders.length === 0) Object.keys(this.aiConfig).forEach(k => (this.aiConfig as any)[k] = '');
    this.saveAiConfig();
    this.showToast('Modèle supprimé');
  }

  saveAiProviders() { localStorage.setItem('cvb_ai_providers', JSON.stringify(this.aiProviders)); }
  saveAiConfig()    { localStorage.setItem('cvb_ai_config',    JSON.stringify(this.aiConfig)); }

  providerLabel(id: string): string {
    const p = this.aiProviders.find(x => x.id === id);
    return p ? `${p.name} [${p.model.slice(0,12)}…]` : '— Choisir —';
  }

  fnLabel(fn: AiFn): string {
    const labels: Record<AiFn, string> = { chatbot:'Chatbot', summary:'Résumer', translate:'Traduire', analyze:'Analyse de texte', image:'Génération d\'images', grammar:'Grammaire' };
    return labels[fn];
  }

  // ── Knowledge Base ──────────────────────────────────────────────────────

  openKbModal()  { this.showKbModal = true; }
  closeKbModal() { this.showKbModal = false; }
  clearKb()      { this.knowledgeBase = ''; this.kbFileName = ''; this.kbImageData = null; this.kbError = ''; }

  onKbDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) this.processKbFile(file);
  }

  onKbFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.processKbFile(file);
  }

  async processKbFile(file: File) {
    this.kbError = ''; this.kbExtracting = true; this.kbFileName = file.name;
    this.cdr.detectChanges();
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (/^(png|jpg|jpeg|webp|bmp|tiff?|gif)$/.test(ext)) {
        this.kbImageData = await this.readAsDataURL(file);
        // Use AI vision to extract text from image
        this.knowledgeBase = await this.extractFromImageViaAi(this.kbImageData);
      } else if (ext === 'pdf') {
        this.knowledgeBase = await this.extractPdf(file);
        this.kbImageData = null;
      } else if (ext === 'docx' || ext === 'doc') {
        this.knowledgeBase = await this.extractDocx(file);
        this.kbImageData = null;
      } else {
        this.knowledgeBase = await this.readAsText(file);
        this.kbImageData = null;
      }
    } catch (err: any) {
      this.kbError = err.message ?? 'Erreur lors de l\'extraction du document';
      this.knowledgeBase = '';
    } finally {
      this.kbExtracting = false;
      this.cdr.detectChanges();
    }
  }

  private readAsText(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result as string);
      r.onerror = () => rej(new Error('Lecture impossible'));
      r.readAsText(file, 'utf-8');
    });
  }

  private readAsDataURL(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result as string);
      r.onerror = () => rej(new Error('Lecture impossible'));
      r.readAsDataURL(file);
    });
  }

  private async extractPdf(file: File): Promise<string> {
    const pdfjsLib = (window as any)['pdfjsLib'];
    if (!pdfjsLib) throw new Error('PDF.js non chargé. Vérifiez votre connexion.');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf  = await file.arrayBuffer();
    const doc  = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
      const page    = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(' ') + '\n';
    }
    if (!text.trim()) throw new Error('Aucun texte trouvé dans le PDF. Essayez une image du document.');
    return text.trim();
  }

  private async extractDocx(file: File): Promise<string> {
    const mammoth = (window as any)['mammoth'];
    if (!mammoth) throw new Error('Mammoth.js non chargé. Vérifiez votre connexion.');
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    if (!res.value?.trim()) throw new Error('Aucun texte trouvé dans le document.');
    return res.value.trim();
  }

  private async extractFromImageViaAi(dataUrl: string): Promise<string> {
    const prov = this.getProviderForFn('chatbot');
    if (!prov) throw new Error('Aucun modèle IA configuré. Ajoutez un modèle vision (GPT-4o, Claude, etc.).');
    const url = prov.url.replace(/\/$/, '') + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${prov.key}` },
      body: JSON.stringify({
        model: prov.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Extrais tout le texte visible dans cette image (document, CV, manuscrit). Retourne uniquement le texte brut, sans reformatage.' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }],
        stream: false
      })
    });
    if (!res.ok) throw new Error(`Erreur IA ${res.status}. Utilisez un modèle avec capacités vision.`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  async analyzeAndFill() {
    if (!this.knowledgeBase && !this.kbImageData) { this.showToast('⚠️ Chargez d\'abord un document'); return; }
    this.showKbModal = false;
    this.showToast('⏳ Analyse IA en cours…');
    try {
      const prov = this.getProviderForFn('chatbot');
      if (!prov) throw new Error('Aucun modèle IA configuré.');
      const schema = `{
  "prenom":"","nom":"","titre":"","email":"","telephone":"","ville":"","linkedin":"","github":"","portfolio":"",
  "apropos":"",
  "experiences":[{"poste":"","entreprise":"","debut":"","fin":"","actuel":false,"description":[""]}],
  "formations":[{"diplome":"","ecole":"","debut":"","fin":"","detail":""}],
  "competences":[{"nom":""}],
  "langues":[{"nom":"","niveau":""}],
  "centres_interet":[""],
  "photo_description":"description si photo trouvée sinon vide"
}`;
      const reply = await this.callAi('chatbot', [
        { role: 'system', content: `Tu es un expert en analyse de documents RH et rédaction de CV. Extrais toutes les informations du document fourni et retourne UNIQUEMENT un JSON valide respectant ce schéma:\n${schema}\nNe retourne que le JSON, sans markdown, sans explications.` },
        { role: 'user', content: `Document:\n${this.knowledgeBase}` }
      ]);
      // Extract JSON from response
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Réponse JSON invalide. Essayez avec un modèle plus puissant.');
      const parsed = JSON.parse(jsonMatch[0]);
      this.applyParsedData(parsed);
      this.showToast('✅ CV rempli depuis votre document !');
    } catch (e: any) {
      this.showToast('❌ ' + e.message);
    }
    this.cdr.detectChanges();
  }

  private applyParsedData(d: any) {
    if (d.prenom)    this.cvData.info.prenom    = d.prenom;
    if (d.nom)       this.cvData.info.nom        = d.nom;
    if (d.titre)     this.cvData.info.titre      = d.titre;
    if (d.email)     this.cvData.info.email      = d.email;
    if (d.telephone) this.cvData.info.telephone  = d.telephone;
    if (d.ville)     this.cvData.info.ville      = d.ville;
    if (d.linkedin)  this.cvData.info.linkedin   = d.linkedin;
    if (d.github)    this.cvData.info.github     = d.github;
    if (d.portfolio) this.cvData.info.portfolio  = d.portfolio;
    if (d.apropos)   this.cvData.info.apropos    = d.apropos;

    if (Array.isArray(d.experiences) && d.experiences.length) {
      this.cvData.experiences = d.experiences.map((e: any) => ({
        id: uid(), poste: e.poste ?? '', entreprise: e.entreprise ?? '',
        debut: e.debut ?? '', fin: e.fin ?? '', actuel: !!e.actuel,
        description: Array.isArray(e.description) ? e.description : [e.description ?? '']
      }));
    }
    if (Array.isArray(d.formations) && d.formations.length) {
      this.cvData.formations = d.formations.map((f: any) => ({
        id: uid(), diplome: f.diplome ?? '', ecole: f.ecole ?? '',
        debut: f.debut ?? '', fin: f.fin ?? '', actuel: false, detail: f.detail ?? ''
      }));
    }
    if (Array.isArray(d.competences) && d.competences.length) {
      this.cvData.competences = d.competences.map((c: any) => ({
        id: uid(), nom: typeof c === 'string' ? c : (c.nom ?? '')
      })).filter((c: any) => c.nom);
    }
    if (Array.isArray(d.langues) && d.langues.length) {
      this.cvData.langues = d.langues.map((l: any) => ({
        id: uid(), nom: l.nom ?? '', niveau: l.niveau ?? 'Intermédiaire'
      }));
    }
  }

  // ── Voice Recognition ────────────────────────────────────────────────────

  toggleVoice() {
    if (this.isRecording) { this.stopVoice(); return; }
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { this.showToast('⚠️ Reconnaissance vocale non disponible sur ce navigateur'); return; }
    this.recognition = new SR();
    this.recognition.lang = 'fr-FR';
    this.recognition.interimResults = true;
    this.recognition.continuous     = false;
    const base = this.chatInput;
    this.recognition.onresult = (ev: any) => {
      const transcript = Array.from(ev.results as any[])
        .map((r: any) => r[0].transcript).join('');
      this.chatInput = base + (base ? ' ' : '') + transcript;
      this.cdr.detectChanges();
    };
    this.recognition.onend = () => { this.isRecording = false; this.cdr.detectChanges(); };
    this.recognition.onerror = (e: any) => {
      this.isRecording = false;
      if (e.error !== 'aborted') this.showToast('⚠️ Micro : ' + e.error);
      this.cdr.detectChanges();
    };
    this.recognition.start();
    this.isRecording = true;
  }

  stopVoice() {
    this.recognition?.stop();
    this.isRecording = false;
  }

  // ── Apply to any section ─────────────────────────────────────────────────

  getSectionLabel(key: string): string {
    return this.chatSections.find(s => s.key === key)?.label ?? key;
  }

  applyToSection(content: string, section: string) {
    const text = content.trim();
    switch (section) {
      case 'apropos':
        this.cvData.info.apropos = text;
        this.showToast('✅ Profil mis à jour');
        break;

      case 'exp-new': {
        const lines = text.split('\n').filter(Boolean);
        const descLines = lines.slice(1);
        this.cvData.experiences.push({
          id: uid(), poste: lines[0] ?? 'Nouveau poste', entreprise: '',
          debut: new Date().getFullYear().toString(), fin: '', actuel: true,
          description: descLines.length ? descLines : [text]
        });
        this.showToast('✅ Expérience ajoutée');
        break;
      }

      case 'exp-last': {
        const last = this.cvData.experiences[0];
        if (!last) { this.showToast('⚠️ Aucune expérience existante'); return; }
        last.description = text.split('\n').filter(Boolean);
        this.showToast('✅ Expérience actuelle mise à jour');
        break;
      }

      case 'comp': {
        const newComps = text.split(/[,\n•\-]+/).map(c => c.trim()).filter(c => c.length > 1);
        newComps.forEach(nom => this.cvData.competences.push({ id: uid(), nom }));
        this.showToast(`✅ ${newComps.length} compétence(s) ajoutée(s)`);
        break;
      }

      case 'formation': {
        const lines = text.split('\n').filter(Boolean);
        this.cvData.formations.push({
          id: uid(), diplome: lines[0] ?? 'Formation', ecole: lines[1] ?? '',
          debut: '', fin: '', actuel: false, detail: lines.slice(2).join(' ')
        });
        this.showToast('✅ Formation ajoutée');
        break;
      }

      case 'centres': {
        // CvInfo may not have centres_interet — add to apropos as note
        const note = `\n\nCentres d'intérêt : ${text}`;
        this.cvData.info.apropos = (this.cvData.info.apropos + note).trim();
        this.showToast('✅ Intérêts ajoutés au profil');
        break;
      }
    }
    this.cdr.detectChanges();
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => this.showToast('📋 Copié !'));
  }

  // ── sendChat override — inject knowledge base context ────────────────────

  private buildSystemPrompt(): string {
    const info = this.cvData.info;
    let ctx = `Expert en rédaction de CV professionnels. CV de ${info.prenom} ${info.nom}, ${info.titre}.`;
    if (info.apropos) ctx += ` Profil : ${info.apropos.slice(0, 200)}.`;
    if (this.knowledgeBase) ctx += `\n\nBASE DE CONNAISSANCE (document de l'utilisateur) :\n${this.knowledgeBase.slice(0, 3000)}`;
    ctx += '\n\nRéponds en français. Sois concis et professionnel.';
    return ctx;
  }

  // ── Helpers ──
  trackById(_: number, item: { id: string }) { return item.id; }
}
