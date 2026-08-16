import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import * as XLSX from 'xlsx';

@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(html: string): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(html); }
}
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../shared/ui/dialog.service';
import { OfficeEditorComponent, OfficeEditorConfig, OfficeDocType } from '../../shared/office-editor/office-editor.component';
import { DesignEditorComponent, DesignEditorResult, DesignObject } from '../../shared/design-editor/design-editor.component';
import { BADGE_TEMPLATES, CARTE_TEMPLATES, LOGO_TEMPLATES, DesignTemplate, STANDARD_FIELDS, applyFields } from '../../shared/design-editor/design-templates';
import { LOGO_HTML_TPLS, LOGO_CATEGORIES, LogoHtmlTpl } from '../../shared/design-editor/logo-html-templates';

type CSTool =
  | 'editor' | 'template-cv' | 'template-lettre' | 'template-cr' | 'template-conge'
  | 'badge' | 'logo' | 'carte-visite'
  | 'cv-analyzer' | 'doc-chat'
  | 'scanner' | 'bg-removal'
  | 'office-word' | 'office-excel' | 'office-pptx'
  | 'rxresume'
  | 'rxresume-lab'
  | 'cv-gallery';

type CSGroup = { label: string; icon: string; tools: CSToolDef[] };
interface CSToolDef { id: CSTool; icon: string; name: string; desc: string; wip?: boolean }

const TEMPLATES: Record<string, string> = {
  'template-cv': `<h1 style="text-align:center;color:#1e293b;font-size:1.6rem;margin-bottom:.25rem">Prénom NOM</h1>
<p style="text-align:center;color:#6366f1;font-size:.95rem;margin-bottom:.5rem">Titre du poste recherché</p>
<p style="text-align:center;font-size:.85rem;color:#64748b">📧 email@exemple.com &nbsp;|&nbsp; 📞 +33 6 00 00 00 00 &nbsp;|&nbsp; 🔗 linkedin.com/in/profil</p>
<hr style="border:none;border-top:2px solid #6366f1;margin:1rem 0"/>

<h2 style="color:#1e293b;font-size:1.05rem;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:.35rem">🎓 Formation</h2>
<p><strong>Master Informatique</strong> — Université Paris-Saclay &nbsp;<em style="color:#94a3b8">(2022–2024)</em></p>

<h2 style="color:#1e293b;font-size:1.05rem;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:.35rem;margin-top:1rem">💼 Expérience professionnelle</h2>
<p><strong>Développeur Full-Stack</strong> — Entreprise XYZ &nbsp;<em style="color:#94a3b8">(2024–présent)</em></p>
<ul><li>Développement d'APIs REST Spring Boot</li><li>Intégration de services IA (Python/FastAPI)</li></ul>

<h2 style="color:#1e293b;font-size:1.05rem;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:.35rem;margin-top:1rem">🛠️ Compétences</h2>
<p><strong>Langages :</strong> Java, Python, TypeScript, SQL</p>
<p><strong>Frameworks :</strong> Spring Boot, Angular, FastAPI, Kafka</p>

<h2 style="color:#1e293b;font-size:1.05rem;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:.35rem;margin-top:1rem">🌍 Langues</h2>
<p>Français (natif) &nbsp;|&nbsp; Anglais (courant) &nbsp;|&nbsp; Espagnol (notions)</p>`,

  'template-lettre': `<p style="text-align:right;color:#64748b;font-size:.9rem">Ville, le ${new Date().toLocaleDateString('fr-FR')}</p>
<br>
<p><strong>Prénom NOM</strong><br>Adresse<br>Code postal, Ville<br>email@exemple.com</p>
<br>
<p><strong>À l'attention de :</strong><br>Madame / Monsieur le Directeur<br>Nom de l'entreprise<br>Adresse</p>
<br>
<p><strong>Objet : Candidature au poste de ...</strong></p>
<br>
<p>Madame, Monsieur,</p>
<br>
<p>Actuellement [votre situation actuelle], je vous adresse ma candidature au poste de <strong>[intitulé du poste]</strong> au sein de votre entreprise.</p>
<br>
<p>Fort(e) d'une expérience de [X années] dans [domaine], j'ai pu développer des compétences solides en [compétence 1], [compétence 2] et [compétence 3]. Votre entreprise m'attire particulièrement pour [raison spécifique liée à l'entreprise].</p>
<br>
<p>Convaincu(e) que mon profil correspond à vos attentes, je reste disponible pour un entretien à votre convenance.</p>
<br>
<p>Dans l'attente de votre réponse, je vous adresse mes sincères salutations.</p>
<br><br>
<p style="text-align:right"><strong>Prénom NOM</strong></p>`,

  'template-cr': `<h1 style="text-align:center;color:#1e293b">Compte-rendu de réunion</h1>
<p style="text-align:center;color:#64748b;font-size:.9rem">Date : ${new Date().toLocaleDateString('fr-FR')} &nbsp;|&nbsp; Lieu : [Salle/Visio]</p>
<hr style="border:none;border-top:2px solid #e2e8f0;margin:1rem 0"/>

<h2 style="color:#1e293b">Participants</h2>
<ul><li>Prénom NOM — Rôle</li><li>Prénom NOM — Rôle</li></ul>

<h2 style="color:#1e293b">Ordre du jour</h2>
<ol><li>Point 1</li><li>Point 2</li><li>Point 3</li></ol>

<h2 style="color:#1e293b">Résumé des échanges</h2>
<p>[Résumé des discussions]</p>

<h2 style="color:#1e293b">Décisions prises</h2>
<ul><li>Décision 1</li><li>Décision 2</li></ul>

<h2 style="color:#1e293b">Actions à mener</h2>
<table style="width:100%;border-collapse:collapse;font-size:.9rem">
<tr style="background:#f8fafc"><th style="border:1px solid #e2e8f0;padding:.5rem;text-align:left">Action</th><th style="border:1px solid #e2e8f0;padding:.5rem;text-align:left">Responsable</th><th style="border:1px solid #e2e8f0;padding:.5rem;text-align:left">Échéance</th></tr>
<tr><td style="border:1px solid #e2e8f0;padding:.5rem">[Action]</td><td style="border:1px solid #e2e8f0;padding:.5rem">[Nom]</td><td style="border:1px solid #e2e8f0;padding:.5rem">[Date]</td></tr>
</table>

<p style="margin-top:1.5rem;color:#64748b;font-size:.85rem">Prochaine réunion : [date]</p>`,

  'template-conge': `<p style="text-align:right;color:#64748b;font-size:.9rem">Ville, le ${new Date().toLocaleDateString('fr-FR')}</p>
<br>
<p><strong>Prénom NOM</strong><br>Service : [Département]<br>email@entreprise.com</p>
<br>
<p><strong>À l'attention de :</strong><br>[Responsable hiérarchique]<br>[Service RH]</p>
<br>
<p><strong>Objet : Demande de congés payés</strong></p>
<br>
<p>Madame, Monsieur,</p>
<br>
<p>Je vous adresse par la présente une demande de congés pour la période du <strong>[date de début]</strong> au <strong>[date de fin]</strong> inclus, soit <strong>[X jours ouvrés]</strong>.</p>
<br>
<p>Je m'assurerai de la bonne continuité de mes missions avant mon départ en informant [collègue/responsable] de l'avancement de mes dossiers.</p>
<br>
<p>Dans l'attente de votre accord, je vous adresse mes cordiales salutations.</p>
<br><br>
<p><strong>Prénom NOM</strong></p>
<p>Lu et approuvé : _________________ &nbsp;&nbsp; Date : _________</p>`,
};

const BADGE_COLOR_PRESETS = [
  { id: 'event',    label: 'Événement',    bg: '#1e1b4b', fg: '#ffffff', accent: '#6366f1' },
  { id: 'staff',    label: 'Staff',        bg: '#0f172a', fg: '#f8fafc', accent: '#22c55e' },
  { id: 'vip',      label: 'VIP',          bg: '#78350f', fg: '#fef3c7', accent: '#f59e0b' },
  { id: 'speaker',  label: 'Intervenant',  bg: '#1e3a8a', fg: '#ffffff', accent: '#3b82f6' },
  { id: 'visitor',  label: 'Visiteur',     bg: '#f8fafc', fg: '#1e293b', accent: '#6366f1' },
  { id: 'press',    label: 'Presse',       bg: '#1c1c1c', fg: '#ffffff', accent: '#ef4444' },
];

// ═══════════════════════════════════════════════════
// DESIGN TEMPLATES (badge, carte de visite, logo)
// ═══════════════════════════════════════════════════

interface DesignTpl { id: string; name: string; previewBg: string; w: number; h: number; html: string; }

const BADGE_DESIGN_TPLS: DesignTpl[] = [
  { id: 'b-corporate', name: 'Corporate Dark', previewBg: '#0f172a', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:#0f172a;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(to bottom,#6366f1,#a855f7)"></div>
  <div style="position:absolute;top:0;left:5px;right:0;height:2px;background:linear-gradient(90deg,#6366f1,transparent)"></div>
  <div style="position:absolute;top:36px;right:24px;width:50px;height:50px;border-radius:50%;background:#6366f1;text-align:center;line-height:50px;color:#fff;font-size:22px;font-weight:800">N</div>
  <div style="position:absolute;top:38px;left:22px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.3px">Prénom NOM</div>
  <div style="position:absolute;top:66px;left:22px;color:#818cf8;font-size:12.5px;font-weight:600">Rôle / Titre du poste</div>
  <div style="position:absolute;top:90px;left:22px;right:22px;height:1px;background:rgba(255,255,255,0.1)"></div>
  <div style="position:absolute;top:100px;left:22px;color:rgba(255,255,255,0.45);font-size:11px">Organisation · Événement 2026</div>
  <div style="position:absolute;bottom:16px;left:22px;color:rgba(255,255,255,0.3);font-size:9px;font-family:monospace;letter-spacing:1.2px">BADGE-001</div>
  <div style="position:absolute;bottom:12px;right:16px;color:rgba(255,255,255,0.1);font-size:7.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">MEDI EXPRESS</div>
</div>` },
  { id: 'b-event', name: 'Événement Blue', previewBg: '#1e3a8a', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:linear-gradient(135deg,#1e3a8a,#2563eb);font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:-50px;right:-50px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,0.06)"></div>
  <div style="position:absolute;bottom:-30px;left:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.04)"></div>
  <div style="position:absolute;top:20px;left:20px;color:rgba(255,255,255,0.6);font-size:8px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase">ÉVÉNEMENT · 2026</div>
  <div style="position:absolute;top:38px;left:20px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px">Prénom NOM</div>
  <div style="position:absolute;top:70px;left:20px;color:#93c5fd;font-size:13px;font-weight:600">Rôle / Titre</div>
  <div style="position:absolute;bottom:36px;left:20px;right:20px;height:1px;background:rgba(255,255,255,0.2)"></div>
  <div style="position:absolute;bottom:18px;left:20px;color:rgba(255,255,255,0.5);font-size:10px">Organisation</div>
  <div style="position:absolute;bottom:18px;right:18px;color:rgba(255,255,255,0.3);font-size:9px;font-family:monospace">BADGE-001</div>
</div>` },
  { id: 'b-staff', name: 'Staff Vert', previewBg: '#064e3b', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:#064e3b;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#10b981,#34d399,#10b981)"></div>
  <div style="position:absolute;top:18px;left:20px;background:#10b981;color:#fff;font-size:8.5px;font-weight:800;letter-spacing:2px;padding:3px 12px;border-radius:20px;text-transform:uppercase">STAFF</div>
  <div style="position:absolute;top:50px;left:20px;color:#fff;font-size:22px;font-weight:800">Prénom NOM</div>
  <div style="position:absolute;top:80px;left:20px;color:#6ee7b7;font-size:12.5px;font-weight:600">Rôle / Poste</div>
  <div style="position:absolute;top:105px;left:20px;right:20px;height:1px;background:rgba(255,255,255,0.12)"></div>
  <div style="position:absolute;top:115px;left:20px;color:rgba(255,255,255,0.45);font-size:11px">Organisation</div>
  <div style="position:absolute;bottom:16px;left:20px;color:rgba(255,255,255,0.25);font-size:9px;font-family:monospace;letter-spacing:1px">BADGE-001</div>
</div>` },
  { id: 'b-vip', name: 'VIP Gold', previewBg: '#1c1008', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:#1c1008;font-family:'Georgia',serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:10px;left:10px;right:10px;bottom:10px;border:1px solid rgba(245,158,11,0.3);border-radius:6px"></div>
  <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);background:#f59e0b;color:#1c1008;font-size:7px;font-weight:800;letter-spacing:2.5px;padding:2px 18px;text-transform:uppercase">VIP ACCESS</div>
  <div style="position:absolute;top:22px;left:0;right:0;text-align:center;color:#f59e0b;font-size:9px;letter-spacing:3px;text-transform:uppercase">✦ &nbsp; ✦ &nbsp; ✦</div>
  <div style="position:absolute;top:44px;left:0;right:0;text-align:center;color:#fef3c7;font-size:21px;font-weight:700;letter-spacing:0.5px">Prénom NOM</div>
  <div style="position:absolute;top:74px;left:0;right:0;text-align:center;color:#f59e0b;font-size:11.5px;font-style:italic">Titre / Rôle d'honneur</div>
  <div style="position:absolute;top:96px;left:50px;right:50px;height:1px;background:linear-gradient(90deg,transparent,rgba(245,158,11,0.45),transparent)"></div>
  <div style="position:absolute;top:108px;left:0;right:0;text-align:center;color:rgba(254,243,199,0.45);font-size:10px;letter-spacing:0.5px">Organisation</div>
  <div style="position:absolute;bottom:18px;left:0;right:0;text-align:center;color:rgba(245,158,11,0.3);font-size:9px;font-family:monospace;letter-spacing:1.5px">BADGE-001</div>
</div>` },
  { id: 'b-speaker', name: 'Intervenant', previewBg: '#f8fafc', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:#fff;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden;border:1px solid #e2e8f0">
  <div style="position:absolute;top:0;left:0;right:0;height:58px;background:#1e3a8a"></div>
  <div style="position:absolute;top:8px;left:16px;color:rgba(255,255,255,0.65);font-size:8.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase">INTERVENANT</div>
  <div style="position:absolute;top:24px;left:16px;color:#fff;font-size:17px;font-weight:800;letter-spacing:-0.3px">Prénom NOM</div>
  <div style="position:absolute;top:68px;left:16px;color:#1e3a8a;font-size:12.5px;font-weight:700">Rôle / Titre</div>
  <div style="position:absolute;top:92px;left:16px;right:16px;height:1.5px;background:#e2e8f0"></div>
  <div style="position:absolute;top:104px;left:16px;color:#64748b;font-size:11px">Organisation</div>
  <div style="position:absolute;bottom:14px;left:16px;color:#94a3b8;font-size:9px;font-family:monospace">BADGE-001</div>
  <div style="position:absolute;bottom:12px;right:14px;background:#dbeafe;color:#1e3a8a;font-size:8px;font-weight:800;padding:2px 8px;border-radius:4px;letter-spacing:0.5px">SPEAKER</div>
</div>` },
  { id: 'b-press', name: 'Presse', previewBg: '#111', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:#111;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:50px;background:#dc2626"></div>
  <div style="position:absolute;top:12px;left:16px;color:#fff;font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase">PRESSE</div>
  <div style="position:absolute;top:12px;right:14px;color:rgba(255,255,255,0.65);font-size:9px;font-weight:700;letter-spacing:1px">MEDIA PASS</div>
  <div style="position:absolute;top:60px;left:16px;color:#fff;font-size:21px;font-weight:800">Prénom NOM</div>
  <div style="position:absolute;top:88px;left:16px;color:#f87171;font-size:12px;font-weight:600">Publication / Média</div>
  <div style="position:absolute;top:110px;left:16px;right:16px;height:1px;background:rgba(255,255,255,0.1)"></div>
  <div style="position:absolute;top:120px;left:16px;color:rgba(255,255,255,0.45);font-size:11px">Rôle / Poste</div>
  <div style="position:absolute;bottom:15px;left:16px;color:rgba(255,255,255,0.25);font-size:9px;font-family:monospace;letter-spacing:1px">BADGE-001</div>
</div>` },
  { id: 'b-academic', name: 'Académique', previewBg: '#1e3a8a', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:#fff;font-family:'Georgia',serif;position:relative;overflow:hidden;border:1px solid #cbd5e1">
  <div style="position:absolute;top:0;left:0;right:0;height:70px;background:#1e3a8a"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:70px;background:linear-gradient(135deg,#1e3a8a,#1e40af)"></div>
  <div style="position:absolute;top:8px;left:0;right:0;text-align:center;color:rgba(255,255,255,0.65);font-size:8px;letter-spacing:2.5px;text-transform:uppercase">UNIVERSITÉ · CONFÉRENCE 2026</div>
  <div style="position:absolute;top:22px;left:0;right:0;text-align:center;color:#fff;font-size:18px;font-weight:700;letter-spacing:0.3px">Prénom NOM</div>
  <div style="position:absolute;top:46px;left:0;right:0;text-align:center;color:rgba(255,255,255,0.75);font-size:11px;font-style:italic">Chercheur(se) · Doctorant(e)</div>
  <div style="position:absolute;top:82px;left:0;right:0;text-align:center;color:#1e3a8a;font-size:12px;font-weight:700">Département / Laboratoire</div>
  <div style="position:absolute;top:100px;left:20px;right:20px;height:1px;background:#e2e8f0"></div>
  <div style="position:absolute;top:110px;left:0;right:0;text-align:center;color:#64748b;font-size:10.5px">Institution · Ville</div>
  <div style="position:absolute;bottom:16px;left:0;right:0;text-align:center;color:#94a3b8;font-size:9px;font-family:monospace">BADGE-001</div>
</div>` },
  { id: 'b-medical', name: 'Médical', previewBg: '#f0fdf4', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:#f0fdf4;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden;border:1px solid #bbf7d0">
  <div style="position:absolute;top:0;left:0;bottom:0;width:5px;background:#16a34a"></div>
  <div style="position:absolute;top:16px;left:18px;width:36px;height:36px;border-radius:50%;background:#16a34a;text-align:center;line-height:36px;color:#fff;font-size:18px;font-weight:800">+</div>
  <div style="position:absolute;top:18px;left:64px;color:#14532d;font-size:21px;font-weight:800">Prénom NOM</div>
  <div style="position:absolute;top:46px;left:64px;color:#16a34a;font-size:12px;font-weight:700">Médecin · Spécialité</div>
  <div style="position:absolute;top:74px;left:18px;right:18px;height:1px;background:#bbf7d0"></div>
  <div style="position:absolute;top:84px;left:18px;color:#374151;font-size:11px">Service / Établissement</div>
  <div style="position:absolute;top:104px;left:18px;color:#64748b;font-size:11px">✉  email@hopital.fr</div>
  <div style="position:absolute;top:122px;left:18px;color:#64748b;font-size:11px">☎  +33 1 00 00 00 00</div>
  <div style="position:absolute;bottom:14px;right:16px;background:#dcfce7;color:#15803d;font-size:8px;font-weight:800;padding:2px 8px;border-radius:4px;letter-spacing:0.5px">PROFESSIONNEL DE SANTÉ</div>
  <div style="position:absolute;bottom:14px;left:18px;color:#86efac;font-size:9px;font-family:monospace">BADGE-001</div>
</div>` },
  { id: 'b-festival', name: 'Festival', previewBg: '#581c87', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:linear-gradient(135deg,#581c87,#be185d,#ea580c);font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.06)"></div>
  <div style="position:absolute;bottom:-30px;left:-30px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.04)"></div>
  <div style="position:absolute;top:16px;left:18px;right:18px;text-align:center;color:rgba(255,255,255,0.7);font-size:8.5px;font-weight:800;letter-spacing:3px;text-transform:uppercase">✦ FESTIVAL 2026 ✦</div>
  <div style="position:absolute;top:36px;left:18px;right:18px;text-align:center;color:#fff;font-size:24px;font-weight:900;letter-spacing:-0.5px">Prénom NOM</div>
  <div style="position:absolute;top:70px;left:18px;right:18px;text-align:center;background:rgba(255,255,255,0.15);border-radius:20px;padding:4px 0;color:#fff;font-size:11px;font-weight:700">Artiste · Rôle</div>
  <div style="position:absolute;top:106px;left:18px;right:18px;height:1px;background:rgba(255,255,255,0.2)"></div>
  <div style="position:absolute;top:116px;left:18px;right:18px;text-align:center;color:rgba(255,255,255,0.6);font-size:10.5px">Scène / Zone · Jour</div>
  <div style="position:absolute;bottom:14px;left:18px;color:rgba(255,255,255,0.35);font-size:9px;font-family:monospace">BADGE-001</div>
</div>` },
  { id: 'b-corporate-light', name: 'Corporate Clair', previewBg: '#f8fafc', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:#fff;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden;border:1px solid #e2e8f0">
  <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#6366f1,#a855f7,#ec4899)"></div>
  <div style="position:absolute;top:20px;left:20px;right:20px;display:flex;align-items:center;gap:12px">
    <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#a855f7);text-align:center;line-height:44px;color:#fff;font-size:20px;font-weight:800;flex-shrink:0">N</div>
    <div>
      <div style="color:#0f172a;font-size:18px;font-weight:800;line-height:1.2">Prénom NOM</div>
      <div style="color:#6366f1;font-size:11.5px;font-weight:600">Titre · Département</div>
    </div>
  </div>
  <div style="position:absolute;top:84px;left:20px;right:20px;height:1px;background:#f1f5f9"></div>
  <div style="position:absolute;top:96px;left:20px;color:#64748b;font-size:11px">✉  email@entreprise.com</div>
  <div style="position:absolute;top:114px;left:20px;color:#64748b;font-size:11px">☎  +33 6 00 00 00 00</div>
  <div style="position:absolute;top:132px;left:20px;color:#64748b;font-size:11px">⬡  www.entreprise.com</div>
  <div style="position:absolute;bottom:20px;left:20px;color:#94a3b8;font-size:9px;font-family:monospace">BADGE-001</div>
  <div style="position:absolute;bottom:20px;right:18px;color:#94a3b8;font-size:9px">Entreprise SAS</div>
</div>` },
  { id: 'b-tech', name: 'Tech Conference', previewBg: '#020617', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:#020617;font-family:'Courier New',monospace;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#22d3ee,#6366f1,#a855f7)"></div>
  <div style="position:absolute;top:10px;left:12px;color:#22d3ee;font-size:8px;opacity:0.4">// attendee.ts</div>
  <div style="position:absolute;top:24px;left:12px;color:#a78bfa;font-size:10px">const <span style="color:#67e8f9">name</span> = <span style="color:#86efac">"Prénom NOM"</span>;</div>
  <div style="position:absolute;top:40px;left:12px;color:#a78bfa;font-size:10px">const <span style="color:#67e8f9">role</span> = <span style="color:#86efac">"Dev Full-Stack"</span>;</div>
  <div style="position:absolute;top:58px;left:12px;right:12px;height:1px;background:rgba(99,102,241,0.3)"></div>
  <div style="position:absolute;top:68px;left:12px;color:#94a3b8;font-size:9.5px">org: <span style="color:#f1f5f9">Entreprise Tech</span></div>
  <div style="position:absolute;top:84px;left:12px;color:#94a3b8;font-size:9.5px">email: <span style="color:#67e8f9">dev@exemple.com</span></div>
  <div style="position:absolute;top:100px;left:12px;color:#94a3b8;font-size:9.5px">badge_id: <span style="color:#fbbf24">"BADGE-001"</span></div>
  <div style="position:absolute;bottom:14px;left:12px;color:rgba(99,102,241,0.4);font-size:9px">✓ TECH CONF 2026</div>
</div>` },
  { id: 'b-sports', name: 'Sports / Équipe', previewBg: '#7f1d1d', w: 340, h: 210, html:
`<div style="width:340px;height:210px;background:#7f1d1d;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(45deg,rgba(255,255,255,0.02),rgba(255,255,255,0.02) 1px,transparent 1px,transparent 8px)"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:6px;background:#ef4444"></div>
  <div style="position:absolute;top:14px;left:16px;color:rgba(255,255,255,0.55);font-size:8px;font-weight:800;letter-spacing:3px;text-transform:uppercase">ÉQUIPE · SAISON 2026</div>
  <div style="position:absolute;top:30px;left:16px;color:#fff;font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.3px">Prénom NOM</div>
  <div style="position:absolute;top:60px;left:16px;color:#fca5a5;font-size:13px;font-weight:700">POSTE · #NUMÉRO</div>
  <div style="position:absolute;top:84px;left:16px;right:16px;height:1px;background:rgba(255,255,255,0.15)"></div>
  <div style="position:absolute;top:94px;left:16px;color:rgba(255,255,255,0.5);font-size:11px">Club / Association</div>
  <div style="position:absolute;bottom:14px;right:14px;background:#ef4444;color:#fff;font-size:8.5px;font-weight:800;padding:3px 10px;border-radius:4px;letter-spacing:1px">MEMBRE</div>
  <div style="position:absolute;bottom:14px;left:16px;color:rgba(255,255,255,0.25);font-size:9px;font-family:monospace">BADGE-001</div>
</div>` },
];

const CARTE_DESIGN_TPLS: DesignTpl[] = [
  { id: 'c-modern', name: 'Moderne Dark', previewBg: '#0f172a', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:#0f172a;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(to bottom,#6366f1,#a855f7)"></div>
  <div style="position:absolute;top:0;left:5px;right:0;height:2px;background:linear-gradient(90deg,#6366f1,transparent)"></div>
  <div style="position:absolute;top:36px;right:26px;width:54px;height:54px;border-radius:50%;background:#6366f1;text-align:center;line-height:54px;color:#fff;font-size:24px;font-weight:800">N</div>
  <div style="position:absolute;top:38px;left:26px;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px">Prénom NOM</div>
  <div style="position:absolute;top:72px;left:26px;color:#818cf8;font-size:13.5px;font-weight:600">Directeur Marketing · Entreprise</div>
  <div style="position:absolute;top:106px;left:26px;right:26px;height:1px;background:rgba(255,255,255,0.1)"></div>
  <div style="position:absolute;top:122px;left:26px;color:rgba(255,255,255,0.5);font-size:12px">✉  email@exemple.com</div>
  <div style="position:absolute;top:148px;left:26px;color:rgba(255,255,255,0.5);font-size:12px">☎  +33 6 00 00 00 00</div>
  <div style="position:absolute;top:174px;left:26px;color:rgba(255,255,255,0.5);font-size:12px">⬡  www.exemple.com</div>
  <div style="position:absolute;top:200px;left:26px;color:rgba(255,255,255,0.38);font-size:12px">◉  Paris, France</div>
  <div style="position:absolute;bottom:18px;right:22px;color:rgba(255,255,255,0.1);font-size:8.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">Creative AI Studio</div>
</div>` },
  { id: 'c-classic', name: 'Classique Pro', previewBg: '#ffffff', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:#fff;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:100px;background:#1d4ed8"></div>
  <div style="position:absolute;top:0;right:0;width:80px;height:100px;background:rgba(255,255,255,0.08)"></div>
  <div style="position:absolute;top:18px;left:26px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.3px">Prénom NOM</div>
  <div style="position:absolute;top:52px;left:26px;color:rgba(255,255,255,0.8);font-size:13px;font-weight:500">Directeur Marketing · Entreprise</div>
  <div style="position:absolute;top:116px;left:26px;color:#1d4ed8;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Email</div>
  <div style="position:absolute;top:130px;left:26px;color:#1e293b;font-size:12.5px">email@exemple.com</div>
  <div style="position:absolute;top:158px;left:26px;color:#1d4ed8;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Téléphone</div>
  <div style="position:absolute;top:172px;left:26px;color:#1e293b;font-size:12.5px">+33 6 00 00 00 00</div>
  <div style="position:absolute;top:116px;left:280px;color:#1d4ed8;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Site web</div>
  <div style="position:absolute;top:130px;left:280px;color:#1e293b;font-size:12.5px">www.exemple.com</div>
  <div style="position:absolute;top:158px;left:280px;color:#1d4ed8;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Adresse</div>
  <div style="position:absolute;top:172px;left:280px;color:#1e293b;font-size:12.5px">Paris, France</div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:5px;background:#1d4ed8"></div>
</div>` },
  { id: 'c-minimal', name: 'Minimal Épuré', previewBg: '#ffffff', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:#fff;font-family:'Georgia',serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50px;left:40px;color:#0f172a;font-size:30px;font-weight:700;letter-spacing:-0.5px">Prénom NOM</div>
  <div style="position:absolute;top:92px;left:40px;width:200px;height:2.5px;background:#10b981"></div>
  <div style="position:absolute;top:108px;left:40px;color:#64748b;font-size:13.5px;font-style:italic">Directeur Marketing</div>
  <div style="position:absolute;top:165px;left:40px;color:#374151;font-size:12px">email@exemple.com</div>
  <div style="position:absolute;top:188px;left:40px;color:#374151;font-size:12px">+33 6 00 00 00 00</div>
  <div style="position:absolute;top:165px;left:290px;color:#374151;font-size:12px">www.exemple.com</div>
  <div style="position:absolute;top:188px;left:290px;color:#374151;font-size:12px">Paris, France</div>
  <div style="position:absolute;bottom:32px;right:32px;width:44px;height:44px;border-radius:50%;background:#10b981"></div>
</div>` },
  { id: 'c-premium', name: 'Premium Gold', previewBg: '#1c1008', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:linear-gradient(135deg,#1c1008,#0f0a04);font-family:'Georgia',serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:14px;left:14px;right:14px;bottom:14px;border:1px solid rgba(245,158,11,0.28);border-radius:4px"></div>
  <div style="position:absolute;top:34px;right:32px;width:56px;height:56px;border-radius:50%;border:1.5px solid rgba(245,158,11,0.5);text-align:center;line-height:56px;color:#f59e0b;font-size:24px;font-weight:700">N</div>
  <div style="position:absolute;top:36px;left:32px;color:#fef3c7;font-size:26px;font-weight:700;letter-spacing:0.5px">Prénom NOM</div>
  <div style="position:absolute;top:70px;left:32px;color:#f59e0b;font-size:12.5px;font-style:italic">Directeur Général · Entreprise</div>
  <div style="position:absolute;top:100px;left:32px;right:32px;height:1px;background:linear-gradient(90deg,rgba(245,158,11,0.35),transparent)"></div>
  <div style="position:absolute;top:118px;left:32px;color:rgba(254,243,199,0.5);font-size:11.5px">✉  email@exemple.com</div>
  <div style="position:absolute;top:142px;left:32px;color:rgba(254,243,199,0.5);font-size:11.5px">☎  +33 6 00 00 00 00</div>
  <div style="position:absolute;top:166px;left:32px;color:rgba(254,243,199,0.5);font-size:11.5px">⬡  www.exemple.com</div>
  <div style="position:absolute;top:190px;left:32px;color:rgba(254,243,199,0.38);font-size:11.5px">◉  Paris, France</div>
  <div style="position:absolute;bottom:22px;left:0;right:0;text-align:center;color:rgba(245,158,11,0.2);font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase">MEDI EXPRESS STUDIO</div>
</div>` },
  { id: 'c-teal', name: 'Creative Teal', previewBg: '#0d9488', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:#fff;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;width:180px;bottom:0;background:#0d9488"></div>
  <div style="position:absolute;top:32px;left:24px;width:70px;height:70px;border-radius:50%;background:rgba(255,255,255,0.2);border:2.5px solid rgba(255,255,255,0.5);text-align:center;line-height:70px;color:#fff;font-size:28px;font-weight:800">N</div>
  <div style="position:absolute;top:112px;left:0;width:180px;text-align:center;color:rgba(255,255,255,0.9);font-size:13px;font-weight:700">Prénom NOM</div>
  <div style="position:absolute;top:134px;left:0;width:180px;text-align:center;color:rgba(255,255,255,0.65);font-size:10.5px">Directeur Marketing</div>
  <div style="position:absolute;top:50px;left:200px;color:#0d9488;font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Email</div>
  <div style="position:absolute;top:66px;left:200px;color:#374151;font-size:12px">email@exemple.com</div>
  <div style="position:absolute;top:96px;left:200px;color:#0d9488;font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Téléphone</div>
  <div style="position:absolute;top:112px;left:200px;color:#374151;font-size:12px">+33 6 00 00 00 00</div>
  <div style="position:absolute;top:142px;left:200px;color:#0d9488;font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Web</div>
  <div style="position:absolute;top:158px;left:200px;color:#374151;font-size:12px">www.exemple.com</div>
  <div style="position:absolute;top:188px;left:200px;color:#374151;font-size:12px">Paris, France</div>
  <div style="position:absolute;bottom:0;left:180px;right:0;height:4px;background:#0d9488"></div>
</div>` },
  { id: 'c-bold', name: 'Bold Gradient', previewBg: '#7c3aed', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:linear-gradient(135deg,#7c3aed,#ec4899);font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.07)"></div>
  <div style="position:absolute;bottom:-40px;left:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.05)"></div>
  <div style="position:absolute;top:36px;left:30px;color:#fff;font-size:30px;font-weight:900;letter-spacing:-0.5px">Prénom NOM</div>
  <div style="position:absolute;top:76px;left:30px;color:rgba(255,255,255,0.75);font-size:13.5px;font-weight:500">Directeur Marketing · Entreprise</div>
  <div style="position:absolute;top:112px;left:30px;right:30px;height:1px;background:rgba(255,255,255,0.2)"></div>
  <div style="position:absolute;top:128px;left:30px;color:rgba(255,255,255,0.7);font-size:12px">✉  email@exemple.com</div>
  <div style="position:absolute;top:152px;left:30px;color:rgba(255,255,255,0.7);font-size:12px">☎  +33 6 00 00 00 00</div>
  <div style="position:absolute;top:176px;left:30px;color:rgba(255,255,255,0.7);font-size:12px">⬡  www.exemple.com</div>
  <div style="position:absolute;top:200px;left:30px;color:rgba(255,255,255,0.55);font-size:12px">◉  Paris, France</div>
</div>` },
  { id: 'c-juridique', name: 'Juridique / Avocat', previewBg: '#1c1a18', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:#1c1a18;font-family:'Georgia',serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#b45309,#d97706,#b45309)"></div>
  <div style="position:absolute;top:16px;left:28px;right:28px;bottom:16px;border:1px solid rgba(180,83,9,0.25);border-radius:3px"></div>
  <div style="position:absolute;top:34px;right:36px;color:#d97706;font-size:28px">⚖</div>
  <div style="position:absolute;top:36px;left:36px;color:#fef3c7;font-size:24px;font-weight:700;letter-spacing:0.5px">Prénom NOM</div>
  <div style="position:absolute;top:68px;left:36px;color:#d97706;font-size:12px;font-style:italic">Avocat au Barreau de Paris</div>
  <div style="position:absolute;top:98px;left:36px;right:36px;height:1px;background:linear-gradient(90deg,rgba(180,83,9,0.4),transparent)"></div>
  <div style="position:absolute;top:116px;left:36px;color:#d97706;font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Cabinet</div>
  <div style="position:absolute;top:130px;left:36px;color:rgba(254,243,199,0.7);font-size:12px">Cabinet NOM · Droit des Affaires</div>
  <div style="position:absolute;top:158px;left:36px;color:#d97706;font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Contact</div>
  <div style="position:absolute;top:172px;left:36px;color:rgba(254,243,199,0.6);font-size:11.5px">✉  avocat@cabinet.fr</div>
  <div style="position:absolute;top:192px;left:36px;color:rgba(254,243,199,0.6);font-size:11.5px">☎  +33 1 00 00 00 00</div>
  <div style="position:absolute;top:212px;left:36px;color:rgba(254,243,199,0.45);font-size:11.5px">◉  75008 Paris — Tour Eiffel</div>
  <div style="position:absolute;bottom:22px;left:0;right:0;text-align:center;color:rgba(180,83,9,0.2);font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase">MEDI EXPRESS STUDIO</div>
</div>` },
  { id: 'c-medical', name: 'Médecin / Santé', previewBg: '#f0fdf4', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:#fff;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:88px;background:linear-gradient(135deg,#059669,#10b981)"></div>
  <div style="position:absolute;top:18px;right:28px;width:52px;height:52px;border-radius:50%;border:2.5px solid rgba(255,255,255,0.6);text-align:center;line-height:52px;color:#fff;font-size:22px;font-weight:800">+</div>
  <div style="position:absolute;top:20px;left:26px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.3px">Dr Prénom NOM</div>
  <div style="position:absolute;top:52px;left:26px;color:rgba(255,255,255,0.82);font-size:12.5px">Médecin Généraliste · Spécialité</div>
  <div style="position:absolute;top:104px;left:26px;color:#059669;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Cabinet médical</div>
  <div style="position:absolute;top:118px;left:26px;color:#374151;font-size:12.5px">Cabinet NOM · Adresse complète</div>
  <div style="position:absolute;top:146px;left:26px;color:#059669;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Contact & Horaires</div>
  <div style="position:absolute;top:160px;left:26px;color:#374151;font-size:12px">☎  +33 1 00 00 00 00</div>
  <div style="position:absolute;top:180px;left:26px;color:#374151;font-size:12px">✉  contact@cabinet.fr</div>
  <div style="position:absolute;top:160px;left:280px;color:#374151;font-size:12px">Lun–Ven : 9h–19h</div>
  <div style="position:absolute;top:180px;left:280px;color:#374151;font-size:12px">Sam : 9h–12h</div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:5px;background:#10b981"></div>
</div>` },
  { id: 'c-immo', name: 'Immobilier', previewBg: '#1e293b', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:#1e293b;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div>
  <div style="position:absolute;top:32px;left:28px;right:28px;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.3px">Prénom NOM</div>
  <div style="position:absolute;top:66px;left:28px;color:#fbbf24;font-size:13px;font-weight:600">Agent Immobilier · Négociateur</div>
  <div style="position:absolute;top:96px;left:28px;right:28px;height:1px;background:rgba(251,191,36,0.2)"></div>
  <div style="position:absolute;top:114px;left:28px;color:rgba(255,255,255,0.55);font-size:12px">🏠  Agence Immobilière NOM</div>
  <div style="position:absolute;top:138px;left:28px;color:rgba(255,255,255,0.55);font-size:12px">✉  agent@agence.fr</div>
  <div style="position:absolute;top:162px;left:28px;color:rgba(255,255,255,0.55);font-size:12px">☎  +33 6 00 00 00 00</div>
  <div style="position:absolute;top:186px;left:28px;color:rgba(255,255,255,0.4);font-size:12px">⬡  www.agence.fr</div>
  <div style="position:absolute;top:210px;left:28px;color:rgba(255,255,255,0.38);font-size:12px">◉  Paris · Île-de-France</div>
  <div style="position:absolute;top:28px;right:28px;width:56px;height:56px;border-radius:12px;border:1.5px solid rgba(251,191,36,0.4);text-align:center;line-height:56px;color:#fbbf24;font-size:26px">🏢</div>
  <div style="position:absolute;bottom:18px;right:22px;color:rgba(251,191,36,0.15);font-size:8.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Creative AI Studio</div>
</div>` },
  { id: 'c-dev', name: 'Développeur / Tech', previewBg: '#020617', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:#020617;font-family:'Courier New',monospace;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#22d3ee,#6366f1,#a855f7)"></div>
  <div style="position:absolute;top:16px;left:22px;color:#64748b;font-size:10px">// contact.json</div>
  <div style="position:absolute;top:34px;left:22px;color:#94a3b8;font-size:11.5px">{</div>
  <div style="position:absolute;top:52px;left:40px;color:#a78bfa;font-size:11px">"name": <span style="color:#86efac">"Prénom NOM"</span>,</div>
  <div style="position:absolute;top:70px;left:40px;color:#a78bfa;font-size:11px">"role": <span style="color:#86efac">"Développeur Full-Stack"</span>,</div>
  <div style="position:absolute;top:88px;left:40px;color:#a78bfa;font-size:11px">"stack": <span style="color:#fbbf24">["Java","Angular","Docker"]</span>,</div>
  <div style="position:absolute;top:106px;left:40px;color:#a78bfa;font-size:11px">"email": <span style="color:#67e8f9">"dev@exemple.com"</span>,</div>
  <div style="position:absolute;top:124px;left:40px;color:#a78bfa;font-size:11px">"phone": <span style="color:#86efac">"+33 6 00 00 00 00"</span>,</div>
  <div style="position:absolute;top:142px;left:40px;color:#a78bfa;font-size:11px">"github": <span style="color:#67e8f9">"github.com/username"</span>,</div>
  <div style="position:absolute;top:160px;left:40px;color:#a78bfa;font-size:11px">"location": <span style="color:#86efac">"Paris, France"</span></div>
  <div style="position:absolute;top:178px;left:22px;color:#94a3b8;font-size:11.5px">}</div>
  <div style="position:absolute;bottom:16px;right:20px;color:rgba(99,102,241,0.3);font-size:9px;font-family:monospace">// v2.6.0 · MIT</div>
</div>` },
  { id: 'c-artiste', name: 'Artiste / Créatif', previewBg: '#fdf4ff', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:#fdf4ff;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;width:180px;height:100%;background:linear-gradient(180deg,#a855f7,#ec4899)"></div>
  <div style="position:absolute;top:40px;left:0;width:180px;text-align:center;color:#fff;font-size:40px">🎨</div>
  <div style="position:absolute;top:92px;left:0;width:180px;text-align:center;color:rgba(255,255,255,0.9);font-size:13px;font-weight:700">Prénom NOM</div>
  <div style="position:absolute;top:114px;left:0;width:180px;text-align:center;color:rgba(255,255,255,0.65);font-size:10.5px">Artiste · Designer</div>
  <div style="position:absolute;top:40px;left:200px;color:#7c3aed;font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Portfolio</div>
  <div style="position:absolute;top:54px;left:200px;color:#374151;font-size:12px">www.portfolio.fr</div>
  <div style="position:absolute;top:82px;left:200px;color:#7c3aed;font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Contact</div>
  <div style="position:absolute;top:96px;left:200px;color:#374151;font-size:12px">artiste@exemple.com</div>
  <div style="position:absolute;top:116px;left:200px;color:#374151;font-size:12px">+33 6 00 00 00 00</div>
  <div style="position:absolute;top:144px;left:200px;color:#7c3aed;font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Réseaux</div>
  <div style="position:absolute;top:158px;left:200px;color:#374151;font-size:12px">@instagram · @behance</div>
  <div style="position:absolute;bottom:0;left:180px;right:0;height:4px;background:linear-gradient(90deg,#a855f7,#ec4899)"></div>
</div>` },
  { id: 'c-consultant', name: 'Consultant', previewBg: '#fafaf9', w: 530, h: 330, html:
`<div style="width:530px;height:330px;background:#fafaf9;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden;border:1px solid #e7e5e4">
  <div style="position:absolute;top:0;left:0;bottom:0;width:130px;background:#1c1917"></div>
  <div style="position:absolute;top:0;right:0;width:30px;height:100%;background:#f5f5f4"></div>
  <div style="position:absolute;top:36px;left:18px;width:94px;height:94px;border-radius:50%;border:2px solid rgba(255,255,255,0.2);text-align:center;line-height:94px;color:#d6d3d1;font-size:40px;font-weight:700">N</div>
  <div style="position:absolute;top:144px;left:0;width:130px;text-align:center;color:rgba(255,255,255,0.55);font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">CONSULTANT</div>
  <div style="position:absolute;top:34px;left:148px;color:#1c1917;font-size:23px;font-weight:800;letter-spacing:-0.3px">Prénom NOM</div>
  <div style="position:absolute;top:66px;left:148px;color:#78716c;font-size:12.5px">Senior Consultant · Management</div>
  <div style="position:absolute;top:96px;left:148px;right:20px;height:1.5px;background:#e7e5e4"></div>
  <div style="position:absolute;top:110px;left:148px;color:#57534e;font-size:11.5px">✉  consultant@cabinet.fr</div>
  <div style="position:absolute;top:130px;left:148px;color:#57534e;font-size:11.5px">☎  +33 6 00 00 00 00</div>
  <div style="position:absolute;top:150px;left:148px;color:#57534e;font-size:11.5px">⬡  www.cabinet.fr</div>
  <div style="position:absolute;top:170px;left:148px;color:#a8a29e;font-size:11.5px">◉  Paris, France</div>
</div>` },
];

const LOGO_DESIGN_TPLS: DesignTpl[] = [
  { id: 'l-wordmark', name: 'Wordmark', previewBg: '#ffffff', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#fff;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);text-align:center;white-space:nowrap">
    <span style="font-size:58px;font-weight:900;color:#6366f1;letter-spacing:-1px">M</span><span style="font-size:58px;font-weight:900;color:#0f172a;letter-spacing:-1px">ediSearch</span>
  </div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,20px);width:300px;height:3px;background:linear-gradient(90deg,#6366f1,#a855f7)"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,36px);text-align:center;white-space:nowrap;color:#94a3b8;font-size:13px;letter-spacing:3px;text-transform:uppercase">Intelligence Artificielle</div>
</div>` },
  { id: 'l-monogram', name: 'Monogramme', previewBg: '#f8fafc', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#f8fafc;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
    <div style="width:110px;height:110px;border-radius:50%;border:3px solid #6366f1;margin:0 auto;position:relative;background:rgba(99,102,241,0.08)">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#0f172a;font-size:48px;font-weight:900;letter-spacing:-2px">MS</div>
    </div>
    <div style="margin-top:14px;color:#0f172a;font-size:18px;font-weight:700;letter-spacing:2px;text-transform:uppercase">CREATIVE AI STUDIO</div>
    <div style="color:#94a3b8;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px">Intelligence Artificielle</div>
  </div>
</div>` },
  { id: 'l-badge', name: 'Badge Circulaire', previewBg: '#f8fafc', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#f8fafc;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
    <div style="width:120px;height:120px;border-radius:50%;border:4px solid #6366f1;margin:0 auto;position:relative">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);color:#6366f1;font-size:42px;font-weight:900">MS</div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,14px);color:#0f172a;font-size:11px;font-weight:800;letter-spacing:1.5px;white-space:nowrap;text-transform:uppercase">CREATIVE AI STUDIO</div>
    </div>
    <div style="margin-top:12px;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase">Intelligence Artificielle</div>
  </div>
</div>` },
  { id: 'l-icon', name: 'Icône + Texte', previewBg: '#ffffff', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#fff;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:20px;white-space:nowrap">
    <div style="width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,#6366f1,#a855f7);text-align:center;line-height:72px;color:#fff;font-size:34px;flex-shrink:0">◈</div>
    <div>
      <div style="color:#0f172a;font-size:32px;font-weight:900;letter-spacing:-0.5px;line-height:1">Creative AI Studio</div>
      <div style="color:#6366f1;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px">Intelligence Artificielle</div>
    </div>
  </div>
</div>` },
  { id: 'l-split', name: 'Split Couleurs', previewBg: '#ffffff', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#fff;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);text-align:center;white-space:nowrap">
    <span style="font-size:56px;font-weight:900;color:#6366f1">Media</span><span style="font-size:56px;font-weight:900;color:#0f172a">Search</span>
  </div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,20px);text-align:center;white-space:nowrap;color:#94a3b8;font-size:12px;letter-spacing:4px;text-transform:uppercase">Intelligence Artificielle</div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,8px);width:60px;height:2px;background:#6366f1"></div>
</div>` },
  { id: 'l-dark', name: 'Dark Mode', previewBg: '#0f172a', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#0f172a;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;white-space:nowrap">
    <div style="display:inline-flex;align-items:center;gap:14px">
      <div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#a855f7);text-align:center;line-height:52px;color:#fff;font-size:22px;font-weight:900">M</div>
      <div style="text-align:left">
        <div style="color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.3px;line-height:1.1">Creative AI Studio</div>
        <div style="color:#818cf8;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;margin-top:3px">Intelligence Artificielle</div>
      </div>
    </div>
  </div>
</div>` },
  { id: 'l-shield', name: 'Bouclier / Sécurité', previewBg: '#f8fafc', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#f8fafc;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
    <div style="width:90px;height:100px;margin:0 auto;position:relative">
      <svg viewBox="0 0 90 100" style="width:90px;height:100px;position:absolute;top:0;left:0">
        <path d="M45,2 L85,18 L85,52 C85,74 65,92 45,98 C25,92 5,74 5,52 L5,18 Z" fill="#1e3a8a" opacity="0.9"/>
      </svg>
      <div style="position:absolute;top:28px;left:0;right:0;text-align:center;color:#fff;font-size:28px;font-weight:900">MS</div>
    </div>
    <div style="margin-top:10px;color:#1e3a8a;font-size:18px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Creative AI Studio</div>
    <div style="color:#64748b;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:4px">Intelligence Artificielle</div>
  </div>
</div>` },
  { id: 'l-diamond', name: 'Diamant Premium', previewBg: '#fafafa', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#fafafa;font-family:'Georgia',serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
    <div style="width:80px;height:80px;margin:0 auto;background:linear-gradient(135deg,#6366f1,#a855f7);transform:rotate(45deg);border-radius:8px;display:flex;align-items:center;justify-content:center">
      <div style="transform:rotate(-45deg);color:#fff;font-size:26px;font-weight:900;letter-spacing:-1px">MS</div>
    </div>
    <div style="margin-top:14px;color:#0f172a;font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase">CREATIVE AI STUDIO</div>
    <div style="color:#6366f1;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-top:5px">Intelligence Artificielle</div>
  </div>
</div>` },
  { id: 'l-hexagon', name: 'Hexagone Tech', previewBg: '#f0f9ff', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#f0f9ff;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;display:flex;align-items:center;gap:18px">
    <div style="position:relative;width:80px;height:90px;flex-shrink:0">
      <svg viewBox="0 0 80 90" style="width:80px;height:90px;position:absolute;top:0;left:0">
        <polygon points="40,2 78,22 78,68 40,88 2,68 2,22" fill="#0284c7" stroke="#0ea5e9" stroke-width="2"/>
      </svg>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:22px;font-weight:900">MS</div>
    </div>
    <div style="text-align:left">
      <div style="color:#0f172a;font-size:28px;font-weight:800;letter-spacing:-0.3px;line-height:1">Creative AI Studio</div>
      <div style="width:100%;height:2px;background:#0284c7;margin:6px 0"></div>
      <div style="color:#0284c7;font-size:11px;letter-spacing:2.5px;text-transform:uppercase">Intelligence Artificielle</div>
    </div>
  </div>
</div>` },
  { id: 'l-framed', name: 'Texte Encadré', previewBg: '#1e293b', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#1e293b;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:30px;left:30px;right:30px;bottom:30px;border:2px solid rgba(99,102,241,0.4);border-radius:4px"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;width:100%">
    <div style="display:inline-block;background:#6366f1;color:#fff;font-size:10px;font-weight:800;letter-spacing:3px;padding:4px 20px;text-transform:uppercase;margin-bottom:10px">CREATIVE AI STUDIO</div>
    <div style="color:#fff;font-size:38px;font-weight:900;letter-spacing:-1px;line-height:1">Media<span style="color:#a5b4fc">Search</span></div>
    <div style="color:rgba(165,180,252,0.6);font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:8px">Intelligence Artificielle</div>
  </div>
</div>` },
  { id: 'l-gradient-wave', name: 'Wave Gradient', previewBg: '#6366f1', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7,#ec4899);font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:-50px;left:-50px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,0.07)"></div>
  <div style="position:absolute;bottom:-40px;right:-40px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.05)"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);text-align:center;white-space:nowrap">
    <div style="color:#fff;font-size:52px;font-weight:900;letter-spacing:-1.5px;text-shadow:0 2px 20px rgba(0,0,0,0.2)">Creative AI Studio</div>
  </div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,20px);text-align:center;white-space:nowrap;color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:4px;text-transform:uppercase">Intelligence Artificielle</div>
</div>` },
  { id: 'l-square-letter', name: 'Lettre en Carré', previewBg: '#f8fafc', w: 480, h: 260, html:
`<div style="width:480px;height:260px;background:#f8fafc;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:20px;white-space:nowrap">
    <div style="width:90px;height:90px;border-radius:18px;background:#0f172a;text-align:center;line-height:90px;color:#fff;font-size:50px;font-weight:900;flex-shrink:0">M</div>
    <div style="text-align:left">
      <div style="color:#0f172a;font-size:22px;font-weight:800;letter-spacing:-0.3px;line-height:1.2">Creative AI Studio</div>
      <div style="color:#6366f1;font-size:10.5px;letter-spacing:2px;text-transform:uppercase;margin-top:5px;font-weight:700">Intelligence Artificielle</div>
      <div style="width:120px;height:2.5px;background:linear-gradient(90deg,#6366f1,#a855f7);border-radius:2px;margin-top:6px"></div>
    </div>
  </div>
</div>` },
];

// ═══════════════════════════════════════════════════
// CV TEMPLATE GALLERY
// ═══════════════════════════════════════════════════
interface CvTpl {
  id: string;
  name: string;
  category: string;   // 'moderne'|'ats'|'minimaliste'|'creatif'|'corporate'|'dev'|'designer'|'marketing'|'etudiant'|'executive'|'europeen'|'nb'
  tags: string[];
  withPhoto: boolean;
  atsScore: number;   // 0-100
  expLevels: string[];// 'none'|'1-2'|'3-5'|'5-10'|'10-15'|'15+'
  domains: string[];  // [] = all
  preview: string;    // short inline CSS preview hint (accent color)
  html: string;
}

const CV_DOMAINS = [
  { value: 'all',          label: 'Tous les domaines' },
  { value: 'tech',         label: 'Informatique / Tech' },
  { value: 'marketing',    label: 'Marketing / Comm' },
  { value: 'finance',      label: 'Finance / Comptabilité' },
  { value: 'rh',           label: 'RH / Recrutement' },
  { value: 'design',       label: 'Design / Créatif' },
  { value: 'sante',        label: 'Santé / Médical' },
  { value: 'juridique',    label: 'Juridique / Droit' },
  { value: 'education',    label: 'Éducation / Formation' },
  { value: 'commerce',     label: 'Commerce / Vente' },
  { value: 'logistique',   label: 'Logistique / Supply' },
  { value: 'ingenierie',   label: 'Ingénierie / BTP' },
  { value: 'art',          label: 'Art / Culture' },
];

const CV_EXP_OPTIONS = [
  { value: 'all',   label: 'Toute expérience' },
  { value: 'none',  label: 'Aucune (étudiant)' },
  { value: '1-2',   label: '1 – 2 ans' },
  { value: '3-5',   label: '3 – 5 ans' },
  { value: '5-10',  label: '5 – 10 ans' },
  { value: '10-15', label: '10 – 15 ans' },
  { value: '15+',   label: '15 ans et plus' },
];

const CV_TEMPLATES: CvTpl[] = [
  // ── 1. Moderne Violet ──────────────────────────────────────────────────────
  {
    id: 'moderne-violet', name: 'Moderne Violet', category: 'moderne',
    tags: ['Moderne', 'Coloré'], withPhoto: false, atsScore: 85,
    expLevels: ['1-2','3-5','5-10'], domains: [],
    preview: '#7c3aed',
    html: `<div style="font-family:'Calibri',sans-serif;max-width:760px;margin:0 auto">
<div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:2rem 2.5rem;color:#fff">
  <h1 style="margin:0;font-size:2rem;font-weight:900;letter-spacing:-1px">Prénom NOM</h1>
  <p style="margin:.35rem 0 0;font-size:1rem;opacity:.88;font-weight:500">Titre du poste recherché</p>
  <p style="margin:.6rem 0 0;font-size:.82rem;opacity:.75">📧 email@exemple.com &nbsp;|&nbsp; 📞 +33 6 00 00 00 00 &nbsp;|&nbsp; 📍 Ville, France</p>
</div>
<div style="padding:1.75rem 2.5rem;background:#fff">
  <h2 style="font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#7c3aed;margin:0 0 .75rem;border-bottom:2px solid #ede9fe;padding-bottom:.4rem">🎓 Formation</h2>
  <p style="margin:0 0 .3rem"><strong>Master Informatique</strong> — Université Paris-Saclay</p>
  <p style="margin:0;font-size:.85rem;color:#64748b">2022 – 2024 · Major de promotion</p>
  <h2 style="font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#7c3aed;margin:1.25rem 0 .75rem;border-bottom:2px solid #ede9fe;padding-bottom:.4rem">💼 Expérience</h2>
  <p style="margin:0 0 .3rem"><strong>Développeur Full-Stack</strong> — Entreprise XYZ</p>
  <p style="margin:0 0 .35rem;font-size:.85rem;color:#64748b">2024 – présent · Paris</p>
  <ul style="margin:.35rem 0;padding-left:1.4rem;font-size:.9rem"><li>Développement APIs REST Spring Boot + Angular</li><li>Intégration services IA (Python/FastAPI)</li></ul>
  <h2 style="font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#7c3aed;margin:1.25rem 0 .75rem;border-bottom:2px solid #ede9fe;padding-bottom:.4rem">🛠️ Compétences</h2>
  <div style="display:flex;flex-wrap:wrap;gap:.4rem">
    ${['Java','Python','Angular','TypeScript','Spring Boot','Docker','SQL','Git'].map(s=>`<span style="background:#f3f0ff;color:#7c3aed;padding:.2rem .6rem;border-radius:4px;font-size:.78rem;font-weight:700">${s}</span>`).join('')}
  </div>
  <h2 style="font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#7c3aed;margin:1.25rem 0 .75rem;border-bottom:2px solid #ede9fe;padding-bottom:.4rem">🌍 Langues</h2>
  <p style="margin:0;font-size:.9rem">Français (natif) &nbsp;·&nbsp; Anglais (courant C1) &nbsp;·&nbsp; Espagnol (B1)</p>
</div></div>`,
  },

  // ── 2. ATS Pro ──────────────────────────────────────────────────────────────
  {
    id: 'ats-pro', name: 'ATS Pro', category: 'ats',
    tags: ['ATS-friendly', 'Professionnel'], withPhoto: false, atsScore: 99,
    expLevels: ['1-2','3-5','5-10','10-15','15+'], domains: [],
    preview: '#1e3a8a',
    html: `<div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;padding:2rem;color:#111">
<h1 style="margin:0 0 .2rem;font-size:1.6rem;font-weight:700">PRÉNOM NOM</h1>
<p style="margin:0 0 .1rem;font-size:.9rem">email@exemple.com | +33 6 00 00 00 00 | LinkedIn: /in/profil | Ville, France</p>
<p style="margin:0 0 .1rem;font-size:.9rem;font-weight:700">Titre du poste recherché</p>
<hr style="border:none;border-top:1.5px solid #1e3a8a;margin:.75rem 0"/>
<h2 style="font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1e3a8a;margin:0 0 .4rem">PROFIL</h2>
<p style="margin:0 0 1rem;font-size:.88rem;line-height:1.55">Professionnel avec X ans d'expérience en [domaine]. Expertise reconnue en [compétence clé 1], [compétence clé 2] et [compétence clé 3]. Orienté résultats, habitué aux environnements agiles.</p>
<h2 style="font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1e3a8a;margin:0 0 .4rem">EXPÉRIENCE PROFESSIONNELLE</h2>
<p style="margin:0 0 .15rem"><strong>Intitulé du Poste</strong> | Entreprise XYZ | 2024 – présent</p>
<ul style="margin:.2rem 0 .75rem;padding-left:1.4rem;font-size:.88rem"><li>Réalisation [action + résultat mesurable]</li><li>Réalisation [action + résultat mesurable]</li></ul>
<h2 style="font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1e3a8a;margin:0 0 .4rem">FORMATION</h2>
<p style="margin:0 0 .15rem;font-size:.88rem"><strong>Master [Spécialité]</strong> | Université | 2022 – 2024</p>
<h2 style="font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1e3a8a;margin:.75rem 0 .4rem">COMPÉTENCES CLÉS</h2>
<p style="margin:0;font-size:.88rem">Compétence 1 · Compétence 2 · Compétence 3 · Compétence 4 · Compétence 5 · Compétence 6</p>
<h2 style="font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1e3a8a;margin:.75rem 0 .4rem">LANGUES</h2>
<p style="margin:0;font-size:.88rem">Français (natif) · Anglais (courant) · [Autre] ([Niveau])</p>
</div>`,
  },

  // ── 3. Minimaliste ─────────────────────────────────────────────────────────
  {
    id: 'minimaliste', name: 'Minimaliste', category: 'minimaliste',
    tags: ['Minimaliste', 'Épuré'], withPhoto: false, atsScore: 90,
    expLevels: ['none','1-2','3-5','5-10'], domains: [],
    preview: '#0f172a',
    html: `<div style="font-family:'Georgia',serif;max-width:720px;margin:0 auto;padding:3rem 2.5rem;color:#0f172a">
<h1 style="margin:0;font-size:1.9rem;font-weight:400;letter-spacing:-.5px">Prénom NOM</h1>
<p style="margin:.4rem 0 2rem;font-size:.9rem;color:#64748b;letter-spacing:.04em">Titre du poste · email@exemple.com · +33 6 00 00 00 00</p>
<div style="display:grid;grid-template-columns:1fr 2fr;gap:2rem">
  <div>
    <h3 style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin:0 0 .6rem">Contact</h3>
    <p style="font-size:.82rem;line-height:1.7;margin:0">Ville, France<br>linkedin.com/in/profil<br>github.com/profil</p>
    <h3 style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin:1.5rem 0 .6rem">Compétences</h3>
    <p style="font-size:.82rem;line-height:1.9;margin:0">Compétence A<br>Compétence B<br>Compétence C<br>Compétence D</p>
    <h3 style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin:1.5rem 0 .6rem">Langues</h3>
    <p style="font-size:.82rem;line-height:1.9;margin:0">Français (natif)<br>Anglais (C1)<br>Espagnol (B1)</p>
  </div>
  <div>
    <h3 style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin:0 0 .6rem">Expérience</h3>
    <p style="margin:0 0 .2rem"><strong>Développeur Full-Stack</strong></p>
    <p style="margin:0 0 .35rem;font-size:.82rem;color:#64748b">Entreprise XYZ · 2024 – présent</p>
    <ul style="margin:0 0 1.25rem;padding-left:1.2rem;font-size:.88rem;line-height:1.6"><li>Développement APIs et intégration IA</li><li>Architecture microservices</li></ul>
    <h3 style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin:0 0 .6rem">Formation</h3>
    <p style="margin:0 0 .2rem"><strong>Master Informatique</strong></p>
    <p style="margin:0;font-size:.82rem;color:#64748b">Université Paris-Saclay · 2022 – 2024</p>
  </div>
</div></div>`,
  },

  // ── 4. Créatif Teal ────────────────────────────────────────────────────────
  {
    id: 'creatif-teal', name: 'Créatif Teal', category: 'creatif',
    tags: ['Créatif', 'Coloré', 'Avec photo'], withPhoto: true, atsScore: 62,
    expLevels: ['1-2','3-5'], domains: ['design','marketing','art'],
    preview: '#0d9488',
    html: `<div style="font-family:'Trebuchet MS',sans-serif;max-width:760px;margin:0 auto;display:grid;grid-template-columns:220px 1fr">
<div style="background:#0d9488;padding:2rem 1.25rem;color:#fff">
  <div style="width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.2);margin:0 auto 1.25rem;display:flex;align-items:center;justify-content:center;font-size:2.2rem;border:3px solid rgba(255,255,255,.6)">👤</div>
  <h1 style="margin:0 0 .25rem;font-size:1.1rem;font-weight:800;text-align:center">Prénom NOM</h1>
  <p style="margin:0 0 1.5rem;font-size:.75rem;opacity:.8;text-align:center">Designer UX/UI</p>
  <h3 style="font-size:.58rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin:0 0 .5rem">Contact</h3>
  <p style="font-size:.75rem;line-height:1.8;margin:0">📧 email@ex.com<br>📞 +33 6 00 00 00<br>🌐 portfolio.fr<br>📍 Paris</p>
  <h3 style="font-size:.58rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin:1.25rem 0 .5rem">Compétences</h3>
  ${['Figma','Adobe XD','Illustrator','Photoshop','Prototypage','UX Research'].map(s=>`<div style="background:rgba(255,255,255,.15);border-radius:4px;padding:.18rem .5rem;font-size:.72rem;margin-bottom:.3rem">${s}</div>`).join('')}
</div>
<div style="padding:2rem 1.75rem;background:#fff">
  <h2 style="font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#0d9488;margin:0 0 .75rem;border-bottom:2px solid #ccfbf1;padding-bottom:.35rem">Profil</h2>
  <p style="margin:0 0 1.25rem;font-size:.88rem;line-height:1.6;color:#374151">Designer créatif avec 3 ans d'expérience dans la conception d'interfaces centrées utilisateur. Passionné par l'innovation visuelle et l'expérience produit.</p>
  <h2 style="font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#0d9488;margin:0 0 .75rem;border-bottom:2px solid #ccfbf1;padding-bottom:.35rem">Expérience</h2>
  <p style="margin:0 0 .2rem"><strong>Designer UX Senior</strong> — Studio ABC · 2022–présent</p>
  <ul style="margin:.2rem 0 1rem;padding-left:1.3rem;font-size:.85rem;color:#374151"><li>Refonte de l'interface principale (+40% satisfaction)</li><li>Création système de design scalable</li></ul>
  <h2 style="font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#0d9488;margin:0 0 .75rem;border-bottom:2px solid #ccfbf1;padding-bottom:.35rem">Formation</h2>
  <p style="margin:0;font-size:.88rem"><strong>BTS Design Graphique</strong> — École des Arts · 2020–2022</p>
</div></div>`,
  },

  // ── 5. Corporate Navy ──────────────────────────────────────────────────────
  {
    id: 'corporate-navy', name: 'Corporate Navy', category: 'corporate',
    tags: ['Corporate', 'Classique', 'ATS-friendly'], withPhoto: false, atsScore: 93,
    expLevels: ['5-10','10-15','15+'], domains: ['finance','juridique','rh','commerce'],
    preview: '#1e3a8a',
    html: `<div style="font-family:'Garamond','Times New Roman',serif;max-width:760px;margin:0 auto;padding:0">
<div style="background:#1e3a8a;padding:1.75rem 2.5rem;color:#fff;display:flex;justify-content:space-between;align-items:flex-end">
  <div>
    <h1 style="margin:0;font-size:1.7rem;font-weight:700;letter-spacing:.5px">PRÉNOM NOM</h1>
    <p style="margin:.3rem 0 0;font-size:1rem;opacity:.82;letter-spacing:.5px">DIRECTEUR / TITRE SENIOR</p>
  </div>
  <div style="text-align:right;font-size:.8rem;opacity:.8;line-height:1.9">
    <div>email@exemple.com</div><div>+33 6 00 00 00 00</div><div>Ville, France</div>
  </div>
</div>
<div style="padding:2rem 2.5rem">
  <div style="border-left:3px solid #1e3a8a;padding-left:1rem;margin-bottom:1.5rem">
    <p style="margin:0;font-size:.92rem;line-height:1.65;color:#374151;font-style:italic">Dirigeant expérimenté avec plus de 10 ans dans [secteur]. Reconnu pour sa capacité à structurer des organisations, piloter des transformations et délivrer des résultats mesurables dans des environnements complexes et internationaux.</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">
    <tr style="background:#f8fafc">
      <td style="padding:.6rem 1rem;font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#1e3a8a;border-bottom:2px solid #dbeafe">EXPÉRIENCE</td>
    </tr>
    <tr><td style="padding:.75rem 1rem 0">
      <p style="margin:0 0 .2rem"><strong>Directeur [Département]</strong> — Groupe XYZ</p>
      <p style="margin:0 0 .4rem;font-size:.82rem;color:#64748b">2018 – présent · Paris / International</p>
      <ul style="margin:0;padding-left:1.3rem;font-size:.88rem"><li>Management d'une équipe de 45 collaborateurs</li><li>Pilotage P&amp;L de 12 M€ avec +18% de croissance</li></ul>
    </td></tr>
  </table>
  <table style="width:100%;border-collapse:collapse">
    <tr style="background:#f8fafc">
      <td style="padding:.6rem 1rem;font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#1e3a8a;border-bottom:2px solid #dbeafe">FORMATION</td>
    </tr>
    <tr><td style="padding:.75rem 1rem"><strong>MBA</strong> — HEC Paris · 2012 – 2014</td></tr>
  </table>
</div></div>`,
  },

  // ── 6. Développeur Dark ────────────────────────────────────────────────────
  {
    id: 'dev-dark', name: 'Développeur Dark', category: 'dev',
    tags: ['Dev/IT', 'Sombre', 'Tech'], withPhoto: false, atsScore: 78,
    expLevels: ['1-2','3-5','5-10'], domains: ['tech'],
    preview: '#22d3ee',
    html: `<div style="font-family:'Courier New',monospace;max-width:760px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:2.5rem">
<div style="margin-bottom:1.75rem">
  <span style="color:#22d3ee;font-size:.85rem">// cv.ts</span>
  <h1 style="margin:.4rem 0 .15rem;font-size:1.8rem;font-weight:700;color:#f1f5f9">Prénom NOM</h1>
  <p style="margin:0;color:#94a3b8;font-size:.9rem"><span style="color:#a78bfa">const</span> role = <span style="color:#86efac">"Développeur Full-Stack Senior"</span>;</p>
  <p style="margin:.3rem 0 0;font-size:.82rem;color:#64748b">📧 email@exemple.com &nbsp;|&nbsp; 🔗 github.com/handle &nbsp;|&nbsp; 📍 Remote / Paris</p>
</div>
<div style="border-top:1px solid #1e293b;padding-top:1.25rem;margin-bottom:1.25rem">
  <p style="margin:0 0 .5rem;color:#22d3ee;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em">// Stack</p>
  <div style="display:flex;flex-wrap:wrap;gap:.4rem">
    ${['Java','Spring Boot','Python','FastAPI','Angular','TypeScript','Docker','Kubernetes','PostgreSQL','Redis','Kafka','AWS'].map(s=>`<span style="background:#1e293b;color:#22d3ee;padding:.2rem .55rem;border-radius:4px;font-size:.75rem;border:1px solid #334155">${s}</span>`).join('')}
  </div>
</div>
<div style="border-top:1px solid #1e293b;padding-top:1.25rem;margin-bottom:1.25rem">
  <p style="margin:0 0 .75rem;color:#22d3ee;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em">// Expérience</p>
  <p style="margin:0 0 .2rem;color:#f1f5f9"><strong>Senior Dev Full-Stack</strong> <span style="color:#64748b">— Startup Tech · 2022–présent</span></p>
  <ul style="margin:.3rem 0 0;padding-left:1.4rem;font-size:.85rem;color:#94a3b8"><li>Architecture microservices (Spring Boot + Kafka)</li><li>Réduction latence API de 40% (Redis caching)</li><li>Lead tech équipe de 6 développeurs</li></ul>
</div>
<div style="border-top:1px solid #1e293b;padding-top:1.25rem">
  <p style="margin:0 0 .5rem;color:#22d3ee;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em">// Formation</p>
  <p style="margin:0;font-size:.88rem;color:#94a3b8">Master Informatique — Université Paris-Saclay · 2020–2022</p>
</div></div>`,
  },

  // ── 7. Designer Warm ───────────────────────────────────────────────────────
  {
    id: 'designer-warm', name: 'Designer Warm', category: 'designer',
    tags: ['Designer', 'Créatif', 'Avec photo'], withPhoto: true, atsScore: 58,
    expLevels: ['none','1-2','3-5'], domains: ['design','art','marketing'],
    preview: '#f97316',
    html: `<div style="font-family:'Helvetica Neue',Helvetica,sans-serif;max-width:760px;margin:0 auto">
<div style="background:#fff7ed;padding:2.5rem 2.5rem 1.5rem;border-bottom:3px solid #f97316">
  <div style="display:flex;align-items:center;gap:1.5rem">
    <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#fb923c,#f97316);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:2rem">👤</div>
    <div>
      <h1 style="margin:0;font-size:1.7rem;font-weight:800;color:#431407">Prénom NOM</h1>
      <p style="margin:.3rem 0 0;color:#f97316;font-size:.95rem;font-weight:600">Designer Graphique &amp; Motion</p>
      <p style="margin:.4rem 0 0;font-size:.8rem;color:#92400e">email@exemple.com · +33 6 00 00 00 00 · portfolio.design</p>
    </div>
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;padding:1.75rem 2.5rem;background:#fff">
  <div>
    <h2 style="font-size:.65rem;text-transform:uppercase;letter-spacing:.14em;font-weight:900;color:#f97316;margin:0 0 .65rem">Expérience</h2>
    <p style="margin:0 0 .2rem"><strong>Designer Senior</strong> — Studio X</p>
    <p style="margin:0 0 .35rem;font-size:.82rem;color:#92400e">2022 – présent</p>
    <ul style="margin:0;padding-left:1.2rem;font-size:.85rem"><li>Direction artistique campagnes nationales</li><li>Motion design After Effects</li></ul>
  </div>
  <div>
    <h2 style="font-size:.65rem;text-transform:uppercase;letter-spacing:.14em;font-weight:900;color:#f97316;margin:0 0 .65rem">Outils &amp; Compétences</h2>
    <div style="display:flex;flex-wrap:wrap;gap:.35rem">
      ${['Figma','Illustrator','Photoshop','After Effects','Premiere Pro','Blender','Notion'].map(s=>`<span style="background:#fff7ed;color:#c2410c;padding:.15rem .5rem;border-radius:3px;font-size:.75rem;border:1px solid #fed7aa">${s}</span>`).join('')}
    </div>
    <h2 style="font-size:.65rem;text-transform:uppercase;letter-spacing:.14em;font-weight:900;color:#f97316;margin:1rem 0 .65rem">Formation</h2>
    <p style="margin:0;font-size:.85rem"><strong>BTS Communication Visuelle</strong><br><span style="color:#92400e;font-size:.8rem">École Supérieure · 2020–2022</span></p>
  </div>
</div></div>`,
  },

  // ── 8. Marketing Bold ──────────────────────────────────────────────────────
  {
    id: 'marketing-bold', name: 'Marketing Bold', category: 'marketing',
    tags: ['Marketing', 'Dynamique'], withPhoto: false, atsScore: 82,
    expLevels: ['1-2','3-5','5-10'], domains: ['marketing','commerce'],
    preview: '#ec4899',
    html: `<div style="font-family:'Verdana',sans-serif;max-width:760px;margin:0 auto">
<div style="background:linear-gradient(90deg,#ec4899,#f43f5e);padding:2rem 2.5rem;color:#fff">
  <h1 style="margin:0;font-size:1.65rem;font-weight:800">Prénom NOM</h1>
  <p style="margin:.3rem 0 0;font-size:1rem;opacity:.9">Responsable Marketing Digital</p>
  <p style="margin:.5rem 0 0;font-size:.8rem;opacity:.75">email@exemple.com · +33 6 00 00 00 00 · linkedin.com/in/profil</p>
</div>
<div style="background:#fff;padding:1.75rem 2.5rem">
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:2rem">
    <div>
      <h2 style="font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#ec4899;margin:0 0 .65rem;border-left:3px solid #ec4899;padding-left:.6rem">Expérience</h2>
      <p style="margin:0 0 .2rem"><strong>Head of Growth</strong> — Startup Fintech</p>
      <p style="margin:0 0 .35rem;font-size:.82rem;color:#be185d">2023 – présent · Paris</p>
      <ul style="margin:0 0 1rem;padding-left:1.3rem;font-size:.86rem"><li>Croissance MRR de +185% en 12 mois</li><li>Gestion budget ads 2M€/an (Google + Meta)</li><li>Équipe de 8 growth hackers</li></ul>
      <h2 style="font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#ec4899;margin:0 0 .65rem;border-left:3px solid #ec4899;padding-left:.6rem">Réalisations clés</h2>
      <ul style="margin:0;padding-left:1.3rem;font-size:.86rem"><li>ROI campagnes : 4,2x moyenne</li><li>Taux de conversion +67% A/B testing</li></ul>
    </div>
    <div>
      <h2 style="font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#ec4899;margin:0 0 .65rem;border-left:3px solid #ec4899;padding-left:.6rem">Compétences</h2>
      ${['SEO/SEA','Google Analytics','HubSpot','Notion','Figma','SQL','A/B Testing','Social Ads'].map(s=>`<div style="font-size:.8rem;padding:.2rem 0;border-bottom:1px solid #fce7f3">${s}</div>`).join('')}
      <h2 style="font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#ec4899;margin:1rem 0 .5rem;border-left:3px solid #ec4899;padding-left:.6rem">Formation</h2>
      <p style="font-size:.82rem;margin:0">Master Marketing Digital<br><span style="color:#94a3b8">ESCP · 2021–2023</span></p>
    </div>
  </div>
</div></div>`,
  },

  // ── 9. Étudiant Simple ──────────────────────────────────────────────────────
  {
    id: 'etudiant-simple', name: 'Étudiant Simple', category: 'etudiant',
    tags: ['Étudiant', 'Simple', 'ATS-friendly'], withPhoto: false, atsScore: 88,
    expLevels: ['none','1-2'], domains: [],
    preview: '#16a34a',
    html: `<div style="font-family:'Calibri',sans-serif;max-width:720px;margin:0 auto;padding:2rem">
<div style="border-top:4px solid #16a34a;padding-top:1.25rem;margin-bottom:1.5rem">
  <h1 style="margin:0;font-size:1.6rem;font-weight:700;color:#14532d">Prénom NOM</h1>
  <p style="margin:.25rem 0;font-size:.95rem;color:#16a34a;font-weight:600">Étudiant(e) en [Filière] — En recherche de stage/alternance</p>
  <p style="margin:.3rem 0 0;font-size:.85rem;color:#64748b">📧 email@exemple.com &nbsp;|&nbsp; 📞 +33 6 00 00 00 00 &nbsp;|&nbsp; 📍 Ville &nbsp;|&nbsp; 🎓 [École] · [Année]</p>
</div>
<h2 style="font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#16a34a;margin:0 0 .6rem;border-bottom:2px solid #dcfce7;padding-bottom:.3rem">Objectif</h2>
<p style="margin:0 0 1.25rem;font-size:.9rem;line-height:1.6">Étudiant(e) en [Master/Licence] à [École], je recherche un stage de [durée] à partir de [date] dans le domaine [domaine]. Motivé(e) et rigoureux(se), j'apporte [compétence clé] et [compétence clé].</p>
<h2 style="font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#16a34a;margin:0 0 .6rem;border-bottom:2px solid #dcfce7;padding-bottom:.3rem">Formation</h2>
<p style="margin:0 0 .2rem"><strong>Master [Spécialité]</strong> — [École/Université]</p>
<p style="margin:0 0 1.25rem;font-size:.85rem;color:#64748b">2023 – présent · En cours</p>
<h2 style="font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#16a34a;margin:0 0 .6rem;border-bottom:2px solid #dcfce7;padding-bottom:.3rem">Expériences &amp; Projets</h2>
<p style="margin:0 0 .2rem"><strong>Stage Assistant [Fonction]</strong> — Entreprise ABC</p>
<p style="margin:0 0 .2rem;font-size:.82rem;color:#64748b">Été 2023 · 2 mois</p>
<ul style="margin:0 0 1.25rem;padding-left:1.3rem;font-size:.88rem"><li>Mission réalisée avec résultat</li><li>Participation à un projet d'équipe</li></ul>
<h2 style="font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#16a34a;margin:0 0 .6rem;border-bottom:2px solid #dcfce7;padding-bottom:.3rem">Compétences &amp; Langues</h2>
<p style="margin:0;font-size:.88rem"><strong>Tech :</strong> Compétence 1, Compétence 2 &nbsp;|&nbsp; <strong>Langues :</strong> Français (natif), Anglais (B2)</p>
</div>`,
  },

  // ── 10. Executive Premium ──────────────────────────────────────────────────
  {
    id: 'executive-premium', name: 'Executive Premium', category: 'executive',
    tags: ['Executive', 'Premium', 'Corporate'], withPhoto: false, atsScore: 89,
    expLevels: ['10-15','15+'], domains: ['finance','juridique','commerce','rh'],
    preview: '#b45309',
    html: `<div style="font-family:'Palatino Linotype','Palatino',serif;max-width:760px;margin:0 auto">
<div style="background:#1c1008;padding:2.25rem 3rem;color:#fef3c7">
  <h1 style="margin:0;font-size:1.9rem;font-weight:700;letter-spacing:.5px;color:#fef3c7">PRÉNOM NOM</h1>
  <p style="margin:.4rem 0 0;font-size:1rem;color:#f59e0b;letter-spacing:.5px">DIRECTEUR GÉNÉRAL · 15 ANS D'EXPÉRIENCE</p>
  <p style="margin:.6rem 0 0;font-size:.82rem;color:#d97706;letter-spacing:.04em">email@exemple.com · +33 6 00 00 00 00 · Paris, France · linkedin.com/in/profil</p>
</div>
<div style="border-bottom:1px solid #fde68a;background:#fffbeb">
  <div style="padding:1.5rem 3rem;border-left:4px solid #f59e0b">
    <p style="margin:0;font-size:.92rem;line-height:1.7;color:#374151;font-style:italic">Dirigeant d'entreprise avec 15 ans d'expérience dans la direction générale de sociétés de 200 à 1 500 collaborateurs. Expert en transformation organisationnelle, M&amp;A et développement international.</p>
  </div>
</div>
<div style="padding:2rem 3rem;background:#fff">
  <h2 style="font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#b45309;margin:0 0 1rem;border-bottom:2px solid #fde68a;padding-bottom:.4rem">PARCOURS PROFESSIONNEL</h2>
  <div style="margin-bottom:1.25rem">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <strong style="font-size:.95rem">Directeur Général</strong>
      <span style="font-size:.8rem;color:#64748b">Groupe International · 2014 – présent</span>
    </div>
    <ul style="margin:.4rem 0 0;padding-left:1.3rem;font-size:.88rem"><li>Direction de 850 collaborateurs, CA 120M€</li><li>Croissance organique +35% sur 5 ans</li><li>3 acquisitions menées avec succès (250M€)</li></ul>
  </div>
  <h2 style="font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#b45309;margin:1.25rem 0 .75rem;border-bottom:2px solid #fde68a;padding-bottom:.4rem">FORMATION</h2>
  <p style="margin:0;font-size:.88rem"><strong>Executive MBA</strong> — INSEAD · 2010 – 2012</p>
</div></div>`,
  },

  // ── 11. Européen / Europass ────────────────────────────────────────────────
  {
    id: 'europeen', name: 'Européen (Europass)', category: 'europeen',
    tags: ['Européen', 'Standard', 'Avec photo'], withPhoto: true, atsScore: 75,
    expLevels: ['none','1-2','3-5','5-10'], domains: [],
    preview: '#003399',
    html: `<div style="font-family:'Arial',sans-serif;max-width:760px;margin:0 auto;border:1px solid #cdd5e0">
<div style="background:#003399;padding:1.5rem 2rem;color:#fff;display:flex;align-items:center;gap:1.5rem">
  <div style="width:70px;height:85px;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;border-radius:2px">👤</div>
  <div>
    <p style="margin:0 0 .15rem;font-size:.72rem;letter-spacing:.08em;opacity:.75;text-transform:uppercase">Curriculum Vitæ</p>
    <h1 style="margin:0;font-size:1.5rem;font-weight:700">Prénom NOM</h1>
    <p style="margin:.3rem 0 0;font-size:.82rem;opacity:.8">📧 email@exemple.com · 📞 +33 6 00 00 00 00 · 📍 Ville, Pays · 🎂 JJ/MM/AAAA</p>
  </div>
</div>
<table style="width:100%;border-collapse:collapse">
  <tr style="vertical-align:top">
    <td style="width:32%;background:#f0f4ff;padding:1.25rem 1.25rem;border-right:2px solid #003399">
      <div style="font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#003399;margin-bottom:.5rem">Nationalité</div>
      <p style="margin:0 0 1rem;font-size:.85rem">Française</p>
      <div style="font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#003399;margin-bottom:.5rem">Compétences</div>
      <p style="margin:0 0 1rem;font-size:.82rem;line-height:1.8">Compétence A<br>Compétence B<br>Compétence C</p>
      <div style="font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#003399;margin-bottom:.5rem">Langues</div>
      <p style="margin:0;font-size:.82rem;line-height:1.8">Français (natif)<br>Anglais (B2)<br>Espagnol (B1)</p>
    </td>
    <td style="padding:1.25rem 1.5rem">
      <div style="font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#003399;margin-bottom:.6rem">Expérience professionnelle</div>
      <p style="margin:0 0 .2rem"><strong>[Poste]</strong> — [Employeur]</p>
      <p style="margin:0 0 .35rem;font-size:.8rem;color:#64748b">[Date début] – [Date fin] · [Ville, Pays]</p>
      <ul style="margin:0 0 1rem;padding-left:1.3rem;font-size:.85rem"><li>Activité/tâche principale</li><li>Réalisation notable</li></ul>
      <div style="font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#003399;margin-bottom:.6rem">Formation</div>
      <p style="margin:0;font-size:.85rem"><strong>[Titre du diplôme]</strong><br><span style="color:#64748b">[Établissement] · [Années]</span></p>
    </td>
  </tr>
</table></div>`,
  },

  // ── 12. Noir & Blanc ───────────────────────────────────────────────────────
  {
    id: 'noir-blanc', name: 'Noir & Blanc', category: 'nb',
    tags: ['Noir & blanc', 'Élégant', 'Impression'], withPhoto: false, atsScore: 92,
    expLevels: ['1-2','3-5','5-10','10-15','15+'], domains: [],
    preview: '#000000',
    html: `<div style="font-family:'Times New Roman',Times,serif;max-width:720px;margin:0 auto;padding:2.5rem">
<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:1rem;margin-bottom:1.5rem">
  <h1 style="margin:0;font-size:2rem;font-weight:700;text-transform:uppercase;letter-spacing:2px">PRÉNOM NOM</h1>
  <p style="margin:.5rem 0 0;font-size:.88rem;color:#555;letter-spacing:.08em">Titre du poste · email@exemple.com · +33 6 00 00 00 00 · Ville</p>
</div>
<h2 style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.15em;margin:0 0 .65rem;border-bottom:1px solid #000;padding-bottom:.25rem">PROFIL</h2>
<p style="margin:0 0 1.5rem;font-size:.9rem;line-height:1.65">Professionnel avec [X] ans d'expérience dans [domaine]. Reconnu pour [qualité 1] et [qualité 2]. Recherche [type de poste] dans une structure [type d'entreprise].</p>
<h2 style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.15em;margin:0 0 .65rem;border-bottom:1px solid #000;padding-bottom:.25rem">EXPÉRIENCE PROFESSIONNELLE</h2>
<div style="margin-bottom:1rem">
  <div style="display:flex;justify-content:space-between"><strong>[Intitulé du poste]</strong><span style="font-size:.85rem">[Dates]</span></div>
  <div style="font-size:.85rem;color:#555;margin-bottom:.3rem">[Entreprise] · [Ville]</div>
  <ul style="margin:0;padding-left:1.3rem;font-size:.88rem;line-height:1.7"><li>Réalisation avec impact mesurable</li><li>Contribution à [projet]</li></ul>
</div>
<h2 style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.15em;margin:1rem 0 .65rem;border-bottom:1px solid #000;padding-bottom:.25rem">FORMATION</h2>
<div style="display:flex;justify-content:space-between;font-size:.9rem"><strong>[Diplôme]</strong><span>[Années]</span></div>
<div style="font-size:.85rem;color:#555;margin-bottom:1.5rem">[Établissement]</div>
<h2 style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.15em;margin:0 0 .65rem;border-bottom:1px solid #000;padding-bottom:.25rem">COMPÉTENCES &amp; LANGUES</h2>
<p style="margin:0;font-size:.88rem;line-height:1.8"><strong>Techniques :</strong> Compétence A · Compétence B · Compétence C<br><strong>Langues :</strong> Français (natif) · Anglais (C1) · [Autre] ([Niveau])</p>
</div>`,
  },
];

@Component({
  selector: 'app-creative-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, OfficeEditorComponent, DesignEditorComponent, SafeHtmlPipe],
  styles: [`
    :host { display: block; }

    /* ── Page ─── */
    .cs-page { min-height: calc(100vh - 64px); background: #f8fafc;
               padding: .75rem 1.5rem 3rem; position: relative; overflow: hidden; }
    .bg-blob { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; opacity: .22; }
    .bg-blob.b1 { width: 520px; height: 520px; background: radial-gradient(circle,#a855f7 0%,transparent 70%); top:-180px; right:-120px; }
    .bg-blob.b2 { width: 380px; height: 380px; background: radial-gradient(circle,#ec4899 0%,transparent 70%); bottom:-80px; left:-80px; }
    .cs-inner  { max-width: 1200px; margin: 0 auto; position: relative; }

    /* ── Hero ─── */
    .hero { padding: .5rem 0 1rem; display: flex; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
    .hero-h1  { font-family: 'Outfit', sans-serif; font-size: clamp(1.15rem, 2.5vw, 1.5rem);
                font-weight: 900; color: #0f172a; letter-spacing: -.5px; margin: 0; }
    .hero-h1 span { background: linear-gradient(135deg, #a855f7, #ec4899);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero-sub { color: #94a3b8; font-size: .78rem; margin: 0; }

    /* (sidebar supprimée — navigation via mega menu) */

    /* ── Panel ─── */
    .panel { background: white; border-radius: 18px; border: 1.5px solid #f1f5f9;
             padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,.05); min-height: 500px; }
    .panel--office {
      /* Bug corrigé (Chrome uniquement, confirmé via getComputedStyle dans le
         navigateur réel de l'utilisateur : height calculée à 105,6px, la hauteur du
         seul bandeau du haut, alors que top:64/bottom:0 auraient dû l'étirer sur tout
         l'écran) : combiner position:fixed + display:flex + height:auto avec
         top ET bottom fixés est un cas où Chrome et Firefox divergent — Chrome fait
         gagner l'algorithme de hauteur intrinsèque du conteneur flex (se réduit à son
         contenu) sur la formule d'étirement top+bottom normalement utilisée pour un
         élément positionné en absolute/fixed, alors que Firefox applique correctement
         cet étirement. Corrigé en donnant une hauteur explicite (calc, cohérente avec
         top:64px) plutôt que de compter sur cette résolution ambiguë. */
      position: fixed;
      top: 64px;
      left: 0;
      right: 0;
      bottom: 0;
      height: calc(100vh - 64px);
      z-index: 100;
      padding: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 0;
      border: none;
      box-shadow: none;
    }
    .panel-head { display: flex; align-items: center; gap: .875rem; margin-bottom: 1.25rem;
                  padding-bottom: 1rem; border-bottom: 1.5px solid #f1f5f9; }
    .panel-ico-wrap { width: 46px; height: 46px; border-radius: 12px;
                      background: linear-gradient(135deg, #a855f7, #ec4899);
                      display: flex; align-items: center; justify-content: center;
                      font-size: 1.4rem; box-shadow: 0 3px 12px rgba(168,85,247,.3); flex-shrink: 0; }
    .panel-title { font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; }
    .panel-hint  { font-size: .76rem; color: #64748b; margin: .15rem 0 0; }
    .wip-badge { font-size: .65rem; font-weight: 800; background: #fef9c3; color: #b45309;
                 padding: .2rem .55rem; border-radius: 5px; border: 1px solid #fde68a; }

    /* ── WIP Placeholder ─── */
    .wip-panel { display: flex; flex-direction: column; align-items: center; justify-content: center;
                 min-height: 360px; gap: 1rem; text-align: center; padding: 2rem; }
    .wip-emoji { font-size: 3.5rem; }
    .wip-title { font-family:'Outfit',sans-serif; font-size:1.15rem; font-weight:800; color:#0f172a; margin:0; }
    .wip-desc  { font-size:.85rem; color:#64748b; max-width:420px; line-height:1.6; margin:0; }
    .wip-features { display:flex; flex-wrap:wrap; gap:.5rem; justify-content:center; margin-top:.5rem; }
    .wip-feature  { background:#fdf4ff; color:#7c3aed; font-size:.73rem; font-weight:700;
                    padding:.3rem .75rem; border-radius:8px; border:1px solid #e9d5ff; }
    .progress-bar-wip { height:4px; width:180px; background:#f1f5f9; border-radius:999px; overflow:hidden; }
    .progress-fill-wip { height:100%; border-radius:999px;
                         background:linear-gradient(90deg,#a855f7,#ec4899);
                         animation: progressAnim 2s ease-in-out infinite; }
    @keyframes progressAnim { 0%{width:0} 70%{width:100%} 100%{width:100%} }

    /* ── Office Launch Panels ─── */
    .office-launch {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 3rem 2rem; gap: 1.25rem; text-align: center; min-height: 360px;
    }
    .office-launch-icon  { font-size: 4rem; line-height: 1; }
    .office-launch-title { font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0; }
    .office-launch-hint  { font-size: .82rem; color: #64748b; max-width: 420px; line-height: 1.6; margin: 0; }
    .office-open-btn {
      padding: .75rem 2.5rem; border: none; border-radius: 12px; color: white;
      font-size: .95rem; font-weight: 700; cursor: pointer; transition: all .2s;
      box-shadow: 0 4px 14px rgba(0,0,0,.15);
    }
    .office-open-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.22); }
    .office-info-banner {
      display: flex; align-items: center; gap: .75rem;
      margin-top: .75rem; padding: .65rem 1rem;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px;
      font-size: .78rem; color: #1d4ed8; max-width: 480px;
    }

    /* ── Word-like Application Frame ─── */
    .word-app { display: flex; flex-direction: column; border: 1px solid #c0c4cc; border-radius: 10px;
                overflow: hidden; box-shadow: 0 6px 30px rgba(0,0,0,.12); }

    /* Title bar */
    .word-titlebar { background: linear-gradient(90deg, #2563eb, #1d4ed8); color: white;
                     display: flex; align-items: center; gap: .5rem; padding: .35rem .75rem;
                     user-select: none; }
    .word-title-ico { font-size: 1rem; }
    .word-filename { font-size: .78rem; font-weight: 600; opacity: .9; }
    .word-qa { display: flex; gap: .15rem; margin-left: .75rem; }
    .wqa-btn { border: none; background: transparent; color: rgba(255,255,255,.75); cursor: pointer;
               width: 26px; height: 26px; border-radius: 4px; display: flex; align-items: center;
               justify-content: center; font-size: .78rem; transition: all .12s; }
    .wqa-btn:hover { background: rgba(255,255,255,.2); color: white; }
    .word-winbtns { margin-left: auto; display: flex; gap: 0; }
    .win-btn { border: none; background: transparent; color: rgba(255,255,255,.7);
               width: 46px; height: 30px; font-size: .75rem; cursor: pointer; transition: all .12s; }
    .win-btn:hover { background: rgba(255,255,255,.15); color: white; }
    .win-btn.close:hover { background: #ef4444; color: white; }

    /* Ribbon tabs */
    .ribbon-tabs { background: #2563eb; display: flex; align-items: flex-end; padding: 0 .5rem; }
    .rtab { padding: .45rem .9rem; font-size: .73rem; font-weight: 600; cursor: pointer;
            border: none; background: transparent; color: rgba(255,255,255,.7);
            border-radius: 6px 6px 0 0; transition: all .15s; }
    .rtab:hover { color: white; background: rgba(255,255,255,.12); }
    .rtab.active { background: #f9fafb; color: #1d4ed8; font-weight: 700; }

    /* Ribbon body */
    .ribbon { background: #f9fafb; border-bottom: 1px solid #d1d5db; padding: .25rem .5rem .15rem;
              display: flex; align-items: stretch; gap: 0; min-height: 76px; }
    .rgroup { display: flex; flex-direction: column; align-items: stretch; padding: 0 .5rem;
              border-right: 1px solid #e5e7eb; min-width: 0; }
    .rgroup:last-child { border-right: none; }
    .rgroup-btns { display: flex; flex-wrap: wrap; align-items: center; gap: .1rem; flex: 1; padding: .15rem 0; }
    .rgroup-name { font-size: .56rem; color: #9ca3af; font-weight: 600; text-transform: uppercase;
                   letter-spacing: .04em; text-align: center; padding: .15rem 0 .1rem;
                   border-top: 1px solid #e5e7eb; margin-top: auto; }

    /* Ribbon buttons */
    .rb { border: 1px solid transparent; background: transparent; cursor: pointer; border-radius: 4px;
          min-width: 28px; height: 26px; display: inline-flex; align-items: center;
          justify-content: center; font-size: .78rem; color: #374151; transition: all .1s;
          padding: 0 .3rem; white-space: nowrap; }
    .rb:hover { background: #e0e7ff; border-color: #c7d2fe; }
    .rb.on { background: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
    .rb.danger:hover { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }
    .rb-lg { flex-direction: column; height: 58px; gap: .15rem; padding: 0 .45rem; font-size: .7rem; }
    .rb-icon { font-size: .9rem; line-height: 1; }
    .rb-txt { font-size: .58rem; color: #374151; }
    .rb-sep { width: 1px; height: 26px; background: #e5e7eb; margin: 0 .15rem; align-self: center; }

    /* Font controls */
    .font-family-sel { border: 1px solid #d1d5db; border-radius: 3px; padding: .15rem .3rem;
                       font-size: .74rem; height: 24px; outline: none; background: white;
                       cursor: pointer; min-width: 90px; }
    .font-family-sel:focus { border-color: #2563eb; outline: 1px solid #93c5fd; }
    .font-size-in { border: 1px solid #d1d5db; border-radius: 3px; padding: .15rem .2rem;
                    font-size: .74rem; height: 24px; width: 34px; text-align: center; outline: none; }
    .font-size-in:focus { border-color: #2563eb; }
    .font-row { display: flex; gap: .25rem; align-items: center; margin-bottom: .2rem; }

    /* Style gallery */
    .style-gallery { display: flex; gap: .2rem; align-items: center; flex-wrap: nowrap; overflow: hidden; }
    .style-btn { border: 1px solid #d1d5db; border-radius: 4px; padding: .25rem .55rem;
                 font-size: .7rem; cursor: pointer; background: white; color: #374151;
                 transition: all .12s; white-space: nowrap; }
    .style-btn:hover { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
    .style-btn.s-normal  { font-weight: 500; }
    .style-btn.s-h1      { font-weight: 800; font-size: .8rem; color: #1e3a8a; }
    .style-btn.s-h2      { font-weight: 700; color: #1d4ed8; }
    .style-btn.s-h3      { font-weight: 700; font-size: .65rem; color: #6366f1; }
    .style-btn.s-nospace { color: #64748b; font-size: .66rem; }

    /* Page area */
    .page-canvas { background: #404040; overflow: auto; padding: 2rem 1.5rem;
                   display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
                   min-height: 480px; max-height: calc(100vh - 300px); }
    .page-sheet { background: white; width: 100%; max-width: 760px;
                  padding: 80px 90px; box-shadow: 0 2px 20px rgba(0,0,0,.4);
                  position: relative; box-sizing: border-box;
                  /* Grows with content — no fixed min-height */ }
    @media(max-width:800px){ .page-sheet { padding: 40px 32px; } }
    .word-editor { width: 100%; min-height: 600px; outline: none;
                   font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt;
                   line-height: 1.6; color: #000; caret-color: #2563eb;
                   /* contenteditable grows automatically with content */ }
    .word-editor:empty:before { content: attr(data-placeholder); color: #b0b8c4; pointer-events: none; }
    .word-editor h1 { font-size: 20pt; font-weight: 700; color: #1e3a8a; margin: .5rem 0 .25rem; border-bottom: 2px solid #e2e8f0; padding-bottom: .25rem; }
    .word-editor h2 { font-size: 14pt; font-weight: 700; color: #1d4ed8; margin: 1rem 0 .25rem; }
    .word-editor h3 { font-size: 12pt; font-weight: 600; color: #6366f1; margin: .75rem 0 .2rem; }
    .word-editor h4 { font-size: 11pt; font-weight: 600; color: #374151; margin: .5rem 0 .15rem; }
    .word-editor p  { margin: .3rem 0; }
    .word-editor ul,.word-editor ol { padding-left: 1.75rem; margin: .25rem 0; }
    .word-editor table { border-collapse: collapse; width: 100%; margin: .75rem 0; }
    .word-editor td,.word-editor th { border: 1px solid #c4c4c4; padding: .4rem .6rem; }
    .word-editor th { background: #f1f5f9; font-weight: 700; }
    .word-editor hr { border: none; border-top: 1.5px solid #d1d5db; margin: 1rem 0; }
    .word-editor blockquote { border-left: 4px solid #6366f1; margin: .5rem 0; padding-left: 1rem; color: #4b5563; font-style: italic; }

    /* ── Images dans l'éditeur ── */
    .word-editor img {
      max-width: 100%; height: auto; display: inline-block;
      cursor: pointer; border-radius: 2px; vertical-align: middle;
      box-sizing: border-box;
    }
    /* Wrapper créé au clic pour activer le redimensionnement */
    .img-wrapper {
      display: inline-block; position: relative;
      line-height: 0; vertical-align: middle; cursor: default;
      box-sizing: border-box;
    }
    /* Quand l'image est sélectionnée */
    .img-wrapper--selected { outline: 2px solid #2563eb; outline-offset: 1px; }
    /* Image à l'intérieur du wrapper : pointer-events:none empêche les clics parasites */
    .img-wrapper img {
      display: block; pointer-events: none; user-select: none;
      cursor: default; width: 100%; height: auto;
    }
    /* Poignées de redimensionnement aux 4 coins */
    .img-handle {
      display: none; position: absolute;
      width: 10px; height: 10px;
      background: #2563eb; border: 2px solid white;
      border-radius: 2px; box-shadow: 0 1px 4px rgba(0,0,0,.4);
      z-index: 20; user-select: none;
    }
    .img-wrapper--selected .img-handle { display: block; }
    .img-handle-nw { top: -5px;    left: -5px;  cursor: nw-resize; }
    .img-handle-ne { top: -5px;    right: -5px; cursor: ne-resize; }
    .img-handle-sw { bottom: -5px; left: -5px;  cursor: sw-resize; }
    .img-handle-se { bottom: -5px; right: -5px; cursor: se-resize; }

    /* Status bar */
    .statusbar { background: #1d4ed8; color: rgba(255,255,255,.82); display: flex;
                 align-items: center; gap: 1.25rem; padding: .22rem .875rem; font-size: .65rem; flex-wrap: wrap; }
    .sb-lbl { opacity: .7; }
    .sb-val { font-weight: 700; }
    .sb-sep { width: 1px; height: 12px; background: rgba(255,255,255,.25); }
    .sb-right { margin-left: auto; display: flex; gap: 1rem; align-items: center; }
    .zoom-sel { border: none; background: transparent; color: rgba(255,255,255,.8);
                font-size: .65rem; cursor: pointer; outline: none; }

    /* ── Save-As Modal ─── */
    .save-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.6); backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center; z-index: 9998;
                    padding: 1rem; animation: fadeIn .18s ease-out; }
    .save-modal { background: white; border-radius: 18px; width: 100%; max-width: 680px;
                  box-shadow: 0 24px 60px rgba(0,0,0,.28); overflow: hidden; }
    .save-header { background: linear-gradient(90deg, #2563eb, #1d4ed8); color: white;
                   padding: 1.1rem 1.5rem; display: flex; align-items: center; gap: .75rem; }
    .save-header-ico { font-size: 1.4rem; }
    .save-header-title { font-size: 1rem; font-weight: 800; }
    .save-header-sub { font-size: .72rem; opacity: .75; margin-top: .15rem; }
    .save-close { margin-left: auto; border: none; background: rgba(255,255,255,.15); color: white;
                  width: 30px; height: 30px; border-radius: 6px; cursor: pointer; font-size: .9rem;
                  display: flex; align-items: center; justify-content: center; }
    .save-close:hover { background: rgba(255,255,255,.28); }
    .save-body { padding: 1.25rem 1.5rem; }
    .save-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: .75rem; }
    .fmt-card { border: 1.5px solid #e5e7eb; border-radius: 12px; padding: .875rem 1rem;
                cursor: pointer; transition: all .18s; display: flex; align-items: flex-start; gap: .75rem; background: white; }
    .fmt-card:hover { border-color: #2563eb; box-shadow: 0 4px 14px rgba(37,99,235,.14); transform: translateY(-1px); }
    .fmt-ico { font-size: 1.6rem; flex-shrink: 0; }
    .fmt-info { min-width: 0; }
    .fmt-label { font-size: .82rem; font-weight: 800; color: #0f172a; margin-bottom: .1rem; }
    .fmt-desc  { font-size: .67rem; color: #64748b; line-height: 1.4; }
    .fmt-ext   { display: inline-block; font-size: .6rem; font-weight: 700; background: #f1f5f9;
                 color: #475569; padding: .1rem .35rem; border-radius: 4px; margin-top: .2rem; }
    .save-footer { padding: .75rem 1.5rem; border-top: 1px solid #f1f5f9; display: flex;
                   align-items: center; justify-content: space-between; }
    .save-hint { font-size: .7rem; color: #94a3b8; }
    .save-cancel { border: 1.5px solid #e2e8f0; background: white; color: #475569;
                   padding: .4rem 1rem; border-radius: 8px; font-size: .78rem; font-weight: 600; cursor: pointer; }
    .save-cancel:hover { border-color: #94a3b8; }

    /* Context menu */
    .ctx-menu { position: fixed; z-index: 9999; background: white; border: 1px solid #d1d5db;
                border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.18); min-width: 190px;
                padding: .3rem 0; animation: ctxFade .12s ease-out; }
    @keyframes ctxFade { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:none} }
    .ctx-item { display: flex; align-items: center; gap: .6rem; padding: .4rem 1rem;
                font-size: .78rem; color: #374151; cursor: pointer; transition: background .1s; }
    .ctx-item:hover { background: #eff6ff; color: #1d4ed8; }
    .ctx-item.danger:hover { background: #fef2f2; color: #dc2626; }
    .ctx-item svg,.ctx-item .ctx-ico { font-size: .85rem; width: 16px; flex-shrink: 0; }
    .ctx-sep { height: 1px; background: #f1f5f9; margin: .2rem 0; }
    .ctx-shortcut { margin-left: auto; font-size: .67rem; color: #9ca3af; }

    /* Actions row below word app */
    .editor-actions { display: flex; gap: .5rem; flex-wrap: wrap; padding-top: .625rem; }
    .ed-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .42rem .85rem;
              font-size: .75rem; font-weight: 700; border-radius: 8px; cursor: pointer; border: none; transition: all .18s; }
    .ed-btn.primary { background: linear-gradient(135deg,#a855f7,#ec4899); color: white;
                      box-shadow: 0 3px 10px rgba(168,85,247,.25); }
    .ed-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 5px 14px rgba(168,85,247,.4); }
    .ed-btn.secondary { background: white; color: #475569; border: 1.5px solid #e2e8f0; }
    .ed-btn.secondary:hover { border-color: #a855f7; color: #a855f7; }

    /* ── Badge Creator ─── */
    .badge-layout { display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; }
    @media(max-width:900px){ .badge-layout { grid-template-columns:1fr; } }
    .badge-config { display: flex; flex-direction: column; gap: .875rem; }
    .field-group  { display: flex; flex-direction: column; gap: .3rem; }
    .field-label  { font-size: .72rem; font-weight: 700; color: #374151; }
    .field-input  { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: .45rem .7rem;
                    font-size: .85rem; outline: none; transition: border-color .2s; }
    .field-input:focus { border-color: #a855f7; }
    .color-row    { display: flex; gap: .5rem; align-items: center; }
    .color-swatch { width: 32px; height: 32px; border-radius: 6px; border: 2px solid #e2e8f0;
                    cursor: pointer; padding: 0; }
    .tpl-picker { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
    .tpl-btn    { border: 2px solid #e2e8f0; border-radius: 9px; padding: .45rem .5rem;
                  cursor: pointer; font-size: .72rem; font-weight: 700; transition: all .18s;
                  text-align: center; }
    .tpl-btn:hover  { border-color: #a855f7; }
    .tpl-btn.active { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
    .badge-preview-wrap { display: flex; flex-direction: column; gap: .75rem; align-items: center; }
    .badge-preview-label { font-size: .7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; }
    .badge-canvas-wrap { border-radius: 14px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.12); }
    .badge-dl-row { display: flex; gap: .5rem; }
    .badge-dl-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .45rem .9rem;
                    font-size: .78rem; font-weight: 700; border-radius: 8px; cursor: pointer; border: none; transition: all .18s; }
    .badge-dl-btn.purple { background: linear-gradient(135deg,#a855f7,#ec4899); color:white;
                           box-shadow:0 3px 10px rgba(168,85,247,.3); }
    .badge-dl-btn.dark   { background: #0f172a; color:white; }
    .badge-dl-btn:hover  { transform: translateY(-1px); }
    .copies-row { display: flex; align-items: center; gap: .75rem; }
    .copies-input { width: 64px; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: .35rem .5rem;
                    text-align: center; font-size: .85rem; font-weight: 700; outline: none; }
    .copies-input:focus { border-color: #a855f7; }

    /* ── Toast ─── */
    .toast { position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
             background: #0f172a; color: white; padding: .75rem 1.25rem; border-radius: 12px;
             font-size: .82rem; font-weight: 700; display: flex; align-items: center; gap: .625rem;
             box-shadow: 0 8px 24px rgba(0,0,0,.25); animation: slideUp .25s ease-out; }
    .toast.success { border-left: 4px solid #22c55e; }
    .toast.info    { border-left: 4px solid #a855f7; }
    @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
    .animate-fade  { animation: fadeIn .3s ease-out; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }

    /* ── CV Template Modal ── */
    .cv-modal-overlay { position:fixed;inset:0;background:rgba(15,23,42,.65);backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem;animation:fadeIn .2s ease-out; }
    .cv-modal { background:#fff;border-radius:20px;width:100%;max-width:960px;max-height:90vh;
      display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.3);overflow:hidden; }
    .cv-modal-head { background:linear-gradient(135deg,#7c3aed,#a855f7,#ec4899);padding:1.25rem 1.5rem;
      color:#fff;display:flex;align-items:center;gap:.875rem;flex-shrink:0; }
    .cv-modal-head-ico { font-size:1.6rem; }
    .cv-modal-head-title { font-family:'Outfit',sans-serif;font-size:1.1rem;font-weight:800;margin:0; }
    .cv-modal-head-sub { font-size:.75rem;opacity:.8;margin:.15rem 0 0; }
    .cv-modal-close { margin-left:auto;border:none;background:rgba(255,255,255,.15);color:#fff;
      width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1rem;
      display:flex;align-items:center;justify-content:center;transition:background .15s; }
    .cv-modal-close:hover { background:rgba(255,255,255,.3); }

    /* Filter bar */
    .cv-filters { display:flex;align-items:center;gap:.75rem;padding:.875rem 1.25rem;
      border-bottom:1px solid #f1f5f9;background:#fafafa;flex-wrap:wrap;flex-shrink:0; }
    .cv-filter-label { font-size:.68rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em; }
    .cv-exp-pills { display:flex;gap:.35rem;flex-wrap:wrap; }
    .cv-pill { border:1.5px solid #e2e8f0;background:#fff;color:#475569;padding:.28rem .7rem;
      border-radius:999px;font-size:.72rem;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap; }
    .cv-pill:hover { border-color:#a855f7;color:#7c3aed; }
    .cv-pill.active { background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border-color:transparent;
      box-shadow:0 2px 8px rgba(124,58,237,.3); }
    .cv-domain-sel { border:1.5px solid #e2e8f0;border-radius:8px;padding:.3rem .65rem;font-size:.78rem;
      outline:none;cursor:pointer;background:#fff;color:#374151;min-width:180px; }
    .cv-domain-sel:focus { border-color:#a855f7; }
    .cv-count { margin-left:auto;font-size:.72rem;color:#94a3b8;font-weight:700;white-space:nowrap; }

    /* Template grid */
    .cv-tpl-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));
      gap:.875rem;padding:1rem 1.25rem;overflow-y:auto;flex:1; }
    .cv-tpl-card { border:2px solid #f1f5f9;border-radius:12px;overflow:hidden;cursor:pointer;
      transition:all .18s;display:flex;flex-direction:column; }
    .cv-tpl-card:hover { border-color:#a855f7;box-shadow:0 6px 20px rgba(124,58,237,.18);transform:translateY(-2px); }
    .cv-tpl-card.selected { border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.2); }
    .cv-tpl-preview { height:140px;background:#f8fafc;overflow:hidden;position:relative;flex-shrink:0; }
    .cv-tpl-preview-inner { transform:scale(.27);transform-origin:top left;
      width:370%;pointer-events:none;position:absolute;top:0;left:0; }
    .cv-tpl-info { padding:.6rem .75rem;border-top:1px solid #f1f5f9;flex:1; }
    .cv-tpl-name { font-size:.78rem;font-weight:800;color:#0f172a;margin:0 0 .2rem; }
    .cv-tpl-meta { display:flex;align-items:center;gap:.3rem;flex-wrap:wrap; }
    .cv-tpl-tag { font-size:.6rem;font-weight:700;background:#fdf4ff;color:#7c3aed;
      padding:.1rem .35rem;border-radius:3px; }
    .cv-tpl-ats { font-size:.6rem;font-weight:800;padding:.1rem .35rem;border-radius:3px; }
    .cv-tpl-ats.high { background:#dcfce7;color:#15803d; }
    .cv-tpl-ats.med  { background:#fef9c3;color:#b45309; }
    .cv-tpl-ats.low  { background:#fee2e2;color:#dc2626; }

    /* Modal footer */
    .cv-modal-footer { padding:.875rem 1.5rem;border-top:1px solid #f1f5f9;display:flex;
      align-items:center;justify-content:space-between;flex-shrink:0;background:#fafafa; }
    .cv-footer-hint { font-size:.72rem;color:#94a3b8; }
    .cv-use-btn { display:inline-flex;align-items:center;gap:.4rem;padding:.5rem 1.25rem;
      background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:10px;
      font-size:.82rem;font-weight:800;cursor:pointer;transition:all .18s;
      box-shadow:0 3px 10px rgba(124,58,237,.3); }
    .cv-use-btn:hover { transform:translateY(-1px);box-shadow:0 5px 14px rgba(124,58,237,.4); }
    .cv-use-btn:disabled { opacity:.4;cursor:default;transform:none; }

    /* "Browse templates" button in panel-head */
    .btn-browse-tpl { display:inline-flex;align-items:center;gap:.4rem;margin-left:auto;
      padding:.42rem 1rem;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;
      border:none;border-radius:10px;font-size:.78rem;font-weight:800;cursor:pointer;
      transition:all .18s;box-shadow:0 3px 10px rgba(124,58,237,.25); }
    .btn-browse-tpl:hover { transform:translateY(-1px);box-shadow:0 5px 14px rgba(124,58,237,.4); }

    /* CV Builder inline panel */
    .cvbuilder-panel { display:block;width:100%;height:calc(100vh - 220px);min-height:600px;overflow:hidden;border-radius:12px; }
    .cvbuilder-iframe { border:none;width:100%;height:100%;display:block;background:#fff; }
    /* RxResume panel — plein écran comme Office */
    .panel--rxresume {
      position: fixed; top: 64px; left: 0; right: 0; bottom: 0;
      z-index: 100; padding: 0; min-height: 0; height: auto;
      display: flex; flex-direction: column; overflow: hidden;
      border-radius: 0; border: none; box-shadow: none;
    }
    .rxresume-bar {
      display:flex; align-items:center; justify-content:space-between;
      padding:.5rem .875rem; background:linear-gradient(90deg,#7c3aed,#a855f7); color:#fff;
      flex-shrink:0;
    }
    .rxresume-bar-left   { display:flex; align-items:center; gap:.6rem; }
    .rxresume-bar-ico    { font-size:1.1rem; }
    .rxresume-bar-title  { font-size:.9rem; font-weight:800; }
    .rxresume-bar-badge  { background:rgba(255,255,255,.18); padding:.18rem .6rem; border-radius:20px; font-size:.68rem; font-weight:600; }
    .rxresume-direct-btn {
      padding:.3rem .8rem; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.3);
      border-radius:7px; color:#fff; font-size:.75rem; font-weight:700; cursor:pointer; transition:.15s;
    }
    .rxresume-direct-btn:hover { background:rgba(255,255,255,.28); }
    .rxresume-iframe { flex:1; border:none; width:100%; min-height:0; display:block; }
    .rxresume-loading { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; background:#0f0f1a; color:#a78bfa; }
    .rxresume-spinner { width:40px;height:40px;border:3px solid rgba(167,139,250,.2);border-top-color:#a78bfa;border-radius:50%;animation:rx-spin 0.8s linear infinite; }
    @keyframes rx-spin { to { transform: rotate(360deg); } }

    /* ── Galerie CV ───────────────────────────────────────────────────── */
    .cvgal-page { display:flex; flex-direction:column; height:100%; }
    .cvgal-header { padding:1.25rem 1.5rem .75rem; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; border-bottom:1px solid #f1f5f9; }
    .cvgal-title { font-size:1.2rem; font-weight:800; color:#1e293b; }
    .cvgal-subtitle { font-size:.8rem; color:#94a3b8; margin-top:.15rem; }
    .cvgal-search { padding:.4rem .75rem; border:1.5px solid #e2e8f0; border-radius:8px; font-size:.82rem; outline:none; width:220px; }
    .cvgal-search:focus { border-color:#7c3aed; }
    .cvgal-grid { flex:1; overflow-y:auto; padding:1.25rem 1.5rem; display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:1.25rem; }
    .cvgal-card { border-radius:14px; overflow:hidden; border:2px solid #e2e8f0; cursor:pointer; transition:.18s; display:flex; flex-direction:column; background:#fff; }
    .cvgal-card:hover { border-color:#7c3aed; box-shadow:0 8px 24px rgba(124,58,237,.15); transform:translateY(-3px); }
    .cvgal-card.selected { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.2); }
    .cvgal-preview { height:140px; display:flex; flex-direction:column; overflow:hidden; position:relative; }
    .cvgal-preview-header { height:32px; display:flex; align-items:center; padding:0 .75rem; gap:.5rem; flex-shrink:0; }
    .cvgal-preview-avatar { width:20px;height:20px;border-radius:50%; background:rgba(255,255,255,.35); flex-shrink:0; }
    .cvgal-preview-lines { display:flex; flex-direction:column; gap:3px; flex:1; }
    .cvgal-preview-line { height:3px; border-radius:2px; background:rgba(255,255,255,.4); }
    .cvgal-preview-line.w80 { width:80%; }
    .cvgal-preview-line.w60 { width:60%; }
    .cvgal-preview-body { flex:1; padding:.5rem .75rem; display:flex; gap:.5rem; }
    .cvgal-preview-main { flex:2; display:flex; flex-direction:column; gap:4px; }
    .cvgal-preview-side { flex:1; display:flex; flex-direction:column; gap:4px; }
    .cvgal-preview-block { height:4px; border-radius:2px; }
    .cvgal-preview-block.dark { background:rgba(0,0,0,.12); }
    .cvgal-preview-block.light { background:rgba(0,0,0,.06); }
    .cvgal-info { padding:.6rem .75rem .75rem; }
    .cvgal-name { font-size:.85rem; font-weight:700; color:#1e293b; }
    .cvgal-tags { display:flex; flex-wrap:wrap; gap:.25rem; margin-top:.35rem; }
    .cvgal-tag { font-size:.65rem; padding:.15rem .4rem; border-radius:20px; font-weight:600; background:#f1f5f9; color:#64748b; }
    .cvgal-tag.ats { background:#dcfce7; color:#166534; }
    .cvgal-tag.sidebar { background:#e0f2fe; color:#0369a1; }
    .cvgal-tag.modern { background:#f3e8ff; color:#7e22ce; }
    .cvgal-footer { padding:.75rem 1.5rem; border-top:1px solid #f1f5f9; flex-shrink:0; display:flex; align-items:center; gap:.75rem; background:#fafafa; }
    .cvgal-sel-name { font-size:.85rem; font-weight:700; color:#7c3aed; flex:1; }
    .cvgal-inp { flex:1; padding:.45rem .75rem; border:1.5px solid #d1d5db; border-radius:8px; font-size:.82rem; outline:none; }
    .cvgal-inp:focus { border-color:#7c3aed; }
    .cvgal-cta { padding:.5rem 1.25rem; border-radius:9px; border:none; font-size:.82rem; font-weight:700; cursor:pointer; background:linear-gradient(135deg,#7c3aed,#a855f7); color:#fff; white-space:nowrap; }
    .cvgal-cta:disabled { opacity:.5; cursor:not-allowed; }
    .cvgal-spinner { width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:rx-spin .7s linear infinite;display:inline-block; }

    /* ── RxResume Lab ─────────────────────────────────────────────────── */
    .lab-page { padding:1.5rem; display:flex; flex-direction:column; gap:1.5rem; max-width:1100px; }
    .lab-title { font-size:1.3rem; font-weight:800; color:#7c3aed; display:flex; align-items:center; gap:.5rem; }
    .lab-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1.25rem; }
    @media(max-width:700px){ .lab-grid { grid-template-columns:1fr; } }
    .lab-card { background:#fff; border:1.5px solid #e5e7eb; border-radius:14px; padding:1.25rem; display:flex; flex-direction:column; gap:.75rem; transition:.15s; }
    .lab-card:hover { border-color:#7c3aed; box-shadow:0 4px 16px rgba(124,58,237,.1); }
    .lab-card-head { display:flex; align-items:center; gap:.6rem; }
    .lab-card-ico { font-size:1.6rem; }
    .lab-card-label { font-size:1rem; font-weight:700; color:#1e293b; }
    .lab-card-desc { font-size:.8rem; color:#64748b; line-height:1.4; }
    .lab-btn { padding:.5rem 1rem; border-radius:8px; border:none; cursor:pointer; font-size:.82rem; font-weight:700; background:linear-gradient(135deg,#7c3aed,#a855f7); color:#fff; transition:.15s; align-self:flex-start; }
    .lab-btn:hover { opacity:.85; }
    .lab-btn:disabled { opacity:.5; cursor:not-allowed; }
    .lab-result { font-size:.78rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:.6rem .8rem; color:#334155; max-height:200px; overflow:auto; white-space:pre-wrap; word-break:break-all; }
    .lab-result.success { border-color:#22c55e; background:#f0fdf4; color:#166534; }
    .lab-result.error   { border-color:#ef4444; background:#fef2f2; color:#991b1b; }
    .lab-tpl-grid { display:flex; flex-wrap:wrap; gap:.4rem; }
    .lab-tpl-chip { padding:.3rem .6rem; border-radius:20px; font-size:.72rem; font-weight:700; cursor:pointer; border:1.5px solid transparent; transition:.12s; }
    .lab-tpl-chip:hover { transform:scale(1.06); }
    .lab-tpl-chip.selected { border-color:#7c3aed; box-shadow:0 0 0 2px rgba(124,58,237,.25); }

    /* ── Penpot Integration ─── */
    .penpot-launch { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; padding: .5rem 0; }
    @media(max-width:900px){ .penpot-launch { grid-template-columns:1fr; } }
    .penpot-preview {
      background: linear-gradient(135deg,#f5f3ff,#ede9fe);
      border: 2px solid #e9d5ff; border-radius: 18px; padding: 2rem;
      display: flex; flex-direction: column; align-items: center; text-align: center; gap: .875rem;
    }
    .penpot-preview-icon { font-size: 3.5rem; line-height: 1; }
    .penpot-preview-title { font-family:'Outfit',sans-serif; font-size: 1.3rem; font-weight: 900; color: #4c1d95; }
    .penpot-preview-sub { font-size: .8rem; color: #6d28d9; }
    .penpot-features { display: flex; flex-direction: column; gap: .35rem; text-align: left; width: 100%; margin: .25rem 0; }
    .penpot-feat { font-size: .82rem; color: #374151; display: flex; align-items: center; gap: .5rem; }
    .penpot-feat span { color: #7c3aed; font-size: .7rem; }
    .penpot-open-btn {
      display: inline-flex; align-items: center; gap: .5rem;
      padding: .85rem 2.5rem; background: linear-gradient(135deg,#7c3aed,#a855f7); color: #fff;
      border: none; border-radius: 14px; font-size: 1rem; font-weight: 800; cursor: pointer;
      transition: all .2s; box-shadow: 0 6px 20px rgba(124,58,237,.35); margin-top: .5rem;
    }
    .penpot-open-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(124,58,237,.45); }
    .penpot-hint { font-size: .7rem; color: #9d8fa3; }
    .penpot-side { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 1rem; }
    .penpot-side-title { font-size: .8rem; font-weight: 800; color: #374151; margin-bottom: .75rem; }
    /* Penpot iframe */
    .penpot-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: .5rem .875rem; background: linear-gradient(90deg,#4c1d95,#6d28d9); color: #fff;
      flex-shrink: 0; border-radius: 0;
    }
    .penpot-bar-left { display: flex; align-items: center; gap: .75rem; }
    .penpot-bar-ico { font-size: 1.2rem; }
    .penpot-bar-title { font-size: .88rem; font-weight: 800; }
    .penpot-bar-badge {
      background: rgba(255,255,255,.2); padding: .2rem .65rem; border-radius: 20px;
      font-size: .7rem; font-weight: 700;
    }
    .penpot-close-btn {
      padding: .35rem .9rem; background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25);
      border-radius: 8px; color: #fff; font-size: .78rem; font-weight: 700; cursor: pointer;
      transition: .15s;
    }
    .penpot-close-btn:hover { background: rgba(255,255,255,.28); }
    .penpot-iframe { flex: 1; border: none; width: 100%; min-height: 0; display: block; }
    /* panel--penpot = plein écran comme Office */
    .panel--penpot {
      position: fixed; top: 64px; left: 0; right: 0; bottom: 0;
      z-index: 100; padding: 0; min-height: 0; height: auto;
      display: flex; flex-direction: column; overflow: hidden;
      border-radius: 0; border: none; box-shadow: none;
    }

    /* ── Logo gallery (plus grands aperçus HTML) ─── */
    .logo-gallery { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .logo-tpl-card .tpl-card-preview { height: 160px; }
    .logo-preview { border-radius: 12px 12px 0 0; }

    /* ── Theme filter bar ─── */
    .tpl-theme-filter { display:flex; flex-wrap:wrap; gap:.35rem; align-items:center; margin-bottom:.5rem; }
    .tpl-filter-lbl { font-size:.72rem; font-weight:700; color:#64748b; }
    .tpl-filter-btn {
      padding:.28rem .65rem; border:1.5px solid #e2e8f0; border-radius:20px; font-size:.7rem;
      font-weight:700; cursor:pointer; background:transparent; color:#64748b; transition:.15s;
    }
    .tpl-filter-btn:hover { border-color:#a855f7; color:#a855f7; }
    .tpl-filter-btn.active { background:#a855f7; border-color:#a855f7; color:#fff; }
    .tpl-count { font-size:.68rem; color:#94a3b8; margin-bottom:.5rem; }

    /* ── Design Template Gallery ─── */
    .tpl-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; padding: .25rem 0 1rem; }
    .tpl-card { border-radius: 14px; overflow: hidden; cursor: pointer;
                border: 2.5px solid #e2e8f0; transition: all .22s; background: #f8fafc; }
    .tpl-card:hover { border-color: #a855f7; transform: translateY(-4px);
                      box-shadow: 0 10px 28px rgba(168,85,247,.18); }
    .tpl-card-preview { height: 130px; overflow: hidden; position: relative;
                        display: flex; align-items: center; justify-content: center; }
    .tpl-preview-scaler { transform-origin: center center; pointer-events: none; }
    .tpl-card-label { padding: .55rem .8rem; font-size: .76rem; font-weight: 700;
                      color: #374151; background: white; border-top: 1px solid #f1f5f9; }
    .tpl-card-label .tpl-use-btn { float: right; font-size: .68rem; color: #a855f7;
                                    font-weight: 800; text-decoration: none; }
    /* Design editor panel full-screen (comme Office) */
    .panel--design {
      position: fixed; top: 64px; left: 0; right: 0; bottom: 0;
      z-index: 100; padding: 0; min-height: 0; height: auto;
      display: flex; flex-direction: column; overflow: hidden;
      border-radius: 0; border: none; box-shadow: none;
    }

    /* ── Sélecteur d'outil Identité visuelle ─── */
    .iv-tool-bar { display:flex; gap:.5rem; margin-bottom:1.25rem; padding:.5rem; background:#f8fafc;
                   border-radius:12px; border:1.5px solid #f1f5f9; }
    .iv-tool-btn { display:flex; align-items:center; gap:.4rem; padding:.45rem 1rem;
                   border:none; border-radius:8px; font-size:.8rem; font-weight:700;
                   cursor:pointer; background:transparent; color:#64748b; transition:all .18s; }
    .iv-tool-btn:hover  { background:#e2e8f0; color:#1e293b; }
    .iv-tool-btn.active { background:linear-gradient(135deg,#a855f7,#ec4899); color:#fff;
                          box-shadow:0 3px 10px rgba(168,85,247,.3); }
    .iv-tool-btn .iv-ico { font-size:1rem; }

    /* ── Import CSV batch ─── */
    .csv-section { margin-top:.75rem; border-top:1.5px dashed #e2e8f0; padding-top:.75rem; }
    .csv-upload-row { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
    .csv-upload-btn { display:inline-flex; align-items:center; gap:.35rem; padding:.4rem .85rem;
                      background:#f1f5f9; border:1.5px solid #e2e8f0; border-radius:8px;
                      font-size:.75rem; font-weight:700; cursor:pointer; color:#374151; transition:.15s; }
    .csv-upload-btn:hover { background:#e2e8f0; border-color:#a855f7; }
    .csv-hint { font-size:.68rem; color:#94a3b8; }
    .csv-list { margin-top:.5rem; max-height:160px; overflow-y:auto; border:1px solid #e2e8f0;
                border-radius:8px; font-size:.75rem; }
    .csv-row  { display:flex; gap:.5rem; align-items:center; padding:.3rem .5rem;
                border-bottom:1px solid #f1f5f9; cursor:pointer; transition:.12s; }
    .csv-row:last-child { border-bottom:none; }
    .csv-row:hover   { background:#fdf4ff; }
    .csv-row.active  { background:#ede9fe; }
    .csv-row-name    { font-weight:700; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .csv-row-role    { color:#64748b; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .csv-gen-btn { display:inline-flex; align-items:center; gap:.35rem; margin-top:.5rem;
                   padding:.42rem 1rem; background:linear-gradient(135deg,#a855f7,#ec4899); color:#fff;
                   border:none; border-radius:8px; font-size:.75rem; font-weight:700; cursor:pointer; transition:.15s; }
    .csv-gen-btn:hover { opacity:.9; transform:translateY(-1px); }

    /* ── Carte de visite ─── */
    .cartevisite-layout { display: grid; grid-template-columns: 1fr 380px; gap: 1.25rem; }
    @media(max-width:900px){ .cartevisite-layout { grid-template-columns:1fr; } }
    .cartevisite-config { display: flex; flex-direction: column; gap: .875rem; }
    .cartevisite-preview-wrap { display: flex; flex-direction: column; gap: .75rem; align-items: center; }
    .cartevisite-preview-label { font-size: .7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; }
    .cartevisite-canvas-wrap { border-radius: 14px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.15); }
    .cartevisite-dl-row { display: flex; gap: .5rem; flex-wrap:wrap; justify-content:center; }
    .cartevisite-dl-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .45rem .9rem;
                 border: none; border-radius: 8px; font-size: .78rem; font-weight: 700; cursor: pointer; transition: all .18s; }
    .cartevisite-dl-btn.purple { background: linear-gradient(135deg,#a855f7,#ec4899); color:white; }
    .cartevisite-dl-btn.dark   { background: #0f172a; color:white; }
    .cartevisite-dl-btn:hover  { transform: translateY(-1px); }

    /* ── Logo Creator ─── */
    .logo-layout { display: grid; grid-template-columns: 1fr 380px; gap: 1.25rem; }
    @media(max-width:900px){ .logo-layout { grid-template-columns:1fr; } }
    .logo-config { display: flex; flex-direction: column; gap: .875rem; }
    .logo-preview-wrap { display: flex; flex-direction: column; gap: .75rem; align-items: center; }
    .logo-preview-label { font-size: .7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; }
    .logo-canvas-wrap { border-radius: 14px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.12); background:#f1f5f9; }
    .logo-dl-row { display: flex; gap: .5rem; flex-wrap:wrap; justify-content:center; }
    .logo-dl-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .45rem .9rem;
                  border: none; border-radius: 8px; font-size: .78rem; font-weight: 700; cursor: pointer; transition: all .18s; }
    .logo-dl-btn.purple { background: linear-gradient(135deg,#6366f1,#a855f7); color:white; }
    .logo-dl-btn.dark   { background: #0f172a; color:white; }
    .logo-dl-btn:hover  { transform: translateY(-1px); }
    .logo-symbol-grid { display: flex; flex-wrap:wrap; gap:.4rem; padding:.25rem 0; }
    .logo-sym-btn { width:36px; height:36px; border:1.5px solid #e2e8f0; border-radius:8px; background:#f8fafc;
                   font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:.12s; }
    .logo-sym-btn.active { border-color:#6366f1; background:#eef2ff; }
    .logo-sym-btn:hover  { border-color:#a5b4fc; background:#eef2ff; }
  `],
  template: `
<!-- Toast -->
<div *ngIf="toastMsg" class="toast" [class.success]="toastType==='success'" [class.info]="toastType==='info'">
  <span>{{ toastType==='success' ? '✓' : 'ℹ' }}</span> {{ toastMsg }}
</div>

<!-- ── Modal Enregistrer sous ── -->
<div *ngIf="saveModal" class="save-overlay" (click)="saveModal=false">
  <div class="save-modal" (click)="$event.stopPropagation()">

    <!-- Header -->
    <div class="save-header">
      <span class="save-header-ico">💾</span>
      <div>
        <div class="save-header-title">Enregistrer sous…</div>
        <div class="save-header-sub">{{ docTitle }} — choisissez le format de téléchargement</div>
      </div>
      <button class="save-close" (click)="saveModal=false">✕</button>
    </div>

    <!-- Format grid -->
    <div class="save-body">
      <div class="save-grid">

        <div class="fmt-card" (click)="saveAs('pdf')">
          <span class="fmt-ico">🖨️</span>
          <div class="fmt-info">
            <div class="fmt-label">PDF</div>
            <div class="fmt-desc">Dialogue impression navigateur → Enregistrer en PDF</div>
            <span class="fmt-ext">.pdf</span>
          </div>
        </div>

        <div class="fmt-card" (click)="saveAs('docx')">
          <span class="fmt-ico">📝</span>
          <div class="fmt-info">
            <div class="fmt-label">Word DOCX</div>
            <div class="fmt-desc">Compatible Microsoft Word 2007+, LibreOffice, Google Docs</div>
            <span class="fmt-ext">.docx</span>
          </div>
        </div>

        <div class="fmt-card" (click)="saveAs('doc')">
          <span class="fmt-ico">📄</span>
          <div class="fmt-info">
            <div class="fmt-label">Word DOC</div>
            <div class="fmt-desc">Format Word 97-2003, compatible avec toutes les versions</div>
            <span class="fmt-ext">.doc</span>
          </div>
        </div>

        <div class="fmt-card" (click)="saveAs('rtf')">
          <span class="fmt-ico">📰</span>
          <div class="fmt-info">
            <div class="fmt-label">RTF</div>
            <div class="fmt-desc">Rich Text Format — ouvert par Word, LibreOffice, TextEdit, Notepad++</div>
            <span class="fmt-ext">.rtf</span>
          </div>
        </div>

        <div class="fmt-card" (click)="saveAs('odt')">
          <span class="fmt-ico">📋</span>
          <div class="fmt-info">
            <div class="fmt-label">ODT</div>
            <div class="fmt-desc">OpenDocument Text — standard LibreOffice / OpenOffice</div>
            <span class="fmt-ext">.odt</span>
          </div>
        </div>

        <div class="fmt-card" (click)="saveAs('html')">
          <span class="fmt-ico">🌐</span>
          <div class="fmt-info">
            <div class="fmt-label">HTML</div>
            <div class="fmt-desc">Page web complète avec toute la mise en forme</div>
            <span class="fmt-ext">.html</span>
          </div>
        </div>

        <div class="fmt-card" (click)="saveAs('md')">
          <span class="fmt-ico">⬇️</span>
          <div class="fmt-info">
            <div class="fmt-label">Markdown</div>
            <div class="fmt-desc">Format Markdown — GitHub, Notion, Obsidian, VS Code</div>
            <span class="fmt-ext">.md</span>
          </div>
        </div>

        <div class="fmt-card" (click)="saveAs('txt')">
          <span class="fmt-ico">📋</span>
          <div class="fmt-info">
            <div class="fmt-label">Texte brut</div>
            <div class="fmt-desc">Texte sans mise en forme, universel</div>
            <span class="fmt-ext">.txt</span>
          </div>
        </div>

        <div class="fmt-card" (click)="saveAs('csv')">
          <span class="fmt-ico">📊</span>
          <div class="fmt-info">
            <div class="fmt-label">CSV (tableaux)</div>
            <div class="fmt-desc">Exporte les tableaux du document en CSV séparateur virgule</div>
            <span class="fmt-ext">.csv</span>
          </div>
        </div>

      </div>
    </div>

    <div class="save-footer">
      <span class="save-hint">💡 DOCX/DOC/ODT : format HTML enrichi lisible par tous les traitements de texte</span>
      <button class="save-cancel" (click)="saveModal=false">Annuler</button>
    </div>
  </div>
</div>
<!-- ── Modal Galerie CV ── -->
<div *ngIf="showCvModal" class="cv-modal-overlay" (click)="closeCvModal()">
  <div class="cv-modal" (click)="$event.stopPropagation()">

    <!-- Header -->
    <div class="cv-modal-head">
      <span class="cv-modal-head-ico">📚</span>
      <div>
        <h2 class="cv-modal-head-title">Galerie de modèles CV</h2>
        <p class="cv-modal-head-sub">{{ filteredCvTemplates.length }} modèle(s) — choisissez et personnalisez</p>
      </div>
      <button class="cv-modal-close" (click)="closeCvModal()">✕</button>
    </div>

    <!-- Filters -->
    <div class="cv-filters">
      <span class="cv-filter-label">Expérience :</span>
      <div class="cv-exp-pills">
        <button *ngFor="let opt of cvExpOptions"
                class="cv-pill"
                [class.active]="cvExpFilter === opt.value"
                (click)="cvExpFilter = opt.value; selectedCvTpl = null">
          {{ opt.label }}
        </button>
      </div>
      <span class="cv-filter-label" style="margin-left:.5rem">Domaine :</span>
      <select class="cv-domain-sel" [(ngModel)]="cvDomainFilter" (ngModelChange)="selectedCvTpl = null">
        <option *ngFor="let d of cvDomains" [value]="d.value">{{ d.label }}</option>
      </select>
      <span class="cv-count">{{ filteredCvTemplates.length }} modèle(s)</span>
    </div>

    <!-- Grid -->
    <div class="cv-tpl-grid">
      <div *ngFor="let tpl of filteredCvTemplates"
           class="cv-tpl-card"
           [class.selected]="selectedCvTpl?.id === tpl.id"
           (click)="selectedCvTpl = tpl">
        <!-- Scaled preview -->
        <div class="cv-tpl-preview">
          <div class="cv-tpl-preview-inner" [innerHTML]="tpl.html"></div>
          <!-- Color accent dot -->
          <div style="position:absolute;bottom:6px;right:6px;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.2)"
               [style.background]="tpl.preview"></div>
        </div>
        <div class="cv-tpl-info">
          <div class="cv-tpl-name">{{ tpl.name }}</div>
          <div class="cv-tpl-meta">
            <span *ngFor="let tag of tpl.tags.slice(0,1)" class="cv-tpl-tag">{{ tag }}</span>
            <span class="cv-tpl-ats"
                  [class.high]="tpl.atsScore >= 85"
                  [class.med]="tpl.atsScore >= 65 && tpl.atsScore < 85"
                  [class.low]="tpl.atsScore < 65">
              ATS {{ tpl.atsScore }}%
            </span>
            <span *ngIf="tpl.withPhoto" style="font-size:.6rem;color:#64748b">📷</span>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="filteredCvTemplates.length === 0"
           style="grid-column:1/-1;text-align:center;padding:3rem 1rem;color:#94a3b8">
        <div style="font-size:2.5rem;margin-bottom:.75rem">🔍</div>
        <p style="font-size:.9rem;font-weight:700;color:#64748b">Aucun modèle pour ces filtres</p>
        <p style="font-size:.8rem">Essayez "Toute expérience" ou "Tous les domaines"</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="cv-modal-footer">
      <span class="cv-footer-hint">
        <span *ngIf="!selectedCvTpl">Cliquez sur un modèle pour le sélectionner</span>
        <span *ngIf="selectedCvTpl">✓ <strong>{{ selectedCvTpl.name }}</strong> sélectionné — Score ATS : {{ selectedCvTpl.atsScore }}%</span>
      </span>
      <button class="cv-use-btn" [disabled]="!selectedCvTpl" (click)="loadCvTemplate()">
        📄 Utiliser ce modèle
      </button>
    </div>
  </div>
</div>

<!-- Context Menu -->
<div *ngIf="ctxMenu.visible" class="ctx-menu"
     [style.left.px]="ctxMenu.x" [style.top.px]="ctxMenu.y"
     (click)="$event.stopPropagation()">
  <div class="ctx-item" (click)="ctxExec('bold'); closeCtxMenu()">
    <span class="ctx-ico"><b>G</b></span> <span>Gras</span>
    <span class="ctx-shortcut">Ctrl+B</span>
  </div>
  <div class="ctx-item" (click)="ctxExec('italic'); closeCtxMenu()">
    <span class="ctx-ico"><i>I</i></span> <span>Italique</span>
    <span class="ctx-shortcut">Ctrl+I</span>
  </div>
  <div class="ctx-item" (click)="ctxExec('underline'); closeCtxMenu()">
    <span class="ctx-ico"><u>S</u></span> <span>Souligné</span>
    <span class="ctx-shortcut">Ctrl+U</span>
  </div>
  <div class="ctx-item" (click)="ctxExec('strikeThrough'); closeCtxMenu()">
    <span class="ctx-ico"><s>S</s></span> <span>Barré</span>
  </div>
  <div class="ctx-sep"></div>
  <div class="ctx-item" (click)="ctxExec('justifyLeft'); closeCtxMenu()">
    <span class="ctx-ico">⇐</span> <span>Aligner à gauche</span>
    <span class="ctx-shortcut">Ctrl+L</span>
  </div>
  <div class="ctx-item" (click)="ctxExec('justifyCenter'); closeCtxMenu()">
    <span class="ctx-ico">⇔</span> <span>Centrer</span>
    <span class="ctx-shortcut">Ctrl+E</span>
  </div>
  <div class="ctx-item" (click)="ctxExec('justifyRight'); closeCtxMenu()">
    <span class="ctx-ico">⇒</span> <span>Aligner à droite</span>
    <span class="ctx-shortcut">Ctrl+R</span>
  </div>
  <div class="ctx-sep"></div>
  <div class="ctx-item" (click)="ctxExec('copy'); closeCtxMenu()">
    <span class="ctx-ico">📋</span> <span>Copier</span>
    <span class="ctx-shortcut">Ctrl+C</span>
  </div>
  <div class="ctx-item" (click)="ctxExec('cut'); closeCtxMenu()">
    <span class="ctx-ico">✂️</span> <span>Couper</span>
    <span class="ctx-shortcut">Ctrl+X</span>
  </div>
  <div class="ctx-item" (click)="pasteFromClipboard(); closeCtxMenu()">
    <span class="ctx-ico">📌</span> <span>Coller</span>
    <span class="ctx-shortcut">Ctrl+V</span>
  </div>
  <div class="ctx-sep"></div>
  <div class="ctx-item" (click)="insertLink(); closeCtxMenu()">
    <span class="ctx-ico">🔗</span> <span>Insérer un lien</span>
    <span class="ctx-shortcut">Ctrl+K</span>
  </div>
  <div class="ctx-sep"></div>
  <div class="ctx-item danger" (click)="ctxExec('removeFormat'); closeCtxMenu()">
    <span class="ctx-ico">✕</span> <span>Effacer la mise en forme</span>
  </div>
</div>

<div class="cs-page">
  <div class="bg-blob b1"></div><div class="bg-blob b2"></div>
  <div class="cs-inner">

    <!-- Hero (masqué quand éditeur Office actif) -->
    <div class="hero animate-fade" *ngIf="!isOfficeTool()">
      <h1 class="hero-h1">Creative&nbsp;<span>Studio</span></h1>
      <span class="hero-sub">Créez, analysez et transformez vos documents et visuels.</span>
    </div>

    <!-- Panneau pleine largeur (navigation via mega menu)
         Bug corrigé (signalé sur Chrome uniquement, OK sur Firefox) : 'animate-fade'
         anime la propriété transform (fadeUp) — tout élément dont le transform calculé
         n'est pas 'none' devient le containing block de ses descendants en position
         fixed (spec CSS Transforms). Pendant les ~0,4s de l'animation, le panneau
         OnlyOffice (.panel--office, position fixed) résolvait donc top/left/right/bottom
         par rapport à CETTE div (hauteur indéterminée à cet instant) plutôt qu'au
         viewport — d'où la minuscule boîte en haut à gauche. Chrome semble ne jamais
         re-mesurer l'iframe OnlyOffice après coup (pas de ResizeObserver dans
         OfficeEditorComponent), contrairement à Firefox qui s'en sortait par un
         réagencement plus tolérant. Corrigé à la source : cette div n'anime plus quand
         un outil Office est actif, pour que .panel--office garde le viewport comme
         containing block dès le départ. -->
    <div [class.animate-fade]="!isOfficeTool()">
      <div class="panel" [class.panel--office]="isOfficeTool()" [class.panel--design]="designHtml!==null" [class.panel--rxresume]="selectedTool==='rxresume'">

        <!-- ═══ CV BUILDER INTÉGRÉ ═══ -->
        <!-- ═══ CV BUILDER (version custom) ═══ -->
        <ng-container *ngIf="selectedTool==='template-cv'">
          <div class="cvbuilder-panel">
            <iframe class="cvbuilder-iframe" src="/assets/cv-builder/index.html"
                    title="CV Builder" allow="downloads" loading="lazy"></iframe>
          </div>
        </ng-container>

        <!-- ═══ RXRESUME (version pro) ═══ -->
        <ng-container *ngIf="selectedTool==='rxresume'">
          <div class="rxresume-bar">
            <div class="rxresume-bar-left">
              <span class="rxresume-bar-ico">🏆</span>
              <span class="rxresume-bar-title">RxResume Pro</span>
              <span class="rxresume-bar-badge">20+ templates · Export PDF natif · Même session</span>
            </div>
            <div class="rxresume-bar-right">
              <button class="rxresume-direct-btn" (click)="openRxResumeDirect()">
                ↗ Ouvrir en plein onglet
              </button>
            </div>
          </div>
          <div *ngIf="rxresumeLoading" class="rxresume-loading">
            <div class="rxresume-spinner"></div>
            <span style="font-size:.85rem;font-weight:600">Connexion automatique…</span>
          </div>
          <iframe *ngIf="rxresumeReady && !rxresumeLoading"
                  class="rxresume-iframe"
                  [src]="rxresumeUrl"
                  title="RxResume"
                  allow="clipboard-read; clipboard-write; downloads">
          </iframe>
        </ng-container>

        <!-- ═══ GALERIE CV ═══ -->
        <ng-container *ngIf="selectedTool==='cv-gallery'">
          <div class="cvgal-page">
            <div class="cvgal-header">
              <div>
                <div class="cvgal-title">🖼️ Galerie de templates CV</div>
                <div class="cvgal-subtitle">{{ cvGalFiltered.length }} templates · Cliquez pour sélectionner</div>
              </div>
              <input class="cvgal-search" [(ngModel)]="cvGalSearch" placeholder="🔍 Rechercher un template…" (input)="onCvGalSearch()" />
            </div>

            <div class="cvgal-grid">
              <div *ngFor="let tpl of cvGalFiltered"
                   class="cvgal-card"
                   [class.selected]="cvGalSelected?.id === tpl.id"
                   (click)="cvGalSelect(tpl)">
                <!-- Prévisualisation stylisée -->
                <div class="cvgal-preview" [style.background]="tpl.bg">
                  <div class="cvgal-preview-header" [style.background]="tpl.accent">
                    <div class="cvgal-preview-avatar" *ngIf="tpl.hasPhoto"></div>
                    <div class="cvgal-preview-lines">
                      <div class="cvgal-preview-line w80"></div>
                      <div class="cvgal-preview-line w60"></div>
                    </div>
                  </div>
                  <div class="cvgal-preview-body">
                    <div class="cvgal-preview-main">
                      <div *ngFor="let _ of [1,2,3,4,5]" class="cvgal-preview-block dark" [style.width]="(_ % 3 === 0 ? '70%' : _ % 2 === 0 ? '90%' : '100%')"></div>
                    </div>
                    <div class="cvgal-preview-side" *ngIf="tpl.sidebar">
                      <div *ngFor="let _ of [1,2,3]" class="cvgal-preview-block" [style.background]="tpl.accent" [style.opacity]="'.4'" [style.width]="'100%'" [style.height.px]="8"></div>
                    </div>
                  </div>
                </div>
                <!-- Infos -->
                <div class="cvgal-info">
                  <div class="cvgal-name">{{ tpl.id }}</div>
                  <div class="cvgal-tags">
                    <span *ngIf="tpl.ats" class="cvgal-tag ats">ATS</span>
                    <span *ngIf="tpl.sidebar" class="cvgal-tag sidebar">Sidebar</span>
                    <span class="cvgal-tag modern">{{ tpl.style }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer : sélection + création -->
            <div class="cvgal-footer">
              <span *ngIf="!cvGalSelected" style="font-size:.82rem;color:#94a3b8;">← Sélectionnez un template</span>
              <span *ngIf="cvGalSelected" class="cvgal-sel-name">✓ {{ cvGalSelected.id }}</span>
              <input *ngIf="cvGalSelected" class="cvgal-inp" [(ngModel)]="cvGalName" placeholder="Nom de votre CV…" (keyup.enter)="cvGalCreate()" />
              <button *ngIf="cvGalSelected" class="cvgal-cta" [disabled]="cvGalCreating || !cvGalName.trim()" (click)="cvGalCreate()">
                <span *ngIf="!cvGalCreating">✏️ Créer &amp; Ouvrir</span>
                <span *ngIf="cvGalCreating"><span class="cvgal-spinner"></span> Création…</span>
              </button>
            </div>
          </div>
        </ng-container>

        <!-- ═══ RXRESUME LAB ═══ -->
        <ng-container *ngIf="selectedTool==='rxresume-lab'">
          <div class="lab-page">
            <div class="lab-title">🧪 RxResume Lab — Test des 4 possibilités API</div>
            <div class="lab-grid">

              <!-- 1. Template Gallery -->
              <div class="lab-card">
                <div class="lab-card-head">
                  <span class="lab-card-ico">🎨</span>
                  <span class="lab-card-label">1 · Galerie des templates</span>
                </div>
                <div class="lab-card-desc">15 templates intégrés. Clic → crée un CV avec ce template et ouvre l'éditeur.</div>
                <div class="lab-tpl-grid">
                  <span *ngFor="let tpl of rxLabTemplates"
                        class="lab-tpl-chip"
                        [class.selected]="labSelectedTpl===tpl.id"
                        [style.background]="tpl.bg" [style.color]="tpl.fg"
                        (click)="labSelectTemplate(tpl.id)">
                    {{ tpl.id }}
                  </span>
                </div>
                <button class="lab-btn" [disabled]="!labSelectedTpl || labLoading[1]" (click)="labCreateWithTemplate()">
                  {{ labLoading[1] ? '⏳ Création...' : '➕ Créer CV avec ce template' }}
                </button>
                <div *ngIf="labResults[1]" class="lab-result" [class.success]="!labResults[1].startsWith('❌')" [class.error]="labResults[1].startsWith('❌')">{{ labResults[1] }}</div>
                <button *ngIf="labLastId[1]" class="lab-btn" style="background:linear-gradient(135deg,#059669,#10b981);" (click)="labOpenEditor(labLastId[1])">
                  ✏️ Ouvrir l'éditeur
                </button>
              </div>

              <!-- 2. Créer via IA -->
              <div class="lab-card">
                <div class="lab-card-head">
                  <span class="lab-card-ico">🤖</span>
                  <span class="lab-card-label">2 · Créer CV via IA</span>
                </div>
                <div class="lab-card-desc">Envoie un JSON pré-rempli (nom, expérience, compétences) à l'API et crée un CV en 1 clic.</div>
                <select class="sort-select" style="font-size:.8rem;padding:.3rem .5rem;border-radius:6px;border:1px solid #d1d5db;" [(ngModel)]="labAiTemplate">
                  <option *ngFor="let tpl of rxLabTemplates" [value]="tpl.id">{{ tpl.id }}</option>
                </select>
                <button class="lab-btn" [disabled]="labLoading[2]" (click)="labCreateWithAI()">
                  {{ labLoading[2] ? '⏳ Création...' : '🤖 Créer avec données IA' }}
                </button>
                <div *ngIf="labResults[2]" class="lab-result" [class.success]="!labResults[2].startsWith('❌')" [class.error]="labResults[2].startsWith('❌')">{{ labResults[2] }}</div>
                <button *ngIf="labLastId[2]" class="lab-btn" style="background:linear-gradient(135deg,#059669,#10b981);" (click)="labOpenEditor(labLastId[2])">
                  ✏️ Ouvrir l'éditeur
                </button>
              </div>

              <!-- 3. Changer de template -->
              <div class="lab-card">
                <div class="lab-card-head">
                  <span class="lab-card-ico">🔄</span>
                  <span class="lab-card-label">3 · Changer de template</span>
                </div>
                <div class="lab-card-desc">Sélectionne un CV existant et change son template instantanément via l'API.</div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                  <select class="sort-select" style="font-size:.8rem;padding:.3rem .5rem;border-radius:6px;border:1px solid #d1d5db;flex:1;" [(ngModel)]="labChangeResumeId">
                    <option value="">-- Choisir un CV --</option>
                    <option *ngFor="let r of labResumes" [value]="r.id">{{ r.name }} ({{ r.slug }})</option>
                  </select>
                  <select class="sort-select" style="font-size:.8rem;padding:.3rem .5rem;border-radius:6px;border:1px solid #d1d5db;" [(ngModel)]="labChangeTemplate">
                    <option *ngFor="let tpl of rxLabTemplates" [value]="tpl.id">{{ tpl.id }}</option>
                  </select>
                </div>
                <button class="lab-btn" [disabled]="!labChangeResumeId || labLoading[3]" (click)="labChangeTemplateApi()">
                  {{ labLoading[3] ? '⏳ Mise à jour...' : '🔄 Changer template' }}
                </button>
                <button class="lab-btn" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);margin-top:.25rem;" (click)="labLoadResumes()">🔃 Rafraîchir CVs</button>
                <div *ngIf="labResults[3]" class="lab-result" [class.success]="!labResults[3].startsWith('❌')" [class.error]="labResults[3].startsWith('❌')">{{ labResults[3] }}</div>
                <button *ngIf="labResults[3] && !labResults[3].startsWith('❌') && labChangeResumeId" class="lab-btn" style="background:linear-gradient(135deg,#059669,#10b981);" (click)="labOpenEditor(labChangeResumeId)">
                  ✏️ Ouvrir ce CV
                </button>
              </div>

              <!-- 4. Export PDF -->
              <div class="lab-card">
                <div class="lab-card-head">
                  <span class="lab-card-ico">📄</span>
                  <span class="lab-card-label">4 · Export PDF</span>
                </div>
                <div class="lab-card-desc">Déclenche la génération PDF via l'API oRPC et retourne l'URL de téléchargement.</div>
                <select class="sort-select" style="font-size:.8rem;padding:.3rem .5rem;border-radius:6px;border:1px solid #d1d5db;" [(ngModel)]="labPdfResumeId">
                  <option value="">-- Choisir un CV --</option>
                  <option *ngFor="let r of labResumes" [value]="r.id">{{ r.name }} ({{ r.slug }})</option>
                </select>
                <button class="lab-btn" [disabled]="!labPdfResumeId || labLoading[4]" (click)="labExportPdf()">
                  {{ labLoading[4] ? '⏳ Génération...' : '📄 Exporter en PDF' }}
                </button>
                <div *ngIf="labResults[4]" class="lab-result" [class.success]="!labResults[4].startsWith('❌')" [class.error]="labResults[4].startsWith('❌')">{{ labResults[4] }}</div>
              </div>

            </div>
          </div>
        </ng-container>

        <!-- ═══ ÉDITEUR DE TEXTE RICHE ═══ -->
        <ng-container *ngIf="selectedTool==='editor' || isTemplateTool()">

          <!-- Template picker (si outil = éditeur ou modèle) -->
          <div class="panel-head">
            <div class="panel-ico-wrap">{{ currentToolDef?.icon }}</div>
            <div>
              <h2 class="panel-title">{{ currentToolDef?.name }}</h2>
              <p class="panel-hint">{{ currentToolDef?.desc }}</p>
            </div>
            <!-- Bouton galerie CV (autres modèles lettres/CR/congé) -->
            <button *ngIf="selectedTool !== 'editor'"
                    class="btn-browse-tpl"
                    (click)="openCvModal()">
              📚 Parcourir les modèles
            </button>
          </div>

          <!-- ── Word-like Application Frame ── -->
          <div class="word-app" (click)="closeCtxMenu()">

            <!-- Title bar -->
            <div class="word-titlebar">
              <span class="word-title-ico">📝</span>
              <span class="word-filename">{{ docTitle }}</span>
              <!-- Quick access toolbar -->
              <div class="word-qa">
                <button class="wqa-btn" title="Ouvrir un fichier (HTML, TXT, MD, RTF)" (mousedown)="$event.preventDefault(); openFile()">📂</button>
                <button class="wqa-btn" title="Enregistrer (Ctrl+S)" (mousedown)="$event.preventDefault(); autoSave()">💾</button>
                <button class="wqa-btn" title="Annuler (Ctrl+Z)"     (mousedown)="$event.preventDefault(); exec('undo')">↩</button>
                <button class="wqa-btn" title="Rétablir (Ctrl+Y)"    (mousedown)="$event.preventDefault(); exec('redo')">↪</button>
                <button class="wqa-btn" title="Imprimer"             (mousedown)="$event.preventDefault(); printDoc()">🖨️</button>
              </div>
              <!-- Window controls -->
              <div class="word-winbtns">
                <button class="win-btn" title="Réduire" (click)="editorMinimized=!editorMinimized">—</button>
                <button class="win-btn" title="Agrandir" (click)="editorMaximized=!editorMaximized">⬜</button>
                <button class="win-btn close" title="Fermer" (click)="clearEditor()">✕</button>
              </div>
            </div>

            <!-- Ribbon tabs -->
            <div class="ribbon-tabs">
              <button class="rtab" [class.active]="ribbonTab==='accueil'"    (click)="ribbonTab='accueil'">Accueil</button>
              <button class="rtab" [class.active]="ribbonTab==='insertion'"  (click)="ribbonTab='insertion'">Insertion</button>
              <button class="rtab" [class.active]="ribbonTab==='misepage'"   (click)="ribbonTab='misepage'">Mise en page</button>
              <button class="rtab" [class.active]="ribbonTab==='revision'"   (click)="ribbonTab='revision'">Révision</button>
              <button class="rtab" [class.active]="ribbonTab==='affichage'"  (click)="ribbonTab='affichage'">Affichage</button>
            </div>

            <!-- ══ RIBBON ACCUEIL ══ -->
            <div class="ribbon" *ngIf="ribbonTab==='accueil'">

              <!-- Groupe : Police -->
              <div class="rgroup">
                <div class="rgroup-btns" style="flex-direction:column; gap:.18rem">
                  <div class="font-row">
                    <select class="font-family-sel" [(ngModel)]="fontFamily" (change)="applyFont()"
                            title="Police">
                      <option *ngFor="let f of fontFamilies" [value]="f">{{ f }}</option>
                    </select>
                    <input class="font-size-in" type="number" [(ngModel)]="fontSize"
                           (change)="applyFontSize()" min="6" max="96" title="Taille">
                    <button class="rb" title="Augmenter taille" (mousedown)="$event.preventDefault(); changeFontSize(1)">A<sup style="font-size:.55rem">▲</sup></button>
                    <button class="rb" title="Diminuer taille"  (mousedown)="$event.preventDefault(); changeFontSize(-1)">A<sub style="font-size:.55rem">▼</sub></button>
                  </div>
                  <div class="font-row">
                    <button class="rb" title="Gras (Ctrl+B)"       [class.on]="fmtState.bold"
                            (mousedown)="$event.preventDefault(); exec('bold')"><b style="font-size:.85rem">G</b></button>
                    <button class="rb" title="Italique (Ctrl+I)"   [class.on]="fmtState.italic"
                            (mousedown)="$event.preventDefault(); exec('italic')"><i style="font-size:.85rem">I</i></button>
                    <button class="rb" title="Souligné (Ctrl+U)"   [class.on]="fmtState.underline"
                            (mousedown)="$event.preventDefault(); exec('underline')"><u style="font-size:.85rem">S</u></button>
                    <button class="rb" title="Barré"               [class.on]="fmtState.strikeThrough"
                            (mousedown)="$event.preventDefault(); exec('strikeThrough')"><s style="font-size:.78rem">abc</s></button>
                    <button class="rb" title="Exposant"
                            (mousedown)="$event.preventDefault(); exec('superscript')">x<sup style="font-size:.55rem">2</sup></button>
                    <button class="rb" title="Indice"
                            (mousedown)="$event.preventDefault(); exec('subscript')">x<sub style="font-size:.55rem">2</sub></button>
                    <div class="rb-sep"></div>
                    <!-- Couleur texte -->
                    <label style="position:relative; cursor:pointer" title="Couleur du texte">
                      <span class="rb" style="position:relative">
                        <span style="font-size:.78rem; font-weight:700">A</span>
                        <span style="position:absolute;bottom:2px;left:4px;right:4px;height:3px;border-radius:1px;background:{{textColor}}"></span>
                      </span>
                      <input type="color" [(ngModel)]="textColor" (change)="applyTextColor()"
                             style="position:absolute;opacity:0;width:0;height:0">
                    </label>
                    <!-- Surlignage -->
                    <label style="position:relative; cursor:pointer" title="Couleur de surbrillance">
                      <span class="rb">
                        <span style="font-size:.78rem; background:{{hlColor}};padding:0 2px">ab</span>
                      </span>
                      <input type="color" [(ngModel)]="hlColor" (change)="applyHighlight()"
                             style="position:absolute;opacity:0;width:0;height:0">
                    </label>
                    <!-- Effacer mise en forme -->
                    <button class="rb danger" title="Effacer la mise en forme"
                            (mousedown)="$event.preventDefault(); exec('removeFormat')">✕<sub style="font-size:.55rem">A</sub></button>
                  </div>
                </div>
                <div class="rgroup-name">Police</div>
              </div>

              <!-- Groupe : Paragraphe -->
              <div class="rgroup">
                <div class="rgroup-btns" style="flex-direction:column; gap:.18rem">
                  <div class="font-row">
                    <button class="rb" title="Liste à puces"
                            (mousedown)="$event.preventDefault(); exec('insertUnorderedList')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
                    </button>
                    <button class="rb" title="Liste numérotée"
                            (mousedown)="$event.preventDefault(); exec('insertOrderedList')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="1" y="8" font-size="7" fill="currentColor" stroke="none">1</text><text x="1" y="14" font-size="7" fill="currentColor" stroke="none">2</text><text x="1" y="20" font-size="7" fill="currentColor" stroke="none">3</text></svg>
                    </button>
                    <button class="rb" title="Diminuer le retrait"
                            (mousedown)="$event.preventDefault(); exec('outdent')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="21" y1="6" x2="9" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/><polyline points="7 9 3 12 7 15"/></svg>
                    </button>
                    <button class="rb" title="Augmenter le retrait"
                            (mousedown)="$event.preventDefault(); exec('indent')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><polyline points="3 9 7 12 3 15"/></svg>
                    </button>
                    <div class="rb-sep"></div>
                    <button class="rb" title="Interligne" style="font-size:.6rem"
                            (mousedown)="$event.preventDefault(); cycleLineHeight()">↕ {{ lineHeight }}</button>
                  </div>
                  <div class="font-row">
                    <button class="rb" title="Aligner à gauche (Ctrl+L)"  [class.on]="fmtState.justifyLeft"
                            (mousedown)="$event.preventDefault(); exec('justifyLeft')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                    </button>
                    <button class="rb" title="Centrer (Ctrl+E)"           [class.on]="fmtState.justifyCenter"
                            (mousedown)="$event.preventDefault(); exec('justifyCenter')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                    </button>
                    <button class="rb" title="Aligner à droite (Ctrl+R)" [class.on]="fmtState.justifyRight"
                            (mousedown)="$event.preventDefault(); exec('justifyRight')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
                    </button>
                    <button class="rb" title="Justifier (Ctrl+J)"        [class.on]="fmtState.justifyFull"
                            (mousedown)="$event.preventDefault(); exec('justifyFull')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </button>
                  </div>
                </div>
                <div class="rgroup-name">Paragraphe</div>
              </div>

              <!-- Groupe : Styles -->
              <div class="rgroup">
                <div class="rgroup-btns">
                  <div class="style-gallery">
                    <button class="style-btn s-normal" (mousedown)="$event.preventDefault(); applyStyle('p')">Normal</button>
                    <button class="style-btn s-nospace" (mousedown)="$event.preventDefault(); applyStyle('div')">Aucun espace</button>
                    <button class="style-btn s-h1" (mousedown)="$event.preventDefault(); applyStyle('h1')">Titre 1</button>
                    <button class="style-btn s-h2" (mousedown)="$event.preventDefault(); applyStyle('h2')">Titre 2</button>
                    <button class="style-btn s-h3" (mousedown)="$event.preventDefault(); applyStyle('h3')">Titre 3</button>
                    <button class="style-btn" style="font-weight:600;font-size:.68rem;color:#7c3aed" (mousedown)="$event.preventDefault(); applyStyle('h4')">Titre 4</button>
                    <button class="style-btn" style="font-style:italic;color:#64748b;font-size:.68rem" (mousedown)="$event.preventDefault(); applyStyle('blockquote')">Citation</button>
                  </div>
                </div>
                <div class="rgroup-name">Styles</div>
              </div>

              <!-- Groupe : Édition -->
              <div class="rgroup">
                <div class="rgroup-btns" style="flex-direction:column; gap:.18rem; align-items:flex-start">
                  <button class="rb" title="Sélectionner tout (Ctrl+A)"
                          (mousedown)="$event.preventDefault(); exec('selectAll')" style="width:100%; justify-content:flex-start; gap:.4rem; padding:.2rem .5rem">
                    <span>☰</span><span style="font-size:.7rem">Sélectionner tout</span>
                  </button>
                  <button class="rb danger" title="Effacer le document"
                          (mousedown)="$event.preventDefault(); clearEditor()" style="width:100%; justify-content:flex-start; gap:.4rem; padding:.2rem .5rem">
                    <span>🗑️</span><span style="font-size:.7rem">Nouveau doc</span>
                  </button>
                </div>
                <div class="rgroup-name">Édition</div>
              </div>

            </div>

            <!-- ══ RIBBON INSERTION ══ -->
            <div class="ribbon" *ngIf="ribbonTab==='insertion'">

              <!-- Images -->
              <div class="rgroup">
                <div class="rgroup-btns">
                  <button class="rb rb-lg" title="Insérer une image" (mousedown)="$event.preventDefault(); insertImage()">
                    <span class="rb-icon">🖼️</span><span class="rb-txt">Image</span>
                  </button>
                  <button class="rb rb-lg" title="Insérer un tableau" (mousedown)="$event.preventDefault(); insertTable()">
                    <span class="rb-icon">⊞</span><span class="rb-txt">Tableau</span>
                  </button>
                </div>
                <div class="rgroup-name">Illustrations</div>
              </div>

              <!-- Liens -->
              <div class="rgroup">
                <div class="rgroup-btns">
                  <button class="rb rb-lg" title="Insérer un lien (Ctrl+K)" (mousedown)="$event.preventDefault(); insertLink()">
                    <span class="rb-icon">🔗</span><span class="rb-txt">Lien</span>
                  </button>
                </div>
                <div class="rgroup-name">Liens</div>
              </div>

              <!-- Texte -->
              <div class="rgroup">
                <div class="rgroup-btns">
                  <button class="rb rb-lg" title="Insérer un séparateur horizontal" (mousedown)="$event.preventDefault(); exec('insertHorizontalRule')">
                    <span class="rb-icon">—</span><span class="rb-txt">Séparateur</span>
                  </button>
                  <button class="rb rb-lg" title="Insérer la date/heure" (mousedown)="$event.preventDefault(); insertDateTime()">
                    <span class="rb-icon">📅</span><span class="rb-txt">Date</span>
                  </button>
                  <button class="rb rb-lg" title="Insérer un caractère spécial" (mousedown)="$event.preventDefault(); insertSpecialChar()">
                    <span class="rb-icon">Ω</span><span class="rb-txt">Symbole</span>
                  </button>
                </div>
                <div class="rgroup-name">Texte</div>
              </div>

            </div>

            <!-- ══ RIBBON MISE EN PAGE ══ -->
            <div class="ribbon" *ngIf="ribbonTab==='misepage'">
              <div class="rgroup">
                <div class="rgroup-btns">
                  <button class="rb rb-lg" title="Portrait" [class.on]="pageOrient==='portrait'" (click)="pageOrient='portrait'">
                    <span class="rb-icon">📄</span><span class="rb-txt">Portrait</span>
                  </button>
                  <button class="rb rb-lg" title="Paysage" [class.on]="pageOrient==='landscape'" (click)="pageOrient='landscape'">
                    <span class="rb-icon">📰</span><span class="rb-txt">Paysage</span>
                  </button>
                </div>
                <div class="rgroup-name">Orientation</div>
              </div>
              <div class="rgroup">
                <div class="rgroup-btns">
                  <button class="rb rb-lg" *ngFor="let m of pageMargins" [class.on]="selectedMargin===m.id" (click)="selectedMargin=m.id">
                    <span class="rb-icon">📐</span><span class="rb-txt">{{ m.label }}</span>
                  </button>
                </div>
                <div class="rgroup-name">Marges</div>
              </div>
            </div>

            <!-- ══ RIBBON RÉVISION ══ -->
            <div class="ribbon" *ngIf="ribbonTab==='revision'">
              <div class="rgroup">
                <div class="rgroup-btns">
                  <button class="rb rb-lg" (mousedown)="$event.preventDefault(); exec('undo')">
                    <span class="rb-icon">↩</span><span class="rb-txt">Annuler</span>
                  </button>
                  <button class="rb rb-lg" (mousedown)="$event.preventDefault(); exec('redo')">
                    <span class="rb-icon">↪</span><span class="rb-txt">Rétablir</span>
                  </button>
                </div>
                <div class="rgroup-name">Historique</div>
              </div>
              <div class="rgroup">
                <div class="rgroup-btns">
                  <button class="rb rb-lg" (mousedown)="$event.preventDefault(); checkSpelling()">
                    <span class="rb-icon">ABC</span><span class="rb-txt">Orthographe</span>
                  </button>
                  <button class="rb rb-lg" (mousedown)="$event.preventDefault(); countWords()">
                    <span class="rb-icon">🔢</span><span class="rb-txt">Statistiques</span>
                  </button>
                </div>
                <div class="rgroup-name">Vérification</div>
              </div>
            </div>

            <!-- ══ RIBBON AFFICHAGE ══ -->
            <div class="ribbon" *ngIf="ribbonTab==='affichage'">
              <div class="rgroup">
                <div class="rgroup-btns">
                  <button class="rb rb-lg" [class.on]="showRuler" (click)="showRuler=!showRuler">
                    <span class="rb-icon">📏</span><span class="rb-txt">Règle</span>
                  </button>
                  <button class="rb rb-lg" [class.on]="showWordCount" (click)="showWordCount=!showWordCount">
                    <span class="rb-icon">🔢</span><span class="rb-txt">Nb mots</span>
                  </button>
                </div>
                <div class="rgroup-name">Afficher/Masquer</div>
              </div>
              <div class="rgroup">
                <div class="rgroup-btns">
                  <button class="rb rb-lg" *ngFor="let z of zoomLevels" [class.on]="editorZoom===z"
                          (click)="editorZoom=z">
                    <span class="rb-icon">🔍</span><span class="rb-txt">{{ z }}%</span>
                  </button>
                </div>
                <div class="rgroup-name">Zoom</div>
              </div>
            </div>

            <!-- ── Ruler (optionnel) ── -->
            <div *ngIf="showRuler" style="background:#f3f4f6; border-bottom:1px solid #d1d5db; height:20px; display:flex; align-items:center; padding:0 .5rem; overflow:hidden">
              <div style="flex:1; height:12px; background:linear-gradient(90deg, transparent 0, transparent 100%); position:relative; margin:0 auto; max-width:680px">
                <div *ngFor="let tick of rulerTicks; let i=index"
                     style="position:absolute; height: {{ tick.h }}px; width:1px; background:#9ca3af; bottom:0"
                     [style.left.%]="tick.pos">
                  <span *ngIf="tick.label" style="position:absolute; bottom:100%; font-size:8px; color:#9ca3af; transform:translateX(-50%)">{{ tick.label }}</span>
                </div>
              </div>
            </div>

            <!-- ── Document page ── -->
            <div class="page-canvas" *ngIf="!editorMinimized"
                 [style.height]="editorMaximized ? 'calc(100vh - 200px)' : '520px'">
              <div class="page-sheet"
                   [style.max-width]="pageOrient==='landscape' ? '900px' : '680px'"
                   [style.min-height]="pageOrient==='landscape' ? '480px' : '900px'"
                   [style.padding]="marginStyle">
                <div #editorArea class="word-editor"
                     contenteditable="true"
                     data-placeholder="Commencez à rédiger votre document…"
                     (input)="onEditorInput()"
                     (keydown)="onEditorKeydown($event)"
                     (mouseup)="updateFmtState()"
                     (keyup)="updateFmtState()"
                     (contextmenu)="onCtxMenu($event)"
                     (click)="onEditorClick($event)"
                     [style.font-family]="fontFamily+', Calibri, Arial, sans-serif'"
                     [style.font-size]="fontSize+'pt'"
                     [style.line-height]="lineHeight"
                     [style.zoom]="editorZoom/100">
                </div>
              </div>
            </div>

            <!-- ── Status bar ── -->
            <div class="statusbar">
              <span class="sb-lbl">Page</span><span class="sb-val">1</span>
              <span class="sb-sep"></span>
              <span class="sb-lbl">Mots :</span>
              <span class="sb-val" *ngIf="showWordCount">{{ wordCount }}</span>
              <span class="sb-val" *ngIf="!showWordCount">—</span>
              <span class="sb-sep"></span>
              <span class="sb-lbl">Caractères :</span>
              <span class="sb-val">{{ charCount }}</span>
              <span class="sb-sep"></span>
              <span class="sb-lbl">Police :</span>
              <span class="sb-val">{{ fontFamily }}, {{ fontSize }}pt</span>
              <div class="sb-right">
                <span class="sb-lbl">Zoom :</span>
                <select class="zoom-sel" [(ngModel)]="editorZoom">
                  <option *ngFor="let z of zoomLevels" [value]="z">{{ z }}%</option>
                </select>
              </div>
            </div>

          </div>

          <!-- Actions d'export sous la fenêtre Word -->
          <div class="editor-actions">
            <button class="ed-btn secondary" (click)="printDoc()">
              🖨️ Imprimer / PDF
            </button>
            <button class="ed-btn secondary" (click)="exportHtml()">⬇ HTML</button>
            <button class="ed-btn secondary" (click)="exportTxt()">⬇ TXT</button>
            <button class="ed-btn primary" (click)="copyEditorContent()">📋 Copier</button>
          </div>

        </ng-container>

        <!-- ═══ IDENTITÉ VISUELLE — Penpot Designer ═══ -->
        <ng-container *ngIf="isIdentityTool() && !designHtml">

          <!-- En-tête -->
          <div class="panel-head">
            <div class="panel-ico-wrap" [style.background]="identityGradient()">{{ identityIcon() }}</div>
            <div>
              <h2 class="panel-title">{{ identityTitle() }}</h2>
              <p class="panel-hint">Éditeur vectoriel professionnel — drag & drop, templates, export SVG/PNG/PDF</p>
            </div>
          </div>

          <!-- Sélecteur d'outil -->
          <div class="iv-tool-bar">
            <button class="iv-tool-btn" [class.active]="selectedTool==='badge'" (click)="selectTool('badge')"><span class="iv-ico">🏷️</span> Badges</button>
            <button class="iv-tool-btn" [class.active]="selectedTool==='carte-visite'" (click)="selectTool('carte-visite')"><span class="iv-ico">💼</span> Carte de visite</button>
            <button class="iv-tool-btn" [class.active]="selectedTool==='logo'" (click)="selectTool('logo')"><span class="iv-ico">🎨</span> Logo</button>
          </div>

          <!-- Zone de lancement Penpot -->
          <div class="penpot-launch">
            <div class="penpot-preview">
              <div class="penpot-preview-icon">🎨</div>
              <div class="penpot-preview-title">Penpot Design Studio</div>
              <div class="penpot-preview-sub">Outil vectoriel open-source · Figma-like · Auto-hébergé</div>
              <div class="penpot-features">
                <div class="penpot-feat"><span>✦</span> Tous les éléments déplaçables et redimensionnables</div>
                <div class="penpot-feat"><span>✦</span> Templates professionnels intégrés</div>
                <div class="penpot-feat"><span>✦</span> Texte, formes, images, dégradés, ombres</div>
                <div class="penpot-feat"><span>✦</span> Export SVG, PNG, PDF haute résolution</div>
                <div class="penpot-feat"><span>✦</span> Bibliothèques de composants réutilisables</div>
                <div class="penpot-feat"><span>✦</span> Grilles, guides, alignement précis</div>
              </div>
              <button class="penpot-open-btn" (click)="openPenpot()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Ouvrir Penpot Designer
              </button>
              <div class="penpot-hint">S'ouvre dans un nouvel onglet · <strong>localhost:9090</strong></div>
            </div>

            <!-- Import CSV pour badges en lot -->
            <div class="penpot-side" *ngIf="selectedTool==='badge'">
              <div class="penpot-side-title">🏷️ Génération en lot (badges)</div>
              <div class="csv-section">
                <div class="csv-upload-row">
                  <label class="csv-upload-btn">
                    📂 Importer CSV / Excel
                    <input type="file" accept=".csv,.xlsx,.xls,.txt" style="display:none" (change)="onCsvImport($event)">
                  </label>
                </div>
                <div style="font-size:.68rem;color:#94a3b8;margin:.3rem 0">Colonnes : Nom ; Rôle ; Organisation ; ID</div>
                <ng-container *ngIf="csvPersons.length > 0">
                  <div class="csv-list">
                    <div *ngFor="let p of csvPersons; let i=index" class="csv-row" [class.active]="csvIndex===i" (click)="csvIndex=i">
                      <span class="csv-row-name">{{ p.name }}</span>
                      <span class="csv-row-role">{{ p.role }}</span>
                    </div>
                  </div>
                  <button class="csv-gen-btn" (click)="printAllBadges()">
                    🖨️ Imprimer tous ({{ csvPersons.length }})
                  </button>
                </ng-container>
              </div>
            </div>
          </div>

          <!-- Canvas caché pour batch badges -->
          <canvas #badgeCanvas width="340" height="210" style="display:none"></canvas>
        </ng-container>


        <!-- ═══ DESIGN EDITOR (legacy — conservé pour les exports) ═══ -->
        <ng-container *ngIf="designHtml !== null">
          <app-design-editor
            [baseHtml]="designHtml"
            [initialObjects]="designObjects"
            [canvasBg]="designBg"
            [dynamicFields]="designDynFields"
            [width]="designWidth"
            [height]="designHeight"
            (savedEvent)="onDesignSaved($event)"
            (cancelEvent)="onDesignCancel()"
            style="display:flex;flex-direction:column;flex:1;min-height:0;height:100%">
          </app-design-editor>
        </ng-container>

        <!-- ═══ WORD — OnlyOffice ═══ -->
        <ng-container *ngIf="selectedTool==='office-word'">
          <ng-container *ngIf="!officeConfig">
            <div class="panel-head">
              <div class="panel-ico-wrap" style="background:linear-gradient(135deg,#2563eb,#1d4ed8)">📝</div>
              <div>
                <h2 class="panel-title">Word — Traitement de texte</h2>
                <p class="panel-hint">Éditeur .docx complet · Propulsé par <strong>OnlyOffice</strong></p>
              </div>
            </div>
            <div class="office-launch">
              <div class="office-launch-icon">📝</div>
              <h3 class="office-launch-title">Document Word</h3>
              <p class="office-launch-hint">Créez et éditez des documents Word avec mise en forme avancée, tableaux, images et export .docx natif.</p>
              <button class="office-open-btn" style="background:linear-gradient(135deg,#2563eb,#1d4ed8)"
                      (click)="openOfficeEditor('word')">Ouvrir Word</button>
              <div class="office-info-banner">
                <span>ℹ️</span>
                <span>Propulsé par <strong>OnlyOffice Document Server</strong> — Éditeur Office open-source auto-hébergé.</span>
              </div>
            </div>
          </ng-container>
          <app-office-editor *ngIf="officeConfig" [config]="officeConfig"
            (cancel)="closeOfficeEditor()"
            style="display:flex;flex-direction:column;flex:1;min-height:0;height:100%">
          </app-office-editor>
        </ng-container>

        <!-- ═══ EXCEL — OnlyOffice ═══ -->
        <ng-container *ngIf="selectedTool==='office-excel'">
          <ng-container *ngIf="!officeConfig">
            <div class="panel-head">
              <div class="panel-ico-wrap" style="background:linear-gradient(135deg,#16a34a,#15803d)">📊</div>
              <div>
                <h2 class="panel-title">Excel — Tableur</h2>
                <p class="panel-hint">Éditeur .xlsx complet · Propulsé par <strong>OnlyOffice</strong></p>
              </div>
            </div>
            <div class="office-launch">
              <div class="office-launch-icon">📊</div>
              <h3 class="office-launch-title">Tableau Excel</h3>
              <p class="office-launch-hint">Créez et éditez des tableurs Excel avec formules, graphiques, tableaux croisés dynamiques et export .xlsx natif.</p>
              <button class="office-open-btn" style="background:linear-gradient(135deg,#16a34a,#15803d)"
                      (click)="openOfficeEditor('cell')">Ouvrir Excel</button>
              <div class="office-info-banner">
                <span>ℹ️</span>
                <span>Propulsé par <strong>OnlyOffice Document Server</strong> — Éditeur Office open-source auto-hébergé.</span>
              </div>
            </div>
          </ng-container>
          <app-office-editor *ngIf="officeConfig" [config]="officeConfig"
            (cancel)="closeOfficeEditor()"
            style="display:flex;flex-direction:column;flex:1;min-height:0;height:100%">
          </app-office-editor>
        </ng-container>

        <!-- ═══ POWERPOINT — OnlyOffice ═══ -->
        <ng-container *ngIf="selectedTool==='office-pptx'">
          <ng-container *ngIf="!officeConfig">
            <div class="panel-head">
              <div class="panel-ico-wrap" style="background:linear-gradient(135deg,#ea580c,#c2410c)">📽</div>
              <div>
                <h2 class="panel-title">PowerPoint — Présentation</h2>
                <p class="panel-hint">Éditeur .pptx complet · Propulsé par <strong>OnlyOffice</strong></p>
              </div>
            </div>
            <div class="office-launch">
              <div class="office-launch-icon">📽</div>
              <h3 class="office-launch-title">Présentation PowerPoint</h3>
              <p class="office-launch-hint">Créez et éditez des présentations PowerPoint avec diapositives, animations, transitions et export .pptx natif.</p>
              <button class="office-open-btn" style="background:linear-gradient(135deg,#ea580c,#c2410c)"
                      (click)="openOfficeEditor('slide')">Ouvrir PowerPoint</button>
              <div class="office-info-banner">
                <span>ℹ️</span>
                <span>Propulsé par <strong>OnlyOffice Document Server</strong> — Éditeur Office open-source auto-hébergé.</span>
              </div>
            </div>
          </ng-container>
          <app-office-editor *ngIf="officeConfig" [config]="officeConfig"
            (cancel)="closeOfficeEditor()"
            style="display:flex;flex-direction:column;flex:1;min-height:0;height:100%">
          </app-office-editor>
        </ng-container>

        <!-- ═══ OUTILS EN DÉVELOPPEMENT ═══ -->
        <ng-container *ngIf="isWipTool()">
          <div class="panel-head">
            <div class="panel-ico-wrap">{{ currentToolDef?.icon }}</div>
            <div style="flex:1">
              <h2 class="panel-title">{{ currentToolDef?.name }}</h2>
              <p class="panel-hint">{{ currentToolDef?.desc }}</p>
            </div>
            <span class="wip-badge">⚙️ En développement</span>
          </div>
          <div class="wip-panel">
            <div class="wip-emoji">{{ currentToolDef?.icon }}</div>
            <h3 class="wip-title">{{ currentToolDef?.name }}</h3>
            <p class="wip-desc">{{ wipDescription() }}</p>
            <div class="wip-features">
              <span *ngFor="let f of wipFeatures()" class="wip-feature">{{ f }}</span>
            </div>
            <div class="progress-bar-wip" style="margin-top:1rem">
              <div class="progress-fill-wip"></div>
            </div>
            <p style="font-size:.72rem;color:#94a3b8;margin-top:.5rem">Bientôt disponible</p>
          </div>
        </ng-container>

      </div>
    </div>
  </div>
</div>
  `
})
export class CreativeStudioComponent implements OnInit, AfterViewInit {

  @ViewChild('editorArea',  { static: false }) editorArea!:  ElementRef<HTMLDivElement>;
  @ViewChild('badgeCanvas', { static: false }) badgeCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('carteCanvas', { static: false }) carteCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('logoCanvas',  { static: false }) logoCanvas!:  ElementRef<HTMLCanvasElement>;

  selectedTool: CSTool = 'editor';

  toastMsg  = '';
  toastType = 'success';
  private toastTimer: any;

  // ── Editor state ──────────────────────────────────────────────────────────
  editorHtml    = '';
  wordCount     = 0;
  charCount     = 0;
  docTitle      = 'Document sans titre';

  // Ribbon
  ribbonTab: 'accueil'|'insertion'|'misepage'|'revision'|'affichage' = 'accueil';

  // Font controls
  fontFamily  = 'Calibri';
  fontSize    = 11;
  textColor   = '#000000';
  hlColor     = '#ffff00';
  lineHeight  = '1.6';
  lineHeights = ['1.0','1.15','1.5','1.6','2.0','2.5'];

  fontFamilies = [
    'Calibri','Arial','Times New Roman','Georgia','Verdana',
    'Helvetica','Trebuchet MS','Courier New','Palatino','Garamond',
  ];

  // Format state (bold/italic/etc. active on selection)
  fmtState = {
    bold: false, italic: false, underline: false, strikeThrough: false,
    justifyLeft: true, justifyCenter: false, justifyRight: false, justifyFull: false,
  };

  // Window controls
  editorMinimized = false;
  editorMaximized = false;

  // Display options
  showRuler     = false;
  showWordCount = true;
  editorZoom    = 100;
  zoomLevels    = [75, 90, 100, 110, 125, 150];

  // Page settings
  pageOrient    = 'portrait';
  selectedMargin = 'normal';
  pageMargins   = [
    { id: 'narrow',  label: 'Étroites',  value: '48px 64px' },
    { id: 'normal',  label: 'Normales',  value: '80px 90px' },
    { id: 'wide',    label: 'Larges',    value: '96px 128px' },
  ];
  get marginStyle(): string {
    return this.pageMargins.find(m => m.id === this.selectedMargin)?.value ?? '80px 90px';
  }

  // Ruler ticks
  rulerTicks = Array.from({ length: 21 }, (_, i) => ({
    pos: i * 5,
    h: i % 10 === 0 ? 10 : i % 5 === 0 ? 7 : 4,
    label: i % 10 === 0 ? String(i / 10 * 17) : null,
  }));

  // Context menu
  ctxMenu = { visible: false, x: 0, y: 0 };

  // Save modal
  saveModal = false;

  // ── CV Template Gallery ────────────────────────────────────────────────────
  showCvModal      = false;
  cvExpFilter    = 'all';
  cvDomainFilter = 'all';
  selectedCvTpl: CvTpl | null = null;

  readonly cvExpOptions  = CV_EXP_OPTIONS;
  readonly cvDomains     = CV_DOMAINS;

  get filteredCvTemplates(): CvTpl[] {
    return CV_TEMPLATES.filter(tpl => {
      const expOk = this.cvExpFilter === 'all' || tpl.expLevels.includes(this.cvExpFilter);
      const domOk = this.cvDomainFilter === 'all' || tpl.domains.length === 0 || tpl.domains.includes(this.cvDomainFilter);
      return expOk && domOk;
    });
  }

  // ── RxResume ──────────────────────────────────────────────────────────────
  rxresumeUrl: SafeResourceUrl = '';
  rxresumeReady  = false;
  rxresumeLoading = false;

  // ── Penpot Integration ────────────────────────────────────────────────────
  penpotOpen = false;
  penpotUrl: SafeResourceUrl = '';

  isIdentityTool(): boolean {
    return ['badge','carte-visite','logo'].includes(this.selectedTool);
  }

  identityTitle(): string {
    const map: Record<string,string> = { badge:'Créateur de Badges', 'carte-visite':'Carte de visite', logo:'Créateur de Logo' };
    return map[this.selectedTool] || 'Identité Visuelle';
  }

  identityIcon(): string {
    const map: Record<string,string> = { badge:'🏷️', 'carte-visite':'💼', logo:'🎨' };
    return map[this.selectedTool] || '🎨';
  }

  identityGradient(): string {
    const map: Record<string,string> = {
      badge: 'linear-gradient(135deg,#0f172a,#1e293b)',
      'carte-visite': 'linear-gradient(135deg,#1e3a8a,#2563eb)',
      logo: 'linear-gradient(135deg,#6366f1,#a855f7)',
    };
    return map[this.selectedTool] || 'linear-gradient(135deg,#6366f1,#a855f7)';
  }

  openRxResumeDirect() {
    window.open('/rxresume/', '_blank', 'noopener');
  }

  private rxresumePwd(email: string): string {
    return 'Rx!' + btoa(email).replace(/=/g,'').substring(0, 14) + '26';
  }

  async initRxResumeSSO(): Promise<void> {
    if (this.rxresumeReady) return;
    this.rxresumeLoading = true;
    this.cdr.detectChanges();

    const user = this.authService.currentUser();
    if (!user) { this.rxresumeReady = true; this.rxresumeLoading = false; this.cdr.detectChanges(); return; }

    const email    = user.email;
    const password = this.rxresumePwd(email);
    const name     = user.fullName || email.split('@')[0];
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 20);

    // Better Auth: check existing session
    try {
      const session = await fetch('/rxresume/api/auth/get-session', { credentials: 'include' });
      const body = await session.json();
      if (body && body.user) {
        this.rxresumeReady = true; this.rxresumeLoading = false; this.cdr.detectChanges(); return;
      }
    } catch {}

    const trySignIn = async () => {
      const r = await fetch('/rxresume/api/auth/sign-in/email', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return r.ok;
    };

    let ok = await trySignIn();
    if (!ok) {
      try {
        await fetch('/rxresume/api/auth/sign-up/email', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, username, email, password })
        });
        ok = await trySignIn();
      } catch {}
    }

    this.rxresumeReady = true;
    this.rxresumeLoading = false;
    this.cdr.detectChanges();
  }

  // ── RxResume Lab ──────────────────────────────────────────────────────────
  readonly rxLabTemplates = [
    {id:'azurill',  bg:'#dbeafe',fg:'#1e40af'}, {id:'bronzor',  bg:'#fef3c7',fg:'#92400e'},
    {id:'chikorita',bg:'#dcfce7',fg:'#166534'}, {id:'ditgar',   bg:'#f3e8ff',fg:'#6b21a8'},
    {id:'ditto',    bg:'#fce7f3',fg:'#9d174d'}, {id:'gengar',   bg:'#1e1b4b',fg:'#c4b5fd'},
    {id:'glalie',   bg:'#e0f2fe',fg:'#0c4a6e'}, {id:'kakuna',   bg:'#fefce8',fg:'#713f12'},
    {id:'lapras',   bg:'#cffafe',fg:'#164e63'}, {id:'leafish',  bg:'#f0fdf4',fg:'#14532d'},
    {id:'meowth',   bg:'#fff7ed',fg:'#7c2d12'}, {id:'onyx',     bg:'#f1f5f9',fg:'#0f172a'},
    {id:'pikachu',  bg:'#fef08a',fg:'#713f12'}, {id:'rhyhorn',  bg:'#f5f5f4',fg:'#1c1917'},
    {id:'scizor',   bg:'#ffe4e6',fg:'#9f1239'},
  ];

  labSelectedTpl  = 'onyx';
  labAiTemplate   = 'pikachu';
  labChangeResumeId = '';
  labChangeTemplate = 'gengar';
  labPdfResumeId  = '';
  labResumes: {id:string; name:string; slug:string}[] = [];
  labLoading: Record<number,boolean> = {1:false,2:false,3:false,4:false};
  labResults: Record<number,string>  = {};
  labLastId: Record<number,string>   = {};

  private async rxRpc(proc: string, body: unknown): Promise<unknown> {
    const url = `/rxresume/api/rpc/${proc}/__batch__`;
    const payload = [{ body: { json: body }, url: `http://localhost:3101/api/rpc/${proc}` }];
    const res = await fetch(url, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-orpc-batch': 'streaming' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data:')) {
        const d = JSON.parse(line.slice(5).trim());
        if (d.body?.json !== undefined) return d.body.json;
      }
    }
    return null;
  }

  private async rxGetResume(id: string): Promise<any> {
    return this.rxRpc('resume/getById', { id });
  }

  private async rxUpdateResume(id: string, patch: any): Promise<void> {
    const current = await this.rxGetResume(id) as any;
    const pd = patch['data'] ?? {};
    const cd = current['data'] ?? {};
    const merged = { ...cd, ...pd,
      basics:   { ...(cd['basics']   ?? {}), ...(pd['basics']   ?? {}) },
      metadata: { ...(cd['metadata'] ?? {}), ...(pd['metadata'] ?? {}) },
      sections: { ...(cd['sections'] ?? {}), ...(pd['sections'] ?? {}) },
      picture:  { ...(cd['picture']  ?? {}), ...(pd['picture']  ?? {}) },
    };
    await this.rxRpc('resume/update', { id, data: merged });
  }

  // ── Galerie CV ────────────────────────────────────────────────────────────
  readonly cvGalTemplates = [
    { id:'azurill',   bg:'#dbeafe', accent:'#2563eb', sidebar:false, ats:true,  hasPhoto:true,  style:'Moderne' },
    { id:'bronzor',   bg:'#fef3c7', accent:'#d97706', sidebar:true,  ats:false, hasPhoto:false, style:'Élégant' },
    { id:'chikorita', bg:'#dcfce7', accent:'#16a34a', sidebar:false, ats:true,  hasPhoto:false, style:'Propre'  },
    { id:'ditgar',    bg:'#f3e8ff', accent:'#7c3aed', sidebar:true,  ats:false, hasPhoto:true,  style:'Créatif' },
    { id:'ditto',     bg:'#fce7f3', accent:'#db2777', sidebar:false, ats:true,  hasPhoto:false, style:'Minimaliste' },
    { id:'gengar',    bg:'#1e1b4b', accent:'#818cf8', sidebar:true,  ats:false, hasPhoto:true,  style:'Dark'    },
    { id:'glalie',    bg:'#e0f2fe', accent:'#0284c7', sidebar:false, ats:true,  hasPhoto:false, style:'Corporate' },
    { id:'kakuna',    bg:'#fefce8', accent:'#ca8a04', sidebar:true,  ats:false, hasPhoto:false, style:'Rétro'   },
    { id:'lapras',    bg:'#cffafe', accent:'#0e7490', sidebar:true,  ats:true,  hasPhoto:true,  style:'Professionnel' },
    { id:'leafish',   bg:'#f0fdf4', accent:'#15803d', sidebar:false, ats:true,  hasPhoto:false, style:'Simple'  },
    { id:'meowth',    bg:'#fff7ed', accent:'#ea580c', sidebar:true,  ats:false, hasPhoto:true,  style:'Dynamique' },
    { id:'onyx',      bg:'#f1f5f9', accent:'#dc2626', sidebar:true,  ats:true,  hasPhoto:true,  style:'Executive' },
    { id:'pikachu',   bg:'#fef9c3', accent:'#ca8a04', sidebar:false, ats:true,  hasPhoto:false, style:'Moderne' },
    { id:'rhyhorn',   bg:'#f5f5f4', accent:'#57534e', sidebar:false, ats:true,  hasPhoto:false, style:'Neutre'  },
    { id:'scizor',    bg:'#ffe4e6', accent:'#e11d48', sidebar:true,  ats:false, hasPhoto:true,  style:'Bold'    },
  ];

  cvGalSearch    = '';
  cvGalFiltered  = [...this.cvGalTemplates];
  cvGalSelected: typeof this.cvGalTemplates[0] | null = null;
  cvGalName      = 'Mon CV';
  cvGalCreating  = false;

  onCvGalSearch() {
    const q = this.cvGalSearch.toLowerCase().trim();
    this.cvGalFiltered = q
      ? this.cvGalTemplates.filter(t => t.id.includes(q) || t.style.toLowerCase().includes(q) || (t.ats && q.includes('ats')) || (t.sidebar && q.includes('sidebar')))
      : [...this.cvGalTemplates];
    this.cdr.detectChanges();
  }

  cvGalSelect(tpl: typeof this.cvGalTemplates[0]) {
    this.cvGalSelected = tpl;
    if (!this.cvGalName || this.cvGalName === 'Mon CV') this.cvGalName = 'CV ' + tpl.id;
    this.cdr.detectChanges();
  }

  async cvGalCreate() {
    if (!this.cvGalSelected || !this.cvGalName.trim() || this.cvGalCreating) return;
    this.cvGalCreating = true;
    this.cdr.detectChanges();
    try {
      const slug = this.cvGalName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
      const id = await this.rxRpc('resume/create', { name: this.cvGalName.trim(), slug, tags: [] }) as string;
      await this.rxUpdateResume(id, {
        data: {
          metadata: { template: this.cvGalSelected.id },
          basics: { name: '', headline: '', email: '', phone: '', location: '', website: { url: '', label: '' }, customFields: [] }
        }
      });
      // Ouvrir l'éditeur RxResume directement sur ce CV
      this.rxresumeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`http://localhost:3101/builder/${id}`);
      this.rxresumeReady = true;
      this.selectedTool = 'rxresume';
    } catch(e: any) {
      this.dialog.alert('Erreur : ' + e.message, 'Erreur', 'error');
    }
    this.cvGalCreating = false;
    this.cdr.detectChanges();
  }

  labSelectTemplate(id: string) { this.labSelectedTpl = id; this.cdr.detectChanges(); }

  async labCreateWithTemplate() {
    if (!this.labSelectedTpl) return;
    this.labLoading[1] = true; this.labResults[1] = ''; this.cdr.detectChanges();
    try {
      const slug = 'cv-' + this.labSelectedTpl + '-' + Date.now();
      const id = await this.rxRpc('resume/create', { name: 'CV ' + this.labSelectedTpl, slug, tags: [] }) as string;
      await this.rxUpdateResume(id, {
        data: {
          metadata: { template: this.labSelectedTpl },
          basics: { name: 'Prénom Nom', headline: 'Votre titre professionnel', email: 'contact@exemple.fr', phone: '+33 6 00 00 00 00', location: 'Paris, France', website: { url: '', label: '' }, customFields: [] }
        }
      });
      this.labResults[1] = `✅ CV créé !\nTemplate: ${this.labSelectedTpl}\nID: ${id}`;
      this.labLastId[1] = id;
      await this.labLoadResumes();
    } catch(e:any) { this.labResults[1] = '❌ ' + e.message; }
    this.labLoading[1] = false; this.cdr.detectChanges();
  }

  async labCreateWithAI() {
    this.labLoading[2] = true; this.labResults[2] = ''; this.cdr.detectChanges();
    try {
      const user = this.authService.currentUser();
      const name = user?.fullName || 'Utilisateur Demo';
      const slug = 'cv-ia-' + Date.now();
      const id = await this.rxRpc('resume/create', { name: 'CV IA – ' + name, slug, tags: ['IA'] }) as string;
      await this.rxUpdateResume(id, {
        data: {
          metadata: { template: this.labAiTemplate },
          basics: { name, headline: 'Développeur IA & Innovation', email: user?.email || 'contact@exemple.fr', phone: '+33 6 12 34 56 78', location: 'Paris, France', website: { url: 'linkedin.com/in/profil', label: 'LinkedIn' }, customFields: [] },
          sections: {
            summary: { id:'summary', name:'Résumé', type:'custom', visible:true, items:[], content:'Passionné par l\'IA et les nouvelles technologies. Je développe des solutions innovantes pour transformer les processus métier avec Angular, NestJS et les LLMs.' },
            experience: { id:'experience', name:'Expérience', type:'work', visible:true, items:[
              { id:'exp1', visible:true, company:'Creative AI Studio', position:'Développeur Full Stack Senior', location:'Paris', date:'Jan 2024 – Présent', url:{ label:'', href:'' }, summary:'Développement de la plateforme IA Creative AI Studio. Stack : Angular 18, NestJS, PostgreSQL, Docker, Claude AI.' }
            ]},
            education: { id:'education', name:'Formation', type:'education', visible:true, items:[
              { id:'edu1', visible:true, institution:'École Polytechnique', studyType:'Master', area:'Informatique & IA', date:'2018 – 2020', url:{ label:'', href:'' }, summary:'' }
            ]},
            skills: { id:'skills', name:'Compétences', type:'skill', visible:true, items:[
              {id:'s1',visible:true,name:'Angular / TypeScript',description:'',level:4,keywords:[]},
              {id:'s2',visible:true,name:'NestJS / Node.js',description:'',level:4,keywords:[]},
              {id:'s3',visible:true,name:'Docker / DevOps',description:'',level:3,keywords:[]},
              {id:'s4',visible:true,name:'IA / LLM / Claude',description:'',level:4,keywords:[]}
            ]},
            languages: { id:'languages', name:'Langues', type:'language', visible:true, items:[
              {id:'l1',visible:true,name:'Français',description:'Langue maternelle',level:5},
              {id:'l2',visible:true,name:'Anglais',description:'Professionnel',level:4}
            ]}
          }
        }
      });
      this.labResults[2] = `✅ CV IA créé !\nTemplate: ${this.labAiTemplate}\nNom: CV IA – ${name}\nID: ${id}`;
      this.labLastId[2] = id;
      await this.labLoadResumes();
    } catch(e:any) { this.labResults[2] = '❌ ' + e.message; }
    this.labLoading[2] = false; this.cdr.detectChanges();
  }

  async labLoadResumes() {
    try {
      const result = await fetch('/rxresume/api/rpc/resume/tags/list/__batch__', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-orpc-batch': 'streaming' },
        body: JSON.stringify([
          { body: {}, url: 'http://localhost:3101/api/rpc/resume/tags/list' },
          { body: { json: { tags: [], sort: 'lastUpdatedAt' } }, url: 'http://localhost:3101/api/rpc/resume/list' }
        ])
      });
      const text = await result.text();
      const items: any[] = [];
      for (const line of text.split('\n')) {
        if (line.startsWith('data:')) {
          const d = JSON.parse(line.slice(5).trim());
          if (Array.isArray(d.body?.json)) items.push(...d.body.json);
        }
      }
      this.labResumes = items.map(r => ({ id: r.id, name: r.name, slug: r.slug }));
      this.cdr.detectChanges();
    } catch {}
  }

  labOpenEditor(id: string) {
    this.rxresumeReady = false;
    this.rxresumeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`http://localhost:3101/builder/${id}`);
    this.rxresumeReady = true;
    this.selectedTool = 'rxresume';
    this.cdr.detectChanges();
  }

  async labChangeTemplateApi() {
    if (!this.labChangeResumeId) return;
    this.labLoading[3] = true; this.labResults[3] = ''; this.cdr.detectChanges();
    try {
      await this.rxUpdateResume(this.labChangeResumeId, { data: { metadata: { template: this.labChangeTemplate } } });
      this.labResults[3] = `✅ Template mis à jour !\nCV: ${this.labChangeResumeId}\nNouveau template: ${this.labChangeTemplate}`;
    } catch(e:any) { this.labResults[3] = '❌ ' + e.message; }
    this.labLoading[3] = false; this.cdr.detectChanges();
  }

  async labExportPdf() {
    if (!this.labPdfResumeId) return;
    this.labLoading[4] = true; this.labResults[4] = ''; this.cdr.detectChanges();
    try {
      const result = await this.rxRpc('resume/printAsPdf', { id: this.labPdfResumeId }) as any;
      if (result?.url) {
        this.labResults[4] = `✅ PDF généré !\nURL: ${result.url}`;
      } else {
        this.labResults[4] = `⚠️ Réponse API:\n${JSON.stringify(result, null, 2)}\n\n(Le renderer PDF nécessite une config CHROMIUM_URL)`;
      }
    } catch(e:any) { this.labResults[4] = '❌ ' + e.message; }
    this.labLoading[4] = false; this.cdr.detectChanges();
  }

  openPenpot() {
    // Penpot ne supporte pas le proxying sous-chemin — ouvrir dans un onglet dédié
    window.open('http://localhost:9090', '_blank', 'noopener');
  }

  closePenpot() {
    this.penpotOpen = false;
    this.cdr.detectChanges();
  }

  // ── Design Editor state ───────────────────────────────────────────────────
  designHtml:    string | null = null;
  designObjects: DesignObject[] = [];
  designBg     = '#ffffff';
  designWidth  = 340;
  designHeight = 210;
  designDynFields: string[] = [];

  // Generated template galleries (60 per category)
  readonly badgeDesignTpls  = BADGE_TEMPLATES;
  readonly carteDesignTpls  = CARTE_TEMPLATES;
  readonly logoDesignTpls   = LOGO_TEMPLATES;
  readonly logoHtmlTpls     = LOGO_HTML_TPLS;
  readonly logoCategories   = LOGO_CATEGORIES;
  logoCatFilter = '';
  readonly standardFields   = STANDARD_FIELDS;

  // Filters
  badgeThemeFilter = '';
  carteThemeFilter = '';
  logoThemeFilter  = '';

  get filteredBadgeTpls() { return this.badgeThemeFilter ? this.badgeDesignTpls.filter(t => t.theme.id === this.badgeThemeFilter) : this.badgeDesignTpls; }
  get filteredCarteTpls()  { return this.carteThemeFilter  ? this.carteDesignTpls.filter(t  => t.theme.id === this.carteThemeFilter)  : this.carteDesignTpls; }
  get filteredLogoTpls()   { return this.logoThemeFilter   ? this.logoDesignTpls.filter(t   => t.theme.id === this.logoThemeFilter)   : this.logoDesignTpls; }

  readonly themeOptions = [
    { id:'', name:'Tous' },
    { id:'dk-v', name:'Violet' }, { id:'dk-b', name:'Marine' }, { id:'dk-g', name:'Forêt' },
    { id:'dk-o', name:'Or' },     { id:'dk-r', name:'Rouge' },  { id:'dk-t', name:'Teal' },
    { id:'lt-v', name:'Blanc/Violet' }, { id:'lt-b', name:'Blanc/Bleu' },
    { id:'lt-g', name:'Blanc/Vert' },   { id:'lt-p', name:'Blanc/Rose' },
  ];

  tplScale(tplW: number, tplH: number, boxW: number, boxH: number): number {
    return Math.min(boxW / tplW, boxH / tplH);
  }

  get filteredLogoHtmlTpls() {
    return this.logoCatFilter
      ? this.logoHtmlTpls.filter(t => t.category === this.logoCatFilter)
      : this.logoHtmlTpls;
  }

  openLogoHtmlTemplate(t: LogoHtmlTpl) {
    this.designWidth   = t.w;
    this.designHeight  = t.h;
    this.designBg      = t.previewBg;
    this.designHtml    = t.html;
    this.designObjects = [];
    this.designDynFields = [];
    this.cdr.detectChanges();
  }

  openDesignTemplate(t: DesignTemplate) {
    this.designWidth   = t.w;
    this.designHeight  = t.h;
    this.designBg      = t.bgColor;
    this.designHtml    = '';
    this.designObjects = t.objects.map(o => ({ ...o }));
    // Pass Excel columns as dynamic fields
    this.designDynFields = this.csvPersons.length > 0
      ? Object.keys(this.csvPersons[0]).filter(k => k !== '__rowNum')
      : [];
    this.cdr.detectChanges();
  }

  onDesignSaved(result: DesignEditorResult) {
    this.designHtml    = null;
    this.designObjects = [];
    this.showToast('Design sauvegardé ✓', 'success');
    this.cdr.detectChanges();
  }

  onDesignCancel() {
    this.designHtml    = null;
    this.designObjects = [];
    this.cdr.detectChanges();
  }

  // ── Carte de visite ───────────────────────────────────────────────────────
  carteTemplates = [
    { id: 'modern',  label: 'Moderne',  bg: '#0f172a', fg: '#ffffff', accent: '#6366f1' },
    { id: 'classic', label: 'Classique', bg: '#ffffff', fg: '#1e293b', accent: '#1d4ed8' },
    { id: 'minimal', label: 'Minimal',   bg: '#ffffff', fg: '#0f172a', accent: '#10b981' },
    { id: 'premium', label: 'Premium',   bg: '#1c1008', fg: '#fef3c7', accent: '#f59e0b' },
  ];
  carteTpl = 'modern';
  carteCopies = 1;
  carteLogoImg: HTMLImageElement | null = null;
  carte = {
    nom: 'Marie Dupont', titre: 'Directrice Marketing',
    email: 'marie@exemple.com', tel: '+33 6 12 34 56 78',
    site: 'www.exemple.com', adresse: 'Paris, France',
    bg: '#0f172a', fg: '#ffffff', accent: '#6366f1'
  };

  // ── Logo Creator ───────────────────────────────────────────────────────────
  logoStyles = [
    { id: 'wordmark', label: 'Wordmark' },
    { id: 'monogram', label: 'Monogramme' },
    { id: 'badge',    label: 'Badge' },
    { id: 'icone',    label: 'Icône + texte' },
  ];
  logoStyle = 'wordmark';
  logoSymbols = ['◈','◉','⬡','⬢','◆','★','✦','⊕','⊛','❋','✺','⬤'];
  logo = {
    nom: 'Creative AI Studio', tagline: 'Intelligence artificielle',
    initiales: 'MS', symbole: '◈',
    bg: '#ffffff', fg: '#0f172a', accent: '#6366f1', bgFilled: true
  };

  // Badge
  badgeTemplates = BADGE_COLOR_PRESETS;
  badgeTpl  = 'event';
  badgeCopies = 1;
  csvPersons: { name: string; role: string; org: string; id: string }[] = [];
  csvIndex = 0;
  badgeLogoImg: HTMLImageElement | null = null;
  badge = { name: 'Marie Dupont', role: 'Intervenante — IA & Data', org: 'Creative AI Studio Summit 2026',
            id: 'BADGE-001', bg: '#1e1b4b', fg: '#ffffff', accent: '#6366f1' };

  // ── Mes Office ────────────────────────────────────────────────────────────
  officeConfig: OfficeEditorConfig | null = null;

  openOfficeEditor(docType: OfficeDocType) {
    const ext = docType === 'word' ? 'docx' : docType === 'cell' ? 'xlsx' : 'pptx';
    const titles: Record<OfficeDocType, string> = {
      word: 'Nouveau document Word', cell: 'Nouveau tableau Excel', slide: 'Nouvelle présentation'
    };
    // URL interne Docker (accessible depuis le conteneur onlyoffice)
    // Pour le dev local, le conteneur onlyoffice:80 doit joindre frontend:80
    const docUrl = `http://frontend/assets/office-templates/blank.${ext}`;
    this.officeConfig = { docType, title: titles[docType], documentUrl: docUrl, lang: 'fr' };
  }

  closeOfficeEditor() {
    this.officeConfig = null;
    this.selectedTool = 'editor';
    this.router.navigate(['/']);
  }

  groups: CSGroup[] = [
    {
      label: '✏️ Documents',
      icon: '📝',
      tools: [
        { id: 'editor',          icon: '✏️', name: 'Éditeur de texte',    desc: 'Riche, formaté, exports' },
        { id: 'template-cv',     icon: '📄', name: 'CV Builder',          desc: 'Curriculum vitæ (custom)' },
        { id: 'cv-gallery',      icon: '🖼️', name: 'Galerie CV',           desc: 'Choisir un template · Créer · Éditer' },
        { id: 'rxresume',        icon: '🏆', name: 'RxResume Éditeur',    desc: 'Éditeur complet · PDF natif' },
        { id: 'rxresume-lab',    icon: '🧪', name: 'RxResume Lab',        desc: 'Tester API : templates · IA · PDF' },
        { id: 'template-lettre', icon: '✉️', name: 'Lettre motivation',   desc: 'Candidature pro' },
        { id: 'template-cr',     icon: '📋', name: 'Compte-rendu',        desc: 'PV de réunion' },
        { id: 'template-conge',  icon: '🏖️', name: 'Demande congé',      desc: 'Congés / RTT' },
        { id: 'office-word',     icon: '📝', name: 'Word',                desc: 'Traitement de texte .docx (OnlyOffice)' },
        { id: 'office-excel',    icon: '📊', name: 'Excel',               desc: 'Tableur .xlsx (OnlyOffice)' },
        { id: 'office-pptx',     icon: '📽', name: 'PowerPoint',          desc: 'Présentation .pptx (OnlyOffice)' },
      ]
    },
    {
      label: '🎨 Identité visuelle',
      icon: '🎨',
      tools: [
        { id: 'badge',         icon: '🏷️', name: 'Créateur de badges', desc: 'Événement, staff, VIP' },
        { id: 'carte-visite',  icon: '💼', name: 'Carte de visite',     desc: 'Pro & personnalisée' },
        { id: 'logo',          icon: '🎨', name: 'Créateur de logo',    desc: 'Templates + éditeur' },
      ]
    },
    {
      label: '🧠 Analyse IA',
      icon: '🧠',
      tools: [
        { id: 'cv-analyzer',   icon: '🔍', name: 'Analyseur de CV',    desc: 'Score + matching poste', wip: true },
        { id: 'doc-chat',      icon: '💬', name: 'Chat avec document', desc: 'RAG multimodal', wip: true },
      ]
    },
    {
      label: '🛠️ Outils image',
      icon: '🖼️',
      tools: [
        { id: 'scanner',       icon: '📷', name: 'Scanner de document', desc: 'Webcam → PDF/DOCX', wip: true },
        { id: 'bg-removal',    icon: '✂️', name: 'Suppression de fond', desc: 'PNG transparent', wip: true },
      ]
    },
  ];

  get allTools(): CSToolDef[] { return this.groups.flatMap(g => g.tools); }
  get currentToolDef(): CSToolDef | undefined { return this.allTools.find(t => t.id === this.selectedTool); }

  isTemplateTool(): boolean { return ['template-lettre','template-cr','template-conge'].includes(this.selectedTool); }
  isOfficeTool(): boolean { return ['office-word','office-excel','office-pptx'].includes(this.selectedTool); }
  isWipTool(): boolean {
    const t = this.currentToolDef;
    return !!t?.wip;
  }

  constructor(private cdr: ChangeDetectorRef, private route: ActivatedRoute, private router: Router, private sanitizer: DomSanitizer, private authService: AuthService, private dialog: DialogService) {
    this.rxresumeUrl = this.sanitizer.bypassSecurityTrustResourceUrl('http://localhost:3101/dashboard/resumes');
  }

  ngOnInit() {
    // Lire le query param ?tool=xxx envoyé par le mega menu
    this.route.queryParamMap.subscribe(params => {
      const tool = params.get('tool') as CSTool | null;
      if (tool && this.allTools.find(t => t.id === tool)) {
        this.selectTool(tool);
      }
    });
  }

  ngAfterViewInit() {
    if (this.badgeCanvas) setTimeout(() => this.drawBadge(), 100);
  }

  selectTool(t: CSTool) {
    this.selectedTool = t;
    // Réinitialise l'éditeur Office si on change d'outil
    if (!['office-word','office-excel','office-pptx'].includes(t)) {
      this.officeConfig = null;
    }
    if (this.isTemplateTool()) {
      setTimeout(() => this.loadTemplate(t), 50);
    }
    if (t === 'badge') {
      setTimeout(() => this.drawBadge(), 100);
    }
    if (t === 'carte-visite') {
      setTimeout(() => this.drawCarte(), 100);
    }
    if (t === 'logo') {
      setTimeout(() => this.drawLogo(), 100);
    }
    // Ouvrir directement l'éditeur Office si sélectionné via le mega menu
    if (t === 'office-word')  this.openOfficeEditor('word');
    if (t === 'office-excel') this.openOfficeEditor('cell');
    if (t === 'office-pptx')  this.openOfficeEditor('slide');
    if (t === 'rxresume') this.initRxResumeSSO();
    if (t === 'cv-gallery') this.initRxResumeSSO();
    if (t === 'rxresume-lab') { this.initRxResumeSSO().then(() => this.labLoadResumes()); }
    this.cdr.detectChanges();
  }

  // ─── Rich Text Editor ─────────────────────────────────────────────────────

  /** Execute a contenteditable command and refocus the editor */
  exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    this.editorArea?.nativeElement.focus();
    this.onEditorInput();
    this.updateFmtState();
  }

  /** Update active format state (bold/italic/align) from current selection */
  updateFmtState() {
    this.fmtState = {
      bold:          document.queryCommandState('bold'),
      italic:        document.queryCommandState('italic'),
      underline:     document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      justifyLeft:   document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight:  document.queryCommandState('justifyRight'),
      justifyFull:   document.queryCommandState('justifyFull'),
    };
  }

  /** Apply font family */
  applyFont() {
    document.execCommand('fontName', false, this.fontFamily);
    this.editorArea?.nativeElement.focus();
  }

  /** Apply font size (pt → HTML size 1-7 approx) */
  applyFontSize() {
    // Use span workaround for pt sizes
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    document.execCommand('fontSize', false, '7');
    const el = this.editorArea?.nativeElement.querySelectorAll('font[size="7"]');
    el?.forEach((e: Element) => {
      (e as HTMLElement).removeAttribute('size');
      (e as HTMLElement).style.fontSize = this.fontSize + 'pt';
    });
    this.editorArea?.nativeElement.focus();
  }

  /** Increment/decrement font size */
  changeFontSize(delta: number) {
    this.fontSize = Math.max(6, Math.min(96, this.fontSize + delta));
    this.applyFontSize();
  }

  /** Apply text color */
  applyTextColor() {
    document.execCommand('foreColor', false, this.textColor);
    this.editorArea?.nativeElement.focus();
  }

  /** Apply highlight color */
  applyHighlight() {
    document.execCommand('hiliteColor', false, this.hlColor);
    this.editorArea?.nativeElement.focus();
  }

  /** Apply a block style (p, h1, h2, h3, blockquote, div) */
  applyStyle(tag: string) {
    document.execCommand('formatBlock', false, tag);
    this.editorArea?.nativeElement.focus();
  }

  /** Cycle through line heights */
  cycleLineHeight() {
    const idx = this.lineHeights.indexOf(this.lineHeight);
    this.lineHeight = this.lineHeights[(idx + 1) % this.lineHeights.length];
    if (this.editorArea) {
      this.editorArea.nativeElement.style.lineHeight = this.lineHeight;
    }
  }

  async insertLink(): Promise<void> {
    const url = await this.dialog.prompt('Insérer un lien', '', 'https://...', '');
    if (url) document.execCommand('createLink', false, url);
    this.editorArea?.nativeElement.focus();
  }

  async insertTable(): Promise<void> {
    const rowsStr = await this.dialog.prompt('Insérer un tableau', 'Nombre de lignes :', '3', '3');
    const colsStr = await this.dialog.prompt('Insérer un tableau', 'Nombre de colonnes :', '3', '3');
    const rows = parseInt(rowsStr || '3', 10);
    const cols = parseInt(colsStr || '3', 10);
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += r === 0 ? '<th>&nbsp;</th>' : '<td>&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    document.execCommand('insertHTML', false, html);
    this.editorArea?.nativeElement.focus();
  }

  /** Insert an image from URL or file */
  insertImage() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        document.execCommand('insertImage', false, e.target?.result as string);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  /** Insert current date/time */
  insertDateTime() {
    const now = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });
    document.execCommand('insertText', false, now);
    this.editorArea?.nativeElement.focus();
  }

  async insertSpecialChar(): Promise<void> {
    const chars = ['©', '®', '™', '€', '£', '¥', '°', '±', '×', '÷', '→', '←', '↑', '↓', '↔', '•', '…', '—', '«', '»', '¿', '¡', 'Ω', 'α', 'β', 'π', 'Σ'];
    const char = await this.dialog.prompt('Insérer un symbole', chars.join('  '), '©', '©');
    if (char) {
      document.execCommand('insertText', false, char);
      this.editorArea?.nativeElement.focus();
    }
  }

  /** Keyboard shortcuts */
  onEditorKeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 's': e.preventDefault(); this.autoSave(); break;
        case 'k': e.preventDefault(); this.insertLink(); break;
      }
    }
  }

  /** Auto-save to localStorage */
  /** Ctrl+S → open format picker */
  autoSave() {
    // Auto-save to localStorage as backup
    if (this.editorArea) {
      try {
        localStorage.setItem('cs_editor_autosave', this.editorArea.nativeElement.innerHTML);
        localStorage.setItem('cs_editor_title', this.docTitle);
      } catch { /* quota exceeded */ }
    }
    // Open save dialog
    this.saveModal = true;
    this.cdr.detectChanges();
  }

  /** Dispatch to the right export function */
  saveAs(fmt: string) {
    this.saveModal = false;
    switch (fmt) {
      case 'pdf':  this.printDoc(); break;
      case 'docx': this.exportWordHtml('docx'); break;
      case 'doc':  this.exportWordHtml('doc');  break;
      case 'rtf':  this.exportRtf();            break;
      case 'odt':  this.exportOdt();            break;
      case 'html': this.exportHtml();           break;
      case 'md':   this.exportMarkdown();       break;
      case 'txt':  this.exportTxt();            break;
      case 'csv':  this.exportCsv();            break;
    }
  }

  // ── DOCX / DOC  ──────────────────────────────────────────────────────────
  /** Export as Word-compatible HTML (all Office suites accept this) */
  exportWordHtml(ext: 'docx' | 'doc') {
    if (!this.editorArea) return;
    const content = this.editorArea.nativeElement.innerHTML;
    const msoHtml = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${this.docTitle}</title>
  <!--[if gte mso 9]><xml>
    <w:WordDocument>
      <w:View>Print</w:View><w:Zoom>90</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml><![endif]-->
  <style>
    @page WordSection1 {
      size: 21cm 29.7cm; margin: 2.5cm 3cm 2.5cm 3cm;
      mso-header-margin: 1.25cm; mso-footer-margin: 1.25cm;
      mso-page-numbers: 1;
    }
    div.WordSection1 { page: WordSection1; }
    body { font-family: Calibri,Arial,sans-serif; font-size: 11pt;
           line-height: 1.5; color: #000000; }
    h1 { font-size: 20pt; color: #1E3A8A; border-bottom: 2pt solid #e2e8f0; padding-bottom: 4pt; }
    h2 { font-size: 14pt; color: #1D4ED8; }
    h3 { font-size: 12pt; color: #6366F1; }
    h4 { font-size: 11pt; font-weight: bold; color: #374151; }
    table { border-collapse: collapse; width: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td, th { border: 1pt solid #C4C4C4; padding: 4pt 6pt; }
    th { background: #F1F5F9; font-weight: bold; }
    blockquote { border-left: 4pt solid #6366F1; margin-left: 1cm;
                 padding-left: 0.5cm; color: #4B5563; font-style: italic; }
    hr { border: none; border-top: 1pt solid #D1D5DB; }
    a { color: #2563EB; }
  </style>
</head>
<body><div class="WordSection1">
${content}
</div></body></html>`;
    const name = this.sanitizeFilename(this.docTitle) + '.' + ext;
    this.downloadBlob(msoHtml, name, 'application/msword');
  }

  // ── RTF  ──────────────────────────────────────────────────────────────────
  exportRtf() {
    if (!this.editorArea) return;
    const rtf = this.htmlToRtf(this.editorArea.nativeElement.innerHTML);
    this.downloadBlob(rtf, this.sanitizeFilename(this.docTitle) + '.rtf', 'application/rtf');
  }

  private htmlToRtf(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    const esc = (s: string) => (s || '')
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0)}?`);

    const conv = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent ?? '');
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node as HTMLElement;
      const kids = Array.from(el.childNodes).map(conv).join('');
      switch (el.tagName.toLowerCase()) {
        case 'b': case 'strong': return `{\\b ${kids}}`;
        case 'i': case 'em':    return `{\\i ${kids}}`;
        case 'u':               return `{\\ul ${kids}}`;
        case 's': case 'strike':return `{\\strike ${kids}}`;
        case 'sup':             return `{\\super ${kids}}`;
        case 'sub':             return `{\\sub ${kids}}`;
        case 'h1': return `\\pard\\sa200{\\b\\fs40\\cf2 ${kids}}\\par\n`;
        case 'h2': return `\\pard\\sa180{\\b\\fs32\\cf3 ${kids}}\\par\n`;
        case 'h3': return `\\pard\\sa160{\\b\\fs28\\cf4 ${kids}}\\par\n`;
        case 'h4': return `\\pard\\sa140{\\b\\fs24 ${kids}}\\par\n`;
        case 'p':  return `\\pard\\sa200\\sl276\\slmult1 ${kids}\\par\n`;
        case 'div':return kids + '\\par\n';
        case 'br': return '\\line\n';
        case 'li': return `\\pard\\fi-360\\li720\\sa80 \\bullet  ${kids}\\par\n`;
        case 'ul': case 'ol': return kids;
        case 'blockquote': return `\\pard\\li720\\ri720\\sa200\\qj{\\i ${kids}}\\par\n`;
        case 'hr': return `\\pard\\brdrb\\brdrs\\brdrw10\\brsp20\\sa200 \\par\\pard\n`;
        case 'a': {
          const url = el.getAttribute('href') || '';
          return url
            ? `{\\field{\\*\\fldinst HYPERLINK "${url}"}{\\fldrslt\\cf3\\ul ${kids}}}`
            : kids;
        }
        case 'table': return `{\\trowd ${kids}\\pard}\n`;
        case 'tr':  return `${kids}\\row\n`;
        case 'td': case 'th':
          return `\\pard\\intbl\\sa80\\sb80\\sl240\\slmult1 ${kids}\\cell `;
        default: return kids;
      }
    };

    return `{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\deflang1036
{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}{\\f1\\fswiss\\fcharset0 Arial;}{\\f2\\fmodern\\fcharset0 Calibri;}}
{\\colortbl;\\red0\\green0\\blue0;\\red30\\green58\\blue138;\\red29\\green78\\blue216;\\red99\\green102\\blue241;}
{\\*\\generator Creative AI Studio Studio 1.0;}
\\viewkind4\\uc1\\pard\\sa200\\sl276\\slmult1\\f2\\fs22\\lang1036\n${conv(tmp)}\n}`;
  }

  // ── ODT  ──────────────────────────────────────────────────────────────────
  /** Export as ODT (OpenDocument Text) — HTML-based ODT that LibreOffice accepts */
  exportOdt() {
    if (!this.editorArea) return;
    // ODT wraps content in ODF XML. A simpler approach: use LibreOffice's HTML import.
    // We generate a well-formed HTML with ODF metadata so LibreOffice opens it as ODT-like.
    const content = this.editorArea.nativeElement.innerHTML;
    const odtHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
  <meta name="generator" content="Creative AI Studio Studio"/>
  <title>${this.docTitle}</title>
  <style type="text/css">
    body { font-family: Liberation Serif, Times New Roman, serif; font-size: 12pt;
           line-height: 1.5; margin: 2.5cm 3cm; color: #000; }
    h1 { font-size: 18pt; font-weight: bold; color: #1e3a8a; }
    h2 { font-size: 14pt; font-weight: bold; color: #1d4ed8; }
    h3 { font-size: 12pt; font-weight: bold; color: #6366f1; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #c4c4c4; padding: 4px 6px; }
    th { font-weight: bold; background: #f1f5f9; }
    blockquote { margin-left: 1cm; border-left: 4px solid #6366f1;
                 padding-left: 0.5cm; font-style: italic; color: #4b5563; }
  </style>
</head>
<body>${content}</body>
</html>`;
    // Save as .odt — LibreOffice will import this HTML
    this.downloadBlob(odtHtml, this.sanitizeFilename(this.docTitle) + '.odt',
      'application/vnd.oasis.opendocument.text');
  }

  // ── Markdown  ─────────────────────────────────────────────────────────────
  exportMarkdown() {
    if (!this.editorArea) return;
    const md = this.htmlToMarkdown(this.editorArea.nativeElement.innerHTML);
    this.downloadBlob(md, this.sanitizeFilename(this.docTitle) + '.md', 'text/markdown');
  }

  private htmlToMarkdown(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    const conv = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node as HTMLElement;
      const kids = () => Array.from(el.childNodes).map(conv).join('');
      switch (el.tagName.toLowerCase()) {
        case 'h1': return `# ${kids()}\n\n`;
        case 'h2': return `## ${kids()}\n\n`;
        case 'h3': return `### ${kids()}\n\n`;
        case 'h4': return `#### ${kids()}\n\n`;
        case 'b': case 'strong': return `**${kids()}**`;
        case 'i': case 'em':    return `*${kids()}*`;
        case 'u':               return `__${kids()}__`;
        case 's': case 'strike':return `~~${kids()}~~`;
        case 'sup':             return `<sup>${kids()}</sup>`;
        case 'sub':             return `<sub>${kids()}</sub>`;
        case 'a': {
          const href = el.getAttribute('href') || '#';
          return `[${kids()}](${href})`;
        }
        case 'img': {
          const src = el.getAttribute('src') || '';
          const alt = el.getAttribute('alt') || '';
          return `![${alt}](${src})`;
        }
        case 'p':  return `${kids()}\n\n`;
        case 'div':return `${kids()}\n`;
        case 'br': return '\n';
        case 'hr': return `\n---\n\n`;
        case 'blockquote': return kids().split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
        case 'code': return `\`${kids()}\``;
        case 'pre':  return `\`\`\`\n${kids()}\n\`\`\`\n\n`;
        case 'ul': {
          const items = Array.from(el.querySelectorAll(':scope > li'));
          return items.map(li => `- ${Array.from(li.childNodes).map(conv).join('').trim()}`).join('\n') + '\n\n';
        }
        case 'ol': {
          const items = Array.from(el.querySelectorAll(':scope > li'));
          return items.map((li, i) => `${i+1}. ${Array.from(li.childNodes).map(conv).join('').trim()}`).join('\n') + '\n\n';
        }
        case 'li': return kids();
        case 'table': {
          const rows = Array.from(el.querySelectorAll('tr'));
          if (!rows.length) return '';
          const toRow = (row: Element) =>
            '| ' + Array.from(row.querySelectorAll('td,th'))
              .map(c => Array.from(c.childNodes).map(conv).join('').replace(/\|/g, '\\|').trim())
              .join(' | ') + ' |';
          const head = toRow(rows[0]);
          const sep  = '| ' + Array.from(rows[0].querySelectorAll('td,th')).map(() => '---').join(' | ') + ' |';
          return [head, sep, ...rows.slice(1).map(toRow)].join('\n') + '\n\n';
        }
        default: return kids();
      }
    };

    return conv(tmp).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ── CSV  ──────────────────────────────────────────────────────────────────
  /** Export all tables in the document as CSV (semicolon-separated) */
  exportCsv() {
    if (!this.editorArea) return;
    const tables = this.editorArea.nativeElement.querySelectorAll('table');
    if (!tables.length) {
      this.showToast('Aucun tableau trouvé dans le document', 'info'); return;
    }
    let csv = '';
    tables.forEach((tbl, idx) => {
      if (idx > 0) csv += '\n\n';
      Array.from(tbl.querySelectorAll('tr')).forEach(row => {
        const cells = Array.from(row.querySelectorAll('td,th'))
          .map(c => `"${(c.textContent || '').replace(/"/g, '""').trim()}"`);
        csv += cells.join(';') + '\n';
      });
    });
    this.downloadBlob(csv, this.sanitizeFilename(this.docTitle) + '.csv', 'text/csv;charset=utf-8');
  }

  private sanitizeFilename(name: string): string {
    return (name || 'document').replace(/[<>:"/\\|?*]/g, '_').substring(0, 60);
  }

  /** Check spelling (browser native) */
  checkSpelling() {
    if (this.editorArea) {
      const el = this.editorArea.nativeElement;
      el.spellcheck = true;
      this.showToast('Vérification orthographique activée (navigateur)', 'info');
    }
  }

  /** Count words and show stats */
  countWords() {
    if (!this.editorArea) return;
    const text = this.editorArea.nativeElement.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const sentences = (text.match(/[.!?]+/g) || []).length;
    this.dialog.alert(`• Mots : ${words}\n• Caractères : ${chars}\n• Phrases estimées : ${sentences}`, 'Statistiques du document', 'info');
  }

  onEditorInput() {
    if (!this.editorArea) return;
    const text = this.editorArea.nativeElement.innerText || '';
    this.wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    this.charCount = text.length;
  }

  loadTemplate(tpl: CSTool | string) {
    const html = TEMPLATES[tpl];
    if (!html) return;
    this.editorHtml = html;
    setTimeout(() => {
      if (this.editorArea) {
        this.editorArea.nativeElement.innerHTML = html;
        this.onEditorInput();
      }
    }, 50);
    this.showToast('Modèle chargé ✓', 'success');
  }

  clearEditor() {
    this.editorHtml = '';
    this.docTitle   = 'Document sans titre';
    if (this.editorArea) {
      this.editorArea.nativeElement.innerHTML = '';
      this.wordCount = 0; this.charCount = 0;
    }
    this.cdr.detectChanges();
  }

  copyEditorContent() {
    if (!this.editorArea) return;
    const text = this.editorArea.nativeElement.innerText;
    navigator.clipboard.writeText(text).then(() => this.showToast('Texte copié ✓', 'success'));
  }

  printDoc() {
    if (!this.editorArea) return;
    const html = this.editorArea.nativeElement.innerHTML;
    const win  = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${this.docTitle}</title>
      <style>
        @page { margin: 2cm; }
        body { font-family: '${this.fontFamily}', Calibri, Arial, sans-serif;
               max-width: 100%; font-size: ${this.fontSize}pt; line-height: ${this.lineHeight}; color: #000; }
        h1 { font-size: 20pt; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: .2cm; }
        h2 { font-size: 14pt; color: #1d4ed8; }
        h3 { font-size: 12pt; color: #6366f1; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #c4c4c4; padding: .3cm; }
        th { background: #f1f5f9; font-weight: 700; }
        hr { border: none; border-top: 1.5px solid #d1d5db; margin: .5cm 0; }
        blockquote { border-left: 4px solid #6366f1; margin-left: 1cm; padding-left: .5cm; color: #4b5563; font-style: italic; }
      </style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus(); win.print();
  }

  exportHtml() {
    if (!this.editorArea) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${this.docTitle}</title></head><body>${this.editorArea.nativeElement.innerHTML}</body></html>`;
    this.downloadBlob(html, 'document.html', 'text/html');
  }

  exportTxt() {
    if (!this.editorArea) return;
    this.downloadBlob(this.editorArea.nativeElement.innerText, 'document.txt', 'text/plain');
  }

  // ─── Context Menu ─────────────────────────────────────────────────────────

  onCtxMenu(e: MouseEvent) {
    e.preventDefault();
    // Clamp to viewport
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 340);
    this.ctxMenu = { visible: true, x, y };
    this.cdr.detectChanges();
  }

  closeCtxMenu() {
    if (this.ctxMenu.visible) {
      this.ctxMenu.visible = false;
      this.cdr.detectChanges();
    }
  }

  ctxExec(cmd: string) {
    // Restore focus + selection first
    this.editorArea?.nativeElement.focus();
    document.execCommand(cmd, false);
    this.onEditorInput();
    this.updateFmtState();
  }

  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      document.execCommand('insertText', false, text);
    } catch {
      this.showToast("Coller : utilisez Ctrl+V dans l'éditeur", 'info');
    }
  }

  private downloadBlob(content: string, name: string, mime: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name; a.click();
    this.showToast(`${name} téléchargé ✓`, 'success');
  }

  execFormat(cmd: string, e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    document.execCommand('formatBlock', false, v);
    this.editorArea?.nativeElement.focus();
  }

  // ─── Badge Creator ────────────────────────────────────────────────────────

  selectBadgeTpl(t: typeof BADGE_COLOR_PRESETS[0]) {
    this.badgeTpl     = t.id;
    this.badge.bg     = t.bg;
    this.badge.fg     = t.fg;
    this.badge.accent = t.accent;
    this.drawBadge();
  }

  onLogoUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => { this.badgeLogoImg = img; this.drawBadge(); };
    img.src = URL.createObjectURL(file);
  }

  drawBadge() {
    const canvas = this.badgeCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 340, H = 210;
    ctx.clearRect(0, 0, W, H);

    // Fond
    ctx.fillStyle = this.badge.bg;
    this.roundRect(ctx, 0, 0, W, H, 14);
    ctx.fill();

    // Bande accent
    ctx.fillStyle = this.badge.accent;
    ctx.fillRect(0, 0, 8, H);

    // Logo optionnel
    if (this.badgeLogoImg) {
      const lh = 38, lw = 38;
      ctx.drawImage(this.badgeLogoImg, W - lw - 16, 14, lw, lh);
    }

    // Nom
    ctx.fillStyle = this.badge.fg;
    ctx.font = 'bold 22px Inter, system-ui, sans-serif';
    ctx.fillText(this.badge.name || 'Prénom NOM', 24, 58);

    // Trait accent sous le nom
    ctx.strokeStyle = this.badge.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(24, 68); ctx.lineTo(W - 24, 68); ctx.stroke();

    // Rôle
    ctx.fillStyle = this.badge.accent;
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    this.fillTextMultiline(ctx, this.badge.role || 'Rôle / Titre', 24, 88, W - 48, 18);

    // Organisation
    ctx.fillStyle = this.badge.fg; ctx.globalAlpha = .7;
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillText(this.badge.org || 'Organisation', 24, 130);
    ctx.globalAlpha = 1;

    // Séparateur
    ctx.strokeStyle = this.badge.accent; ctx.lineWidth = 1; ctx.globalAlpha = .3;
    ctx.beginPath(); ctx.moveTo(24, 145); ctx.lineTo(W - 24, 145); ctx.stroke();
    ctx.globalAlpha = 1;

    // ID badge
    ctx.fillStyle = this.badge.fg; ctx.globalAlpha = .5;
    ctx.font = '10px monospace';
    ctx.fillText(this.badge.id || 'BADGE-000', 24, 165);
    ctx.globalAlpha = 1;

    // Watermark coin bas droit
    ctx.fillStyle = this.badge.fg; ctx.globalAlpha = .18;
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText('Creative AI Studio', W - 80, H - 14);
    ctx.globalAlpha = 1;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private fillTextMultiline(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line.trim(), x, y); line = word + ' '; y += lineH; }
      else { line = test; }
    }
    ctx.fillText(line.trim(), x, y);
  }

  downloadBadge() {
    const canvas = this.badgeCanvas?.nativeElement;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `badge-${this.badge.id || 'badge'}.png`;
    a.click();
    this.showToast(`Badge téléchargé ✓ (${this.badgeCopies} copie(s))`, 'success');
  }

  printBadge() {
    const canvas = this.badgeCanvas?.nativeElement;
    if (!canvas) return;
    const img = canvas.toDataURL('image/png');
    let copies = '';
    for (let i = 0; i < this.badgeCopies; i++) {
      copies += `<div style="page-break-inside:avoid;margin:4mm"><img src="${img}" style="width:9cm;height:5.5cm"></div>`;
    }
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>body{margin:0;display:flex;flex-wrap:wrap;gap:4mm;padding:4mm}@media print{@page{margin:1cm}}</style>
    </head><body>${copies}</body></html>`);
    win.document.close(); win.focus(); win.print();
  }

  // ─── CSV Import / Batch badges ────────────────────────────────────────────

  onCsvImport(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    // Reset input pour permettre re-import du même fichier
    (e.target as HTMLInputElement).value = '';

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const reader = new FileReader();

    if (ext === 'xlsx' || ext === 'xls') {
      // Lecture binaire pour Excel via SheetJS
      reader.onload = (ev) => {
        const data = ev.target?.result as ArrayBuffer;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Convertit la première feuille en tableau de tableaux
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
        this.parseRows(rows);
        this.afterImport(file.name);
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV / TXT : lecture texte
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const sep = text.includes(';') ? ';' : ',';
        const rawRows = text.split(/\r?\n/)
          .filter(l => l.trim())
          .map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, '')));
        this.parseRows(rawRows);
        this.afterImport(file.name);
      };
      reader.readAsText(file, 'UTF-8');
    }
  }

  private parseRows(rows: string[][]) {
    if (!rows.length) { this.csvPersons = []; return; }
    // Détecte si la première ligne est un header
    const firstCell = String(rows[0][0] || '').toLowerCase();
    const isHeader = /^(nom|name|pr[eé]nom|first|last|full|titre|label)/i.test(firstCell);
    const dataRows = isHeader ? rows.slice(1) : rows;
    this.csvPersons = dataRows
      .map((cols, i) => ({
        name: String(cols[0] || '').trim(),
        role: String(cols[1] || '').trim(),
        org:  String(cols[2] || '').trim() || this.badge.org,
        id:   String(cols[3] || '').trim() || `BADGE-${String(i + 1).padStart(3, '0')}`,
      }))
      .filter(p => p.name);
  }

  private afterImport(filename: string) {
    if (this.csvPersons.length > 0) {
      this.selectCsvPerson(0);
      this.showToast(`${this.csvPersons.length} personne(s) importée(s) depuis "${filename}" ✓`, 'success');
    } else {
      this.showToast('Aucune ligne valide trouvée — vérifiez le format du fichier', 'info');
    }
    this.cdr.detectChanges();
  }

  selectCsvPerson(i: number) {
    this.csvIndex = i;
    const p = this.csvPersons[i];
    if (!p) return;
    this.badge.name = p.name;
    this.badge.role = p.role;
    this.badge.org  = p.org;
    this.badge.id   = p.id;
    this.drawBadge();
  }

  printAllBadges() {
    if (!this.csvPersons.length || !this.badgeCanvas?.nativeElement) return;
    const origName = this.badge.name;
    const origRole = this.badge.role;
    const origOrg  = this.badge.org;
    const origId   = this.badge.id;
    const images: string[] = [];
    for (const p of this.csvPersons) {
      this.badge.name = p.name;
      this.badge.role = p.role;
      this.badge.org  = p.org;
      this.badge.id   = p.id;
      this.drawBadge();
      images.push(this.badgeCanvas.nativeElement.toDataURL('image/png'));
    }
    // Restaurer
    this.badge.name = origName;
    this.badge.role = origRole;
    this.badge.org  = origOrg;
    this.badge.id   = origId;
    this.drawBadge();
    // Générer la page d'impression
    const cards = images.map(src =>
      `<div style="page-break-inside:avoid;margin:3mm;display:inline-block"><img src="${src}" style="width:9cm;height:5.5cm;display:block"></div>`
    ).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Badges</title>
    <style>body{margin:0;display:flex;flex-wrap:wrap;gap:2mm;padding:4mm}@media print{@page{margin:.5cm}}</style>
    </head><body>${cards}</body></html>`);
    win.document.close(); win.focus(); win.print();
    this.showToast(`${this.csvPersons.length} badges envoyés à l'impression ✓`, 'success');
  }

  // ─── Carte de visite ──────────────────────────────────────────────────────

  selectCarteTpl(t: typeof this.carteTemplates[0]) {
    this.carteTpl     = t.id;
    this.carte.bg     = t.bg;
    this.carte.fg     = t.fg;
    this.carte.accent = t.accent;
    this.drawCarte();
  }

  onCarteLogoUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => { this.carteLogoImg = img; this.drawCarte(); };
    img.src = URL.createObjectURL(file);
  }

  drawCarte() {
    const canvas = this.carteCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 530, H = 330;
    ctx.clearRect(0, 0, W, H);
    const c = this.carte;

    const drawInitOrLogo = (cx: number, cy: number, r: number) => {
      if (this.carteLogoImg) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.clip();
        ctx.drawImage(this.carteLogoImg, cx - r, cy - r, r * 2, r * 2); ctx.restore();
      } else {
        ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(r)}px Inter,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((c.nom || 'N').charAt(0).toUpperCase(), cx, cy);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    };

    if (this.carteTpl === 'modern') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, c.bg); grad.addColorStop(1, c.bg);
      ctx.fillStyle = grad;
      this.roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
      ctx.fillStyle = c.accent; ctx.fillRect(0, 0, W, 5);
      drawInitOrLogo(52, 70, 30);
      ctx.fillStyle = c.fg; ctx.font = 'bold 22px Inter,sans-serif';
      ctx.fillText(c.nom || 'Prénom NOM', 96, 58);
      ctx.fillStyle = c.accent; ctx.font = '13.5px Inter,sans-serif';
      ctx.fillText(c.titre || 'Titre', 96, 80);
      ctx.strokeStyle = c.fg; ctx.globalAlpha = .15; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(24, 112); ctx.lineTo(W - 24, 112); ctx.stroke();
      ctx.globalAlpha = 1;
      const rows: [string, string][] = ([['✉', c.email], ['☎', c.tel], ['⬡', c.site], ['◉', c.adresse]] as [string,string][]).filter(([,v]) => v);
      ctx.font = '12px Inter,sans-serif';
      let ry = 138;
      for (const [icon, val] of rows) {
        ctx.fillStyle = c.accent; ctx.globalAlpha = .85; ctx.fillText(icon, 24, ry);
        ctx.fillStyle = c.fg; ctx.globalAlpha = .9; ctx.fillText(val, 52, ry);
        ctx.globalAlpha = 1; ry += 25;
      }
      ctx.fillStyle = c.fg; ctx.globalAlpha = .12;
      ctx.font = '9px Inter,sans-serif';
      ctx.textAlign = 'right'; ctx.fillText('Creative AI Studio', W - 14, H - 12);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;

    } else if (this.carteTpl === 'classic') {
      ctx.fillStyle = c.bg; this.roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
      ctx.fillStyle = c.accent; ctx.fillRect(0, 0, W, 88);
      if (this.carteLogoImg) { ctx.drawImage(this.carteLogoImg, W - 76, 14, 56, 56); }
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px Inter,sans-serif';
      ctx.fillText(c.nom || 'Prénom NOM', 24, 46);
      ctx.globalAlpha = .85; ctx.font = '13px Inter,sans-serif';
      ctx.fillText(c.titre || 'Titre', 24, 68); ctx.globalAlpha = 1;
      const contacts = ([{ label: 'Email', val: c.email }, { label: 'Tél', val: c.tel }, { label: 'Web', val: c.site }, { label: 'Adresse', val: c.adresse }]).filter(x => x.val);
      let cy2 = 114;
      for (const { label, val } of contacts) {
        ctx.fillStyle = c.accent; ctx.font = 'bold 9px Inter,sans-serif';
        ctx.fillText(label.toUpperCase(), 24, cy2);
        ctx.fillStyle = c.fg; ctx.font = '12.5px Inter,sans-serif';
        ctx.fillText(val, 82, cy2); cy2 += 30;
      }
      ctx.fillStyle = c.accent; ctx.fillRect(0, H - 5, W, 5);

    } else if (this.carteTpl === 'minimal') {
      ctx.fillStyle = c.bg; this.roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
      ctx.fillStyle = c.fg; ctx.font = 'bold 28px Georgia,serif';
      ctx.fillText(c.nom || 'Prénom NOM', 40, 92);
      const nw = ctx.measureText(c.nom || 'Prénom NOM').width;
      ctx.fillStyle = c.accent; ctx.fillRect(40, 101, Math.min(nw, 320), 2.5);
      ctx.fillStyle = '#64748b'; ctx.font = '14px Inter,sans-serif';
      ctx.fillText(c.titre || 'Titre', 40, 126);
      const lItems = [c.email, c.tel].filter(Boolean);
      const rItems = [c.site, c.adresse].filter(Boolean);
      ctx.fillStyle = c.fg; ctx.font = '11.5px Inter,sans-serif';
      let lcy = 168;
      for (const v of lItems) { ctx.fillText(v, 40, lcy); lcy += 22; }
      lcy = 168;
      for (const v of rItems) { ctx.fillText(v, W / 2, lcy); lcy += 22; }
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(W - 44, H - 44, 22, 0, 2 * Math.PI); ctx.fill();
      if (this.carteLogoImg) { ctx.drawImage(this.carteLogoImg, W - 64, H - 64, 44, 44); }

    } else if (this.carteTpl === 'premium') {
      const grad2 = ctx.createLinearGradient(0, 0, W, H);
      grad2.addColorStop(0, '#1c1008'); grad2.addColorStop(1, '#0f0a04');
      ctx.fillStyle = grad2; this.roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1; ctx.globalAlpha = .35;
      ctx.strokeRect(12, 12, W - 24, H - 24); ctx.globalAlpha = 1;
      drawInitOrLogo(58, 92, 34);
      ctx.fillStyle = c.fg; ctx.font = 'bold 22px Georgia,serif';
      ctx.fillText(c.nom || 'Prénom NOM', 108, 80);
      ctx.fillStyle = c.accent; ctx.font = 'italic 13px Georgia,serif';
      ctx.fillText(c.titre || 'Titre', 108, 102);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1; ctx.globalAlpha = .3;
      ctx.beginPath(); ctx.moveTo(24, 142); ctx.lineTo(W - 24, 142); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.fg; ctx.globalAlpha = .75; ctx.font = '12px Inter,sans-serif';
      const items = [c.email, c.tel, c.site, c.adresse].filter(Boolean);
      let yy = 168;
      for (const v of items) { ctx.fillText(v, 40, yy); yy += 24; }
      ctx.globalAlpha = 1;
    }
  }

  downloadCarte() {
    const canvas = this.carteCanvas?.nativeElement;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `carte-${(this.carte.nom || 'carte').replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
    this.showToast('Carte téléchargée ✓', 'success');
  }

  printCarte() {
    const canvas = this.carteCanvas?.nativeElement;
    if (!canvas) return;
    const img = canvas.toDataURL('image/png');
    let copies = '';
    for (let i = 0; i < this.carteCopies; i++) {
      copies += `<div style="page-break-inside:avoid;margin:3mm"><img src="${img}" style="width:8.56cm;height:5.35cm"></div>`;
    }
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>body{margin:0;display:flex;flex-wrap:wrap;gap:3mm;padding:3mm}@media print{@page{margin:.5cm}}</style>
    </head><body>${copies}</body></html>`);
    win.document.close(); win.focus(); win.print();
  }

  // ─── Logo Creator ──────────────────────────────────────────────────────────

  selectLogoStyle(s: string) {
    this.logoStyle = s;
    this.drawLogo();
  }

  drawLogo() {
    const canvas = this.logoCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 480, H = 260;
    ctx.clearRect(0, 0, W, H);
    const l = this.logo;
    const cx = W / 2, cy = H / 2;

    if (l.bgFilled) {
      ctx.fillStyle = l.bg;
      this.roundRect(ctx, 0, 0, W, H, 16); ctx.fill();
    }

    if (this.logoStyle === 'wordmark') {
      const first = l.nom.charAt(0);
      const rest  = l.nom.slice(1);
      ctx.font = 'bold 60px Inter,sans-serif';
      ctx.textBaseline = 'middle';
      const fw = ctx.measureText(first).width;
      const rw = ctx.measureText(rest).width;
      const sx = cx - (fw + rw) / 2;
      ctx.fillStyle = l.accent; ctx.fillText(first, sx, cy - 16);
      ctx.fillStyle = l.fg;     ctx.fillText(rest,  sx + fw, cy - 16);
      ctx.fillStyle = l.accent; ctx.fillRect(sx, cy + 16, fw + rw, 3);
      if (l.tagline) {
        ctx.fillStyle = l.fg; ctx.globalAlpha = .5;
        ctx.font = '15px Inter,sans-serif';
        ctx.fillText(l.tagline, cx - ctx.measureText(l.tagline).width / 2, cy + 40);
        ctx.globalAlpha = 1;
      }
      ctx.textBaseline = 'alphabetic';

    } else if (this.logoStyle === 'monogram') {
      const r = 78;
      ctx.strokeStyle = l.accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy - 10, r, 0, 2 * Math.PI); ctx.stroke();
      ctx.fillStyle = l.accent; ctx.globalAlpha = .1;
      ctx.beginPath(); ctx.arc(cx, cy - 10, r, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
      const ini = (l.initiales || l.nom.slice(0, 2)).toUpperCase();
      ctx.fillStyle = l.fg; ctx.font = `bold ${ini.length > 1 ? 52 : 64}px Inter,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ini, cx, cy - 10);
      if (l.tagline) {
        ctx.fillStyle = l.fg; ctx.globalAlpha = .55;
        ctx.font = '13px Inter,sans-serif';
        ctx.fillText(l.tagline, cx, cy + 82);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    } else if (this.logoStyle === 'badge') {
      const r2 = 96;
      ctx.strokeStyle = l.accent; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, r2, 0, 2 * Math.PI); ctx.stroke();
      ctx.strokeStyle = l.accent; ctx.lineWidth = 1; ctx.globalAlpha = .3;
      ctx.beginPath(); ctx.arc(cx, cy, r2 - 12, 0, 2 * Math.PI); ctx.stroke();
      ctx.globalAlpha = 1;
      const ini2 = (l.initiales || l.nom.slice(0, 2)).toUpperCase();
      ctx.fillStyle = l.accent; ctx.font = `bold 54px Inter,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ini2, cx, cy - 8);
      ctx.fillStyle = l.fg; ctx.font = 'bold 12px Inter,sans-serif';
      ctx.fillText(l.nom.toUpperCase(), cx, cy + 36);
      if (l.tagline) {
        ctx.globalAlpha = .5; ctx.font = '10px Inter,sans-serif';
        ctx.fillText(l.tagline, cx, cy + 54); ctx.globalAlpha = 1;
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    } else if (this.logoStyle === 'icone') {
      const sym = l.symbole || '◈';
      const iconCx = cx - 108, iconCy = cy;
      ctx.fillStyle = l.accent;
      ctx.beginPath(); ctx.arc(iconCx, iconCy, 52, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '40px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sym, iconCx, iconCy);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const tx = iconCx + 72;
      ctx.fillStyle = l.fg; ctx.font = 'bold 30px Inter,sans-serif';
      ctx.fillText(l.nom, tx, cy - 4);
      const nw = ctx.measureText(l.nom).width;
      ctx.fillStyle = l.accent; ctx.fillRect(tx, cy + 4, nw, 2.5);
      if (l.tagline) {
        ctx.fillStyle = l.fg; ctx.globalAlpha = .5;
        ctx.font = '13px Inter,sans-serif';
        ctx.fillText(l.tagline, tx, cy + 26); ctx.globalAlpha = 1;
      }
    }
  }

  downloadLogoPng() {
    const canvas = this.logoCanvas?.nativeElement;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `logo-${(this.logo.nom || 'logo').replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
    this.showToast('Logo PNG téléchargé ✓', 'success');
  }

  downloadLogoSvg() {
    const l = this.logo;
    const W = 480, H = 260, cx = W / 2, cy = H / 2;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let inner = '';

    if (this.logoStyle === 'wordmark') {
      const first = l.nom.charAt(0);
      const rest  = l.nom.slice(1);
      inner = `<text x="${cx}" y="${cy + 10}" font-family="Inter,Arial,sans-serif" font-size="60" font-weight="bold" text-anchor="middle" dominant-baseline="middle"><tspan fill="${l.accent}">${esc(first)}</tspan><tspan fill="${l.fg}">${esc(rest)}</tspan></text>
        ${l.tagline ? `<text x="${cx}" y="${cy + 46}" font-family="Inter,Arial,sans-serif" font-size="15" fill="${l.fg}" opacity="0.5" text-anchor="middle">${esc(l.tagline)}</text>` : ''}`;
    } else if (this.logoStyle === 'monogram') {
      const ini = (l.initiales || l.nom.slice(0, 2)).toUpperCase();
      inner = `<circle cx="${cx}" cy="${cy - 10}" r="78" fill="${l.accent}" fill-opacity="0.1" stroke="${l.accent}" stroke-width="3"/>
        <text x="${cx}" y="${cy - 10}" font-family="Inter,Arial,sans-serif" font-size="${ini.length > 1 ? 52 : 64}" font-weight="bold" fill="${l.fg}" text-anchor="middle" dominant-baseline="middle">${esc(ini)}</text>
        ${l.tagline ? `<text x="${cx}" y="${cy + 82}" font-family="Inter,Arial,sans-serif" font-size="13" fill="${l.fg}" opacity="0.55" text-anchor="middle">${esc(l.tagline)}</text>` : ''}`;
    } else if (this.logoStyle === 'badge') {
      const ini2 = (l.initiales || l.nom.slice(0, 2)).toUpperCase();
      inner = `<circle cx="${cx}" cy="${cy}" r="96" fill="none" stroke="${l.accent}" stroke-width="4"/>
        <circle cx="${cx}" cy="${cy}" r="84" fill="none" stroke="${l.accent}" stroke-width="1" opacity="0.3"/>
        <text x="${cx}" y="${cy - 8}" font-family="Inter,Arial,sans-serif" font-size="54" font-weight="bold" fill="${l.accent}" text-anchor="middle" dominant-baseline="middle">${esc(ini2)}</text>
        <text x="${cx}" y="${cy + 36}" font-family="Inter,Arial,sans-serif" font-size="12" font-weight="bold" fill="${l.fg}" text-anchor="middle">${esc(l.nom.toUpperCase())}</text>
        ${l.tagline ? `<text x="${cx}" y="${cy + 54}" font-family="Inter,Arial,sans-serif" font-size="10" fill="${l.fg}" opacity="0.5" text-anchor="middle">${esc(l.tagline)}</text>` : ''}`;
    } else {
      const sym  = l.symbole || '◈';
      const icx  = cx - 108;
      const tx   = icx + 72;
      inner = `<circle cx="${icx}" cy="${cy}" r="52" fill="${l.accent}"/>
        <text x="${icx}" y="${cy}" font-size="40" text-anchor="middle" dominant-baseline="middle" fill="white">${sym}</text>
        <text x="${tx}" y="${cy}" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="bold" fill="${l.fg}" dominant-baseline="middle">${esc(l.nom)}</text>
        ${l.tagline ? `<text x="${tx}" y="${cy + 26}" font-family="Inter,Arial,sans-serif" font-size="13" fill="${l.fg}" opacity="0.5">${esc(l.tagline)}</text>` : ''}`;
    }

    const bg = l.bgFilled ? `<rect width="${W}" height="${H}" rx="16" fill="${l.bg}"/>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${inner}</svg>`;
    this.downloadBlob(svg, `logo-${(l.nom || 'logo').replace(/\s+/g, '-').toLowerCase()}.svg`, 'image/svg+xml');
    this.showToast('Logo SVG téléchargé ✓', 'success');
  }

  // ─── WIP descriptions ─────────────────────────────────────────────────────

  wipDescription(): string {
    const descs: Record<string, string> = {
      'carte-visite': 'Créez votre carte de visite professionnelle en choisissant parmi nos modèles ou en partant de zéro. Personnalisez chaque élément (couleurs, typographie, logo) et exportez en PDF haute résolution prêt pour l\'impression.',
      'logo': 'Concevez votre logo en quelques clics : modèles par secteur, éditeur vectoriel intégré, palettes de couleurs harmonisées. Export SVG, PNG et PDF.',
      'cv-analyzer': 'Analysez votre CV en profondeur : extraction des compétences, scoring ATS, comparaison avec une fiche de poste, suggestions d\'amélioration personnalisées. Propulsé par IA.',
      'doc-chat': 'Posez des questions en langage naturel sur vos documents PDF, DOCX ou images. RAG multimodal alimenté par Claude/GPT avec mémoire de conversation et interface vocale (Whisper).',
      'scanner': 'Numérisez vos documents via webcam ou photo mobile. Pipeline automatique : deskew, débruitage, amélioration du contraste, OCR. Export PDF ou DOCX.',
      'bg-removal': 'Supprimez automatiquement le fond de n\'importe quelle photo en un clic. Sortie PNG avec transparence totale. Propulsé par rembg (IA).',
    };
    return descs[this.selectedTool] || 'Fonctionnalité en cours de développement.';
  }

  wipFeatures(): string[] {
    const features: Record<string, string[]> = {
      'carte-visite': ['Modèles pro', 'Éditeur drag-and-drop', 'Export PDF', 'Format standard 85×55mm'],
      'logo': ['Templates par secteur', 'Éditeur vectoriel', 'Export SVG/PNG/PDF', 'Palettes harmonisées'],
      'cv-analyzer': ['Score ATS', 'Matching poste', 'Suggestions IA', 'Export rapport PDF'],
      'doc-chat': ['PDF, DOCX, Images', 'Chat vocal', 'Mémoire session', 'pgvector + Claude'],
      'scanner': ['Webcam live', 'Deskew auto', 'OCR intégré', 'Export PDF/DOCX'],
      'bg-removal': ['PNG transparent', 'Traitement batch', 'IA rembg', 'Qualité HD'],
    };
    return features[this.selectedTool] || [];
  }

  // ─── File Import ──────────────────────────────────────────────────────────

  /** Open a file (.html, .htm, .txt, .md, .rtf) and load it into the editor */
  openFile() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.html,.htm,.txt,.md,.rtf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const ext    = file.name.split('.').pop()?.toLowerCase() || '';
      const reader = new FileReader();
      reader.onload = (ev) => {
        const raw = ev.target?.result as string;
        let html   = '';

        if (ext === 'html' || ext === 'htm') {
          // Extract body content from the HTML file
          const parser = new DOMParser();
          const doc    = parser.parseFromString(raw, 'text/html');
          html = doc.body.innerHTML;
        } else if (ext === 'md') {
          html = this.markdownToHtml(raw);
        } else if (ext === 'rtf') {
          const plain = this.rtfToText(raw);
          html = '<p>' + plain.split(/\r?\n/)
            .filter(l => l.trim())
            .map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
            .join('</p><p>') + '</p>';
        } else {
          // txt or any plain text
          html = '<p>' + raw.split(/\r?\n/)
            .filter(l => l.trim())
            .map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
            .join('</p><p>') + '</p>';
        }

        this.docTitle = file.name.replace(/\.[^.]+$/, '') || 'Document importé';
        if (this.editorArea) {
          this.editorArea.nativeElement.innerHTML = html;
          this.onEditorInput();
        }
        this.showToast(`📂 ${file.name} ouvert ✓`, 'success');
      };
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  }

  /** Simple Markdown → HTML converter for imported .md files */
  private markdownToHtml(md: string): string {
    // Preserve code blocks before any inline transformations
    const codeBlocks: string[] = [];
    md = md.replace(/```[\s\S]*?```/g, (m) => { codeBlocks.push(m); return `%%CB${codeBlocks.length - 1}%%`; });

    let html = md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
      .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g,     '<u>$1</u>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/~~(.+?)~~/g,     '<s>$1</s>')
      .replace(/`([^`]+)`/g,     '<code>$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      .replace(/^- (.+)$/gm,    '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm,'<li>$1</li>')
      .replace(/^> (.+)$/gm,    '<blockquote>$1</blockquote>')
      .replace(/^---+$/gm,      '<hr>')
      .replace(/\n\n/g,         '</p><p>');

    // Group adjacent <li> into a <ul>
    html = html.replace(/(<li>.*?<\/li>(\n<li>.*?<\/li>)*)/g, '<ul>$1</ul>');

    // Restore code blocks
    codeBlocks.forEach((cb, i) => {
      const code = cb.replace(/^```[a-z]*\n?/, '').replace(/```$/, '');
      html = html.replace(`%%CB${i}%%`, `<pre><code>${code.replace(/</g,'&lt;')}</code></pre>`);
    });

    return '<p>' + html + '</p>';
  }

  /** Strip RTF control sequences and extract plain text */
  private rtfToText(rtf: string): string {
    return rtf
      .replace(/\{\\[^}]*\}/g, ' ')
      .replace(/\\par\b/gi,  '\n')
      .replace(/\\line\b/gi, '\n')
      .replace(/\\tab\b/gi,  '\t')
      .replace(/\\[a-zA-Z]+\d* ?/g, '')
      .replace(/[{}\\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ─── Image Click / Resize ─────────────────────────────────────────────────

  /** Handle click in the editor area — select/deselect images */
  onEditorClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Click on a resize handle → the mousedown on the handle handles everything
    if (target.classList.contains('img-handle')) { e.stopPropagation(); return; }

    // Click on an already-wrapped image or its wrapper → (re-)select it
    if (target.classList.contains('img-wrapper')) {
      this.deselectAllImages();
      target.classList.add('img-wrapper--selected');
      e.stopPropagation();
      return;
    }

    // Click directly on an unwrapped image → wrap + select
    if (target.tagName === 'IMG' && !target.parentElement?.classList.contains('img-wrapper')) {
      this.wrapAndSelectImage(target as HTMLImageElement);
      e.stopPropagation();
      return;
    }

    // Click anywhere else → deselect all
    this.deselectAllImages();
  }

  /** Wraps an <img> in a resizable container and attaches 4 JS drag-handle corners */
  private wrapAndSelectImage(img: HTMLImageElement) {
    this.deselectAllImages();

    // --- Compute initial dimensions ---
    const editorW = (this.editorArea?.nativeElement.offsetWidth ?? 640) - 20;
    const natW    = img.naturalWidth  || img.offsetWidth  || 400;
    const natH    = img.naturalHeight || img.offsetHeight || 300;
    const initW   = Math.min(natW, editorW);
    const aspect  = natH / (natW || 1);

    // Set explicit pixel size on the <img> so JS can read/change offsetWidth later
    img.style.width    = initW + 'px';
    img.style.height   = Math.round(initW * aspect) + 'px';
    img.style.maxWidth = 'none';   // disable CSS max-width so the user can resize freely
    img.draggable      = false;

    // --- Build wrapper ---
    const wrapper = document.createElement('span');
    wrapper.className = 'img-wrapper img-wrapper--selected';
    wrapper.setAttribute('contenteditable', 'false');

    // Replace img in DOM with wrapper, then move img inside
    img.parentNode!.insertBefore(wrapper, img);
    wrapper.appendChild(img);

    // --- 4 corner drag handles ---
    const corners = [
      { id: 'nw', dxSign: -1, dySign: -1 },
      { id: 'ne', dxSign:  1, dySign: -1 },
      { id: 'sw', dxSign: -1, dySign:  1 },
      { id: 'se', dxSign:  1, dySign:  1 },
    ] as const;

    corners.forEach(({ id, dxSign, dySign }) => {
      const handle = document.createElement('span');
      handle.className = `img-handle img-handle-${id}`;

      handle.addEventListener('mousedown', (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        const x0 = ev.clientX;
        const y0 = ev.clientY;
        const w0 = img.offsetWidth;
        const h0 = img.offsetHeight;

        const onMove = (mv: MouseEvent) => {
          const dw   = (mv.clientX - x0) * dxSign;
          const newW = Math.max(40, w0 + dw);
          img.style.width = newW + 'px';
          // Hold Shift for free-form resize, otherwise keep aspect ratio
          img.style.height = mv.shiftKey
            ? Math.max(20, h0 + (mv.clientY - y0) * dySign) + 'px'
            : Math.max(20, Math.round(newW * aspect)) + 'px';
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',   onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
      });

      wrapper.appendChild(handle);
    });
  }

  /** Remove the selected state from all image wrappers */
  private deselectAllImages() {
    this.editorArea?.nativeElement
      .querySelectorAll('.img-wrapper--selected')
      .forEach((el: Element) => el.classList.remove('img-wrapper--selected'));
  }

  // ─── CV Template Gallery ──────────────────────────────────────────────────

  openCvModal() {
    this.selectedCvTpl = null;
    this.showCvModal   = true;
    this.cdr.detectChanges();
  }

  closeCvModal() {
    this.showCvModal = false;
    this.cdr.detectChanges();
  }

  loadCvTemplate() {
    if (!this.selectedCvTpl) return;
    const tpl = this.selectedCvTpl;
    this.closeCvModal();
    // Load into the editor
    setTimeout(() => {
      if (this.editorArea) {
        this.editorArea.nativeElement.innerHTML = tpl.html;
        this.onEditorInput();
      }
      this.docTitle = `CV — ${tpl.name}`;
      this.showToast(`📄 Modèle "${tpl.name}" chargé ✓`, 'success');
    }, 80);
  }


  // ─── Toast ────────────────────────────────────────────────────────────────

  showToast(msg: string, type: 'success' | 'info' = 'success') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMsg = msg; this.toastType = type; this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => { this.toastMsg = ''; this.cdr.detectChanges(); }, 3000);
  }
}
