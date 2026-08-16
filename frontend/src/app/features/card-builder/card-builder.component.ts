import {
  Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import {
  DesignEditorComponent,
  DesignEditorResult,
  DesignObject
} from '../../shared/design-editor/design-editor.component';

/* ═══════════════════════════════════════════
   INTERFACES
═══════════════════════════════════════════ */
interface CardPerson {
  /* ── Commun ─────────────────────────────────────────────────────── */
  id?: string;
  localId?: string;
  userId?: string;
  cardDesignId?: string;
  entrepriseId?: string;
  category?: string;
  code?: string;
  couleur1?: string;
  couleur2?: string;
  createdAt?: string;

  /* ── Identité personne ───────────────────────────────────────────── */
  nom: string;
  prenoms: string;
  photo?: string;
  civilite?: string;
  genre?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  nationalite?: string;

  /* ── Contact commun ──────────────────────────────────────────────── */
  email?: string;
  contact?: string;        // téléphone principal
  mobile?: string;
  fax?: string;
  siteWeb?: string;
  adresse?: string;
  qrCode?: string;
  qrDataUrl?: string;
  codeBarre?: string;

  /* ── Organisation ─────────────────────────────────────────────────── */
  entreprise?: string;
  sigleEntreprise?: string;
  logo?: string;

  /* ── Badge Identité ───────────────────────────────────────────────── */
  titre?: string;
  profession?: string;
  departement?: string;
  service?: string;
  matricule?: string;
  dateEmbauche?: string;
  dateExpiration?: string;
  accessType?: string;
  niveauAcces?: number;
  zonesAcces?: string;
  armoirie?: string;
  cachet?: string;
  signatureResponsable?: string;
  photoFormat?: string;

  /* ── Carte de Visite ─────────────────────────────────────────────── */
  specialite?: string;
  certifications?: string;
  slogan?: string;
  emailSecondaire?: string;
  whatsapp?: string;
  skype?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
  adresseLigne1?: string;
  adresseLigne2?: string;
  ville?: string;
  codePostal?: string;
  pays?: string;
  qrType?: string;

  /* ── Badge Événement ─────────────────────────────────────────────── */
  titreParticipant?: string;
  organisationParticipant?: string;
  paysOrigine?: string;
  titreEvenement?: string;
  sousTitreEvenement?: string;
  ownerEvenement?: string;
  contactOrganisateur?: string;
  dateDebut?: string;
  dateFin?: string;
  heureDebut?: string;
  heureFin?: string;
  lieuEvenement?: string;
  salleEvenement?: string;
  standEvenement?: string;
  tableNumero?: string;
  villeEvenement?: string;
  paysEvenement?: string;
  typeAcces?: string;
  numeroBadge?: string;
  sessionsAutorisees?: string;
  validiteJournee?: boolean;
  logoEvenement?: string;
  imageFond?: string;
  couleurTheme?: string;

  /* ── Carte Scolaire ──────────────────────────────────────────────── */
  numeroMatricule?: string;
  numeroInscription?: string;
  classe?: string;
  niveau?: string;
  filiere?: string;
  serie?: string;
  anneeScolaire?: string;
  dateInscription?: string;
  typeApprenant?: string;
  boursier?: boolean;
  typeBourse?: string;
  nomTuteur?: string;
  contactTuteur?: string;
  relationTuteur?: string;
  etablissementScolaire?: string;
  sigleEts?: string;
  typeEtablissement?: string;
  adresseEts?: string;
  villeEts?: string;
  paysEts?: string;
  logoEts?: string;
  couleurBandeau1?: string;
  couleurBandeau2?: string;
  titreCarte?: string;
  groupeSanguin?: string;
  allergies?: string;
  nomDirecteur?: string;
  signatureDirecteur?: string;
  description?: string;
}

interface CardData {
  prenom: string; nom: string; titre: string;
  organisation: string; email: string;
  telephone: string; adresse: string;
  siteWeb: string; idNumber: string;
  dateNaissance: string; classe: string; anneeScolaire: string;
  nomEvenement: string; dateEvenement: string;
  lieuEvenement: string; roleEvenement: string;
  photoUrl: string; logoUrl: string;
  couleur1: string; couleur2: string;
  qrDataUrl?: string;
}

interface CardEntreprise {
  id?: string;
  userId?: string;
  code?: string;
  raisonSocial: string;
  sigleEntreprise?: string;
  formeJuridique?: string;
  ifu?: string;
  rccm?: string;
  capitalSocial?: string;
  email?: string;
  contact?: string;
  telephone?: string;
  fax?: string;
  siteWeb?: string;
  adresse?: string;
  boitePostale?: string;
  ville?: string;
  pays?: string;
  secteurActivite?: string;
  niche?: string;
  description?: string;
  responsable?: string;
  titreResponsable?: string;
  logo?: string;
  armoirie?: string;
  cachet?: string;
  signatureResponsable?: string;
  couleur1?: string;
  couleur2?: string;
  createdAt?: string;
}

interface SavedDesign {
  id: string;
  name: string;
  templateId: string;
  category: string;
  cardData?: string;
  editorObjects: string;
  editedHtml: string;
  copies: number;
  pdfFormat: string;
  company?: string;
  createdAt: string;
}

interface CardTemplate {
  id: string; label: string;
  category: string; isVertical: boolean;
  render: (p: CardData) => string;
}

interface ProdRecord {
  id: string;
  designId: string;
  designName: string;
  templateId: string;
  category: string;
  personCount: number;
  copies: number;
  personNames: string[];
  entreprise?: string;
  timestamp: number;
}

const DEFAULT_PERSON: CardPerson = {
  nom: 'Laurent', prenoms: 'Marie',
  titre: 'Directrice Marketing', profession: 'Marketing',
  entreprise: 'Creative Agency', sigleEntreprise: 'CA',
  email: 'marie@agency.com', contact: '+33 6 12 34 56 78',
  adresse: '15 Rue de la Paix, Paris', siteWeb: 'www.agency.com',
  matricule: 'EMP-2024-001',
  classe: 'Terminale A', anneeScolaire: '2024-2025',
  dateNaissance: '15/03/1990', lieuNaissance: 'Paris',
  etablissementScolaire: 'Lycée International', sigleEts: 'LI',
  titreEvenement: 'Creative Summit 2025', dateDebut: '15/03/2025',
  salleEvenement: 'Hall A', standEvenement: 'Stand 12',
  ownerEvenement: 'Creative Agency', accessType: 'VIP',
};

const ACCESS_TYPES = [
  { group: 'Accès événement', items: ['VIP','INVITE','VISITEUR'] },
  { group: 'Rôles professionnels', items: ['EMPLOYE','DIRECTEUR','DIRECTRICE','MANAGER','RH','INFORMATIQUE','SECURITE'] },
  { group: 'Scolaire / Formation', items: ['ETUDIANT','APPRENANT','ENSEIGNANT','ADMINISTRATION','PARENT'] },
];

/* ═══════════════════════════════════════════
   HELPERS RENDU
═══════════════════════════════════════════ */
function personToCardData(p: CardPerson): CardData {
  const parts = (p.prenoms || '').split(' ');
  return {
    prenom:        parts[0] || '',
    nom:           p.nom          || '',
    titre:         p.titre        || '',
    organisation:  p.entreprise   || p.etablissementScolaire || '',
    email:         p.email        || '',
    telephone:     p.contact      || '',
    adresse:       p.adresse      || '',
    siteWeb:       p.siteWeb      || '',
    idNumber:      p.matricule    || '',
    dateNaissance: p.dateNaissance || '',
    classe:        p.classe       || '',
    anneeScolaire: p.anneeScolaire || '',
    nomEvenement:  p.titreEvenement || '',
    dateEvenement: p.dateDebut  || '',
    lieuEvenement: p.salleEvenement || '',
    roleEvenement: p.accessType     || '',
    photoUrl:      p.photo || '',
    logoUrl:       p.logo  || '',
    couleur1:      p.couleur1 || '#1565c0',
    couleur2:      p.couleur2 || '#ffd600',
    qrDataUrl:     p.qrDataUrl || p.qrCode || '',
  };
}

function photoCircle(url: string, size: number, border: string): string {
  if (url) return `<img src="${url}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:${border};display:block;" />`;
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#ccc;border:${border};display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size*0.35)}px;color:#666;">👤</div>`;
}

function photoRect(url: string, w: number, h: number, border: string, radius = '4px'): string {
  if (url) return `<img src="${url}" style="width:${w}px;height:${h}px;border-radius:${radius};object-fit:cover;border:${border};display:block;" />`;
  return `<div style="width:${w}px;height:${h}px;border-radius:${radius};background:#ccc;border:${border};display:flex;align-items:center;justify-content:center;font-size:${Math.floor(h*0.35)}px;color:#666;">👤</div>`;
}

function qrSimulated(size: number, color = '#000', bg = '#fff'): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" fill="${bg}"/>
    <rect x="2" y="2" width="16" height="16" fill="none" stroke="${color}" stroke-width="2"/><rect x="5" y="5" width="10" height="10" fill="${color}"/>
    <rect x="22" y="2" width="16" height="16" fill="none" stroke="${color}" stroke-width="2"/><rect x="25" y="5" width="10" height="10" fill="${color}"/>
    <rect x="2" y="22" width="16" height="16" fill="none" stroke="${color}" stroke-width="2"/><rect x="5" y="25" width="10" height="10" fill="${color}"/>
    <rect x="22" y="22" width="4" height="4" fill="${color}"/><rect x="28" y="22" width="4" height="4" fill="${color}"/>
    <rect x="34" y="22" width="4" height="4" fill="${color}"/><rect x="22" y="28" width="4" height="4" fill="${color}"/>
    <rect x="28" y="28" width="4" height="4" fill="${color}"/><rect x="34" y="34" width="4" height="4" fill="${color}"/>
    <rect x="22" y="34" width="4" height="4" fill="${color}"/><rect x="28" y="34" width="4" height="4" fill="${color}"/></svg>`;
}

function barcodeSimulated(color = '#000', width = 80, height = 28): string {
  const bars = [3,1,2,1,3,2,1,1,2,3,1,2,1,3,2,1,2,1,3,1,1,2,3,1];
  let x = 0; let s = '';
  bars.forEach((w2, i) => { if (i%2===0) s += `<rect x="${x}" y="0" width="${w2*2}" height="${height}" fill="${color}"/>`; x += w2*2+1; });
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${x} ${height}" preserveAspectRatio="none">${s}</svg>`;
}

function qrFor(p: CardData, size: number, color = '#000', bg = '#fff'): string {
  if (p.qrDataUrl) return `<img src="${p.qrDataUrl}" style="width:${size}px;height:${size}px;display:block;image-rendering:pixelated;" />`;
  return qrSimulated(size, color, bg);
}

/* ═══════════════════════════════════════════
   TEMPLATES T01–T20
═══════════════════════════════════════════ */
function renderT01(p: CardData): string {
  const c1 = p.couleur1||'#1a3c6e';
  return `<div style="width:204px;height:322px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);">
  <div style="position:absolute;top:0;left:0;right:0;height:110px;background:${c1};display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:8px;">
    <div style="position:absolute;top:8px;left:8px;width:30px;height:30px;background:#fff3;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;">🏢</div>
    <div style="margin-bottom:6px;">${photoCircle(p.photoUrl,56,'3px solid #fff')}</div>
    <div style="color:#fff;font-weight:700;font-size:12px;text-align:center;">${p.prenom} ${p.nom}</div>
    <div style="color:rgba(255,255,255,.8);font-size:9px;text-align:center;margin-top:2px;">${p.titre}</div>
  </div>
  <div style="position:absolute;top:110px;left:0;right:0;bottom:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0 12px;">
    <div style="display:flex;align-items:center;gap:6px;font-size:9px;color:#333;width:100%;"><span style="color:${c1};font-size:11px;">✉</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.email}</span></div>
    <div style="display:flex;align-items:center;gap:6px;font-size:9px;color:#333;width:100%;"><span style="color:${c1};font-size:11px;">📞</span><span>${p.telephone}</span></div>
    <div style="display:flex;align-items:center;gap:6px;font-size:9px;color:#333;width:100%;"><span style="color:${c1};font-size:11px;">🪪</span><span>${p.idNumber}</span></div>
    <div style="display:flex;align-items:center;gap:6px;font-size:9px;color:#333;width:100%;"><span style="color:${c1};font-size:11px;">🏢</span><span>${p.organisation}</span></div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:60px;background:${c1};display:flex;align-items:center;justify-content:space-between;padding:8px 10px;">
    <div style="color:rgba(255,255,255,.7);font-size:8px;">${p.siteWeb}</div>
    <div>${qrFor(p,40,'#fff','rgba(255,255,255,.15)')}</div>
  </div>
</div>`;
}
function renderT02(p: CardData): string {
  const c1=p.couleur1||'#f4511e';
  return `<div style="width:204px;height:322px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);">
  <svg style="position:absolute;top:0;left:0;" width="70" height="70" viewBox="0 0 70 70"><polygon points="0,0 70,0 0,70" fill="${c1}"/></svg>
  <svg style="position:absolute;bottom:0;right:0;" width="70" height="70" viewBox="0 0 70 70"><polygon points="70,70 0,70 70,0" fill="${c1}"/></svg>
  <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;padding-top:28px;gap:6px;">
    ${photoRect(p.photoUrl,60,70,`2px solid ${c1}`,'4px')}
    <div style="font-size:13px;font-weight:700;color:#111;margin-top:8px;">${p.prenom} ${p.nom}</div>
    <div style="font-size:9px;color:${c1};font-weight:600;">${p.titre}</div>
    <div style="font-size:9px;color:#555;">${p.organisation}</div>
    <div style="height:1px;width:80%;background:#eee;margin:4px 0;"></div>
    <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:#333;"><span style="color:${c1};">✉</span>${p.email}</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:#333;"><span style="color:${c1};">📞</span>${p.telephone}</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:#333;"><span style="color:${c1};">🌐</span>${p.siteWeb}</div>
    <div style="margin-top:16px;">${barcodeSimulated('#333',100,22)}</div>
    <div style="font-size:7px;color:#999;letter-spacing:2px;">${p.idNumber}</div>
  </div>
</div>`;
}
function renderT03(p: CardData): string {
  return `<div style="width:204px;height:322px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#0d1b35;box-shadow:0 2px 8px rgba(0,0,0,.4);">
  <div style="display:flex;flex-direction:column;align-items:center;padding-top:24px;gap:10px;">
    ${photoCircle(p.photoUrl,80,'3px solid #3b82f6')}
    <div style="font-size:15px;font-weight:700;color:#fff;text-align:center;margin-top:6px;">${p.prenom} ${p.nom}</div>
    <div style="font-size:9px;color:#93c5fd;letter-spacing:3px;text-transform:uppercase;">EMPLOYEE</div>
    <div style="height:1px;width:80%;background:rgba(255,255,255,.15);margin:4px 0;"></div>
    <div style="font-size:9px;color:#cbd5e1;text-align:center;">${p.titre}</div>
    <div style="font-size:9px;color:#64748b;text-align:center;">${p.organisation}</div>
    <div style="font-size:9px;color:#64748b;text-align:center;">${p.idNumber}</div>
    <div style="font-size:9px;color:#64748b;text-align:center;">${p.email}</div>
    <div style="font-size:9px;color:#64748b;text-align:center;">${p.telephone}</div>
  </div>
  <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:#1d4ed8;border-radius:20px;padding:5px 18px;">
    <span style="color:#fff;font-size:8px;font-weight:600;">${p.siteWeb}</span>
  </div>
</div>`;
}
function renderT04(p: CardData): string {
  const c1=p.couleur1||'#1976d2';
  return `<div style="width:204px;height:322px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);">
  <svg style="position:absolute;bottom:0;left:0;" width="80" height="60" viewBox="0 0 80 60"><polygon points="0,60 80,60 0,0" fill="${c1}" opacity="0.15"/></svg>
  <div style="display:flex;flex-direction:column;align-items:center;padding-top:20px;gap:6px;">
    ${photoRect(p.photoUrl,65,70,`1.5px solid ${c1}`,'4px')}
    <div style="font-size:13px;font-weight:700;color:#111;margin-top:6px;">${p.prenom} ${p.nom}</div>
    <div style="width:100%;background:${c1};text-align:center;padding:5px 0;margin:4px 0;">
      <div style="color:#fff;font-size:9px;font-weight:600;">${p.titre}</div>
      <div style="color:rgba(255,255,255,.75);font-size:8px;">${p.organisation}</div>
    </div>
    <div style="font-size:8px;color:#555;text-align:center;">${p.email}</div>
    <div style="font-size:8px;color:#555;text-align:center;">${p.telephone}</div>
    <div style="font-size:8px;color:#555;text-align:center;">${p.adresse}</div>
  </div>
  <div style="position:absolute;bottom:10px;left:10px;">${qrFor(p,45,c1)}</div>
  <div style="position:absolute;bottom:10px;right:10px;text-align:right;">
    <div style="font-size:7px;color:#999;font-weight:600;">ID:</div>
    <div style="font-size:8px;color:#333;">${p.idNumber}</div>
  </div>
</div>`;
}
function renderT05(p: CardData): string {
  const c1=p.couleur2||'#ffd600';
  return `<div style="width:204px;height:322px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#1a1a1a;box-shadow:0 2px 8px rgba(0,0,0,.4);">
  <div style="position:absolute;top:12px;left:12px;width:30px;height:30px;background:${c1};border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;">⚡</div>
  <div style="display:flex;flex-direction:column;align-items:center;padding-top:60px;gap:8px;">
    ${photoCircle(p.photoUrl,70,`2px solid ${c1}`)}
    <div style="font-size:13px;font-weight:700;color:#fff;text-align:center;margin-top:6px;">${p.prenom} ${p.nom}</div>
    <div style="font-size:9px;color:${c1};font-weight:600;text-align:center;">${p.titre}</div>
    <div style="height:1px;width:75%;background:${c1};opacity:.4;margin:4px 0;"></div>
    <div style="font-size:8px;color:rgba(255,255,255,.7);text-align:center;">ID: ${p.idNumber}</div>
    <div style="font-size:8px;color:rgba(255,255,255,.7);text-align:center;">${p.email}</div>
    <div style="font-size:8px;color:rgba(255,255,255,.7);text-align:center;">${p.telephone}</div>
    <div style="font-size:8px;color:rgba(255,255,255,.7);text-align:center;">${p.organisation}</div>
  </div>
</div>`;
}
function renderT06(p: CardData): string {
  const ini=(p.prenom[0]||'')+(p.nom[0]||'');
  return `<div style="width:204px;height:322px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#f5f0e8;box-shadow:0 2px 8px rgba(0,0,0,.12);">
  <div style="display:flex;flex-direction:column;align-items:center;padding-top:16px;gap:8px;">
    <div style="width:30px;height:30px;border-radius:50%;background:#7a9e7e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;">${ini||'⊕'}</div>
    ${photoCircle(p.photoUrl,70,'2px solid #7a9e7e')}
    <div style="font-size:14px;font-weight:700;color:#111;text-align:center;">${p.prenom} ${p.nom}</div>
    <div style="font-size:9px;color:#5c7a5e;font-weight:600;text-align:center;">${p.titre}</div>
    <div style="font-size:9px;color:#7a9e7e;text-align:center;">${p.organisation}</div>
    <div style="height:1px;width:70%;background:#7a9e7e;opacity:.3;margin:4px 0;"></div>
    <div style="font-size:8px;color:#5c7a5e;text-align:center;">${p.email}</div>
    <div style="font-size:8px;color:#5c7a5e;text-align:center;">${p.telephone}</div>
    <div style="font-size:8px;color:#5c7a5e;text-align:center;">${p.siteWeb}</div>
  </div>
</div>`;
}
function renderT07(p: CardData): string {
  return `<div style="width:204px;height:322px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:linear-gradient(160deg,#1a237e,#283593,#0d0d1a);box-shadow:0 2px 12px rgba(0,0,0,.5);">
  <div style="display:flex;flex-direction:column;align-items:center;padding-top:40px;gap:8px;">
    <div style="font-size:52px;font-weight:900;color:#fff;letter-spacing:4px;line-height:1;">VIP</div>
    <div style="font-size:11px;color:#90caf9;letter-spacing:5px;text-transform:uppercase;">TOUT ACCÈS</div>
    <div style="height:1px;width:80%;background:rgba(255,255,255,.3);margin:8px 0;"></div>
    <div style="font-size:14px;font-weight:700;color:#fff;text-align:center;">${p.dateEvenement}</div>
    <div style="font-size:16px;font-weight:700;color:#fff;text-align:center;">${p.nomEvenement}</div>
    <div style="font-size:10px;color:#90caf9;text-align:center;">${p.lieuEvenement}</div>
    <div style="font-size:11px;color:rgba(255,255,255,.7);font-style:italic;text-align:center;margin-top:4px;">${p.prenom} ${p.nom}</div>
  </div>
  <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);">${qrFor(p,50,'#fff','rgba(255,255,255,.1)')}</div>
</div>`;
}
function renderT08(p: CardData): string {
  return `<div style="width:204px;height:322px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:radial-gradient(ellipse at top,#6a1b9a,#1a237e,#0d0d1a);box-shadow:0 2px 12px rgba(0,0,0,.5);">
  <div style="display:flex;flex-direction:column;align-items:center;padding-top:30px;gap:8px;">
    <div style="font-size:22px;font-weight:700;color:#fff;text-align:center;">INVITÉ</div>
    <div style="font-size:11px;color:rgba(255,255,255,.8);letter-spacing:3px;text-transform:uppercase;">ACCÈS BACKSTAGE VIP</div>
    <div style="background:#fff;border-radius:20px;padding:4px 14px;margin:6px 0;">
      <span style="color:#111;font-size:10px;font-weight:700;">${p.dateEvenement}</span>
    </div>
    <div style="font-size:15px;font-weight:700;color:#fff;text-align:center;">${p.nomEvenement}</div>
    <div style="font-size:10px;color:rgba(255,255,255,.7);text-align:center;">${p.lieuEvenement}</div>
    <div style="font-size:14px;color:#fff;font-style:italic;font-family:cursive;text-align:center;margin-top:6px;">${p.prenom} ${p.nom}</div>
    <div style="font-size:9px;color:rgba(255,255,255,.6);text-align:center;">${p.roleEvenement}</div>
  </div>
  <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);">${barcodeSimulated('#fff',100,24)}</div>
</div>`;
}
function renderT09(p: CardData): string {
  return `<div style="width:204px;height:322px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#fafaf7;box-shadow:0 2px 8px rgba(0,0,0,.12);">
  <div style="display:flex;flex-direction:column;align-items:center;padding-top:24px;gap:8px;">
    <div style="font-size:15px;font-weight:700;color:#111;text-align:center;">${p.nomEvenement}</div>
    <div style="font-size:11px;color:#2d6e6e;text-align:center;letter-spacing:1px;">${p.organisation}</div>
    <div style="font-size:9px;color:#999;text-align:center;">${p.lieuEvenement}</div>
    <div style="width:80%;background:#2d6e6e;border-radius:6px;text-align:center;padding:8px 0;margin:8px 0;">
      <div style="color:#fff;font-size:12px;font-weight:700;">${p.dateEvenement}</div>
    </div>
    <div style="height:1px;width:80%;background:#ddd;margin:6px 0;"></div>
    <div style="font-size:13px;font-weight:700;color:#111;text-align:center;">${p.prenom} ${p.nom}</div>
    <div style="font-size:9px;color:#555;text-align:center;">${p.titre}</div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:48px;background:#2d6e6e;display:flex;align-items:center;justify-content:center;">
    <span style="color:#fff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${p.roleEvenement||'EXPOSANT'}</span>
  </div>
</div>`;
}
function renderT10(p: CardData): string {
  const s='repeating-linear-gradient(45deg,#f43f5e 0,#f43f5e 4px,#22c55e 4px,#22c55e 8px,#f97316 8px,#f97316 12px,#a855f7 12px,#a855f7 16px,#3b82f6 16px,#3b82f6 20px)';
  return `<div style="width:204px;height:280px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);">
  <div style="height:10px;background:${s};"></div>
  <div style="display:flex;flex-direction:column;align-items:center;padding:20px 16px 10px;gap:6px;">
    <div style="font-size:8px;color:#bbb;text-align:center;letter-spacing:2px;text-transform:uppercase;">BONJOUR, JE M'APPELLE</div>
    <div style="font-size:32px;font-weight:900;color:#111;text-align:center;line-height:1.1;margin:8px 0;">${p.prenom}</div>
    <div style="font-size:14px;font-weight:600;color:#444;text-align:center;">${p.nom}</div>
    <div style="font-size:10px;color:#666;text-align:center;margin-top:4px;">${p.titre}</div>
    <div style="font-size:9px;color:#888;text-align:center;">${p.organisation}</div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:10px;background:${s};"></div>
</div>`;
}
function renderT11(p: CardData): string {
  const c1=p.couleur2||'#ffd600';
  return `<div style="width:204px;height:322px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#111;box-shadow:0 2px 10px rgba(0,0,0,.5);">
  <div style="text-align:center;padding-top:16px;padding-bottom:6px;border-bottom:2px solid ${c1};">
    <div style="color:#fff;font-size:14px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">${p.nomEvenement}</div>
  </div>
  <div style="display:flex;gap:8px;padding:10px;">
    <div style="flex-shrink:0;">${photoRect(p.photoUrl,70,55,'none','4px')}</div>
    <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
      <div><div style="font-size:7px;color:#999;text-transform:uppercase;">Nom</div><div style="font-size:9px;color:#fff;font-weight:600;">${p.prenom} ${p.nom}</div></div>
      <div><div style="font-size:7px;color:#999;text-transform:uppercase;">Mission</div><div style="font-size:9px;color:#fff;">${p.roleEvenement}</div></div>
      <div><div style="font-size:7px;color:#999;text-transform:uppercase;">Lieu</div><div style="font-size:9px;color:#fff;">${p.lieuEvenement}</div></div>
    </div>
  </div>
  <div style="padding:0 12px;display:flex;flex-direction:column;gap:5px;">
    <div style="font-size:8px;color:rgba(255,255,255,.6);">Org: ${p.organisation}</div>
    <div style="font-size:8px;color:rgba(255,255,255,.6);">${p.email}</div>
    <div style="font-size:8px;color:rgba(255,255,255,.6);">ID: ${p.idNumber}</div>
  </div>
  <div style="position:absolute;bottom:12px;left:0;right:0;text-align:center;">
    <div style="font-size:9px;color:rgba(255,255,255,.7);">${p.dateEvenement}</div>
    <div style="height:2px;width:60px;background:${c1};margin:4px auto 0;border-radius:1px;"></div>
  </div>
</div>`;
}
function renderT12(p: CardData): string {
  const c1=p.couleur1||'#1565c0';
  return `<div style="width:321px;height:204px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);display:flex;">
  <div style="width:110px;flex-shrink:0;background:${c1};clip-path:polygon(0 0,100% 0,80% 100%,0 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;">
    <div style="width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:8px;">🏢</div>
    <div style="color:#fff;font-size:11px;font-weight:700;text-align:center;">${p.prenom}<br>${p.nom}</div>
    <div style="color:rgba(255,255,255,.8);font-size:8px;text-align:center;margin-top:3px;">${p.titre}</div>
  </div>
  <div style="flex:1;padding:14px 14px 10px 18px;display:flex;flex-direction:column;justify-content:center;gap:6px;position:relative;">
    <div style="font-size:10px;color:#333;font-weight:600;">${p.organisation}</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:8px;color:#555;"><span style="color:${c1};">✉</span>${p.email}</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:8px;color:#555;"><span style="color:${c1};">📞</span>${p.telephone}</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:8px;color:#555;"><span style="color:${c1};">📍</span>${p.adresse}</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:8px;color:#555;"><span style="color:${c1};">🌐</span>${p.siteWeb}</div>
    <div style="position:absolute;bottom:10px;right:10px;">${qrFor(p,35,c1)}</div>
  </div>
</div>`;
}
function renderT13(p: CardData): string {
  const g='#c9a84c';
  return `<div style="width:321px;height:204px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#111;box-shadow:0 2px 12px rgba(0,0,0,.5);">
  <svg style="position:absolute;bottom:0;left:0;right:0;" width="321" height="80" viewBox="0 0 321 80" preserveAspectRatio="none">
    <path d="M0,60 C80,20 160,80 240,40 S321,60 321,60 L321,80 L0,80 Z" fill="${g}" opacity="0.2"/>
  </svg>
  <div style="padding:18px 20px;position:relative;z-index:1;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="font-size:18px;">💎</div>
      <div style="color:${g};font-size:11px;font-weight:700;">${p.organisation}</div>
    </div>
    <div style="color:${g};font-size:14px;font-weight:700;margin-bottom:2px;">${p.prenom} ${p.nom}</div>
    <div style="color:rgba(201,168,76,.65);font-size:9px;margin-bottom:12px;">${p.titre}</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;">
      <div style="font-size:8px;color:rgba(201,168,76,.8);">📞 ${p.telephone}</div>
      <div style="font-size:8px;color:rgba(201,168,76,.8);">✉ ${p.email}</div>
      <div style="font-size:8px;color:rgba(201,168,76,.8);">🌐 ${p.siteWeb}</div>
    </div>
  </div>
</div>`;
}
function renderT14(p: CardData): string {
  const c1=p.couleur1||'#e8785a';
  return `<div style="width:321px;height:204px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);display:flex;">
  <div style="width:70px;flex-shrink:0;background:${c1};display:flex;align-items:center;justify-content:center;">
    ${photoCircle(p.photoUrl,52,'3px solid #fff')}
  </div>
  <div style="flex:1;padding:16px 14px;display:flex;flex-direction:column;justify-content:center;gap:6px;">
    <div style="font-size:13px;font-weight:700;color:#111;">${p.prenom} ${p.nom}</div>
    <div style="font-size:9px;color:${c1};font-weight:600;">${p.titre}</div>
    <div style="height:1px;background:#eee;width:80%;margin:4px 0;"></div>
    <div style="font-size:8px;color:#555;">✉ ${p.email}</div>
    <div style="font-size:8px;color:#555;">📞 ${p.telephone}</div>
    <div style="font-size:8px;color:#555;">📍 ${p.adresse}</div>
    <div style="font-size:8px;color:#555;">🌐 ${p.siteWeb}</div>
  </div>
</div>`;
}
function renderT15(p: CardData): string {
  const c1=p.couleur1||'#4a7c59';
  return `<div style="width:321px;height:204px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);">
  <svg style="position:absolute;bottom:0;left:0;" width="160" height="90" viewBox="0 0 160 90" preserveAspectRatio="none">
    <path d="M0,90 L0,40 C30,20 60,60 90,35 S140,15 160,30 L160,90 Z" fill="${c1}" opacity="0.15"/>
  </svg>
  <div style="padding:20px 16px;position:relative;z-index:1;">
    <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:3px;">${p.prenom} ${p.nom}</div>
    <div style="font-size:9px;color:#888;margin-bottom:14px;">${p.titre} — ${p.organisation}</div>
    <div style="display:flex;flex-direction:column;gap:5px;">
      <div style="font-size:8px;color:#555;">📞 ${p.telephone}</div>
      <div style="font-size:8px;color:#555;">✉ ${p.email}</div>
      <div style="font-size:8px;color:#555;">📍 ${p.adresse}</div>
      <div style="font-size:8px;color:#555;">🌐 ${p.siteWeb}</div>
    </div>
  </div>
</div>`;
}
function renderT16(p: CardData): string {
  const y=p.couleur2||'#ffd600';
  return `<div style="width:321px;height:204px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;box-shadow:0 2px 8px rgba(0,0,0,.3);">
  <div style="height:112px;background:#1a1a1a;padding:14px 16px;display:flex;flex-direction:column;justify-content:space-between;">
    <div style="color:#fff;font-size:11px;font-weight:700;">${p.organisation}</div>
    <div>
      <div style="color:#fff;font-size:13px;font-weight:700;">${p.prenom} ${p.nom}</div>
      <div style="color:${y};font-size:9px;">${p.titre}</div>
    </div>
    <div style="font-size:7px;color:rgba(255,255,255,.7);">📞 ${p.telephone} · ✉ ${p.email}</div>
  </div>
  <div style="height:92px;background:#fff;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;flex-direction:column;gap:4px;">
      <div style="font-size:7px;color:#555;">🌐 ${p.siteWeb}</div>
      <div style="font-size:7px;color:#555;">📍 ${p.adresse}</div>
      <div style="font-size:7px;color:#555;">ID: ${p.idNumber}</div>
    </div>
    <div>${qrFor(p,38,'#1a1a1a')}</div>
  </div>
</div>`;
}
function renderT17(p: CardData): string {
  const c1=p.couleur1||'#1565c0';
  return `<div style="width:321px;height:204px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);">
  <svg style="position:absolute;bottom:0;left:0;" width="200" height="120" viewBox="0 0 200 120" preserveAspectRatio="none">
    <path d="M0,120 L0,50 C40,30 80,70 120,45 S180,20 200,40 L200,120 Z" fill="${c1}" opacity="0.18"/>
  </svg>
  <div style="padding:18px 16px;position:relative;z-index:1;display:flex;gap:12px;height:100%;box-sizing:border-box;">
    <div style="flex:1;">
      <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:3px;">${p.prenom} ${p.nom}</div>
      <div style="font-size:9px;color:#888;margin-bottom:14px;">${p.titre}</div>
      <div style="font-size:8px;color:#555;">${p.organisation}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
      <div style="font-size:8px;color:#555;">📞 ${p.telephone}</div>
      <div style="font-size:8px;color:#555;">✉ ${p.email}</div>
      <div style="font-size:8px;color:#555;">🌐 ${p.siteWeb}</div>
      <div style="margin-top:auto;">${qrFor(p,30,c1)}</div>
    </div>
  </div>
</div>`;
}
function renderT18(p: CardData): string {
  return `<div style="width:321px;height:204px;border-radius:10px;overflow:hidden;font-family:sans-serif;position:relative;background:#1a3a3a;box-shadow:0 2px 10px rgba(0,0,0,.4);">
  <div style="padding:18px 20px;position:relative;z-index:1;">
    <div style="text-align:center;margin-bottom:10px;color:#fff;font-size:13px;font-weight:700;">${p.organisation}</div>
    <div style="color:#fff;font-size:13px;font-weight:700;margin-bottom:2px;">${p.prenom} ${p.nom}</div>
    <div style="color:rgba(255,255,255,.7);font-size:9px;margin-bottom:12px;">${p.titre}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      <div style="font-size:8px;color:rgba(255,255,255,.75);">📞 ${p.telephone}</div>
      <div style="font-size:8px;color:rgba(255,255,255,.75);">✉ ${p.email}</div>
      <div style="font-size:8px;color:rgba(255,255,255,.75);">🌐 ${p.siteWeb}</div>
    </div>
  </div>
</div>`;
}
function renderT19(p: CardData): string {
  const c1=p.couleur1||'#1565c0';
  return `<div style="width:321px;height:204px;border-radius:8px;overflow:hidden;font-family:sans-serif;position:relative;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);">
  <div style="height:45px;background:${c1};display:flex;align-items:center;padding:0 12px;gap:8px;">
    <div style="font-size:20px;">🏫</div>
    <div style="color:#fff;font-size:11px;font-weight:700;flex:1;text-align:center;">${p.organisation||'ÉCOLE INTERNATIONALE'}</div>
  </div>
  <div style="text-align:center;padding:4px 0;"><span style="color:${c1};font-size:8px;letter-spacing:2px;font-weight:600;">IDENTITY CARD</span></div>
  <div style="display:flex;gap:10px;padding:4px 10px;">
    <div style="flex-shrink:0;">${photoRect(p.photoUrl,48,58,`1px solid ${c1}`,'3px')}</div>
    <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;font-size:8px;">
      <div><span style="color:#999;display:block;">Nom</span><span style="color:#111;font-weight:600;">${p.nom} ${p.prenom}</span></div>
      <div><span style="color:#999;display:block;">Classe</span><span style="color:#111;font-weight:600;">${p.classe||'Terminale A'}</span></div>
      <div><span style="color:#999;display:block;">Naissance</span><span style="color:#111;">${p.dateNaissance}</span></div>
      <div><span style="color:#999;display:block;">Matricule</span><span style="color:#111;">${p.idNumber}</span></div>
      <div><span style="color:#999;display:block;">Contact</span><span style="color:#111;">${p.telephone}</span></div>
      <div><span style="color:#999;display:block;">Email</span><span style="color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;max-width:90px;">${p.email}</span></div>
    </div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:22px;background:${c1};display:flex;align-items:center;justify-content:space-between;padding:0 10px;">
    <span style="color:rgba(255,255,255,.8);font-size:8px;">Année: ${p.anneeScolaire}</span>
  </div>
</div>`;
}
function renderT20(p: CardData): string {
  return `<div style="width:321px;height:204px;border-radius:8px;overflow:hidden;font-family:sans-serif;position:relative;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);">
  <div style="display:flex;height:9px;">
    <div style="flex:1;background:#009a44;"></div>
    <div style="flex:1;background:#fff;border-top:1px solid #eee;border-bottom:1px solid #eee;"></div>
    <div style="flex:1;background:#f77f00;"></div>
  </div>
  <div style="text-align:center;padding:5px 0 2px;">
    <div style="color:#c00;font-size:10px;font-weight:700;letter-spacing:1px;">CARTE D'IDENTITÉ SCOLAIRE</div>
    <div style="color:#c00;font-size:8px;">ANNÉE SCOLAIRE ${p.anneeScolaire}</div>
  </div>
  <div style="display:flex;gap:10px;padding:4px 10px;">
    <div style="flex-shrink:0;">${photoRect(p.photoUrl,45,55,'1.5px solid #c00','0')}</div>
    <div style="flex:1;font-size:8px;display:flex;flex-direction:column;gap:3px;">
      <div><span style="color:#555;">Matricule: </span><span style="color:#111;font-weight:600;">${p.idNumber}</span></div>
      <div><span style="color:#555;">Nom & Prénom: </span><span style="color:#111;font-weight:600;">${p.nom} ${p.prenom}</span></div>
      <div><span style="color:#555;">Né(e) le: </span><span style="color:#111;">${p.dateNaissance}</span></div>
      <div><span style="color:#555;">Classe: </span><span style="color:#111;">${p.classe||'Terminale'}</span></div>
      <div><span style="color:#555;">Contact: </span><span style="color:#111;">${p.telephone}</span></div>
    </div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:38px;border-top:1px solid #eee;display:flex;align-items:center;padding:0 10px;">
    <div style="font-size:16px;">🏫</div>
    <div style="flex:1;text-align:center;font-size:8px;font-weight:600;color:#333;">${p.organisation}</div>
    <div style="width:34px;height:34px;border-radius:50%;border:2px solid #c00;display:flex;align-items:center;justify-content:center;font-size:6px;color:#c00;text-align:center;padding:2px;">VISA<br>VALID</div>
  </div>
</div>`;
}

/* ═══════════════════════════════════════════
   TEMPLATES REGISTRY
═══════════════════════════════════════════ */
const TEMPLATES: CardTemplate[] = [
  {id:'t01',label:'Badge Bleu Abstrait',     category:'badge-identite', isVertical:true,  render:renderT01},
  {id:'t02',label:'Badge Orange Moderne',    category:'badge-identite', isVertical:true,  render:renderT02},
  {id:'t03',label:'Badge Marine Employé',    category:'badge-identite', isVertical:true,  render:renderT03},
  {id:'t04',label:'Badge Bleu QR',           category:'badge-identite', isVertical:true,  render:renderT04},
  {id:'t05',label:'Badge Noir/Jaune',        category:'badge-identite', isVertical:true,  render:renderT05},
  {id:'t06',label:'Badge Vert Nature',       category:'badge-identite', isVertical:true,  render:renderT06},
  {id:'t07',label:'Badge VIP',               category:'badge-evenement',isVertical:true,  render:renderT07},
  {id:'t08',label:'Badge Concert Backstage', category:'badge-evenement',isVertical:true,  render:renderT08},
  {id:'t09',label:'Badge Salon',             category:'badge-evenement',isVertical:true,  render:renderT09},
  {id:'t10',label:'Badge Prénom Coloré',     category:'badge-evenement',isVertical:true,  render:renderT10},
  {id:'t11',label:'Badge Festival Dark',     category:'badge-evenement',isVertical:true,  render:renderT11},
  {id:'t12',label:'Carte Bleue Géométrique', category:'carte-visite',   isVertical:false, render:renderT12},
  {id:'t13',label:'Carte Or/Noir Luxe',      category:'carte-visite',   isVertical:false, render:renderT13},
  {id:'t14',label:'Carte Photo Cercle',      category:'carte-visite',   isVertical:false, render:renderT14},
  {id:'t15',label:'Carte Vague Verte',       category:'carte-visite',   isVertical:false, render:renderT15},
  {id:'t16',label:'Carte Jaune/Noir',        category:'carte-visite',   isVertical:false, render:renderT16},
  {id:'t17',label:'Carte Vague Bleue',       category:'carte-visite',   isVertical:false, render:renderT17},
  {id:'t18',label:'Carte Teal Sombre',       category:'carte-visite',   isVertical:false, render:renderT18},
  {id:'t19',label:'Carte Scolaire Classique',category:'carte-scolaire', isVertical:false, render:renderT19},
  {id:'t20',label:'Carte Identité Scolaire', category:'carte-scolaire', isVertical:false, render:renderT20},
];

const CATEGORIES = [
  {id:'badge-identite',  label:'Badges Identité',  icon:'🪪', catEnum:'BADGE_IDENTITE'},
  {id:'badge-evenement', label:'Badges Événement', icon:'🎫', catEnum:'BADGE_EVENEMENT'},
  {id:'carte-visite',    label:'Cartes Visite',    icon:'💼', catEnum:'CARTE_VISITE'},
  {id:'carte-scolaire',  label:'Cartes Scolaires', icon:'🎓', catEnum:'CARTE_SCOLAIRE'},
];

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
@Component({
  selector: 'app-card-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, DesignEditorComponent],
  template: `
<!-- ═══ STEPPER ═══ -->
<div class="cb-stepper">
  <div *ngFor="let s of steps; let i=index" class="cb-step"
    [class.cb-step--done]="currentStep>i+1"
    [class.cb-step--active]="currentStep===i+1"
    (click)="goStep(i+1)">
    <div class="cb-step-dot">
      <span *ngIf="currentStep>i+1">✓</span>
      <span *ngIf="currentStep<=i+1">{{i+1}}</span>
    </div>
    <span class="cb-step-label">{{s}}</span>
    <div *ngIf="i<steps.length-1" class="cb-step-line"
      [class.cb-step-line--done]="currentStep>i+1"></div>
  </div>
</div>

<!-- ═══ LAYOUT PRINCIPAL ═══ -->
<div class="cb-root">

  <!-- ── SIDEBAR ── -->
  <aside class="cb-sidebar">

    <!-- Catégorie -->
    <div class="cb-section">
      <div class="cb-section-title">1 · Catégorie</div>
      <div class="cb-cats">
        <button *ngFor="let cat of categories" class="cb-cat-btn"
          [class.cb-cat-btn--active]="selectedCategory===cat.id"
          (click)="selectCategory(cat.id)">
          <span>{{cat.icon}}</span><span class="cb-cat-label">{{cat.label}}</span>
        </button>
      </div>
    </div>

    <!-- Template -->
    <div class="cb-section">
      <div class="cb-section-title">2 · Template</div>
      <div class="cb-templates-grid">
        <div *ngFor="let tpl of filteredTemplates" class="cb-tpl-thumb"
          [class.cb-tpl-thumb--active]="selectedTemplate===tpl.id"
          [class.cb-tpl-thumb--vert]="tpl.isVertical"
          [class.cb-tpl-thumb--horiz]="!tpl.isVertical"
          (click)="selectTemplate(tpl.id)" [title]="tpl.label">
          <div class="cb-tpl-thumb-clip">
            <div class="cb-tpl-thumb-inner" [innerHTML]="getThumbnail(tpl)"></div>
          </div>
          <div class="cb-tpl-thumb-label">{{tpl.label}}</div>
        </div>
      </div>
    </div>

    <!-- Couleurs -->
    <div class="cb-section">
      <div class="cb-section-title">Couleurs globales</div>
      <div class="cb-field-row">
        <div><label class="cb-label">Couleur 1</label>
          <input type="color" class="cb-color" [(ngModel)]="sharedCouleur1" (ngModelChange)="refreshPreview()"/></div>
        <div><label class="cb-label">Couleur 2</label>
          <input type="color" class="cb-color" [(ngModel)]="sharedCouleur2" (ngModelChange)="refreshPreview()"/></div>
      </div>
    </div>

    <!-- Résumé personnes -->
    <div class="cb-section" *ngIf="savedPersonsList.length>0">
      <div class="cb-section-title">Personnes ({{savedPersonsList.length}})</div>
      <div class="cb-persons-summary">
        <div *ngFor="let p of savedPersonsList.slice(0,4)" class="cb-person-chip">
          <div class="cb-person-chip-avatar">{{(p.prenoms[0]||'?').toUpperCase()}}</div>
          <span>{{p.prenoms}} {{p.nom}}</span>
        </div>
        <div *ngIf="savedPersonsList.length>4" class="cb-person-chip cb-person-chip--more">+{{savedPersonsList.length-4}} autres</div>
      </div>
    </div>


  </aside>

  <!-- ── PANNEAU PREVIEW ── -->
  <main class="cb-preview-panel">

    <!-- Toolbar principale (actions + IA) -->
    <div class="cb-ai-toolbar">
      <!-- Actions principales -->
      <button class="cb-ait cb-ait--act cb-ait--edit" (click)="openEditor()" title="Éditer le design">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span class="cb-ait-lbl">Éditer</span>
        <span class="cb-ait-tip">Éditer le design</span>
      </button>
      <button class="cb-ait cb-ait--act cb-ait--persons" (click)="openBulkModal()" title="Personnes">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span class="cb-ait-lbl">Personnes</span>
        <span *ngIf="savedPersonsList.length>0" class="cb-badge cb-badge--sm">{{savedPersonsList.length}}</span>
        <span class="cb-ait-tip">Gérer les personnes</span>
      </button>
      <button class="cb-ait cb-ait--act cb-ait--gen" (click)="openProductionModal()" title="Générer PDF">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span class="cb-ait-lbl">Générer</span>
        <span class="cb-ait-tip">Produire les cartes en PDF</span>
      </button>
      <button class="cb-ait cb-ait--act cb-ait--ws" (click)="openWorkspace()" title="Mes créations">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="cb-ait-lbl">Créations</span>
        <span *ngIf="savedDesigns.length>0" class="cb-badge cb-badge--sm">{{savedDesigns.length}}</span>
        <span class="cb-ait-tip">Mes créations sauvegardées</span>
      </button>
      <button class="cb-ait cb-ait--act cb-ait--mycards" (click)="openMyCards()" title="Mes cartes">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        <span class="cb-ait-lbl">Mes Cartes</span>
        <span *ngIf="savedPersonsList.length>0" class="cb-badge cb-badge--sm">{{savedPersonsList.length}}</span>
        <span class="cb-ait-tip">Personnes et créations</span>
      </button>
      <div class="cb-ait-sep"></div>
      <!-- Section IA -->
      <span class="cb-ait-label">✦ IA</span>
      <button class="cb-ait" (click)="showChatbotModal=true" title="Assistant Chat">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span class="cb-ait-tip">Assistant IA</span>
      </button>
      <button class="cb-ait" (click)="toggleAiSuggest()" [class.cb-ait--active]="showAiSuggest" title="Suggérer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span class="cb-ait-tip">Suggérer</span>
      </button>
      <button class="cb-ait" (click)="aiBatchGenerate()" [disabled]="aiBatchLoading" title="Batch">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <span class="cb-ait-tip">Générer en masse</span>
      </button>
      <button class="cb-ait" (click)="aiTranslate()" title="Traduire">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span class="cb-ait-tip">Traduire</span>
      </button>
      <div class="cb-ait-sep"></div>
      <button class="cb-ait cb-ait--config" (click)="showAiConfigModal=true" title="Config IA">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M19.07 19.07A10 10 0 0 1 4.93 19.07M4.93 4.93A10 10 0 0 1 19.07 4.93"/></svg>
        <span class="cb-ait-tip">Config IA</span>
      </button>
    </div>

    <!-- Barre IA Suggest -->
    <div *ngIf="showAiSuggest" class="cb-ai-suggest-bar">
      <input class="cb-ai-suggest-input" [(ngModel)]="aiSuggestPrompt"
        placeholder="Ex: badge VIP festival musique Paris été 2025..."
        (keyup.enter)="aiSuggestData()"/>
      <div class="cb-ai-suggest-prompts">
        <button *ngFor="let q of aiQuickPrompts" class="cb-quick-prompt" (click)="aiSuggestPrompt=q;aiSuggestData()">{{q}}</button>
      </div>
      <button class="cb-btn cb-btn--ia" (click)="aiSuggestData()" [disabled]="aiSuggestLoading" style="font-size:12px;padding:7px;">
        <span *ngIf="!aiSuggestLoading">✨ Générer</span><span *ngIf="aiSuggestLoading">⏳...</span>
      </button>
    </div>

    <!-- Preview toolbar -->
    <div class="cb-preview-toolbar">
      <div class="cb-zoom-wrap">
        <span class="cb-zoom-label">🔍 {{zoom}}%</span>
        <input type="range" min="30" max="200" [(ngModel)]="zoom" class="cb-zoom-slider"/>
      </div>
      <div class="cb-preview-nav" *ngIf="savedPersonsList.length>1">
        <button class="cb-nav-btn" (click)="prevCard()" [disabled]="currentPersonIndex===0">◀</button>
        <span class="cb-nav-info">{{currentPersonIndex+1}}/{{savedPersonsList.length}}</span>
        <button class="cb-nav-btn" (click)="nextCard()" [disabled]="currentPersonIndex>=savedPersonsList.length-1">▶</button>
      </div>
      <div style="flex:1"></div>
      <button *ngIf="editedCardHtml" class="cb-reset-btn" (click)="resetEdits()">↺ Template</button>
    </div>

    <!-- Zone checkerboard -->
    <div class="cb-preview-area">
      <div class="cb-checkerboard">
        <div class="cb-card-wrapper" [style.transform]="'scale('+zoomFactor+')'">
          <div [innerHTML]="previewHtml"></div>
        </div>
      </div>
    </div>

    <!-- Info bar -->
    <div class="cb-preview-info" *ngIf="selectedTemplateObj">
      <span class="cb-tpl-badge">{{selectedTemplateObj.label}}</span>
      <span class="cb-tpl-size">{{selectedTemplateObj.isVertical?'204×322px':'321×204px'}}</span>
      <span *ngIf="editedCardHtml" class="cb-edited-badge">✏ Design personnalisé</span>
      <span *ngIf="currentDesign" class="cb-design-badge">💾 {{currentDesign.name}}</span>
    </div>

  </main>
</div>

<!-- ═══ DESIGNER OVERLAY ═══ -->
<div *ngIf="editorOpen" class="cb-editor-overlay">
  <!-- Barre flottante -->
  <div class="cb-editor-float-bar">
    <div class="cb-efb-left">
      <button class="cb-efb-btn" (click)="toggleDesignerCreations()">
        📂 Créations<span *ngIf="savedDesigns.length>0" class="cb-badge cb-badge--sm">{{savedDesigns.length}}</span>
      </button>
      <div *ngIf="showDesignerCreations" class="cb-efb-dropdown" (click)="stopProp($event)">
        <div class="cb-efb-dd-title">Charger une création</div>
        <div *ngIf="savedDesigns.length===0" style="padding:10px;color:#9ca3af;font-size:12px;">Aucune création</div>
        <div *ngFor="let d of savedDesigns" class="cb-efb-dd-item">
          <div style="flex:1;cursor:pointer;" (click)="loadDesignInEditor(d)">
            <span class="cb-efb-dd-name">{{d.name}}</span>
            <span class="cb-efb-dd-meta">{{d.templateId}} · {{d.category}}</span>
          </div>
          <button class="cb-efb-dd-del" (click)="deleteDesignFromEditor(d.id,$event)" title="Supprimer">🗑</button>
        </div>
      </div>
    </div>
    <div class="cb-efb-center">
      <span style="color:#e0e7ff;font-size:13px;font-weight:600;">✏ Designer — {{selectedTemplateObj?.label}}</span>
    </div>
    <div class="cb-efb-right">
      <button class="cb-efb-btn" (click)="openBulkModal()">
        👥 Personnes<span *ngIf="savedPersonsList.length>0" class="cb-badge cb-badge--sm">{{savedPersonsList.length}}</span>
      </button>
    </div>
  </div>
  <app-design-editor
    [baseHtml]="editorBaseHtml"
    [width]="editorWidth"
    [height]="editorHeight"
    [initialObjects]="savedEditorObjects"
    (savedEvent)="onEditorSaved($event)"
    (cancelEvent)="closeEditor()"
    style="flex:1;display:flex;flex-direction:column;min-height:0">
  </app-design-editor>
  <!-- Dialog sauvegarde -->
  <div *ngIf="showSaveDialog" class="cb-save-inline" (click)="showSaveDialog=false">
    <div class="cb-save-dialog" (click)="stopProp($event)">
      <div class="cb-modal-head"><span>💾 Nommer la création</span><button class="cb-modal-close" (click)="showSaveDialog=false">✕</button></div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:8px;">
        <input class="cb-input" [(ngModel)]="designName" placeholder="Ex: Badge VIP Corporate Bleu..." (keyup.enter)="saveCurrentDesign()"/>
        <div style="font-size:11px;color:#9ca3af;">Template: {{selectedTemplateObj?.label}} · {{activeCategoryLabel}}</div>
      </div>
      <div class="cb-modal-foot">
        <button class="cb-btn cb-btn--secondary" (click)="showSaveDialog=false">Annuler</button>
        <button class="cb-btn cb-btn--primary" (click)="saveCurrentDesign()" [disabled]="!designName.trim()||savingDesign">
          <span *ngIf="!savingDesign">💾 Sauvegarder</span><span *ngIf="savingDesign">⏳...</span>
        </button>
      </div>
    </div>
  </div>
</div>

<!-- ═══ WIZARD PERSONNES (5 étapes) ═══ -->
<div *ngIf="wizOpen" class="cb-overlay">
  <div class="cb-wiz-modal">

    <!-- ── En-tête wizard ── -->
    <div class="cb-wiz-head">
      <div class="cb-wiz-head-top">
        <div>
          <div class="cb-wiz-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:8px;vertical-align:middle"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {{wizEditPersonId ? 'Modifier la personne' : 'Créer des personnes'}}
          </div>
          <div class="cb-wiz-subtitle" *ngIf="!wizQuickAdd">Étape {{wizStep}} / 5 — {{['Catégorie','Création','Société','Personnes','Résumé'][wizStep-1]}}</div>
          <div class="cb-wiz-subtitle" *ngIf="wizQuickAdd && !wizEditPersonId">Ajout rapide — contexte pré-rempli</div>
          <div class="cb-wiz-subtitle" *ngIf="wizEditPersonId">Modifiez les informations puis enregistrez</div>
        </div>
        <button class="cb-modal-close" (click)="closeBulkModal()">✕</button>
      </div>

      <!-- Stepper (masqué en mode quick-add) -->
      <ng-container *ngIf="!wizQuickAdd">
        <div class="cb-wiz-stepper">
          <ng-container *ngFor="let lbl of ['Catégorie','Création','Société','Personnes','Résumé']; let idx=index">
            <div class="cb-wiz-step" [class.cb-wiz-step--done]="wizStep>idx+1" [class.cb-wiz-step--active]="wizStep===idx+1">
              <div class="cb-wiz-step-dot">
                <svg *ngIf="wizStep>idx+1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span *ngIf="wizStep<=idx+1">{{idx+1}}</span>
              </div>
              <span class="cb-wiz-step-lbl">{{lbl}}</span>
            </div>
            <div *ngIf="idx<4" class="cb-wiz-step-bar" [class.cb-wiz-step-bar--done]="wizStep>idx+1"></div>
          </ng-container>
        </div>
        <div class="cb-wiz-progress"><div class="cb-wiz-progress-fill" [style.width]="((wizStep-1)/4*100)+'%'"></div></div>
      </ng-container>

      <!-- Banneau contexte pré-rempli (quick-add) -->
      <div *ngIf="wizQuickAdd" class="cb-wiz-quickadd-banner">
        <div class="cb-wiz-qa-chips">
          <span class="cb-wiz-qa-chip cb-wiz-qa-chip--cat">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            {{wizCategoryLabel()}}
          </span>
          <span *ngIf="wizEntreprise" class="cb-wiz-qa-chip cb-wiz-qa-chip--ent">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            {{wizEntreprise.raisonSocial}}
          </span>
          <span *ngIf="wizDesign" class="cb-wiz-qa-chip cb-wiz-qa-chip--design">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h4"/></svg>
            {{wizDesign.name || 'Création sans nom'}}
          </span>
        </div>
        <button class="cb-wiz-qa-reset" (click)="openBulkModal()" title="Recommencer depuis le début">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:3px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.84"/></svg>
          Flux complet
        </button>
      </div>
    </div>

    <!-- ── Corps wizard ── -->
    <div class="cb-wiz-body">

      <!-- ╔══ ÉTAPE 1 : Catégorie ══╗ -->
      <ng-container *ngIf="wizStep===1">
        <div class="cb-wiz-intro">
          <div class="cb-wiz-intro-icon">📋</div>
          <div>
            <div class="cb-wiz-intro-title">Choisissez le type de carte</div>
            <div class="cb-wiz-intro-desc">Le formulaire de saisie et les champs disponibles s'adapteront automatiquement à votre sélection</div>
          </div>
        </div>
        <div class="cb-wiz-cat-grid">
          <div *ngFor="let c of WIZARD_CATEGORIES" class="cb-wiz-cat-card"
            [class.cb-wiz-cat-card--sel]="wizCategory===c.value"
            (click)="wizSelectCategory(c.value)"
            [style.--cat-color]="c.color">

            <!-- Badge Identité icon -->
            <div *ngIf="c.value==='BADGE_IDENTITE'" class="cb-wiz-cat-icon" [style.background]="c.grad">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="4" width="20" height="16" rx="3"/><circle cx="9" cy="10" r="2.5"/><path d="M6 16c0-2 1.5-3 3-3h0c1.5 0 3 1 3 3"/><line x1="15" y1="9" x2="19" y2="9"/><line x1="15" y1="12" x2="18" y2="12"/><line x1="15" y1="15" x2="17" y2="15"/></svg>
            </div>
            <!-- Carte de Visite icon -->
            <div *ngIf="c.value==='CARTE_VISITE'" class="cb-wiz-cat-icon" [style.background]="c.grad">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="11" x2="13" y2="11"/><line x1="6" y1="14" x2="11" y2="14"/><circle cx="17" cy="11" r="2"/></svg>
            </div>
            <!-- Badge Événement icon -->
            <div *ngIf="c.value==='BADGE_EVENEMENT'" class="cb-wiz-cat-icon" [style.background]="c.grad">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"><path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4V9z"/><line x1="9" y1="7" x2="9" y2="17"/><line x1="7" y1="11" x2="11" y2="11"/><line x1="14" y1="11" x2="17" y2="11"/></svg>
            </div>
            <!-- Carte Scolaire icon -->
            <div *ngIf="c.value==='CARTE_SCOLAIRE'" class="cb-wiz-cat-icon" [style.background]="c.grad">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>
            </div>

            <div class="cb-wiz-cat-name">{{c.label}}</div>
            <div class="cb-wiz-cat-desc">{{c.desc}}</div>
            <div *ngIf="wizCategory===c.value" class="cb-wiz-cat-check">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ╔══ ÉTAPE 2 : Création liée ══╗ -->
      <ng-container *ngIf="wizStep===2">
        <div class="cb-wiz-intro">
          <div class="cb-wiz-intro-icon">🎨</div>
          <div>
            <div class="cb-wiz-intro-title">Sélectionnez une création</div>
            <div class="cb-wiz-intro-desc">Choisissez le template à utiliser pour cette session. La création sera liée à toutes les personnes enregistrées</div>
          </div>
        </div>

        <div *ngIf="wizDesignsForCat().length===0" class="cb-wiz-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <div>Aucune création disponible pour cette catégorie</div>
          <button class="cb-btn cb-btn--primary" style="width:auto;margin-top:8px;" (click)="wizSkipDesign()">Continuer sans création</button>
        </div>

        <div *ngIf="wizDesignsForCat().length>0" class="cb-wiz-designs-grid">
          <div *ngFor="let d of wizDesignsForCat()" class="cb-wiz-design-card"
            [class.cb-wiz-design-card--sel]="wizDesign?.id===d.id"
            (click)="wizSelectDesign(d)">
            <div class="cb-wiz-design-thumb" [class.cb-wiz-design-thumb--horiz]="!isDesignVertical(d)">
              <div class="cb-wiz-design-thumb-inner" [innerHTML]="getDesignPreviewHtml(d)"></div>
            </div>
            <div class="cb-wiz-design-name">{{d.name || 'Sans nom'}}</div>
            <div *ngIf="wizDesign?.id===d.id" class="cb-wiz-design-check">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ╔══ ÉTAPE 3 : Société ══╗ -->
      <ng-container *ngIf="wizStep===3">
        <div class="cb-wiz-intro">
          <div class="cb-wiz-intro-icon">🏢</div>
          <div>
            <div class="cb-wiz-intro-title">Société / Organisation</div>
            <div class="cb-wiz-intro-desc">Les données de la société (logo, couleurs, adresse) seront préremplies sur chaque personne</div>
          </div>
        </div>

        <div *ngIf="savedEntreprises.length===0" class="cb-wiz-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
          <div>Aucune société enregistrée</div>
        </div>

        <div class="cb-wiz-ents-grid">
          <div *ngFor="let e of savedEntreprises" class="cb-wiz-ent-card"
            [class.cb-wiz-ent-card--sel]="wizEntreprise?.id===e.id"
            (click)="wizSelectEntreprise(e)">
            <div class="cb-wiz-ent-logo">
              <img *ngIf="e.logo" [src]="e.logo" style="width:100%;height:100%;object-fit:contain;border-radius:6px;"/>
              <span *ngIf="!e.logo" style="font-size:20px;">🏢</span>
            </div>
            <div class="cb-wiz-ent-info">
              <div class="cb-wiz-ent-name">{{e.raisonSocial}}</div>
              <div class="cb-wiz-ent-sub">{{e.sigleEntreprise}} {{e.formeJuridique ? '· '+e.formeJuridique : ''}} {{e.ville ? '· '+e.ville : ''}}</div>
            </div>
            <div *ngIf="e.couleur1" class="cb-wiz-ent-palette">
              <div [style.background]="e.couleur1" style="width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,0,0,.1)"></div>
              <div *ngIf="e.couleur2" [style.background]="e.couleur2" style="width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,0,0,.1)"></div>
            </div>
            <div *ngIf="wizEntreprise?.id===e.id" class="cb-wiz-ent-check">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>

          <!-- Créer une nouvelle société -->
          <div class="cb-wiz-ent-card cb-wiz-ent-card--new" (click)="openEntrepriseModal()">
            <div class="cb-wiz-ent-logo" style="background:#f0fdf4;border:2px dashed #86efac;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div class="cb-wiz-ent-info">
              <div class="cb-wiz-ent-name" style="color:#16a34a;">Créer une société</div>
              <div class="cb-wiz-ent-sub">Ajouter un nouvel organisme</div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ╔══ ÉTAPE 4 : Personnes ══╗ -->
      <ng-container *ngIf="wizStep===4">
        <div class="cb-wiz-persons-head">
          <div>
            <div class="cb-wiz-intro-title" style="margin-bottom:2px;">
              Saisie des personnes
              <span class="cb-badge" style="margin-left:8px;">{{wizPersons.length}}</span>
            </div>
            <div style="font-size:12px;color:#6b7280;">
              Catégorie : <strong>{{wizCategoryLabel()}}</strong>
              <span *ngIf="wizEntreprise"> · {{wizEntreprise.raisonSocial}}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="cb-btn cb-btn--outline" style="width:auto;padding:7px 14px;font-size:12px;" (click)="bulkCsvRef2.click()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              CSV
            </button>
            <input #bulkCsvRef2 type="file" accept=".csv,.xlsx" style="display:none" (change)="onCsvChange($event)"/>
            <button class="cb-btn cb-btn--primary" style="width:auto;padding:7px 16px;font-size:12px;" (click)="wizAddPerson()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Ajouter
            </button>
          </div>
        </div>

        <div *ngIf="wizPersons.length===0" class="cb-wiz-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>
          <div>Cliquez "Ajouter" pour saisir la première personne</div>
        </div>

        <div class="cb-wiz-persons-list">
          <div *ngFor="let p of wizPersons; let i=index" class="cb-wiz-person-item">

            <!-- Header accordéon -->
            <div class="cb-wiz-person-hdr" (click)="wizToggle(i)"
              [style.border-left]="'4px solid '+wizAvatarColor(i)">
              <div class="cb-wiz-person-avatar" [style.background]="wizAvatarColor(i)">
                <img *ngIf="p.photo" [src]="p.photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>
                <span *ngIf="!p.photo">{{((p.prenoms[0]||'?')).toUpperCase()}}{{(p.nom[0]||'').toUpperCase()}}</span>
              </div>
              <div class="cb-wiz-person-hdr-info">
                <div style="font-size:13px;font-weight:600;color:#111;">{{wizPersonLabel(p,i)}}</div>
                <div style="font-size:11px;color:#6b7280;">
                  {{p.titre || p.titreParticipant || p.typeApprenant || '—'}}
                  <span *ngIf="p.classe"> · {{p.classe}}</span>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
                <button class="cb-row-act cb-row-act--del" (click)="wizRemovePerson(i,$event)" title="Supprimer">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round">
                  <polyline *ngIf="!wizExpandedIdx.has(i)" points="6 9 12 15 18 9"/>
                  <polyline *ngIf="wizExpandedIdx.has(i)"  points="18 15 12 9 6 15"/>
                </svg>
              </div>
            </div>

            <!-- Formulaire accordéon -->
            <div *ngIf="wizExpandedIdx.has(i)" class="cb-wiz-person-form">

              <!-- ► BADGE IDENTITÉ -->
              <ng-container *ngIf="wizCategory==='BADGE_IDENTITE'">
                <div class="cb-wiz-form-section">Photo & Identité</div>
                <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:10px;">
                  <div>
                    <div class="cb-wiz-photo-zone" (click)="wizPhotoRef.click()">
                      <img *ngIf="p.photo" [src]="p.photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>
                      <svg *ngIf="!p.photo" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <input #wizPhotoRef type="file" accept="image/*" style="display:none" (change)="onWizPhoto($event,i)"/>
                  </div>
                  <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
                    <div class="cb-form-2col">
                      <div class="cb-field-group"><label class="cb-label">Prénom(s) *</label><input class="cb-input" [(ngModel)]="p.prenoms" placeholder="Marie"/></div>
                      <div class="cb-field-group"><label class="cb-label">Nom *</label><input class="cb-input" [(ngModel)]="p.nom" placeholder="Laurent"/></div>
                    </div>
                    <div class="cb-form-2col">
                      <div class="cb-field-group"><label class="cb-label">Civilité</label>
                        <select class="cb-input" [(ngModel)]="p.civilite"><option value="">—</option><option>M.</option><option>Mme</option><option>Dr.</option><option>Prof.</option><option>Me</option></select>
                      </div>
                      <div class="cb-field-group"><label class="cb-label">Genre</label>
                        <select class="cb-input" [(ngModel)]="p.genre"><option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option><option value="Autre">Autre</option></select>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="cb-wiz-form-section">Poste & Accès</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Titre / Poste</label><input class="cb-input" [(ngModel)]="p.titre" placeholder="Directrice Marketing"/></div>
                  <div class="cb-field-group"><label class="cb-label">Département</label><input class="cb-input" [(ngModel)]="p.departement" placeholder="Direction Commerciale"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Service / Division</label><input class="cb-input" [(ngModel)]="p.service" placeholder="Marketing Digital"/></div>
                  <div class="cb-field-group"><label class="cb-label">Matricule / ID</label><input class="cb-input" [(ngModel)]="p.matricule" placeholder="EMP-2024-001"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Type d'accès</label>
                    <select class="cb-input" [(ngModel)]="p.accessType">
                      <option value="">— Choisir —</option>
                      <option *ngFor="let t of ACCESS_TYPES2" [value]="t">{{t}}</option>
                    </select>
                  </div>
                  <div class="cb-field-group"><label class="cb-label">Date d'expiration</label><input class="cb-input" type="date" [(ngModel)]="p.dateExpiration"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Date d'embauche</label><input class="cb-input" type="date" [(ngModel)]="p.dateEmbauche"/></div>
                  <div class="cb-field-group"><label class="cb-label">Format photo</label>
                    <select class="cb-input" [(ngModel)]="p.photoFormat"><option value="ROND">Rond</option><option value="CARRE">Carré</option></select>
                  </div>
                </div>
                <div class="cb-wiz-form-section">Contact</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Email</label><input class="cb-input" type="email" [(ngModel)]="p.email" placeholder="marie@agence.com"/></div>
                  <div class="cb-field-group"><label class="cb-label">Téléphone</label><input class="cb-input" [(ngModel)]="p.contact" placeholder="+229 XX XX XX XX"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Adresse</label><input class="cb-input" [(ngModel)]="p.adresse" placeholder="Rue, Quartier"/></div>
                  <div class="cb-field-group"><label class="cb-label">Site web</label><input class="cb-input" [(ngModel)]="p.siteWeb" placeholder="www.agence.com"/></div>
                </div>
                <div class="cb-wiz-form-section">État civil (optionnel)</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Date de naissance</label><input class="cb-input" [(ngModel)]="p.dateNaissance" placeholder="JJ/MM/AAAA"/></div>
                  <div class="cb-field-group"><label class="cb-label">Lieu de naissance</label><input class="cb-input" [(ngModel)]="p.lieuNaissance" placeholder="Cotonou"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Nationalité</label><input class="cb-input" [(ngModel)]="p.nationalite" placeholder="Béninoise"/></div>
                  <div class="cb-field-group"><label class="cb-label">Zones d'accès</label><input class="cb-input" [(ngModel)]="p.zonesAcces" placeholder="Zone A, Zone B"/></div>
                </div>
              </ng-container>

              <!-- ► CARTE DE VISITE -->
              <ng-container *ngIf="wizCategory==='CARTE_VISITE'">
                <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:10px;">
                  <div>
                    <div class="cb-wiz-photo-zone" (click)="wizPhotoRef2.click()">
                      <img *ngIf="p.photo" [src]="p.photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>
                      <svg *ngIf="!p.photo" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <input #wizPhotoRef2 type="file" accept="image/*" style="display:none" (change)="onWizPhoto($event,i)"/>
                  </div>
                  <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
                    <div class="cb-form-2col">
                      <div class="cb-field-group"><label class="cb-label">Prénom(s) *</label><input class="cb-input" [(ngModel)]="p.prenoms" placeholder="Marie"/></div>
                      <div class="cb-field-group"><label class="cb-label">Nom *</label><input class="cb-input" [(ngModel)]="p.nom" placeholder="Laurent"/></div>
                    </div>
                    <div class="cb-form-2col">
                      <div class="cb-field-group"><label class="cb-label">Civilité</label>
                        <select class="cb-input" [(ngModel)]="p.civilite"><option value="">—</option><option>M.</option><option>Mme</option><option>Dr.</option><option>Prof.</option><option>Me</option></select>
                      </div>
                      <div class="cb-field-group"><label class="cb-label">Titre / Poste *</label><input class="cb-input" [(ngModel)]="p.titre" placeholder="Directrice Marketing"/></div>
                    </div>
                  </div>
                </div>
                <div class="cb-wiz-form-section">Identité professionnelle</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Spécialité</label><input class="cb-input" [(ngModel)]="p.specialite" placeholder="Expert-comptable, Designer…"/></div>
                  <div class="cb-field-group"><label class="cb-label">Slogan / Tagline</label><input class="cb-input" [(ngModel)]="p.slogan" placeholder="Votre vision, notre expertise"/></div>
                </div>
                <div class="cb-field-group"><label class="cb-label">Certifications</label><input class="cb-input" [(ngModel)]="p.certifications" placeholder="MBA, PMP, Expert certifié…"/></div>
                <div class="cb-wiz-form-section">Contact</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Email principal</label><input class="cb-input" type="email" [(ngModel)]="p.email" placeholder="marie@agence.com"/></div>
                  <div class="cb-field-group"><label class="cb-label">Email secondaire</label><input class="cb-input" type="email" [(ngModel)]="p.emailSecondaire" placeholder="perso@gmail.com"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Téléphone</label><input class="cb-input" [(ngModel)]="p.contact" placeholder="+229 XX XX XX XX"/></div>
                  <div class="cb-field-group"><label class="cb-label">Mobile / WhatsApp</label><input class="cb-input" [(ngModel)]="p.whatsapp" placeholder="+229 XX XX XX XX"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Site web</label><input class="cb-input" [(ngModel)]="p.siteWeb" placeholder="www.agence.com"/></div>
                  <div class="cb-field-group"><label class="cb-label">Matricule / ID</label><input class="cb-input" [(ngModel)]="p.matricule" placeholder="ID: EMP-001"/></div>
                </div>
                <div class="cb-wiz-form-section">Réseaux sociaux</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">LinkedIn</label><input class="cb-input" [(ngModel)]="p.linkedin" placeholder="linkedin.com/in/marie"/></div>
                  <div class="cb-field-group"><label class="cb-label">Twitter / X</label><input class="cb-input" [(ngModel)]="p.twitter" placeholder="@marie"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Instagram</label><input class="cb-input" [(ngModel)]="p.instagram" placeholder="@marie"/></div>
                  <div class="cb-field-group"><label class="cb-label">Facebook</label><input class="cb-input" [(ngModel)]="p.facebook" placeholder="/marie.laurent"/></div>
                </div>
                <div class="cb-wiz-form-section">Adresse</div>
                <div class="cb-field-group"><label class="cb-label">Adresse ligne 1</label><input class="cb-input" [(ngModel)]="p.adresseLigne1" placeholder="15 Rue des Palmiers"/></div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Ville</label><input class="cb-input" [(ngModel)]="p.ville" placeholder="Cotonou"/></div>
                  <div class="cb-field-group"><label class="cb-label">Pays</label><input class="cb-input" [(ngModel)]="p.pays" placeholder="Bénin"/></div>
                </div>
              </ng-container>

              <!-- ► BADGE ÉVÉNEMENT -->
              <ng-container *ngIf="wizCategory==='BADGE_EVENEMENT'">
                <div class="cb-wiz-form-section">Participant</div>
                <div style="display:flex;gap:16px;align-items:flex-start;">
                  <div>
                    <div class="cb-wiz-photo-zone" (click)="wizPhotoRef3.click()">
                      <img *ngIf="p.photo" [src]="p.photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>
                      <svg *ngIf="!p.photo" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <input #wizPhotoRef3 type="file" accept="image/*" style="display:none" (change)="onWizPhoto($event,i)"/>
                  </div>
                  <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
                    <div class="cb-form-2col">
                      <div class="cb-field-group"><label class="cb-label">Prénom(s) *</label><input class="cb-input" [(ngModel)]="p.prenoms" placeholder="Marie"/></div>
                      <div class="cb-field-group"><label class="cb-label">Nom *</label><input class="cb-input" [(ngModel)]="p.nom" placeholder="Laurent"/></div>
                    </div>
                    <div class="cb-form-2col">
                      <div class="cb-field-group"><label class="cb-label">Titre / Rôle</label><input class="cb-input" [(ngModel)]="p.titreParticipant" placeholder="Directrice Marketing"/></div>
                      <div class="cb-field-group"><label class="cb-label">Organisation</label><input class="cb-input" [(ngModel)]="p.organisationParticipant" placeholder="Creative Agency"/></div>
                    </div>
                  </div>
                </div>
                <div class="cb-wiz-form-section">Événement</div>
                <div class="cb-field-group"><label class="cb-label">Titre de l'événement *</label><input class="cb-input" [(ngModel)]="p.titreEvenement" placeholder="Creative Summit 2025"/></div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Sous-titre</label><input class="cb-input" [(ngModel)]="p.sousTitreEvenement" placeholder="TOUT ACCÈS · VIP"/></div>
                  <div class="cb-field-group"><label class="cb-label">Organisateur</label><input class="cb-input" [(ngModel)]="p.ownerEvenement" placeholder="Creative Agency"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Date début *</label><input class="cb-input" type="date" [(ngModel)]="p.dateDebut"/></div>
                  <div class="cb-field-group"><label class="cb-label">Date fin</label><input class="cb-input" type="date" [(ngModel)]="p.dateFin"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Heure début</label><input class="cb-input" type="time" [(ngModel)]="p.heureDebut"/></div>
                  <div class="cb-field-group"><label class="cb-label">Heure fin</label><input class="cb-input" type="time" [(ngModel)]="p.heureFin"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Lieu / Venue</label><input class="cb-input" [(ngModel)]="p.lieuEvenement" placeholder="Palais des Congrès"/></div>
                  <div class="cb-field-group"><label class="cb-label">Salle / Hall</label><input class="cb-input" [(ngModel)]="p.salleEvenement" placeholder="Hall A"/></div>
                </div>
                <div class="cb-wiz-form-section">Accès & Badge</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Type d'accès *</label>
                    <select class="cb-input" [(ngModel)]="p.typeAcces">
                      <option value="">— Choisir —</option>
                      <option *ngFor="let t of ['VIP','INVITE','VISITEUR','SPEAKER','STAFF','EXPOSANT','PRESSE','SPONSOR','BENEVOLE']" [value]="t">{{t}}</option>
                    </select>
                  </div>
                  <div class="cb-field-group"><label class="cb-label">N° Badge</label><input class="cb-input" [(ngModel)]="p.numeroBadge" placeholder="B-001"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Stand</label><input class="cb-input" [(ngModel)]="p.standEvenement" placeholder="Stand 12"/></div>
                  <div class="cb-field-group"><label class="cb-label">Table / Siège</label><input class="cb-input" [(ngModel)]="p.tableNumero" placeholder="Table 3"/></div>
                </div>
              </ng-container>

              <!-- ► CARTE SCOLAIRE -->
              <ng-container *ngIf="wizCategory==='CARTE_SCOLAIRE'">
                <div class="cb-wiz-form-section">Élève / Étudiant</div>
                <div style="display:flex;gap:16px;align-items:flex-start;">
                  <div>
                    <div class="cb-wiz-photo-zone" (click)="wizPhotoRef4.click()">
                      <img *ngIf="p.photo" [src]="p.photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>
                      <svg *ngIf="!p.photo" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <input #wizPhotoRef4 type="file" accept="image/*" style="display:none" (change)="onWizPhoto($event,i)"/>
                  </div>
                  <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
                    <div class="cb-form-2col">
                      <div class="cb-field-group"><label class="cb-label">Prénom(s) *</label><input class="cb-input" [(ngModel)]="p.prenoms" placeholder="Laurent"/></div>
                      <div class="cb-field-group"><label class="cb-label">Nom *</label><input class="cb-input" [(ngModel)]="p.nom" placeholder="Marie"/></div>
                    </div>
                    <div class="cb-form-2col">
                      <div class="cb-field-group"><label class="cb-label">Genre</label>
                        <select class="cb-input" [(ngModel)]="p.genre"><option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option></select>
                      </div>
                      <div class="cb-field-group"><label class="cb-label">Date de naissance</label><input class="cb-input" [(ngModel)]="p.dateNaissance" placeholder="JJ/MM/AAAA"/></div>
                    </div>
                  </div>
                </div>
                <div class="cb-wiz-form-section">Scolarité</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Classe *</label><input class="cb-input" [(ngModel)]="p.classe" placeholder="Terminale A"/></div>
                  <div class="cb-field-group"><label class="cb-label">Niveau</label>
                    <select class="cb-input" [(ngModel)]="p.niveau">
                      <option value="">— Choisir —</option>
                      <option *ngFor="let n of NIVEAUX_SCOLAIRES" [value]="n">{{n}}</option>
                    </select>
                  </div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Filière</label><input class="cb-input" [(ngModel)]="p.filiere" placeholder="Sciences, Lettres…"/></div>
                  <div class="cb-field-group"><label class="cb-label">Série</label><input class="cb-input" [(ngModel)]="p.serie" placeholder="A, C, D, ABT…"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Année scolaire *</label><input class="cb-input" [(ngModel)]="p.anneeScolaire" placeholder="2024-2025"/></div>
                  <div class="cb-field-group"><label class="cb-label">Matricule</label><input class="cb-input" [(ngModel)]="p.numeroMatricule" placeholder="MAT-001"/></div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Type d'apprenant</label>
                    <select class="cb-input" [(ngModel)]="p.typeApprenant">
                      <option *ngFor="let t of TYPE_APPRENANTS" [value]="t">{{t}}</option>
                    </select>
                  </div>
                  <div class="cb-field-group"><label class="cb-label">Boursier</label>
                    <select class="cb-input" [(ngModel)]="p.boursier">
                      <option [ngValue]="false">Non</option>
                      <option [ngValue]="true">Oui</option>
                    </select>
                  </div>
                </div>
                <div class="cb-wiz-form-section">Contact</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Téléphone</label><input class="cb-input" [(ngModel)]="p.contact" placeholder="+229 XX XX XX XX"/></div>
                  <div class="cb-field-group"><label class="cb-label">Email</label><input class="cb-input" type="email" [(ngModel)]="p.email" placeholder="eleve@lycee.bj"/></div>
                </div>
                <div class="cb-wiz-form-section">Tuteur / Parent</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Nom du tuteur</label><input class="cb-input" [(ngModel)]="p.nomTuteur" placeholder="Laurent Pierre"/></div>
                  <div class="cb-field-group"><label class="cb-label">Lien</label>
                    <select class="cb-input" [(ngModel)]="p.relationTuteur"><option value="">—</option><option value="PERE">Père</option><option value="MERE">Mère</option><option value="TUTEUR">Tuteur</option></select>
                  </div>
                </div>
                <div class="cb-field-group"><label class="cb-label">Contact tuteur</label><input class="cb-input" [(ngModel)]="p.contactTuteur" placeholder="+229 XX XX XX XX"/></div>
                <div class="cb-wiz-form-section">Visuels carte</div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Titre de la carte</label><input class="cb-input" [(ngModel)]="p.titreCarte" placeholder="IDENTITY CARD"/></div>
                  <div class="cb-field-group"><label class="cb-label">Type d'établissement</label>
                    <select class="cb-input" [(ngModel)]="p.typeEtablissement">
                      <option value="">—</option>
                      <option *ngFor="let t of TYPE_ETABS" [value]="t">{{t}}</option>
                    </select>
                  </div>
                </div>
                <div class="cb-form-2col">
                  <div class="cb-field-group"><label class="cb-label">Bandeau couleur 1</label>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <input type="color" class="cb-color" [(ngModel)]="p.couleurBandeau1" style="width:44px;height:34px;"/>
                      <span style="font-size:11px;color:#6b7280;font-family:monospace;">{{p.couleurBandeau1||'—'}}</span>
                    </div>
                  </div>
                  <div class="cb-field-group"><label class="cb-label">Bandeau couleur 2</label>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <input type="color" class="cb-color" [(ngModel)]="p.couleurBandeau2" style="width:44px;height:34px;"/>
                      <span style="font-size:11px;color:#6b7280;font-family:monospace;">{{p.couleurBandeau2||'—'}}</span>
                    </div>
                  </div>
                </div>
              </ng-container>

            </div><!-- /form -->
          </div><!-- /person-item -->
        </div><!-- /persons-list -->
      </ng-container>

      <!-- ╔══ ÉTAPE 5 : Résumé ══╗ -->
      <ng-container *ngIf="wizStep===5">
        <div class="cb-wiz-intro">
          <div class="cb-wiz-intro-icon">✅</div>
          <div>
            <div class="cb-wiz-intro-title">Récapitulatif — {{wizPersons.length}} personne(s)</div>
            <div class="cb-wiz-intro-desc">Vérifiez les informations avant d'enregistrer. Cliquez sur une carte pour modifier</div>
          </div>
        </div>

        <!-- Résumé session -->
        <div class="cb-wiz-recap-session">
          <div class="cb-wiz-recap-meta"><span>Catégorie</span><strong>{{wizCategoryLabel()}}</strong></div>
          <div *ngIf="wizDesign" class="cb-wiz-recap-meta"><span>Création</span><strong>{{wizDesign.name || 'Sans nom'}}</strong></div>
          <div *ngIf="wizEntreprise" class="cb-wiz-recap-meta"><span>Société</span><strong>{{wizEntreprise.raisonSocial}}</strong></div>
        </div>

        <!-- Cards récap personnes -->
        <div class="cb-wiz-recap-grid">
          <div *ngFor="let p of wizPersons; let i=index" class="cb-wiz-recap-card">
            <div class="cb-wiz-recap-card-head" [style.background]="wizAvatarColor(i)">
              <div class="cb-wiz-recap-avatar">
                <img *ngIf="p.photo" [src]="p.photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>
                <span *ngIf="!p.photo" style="font-size:16px;color:#fff;">{{((p.prenoms[0]||'?')).toUpperCase()}}{{(p.nom[0]||'').toUpperCase()}}</span>
              </div>
            </div>
            <div class="cb-wiz-recap-card-body">
              <div class="cb-wiz-recap-name">{{wizPersonLabel(p,i)}}</div>
              <div class="cb-wiz-recap-role">{{p.titre||p.titreParticipant||p.typeApprenant||'—'}}</div>
              <div *ngIf="p.email" class="cb-wiz-recap-detail">{{p.email}}</div>
              <div *ngIf="p.contact" class="cb-wiz-recap-detail">{{p.contact}}</div>
              <div *ngIf="p.classe" class="cb-wiz-recap-detail">{{p.classe}} · {{p.anneeScolaire}}</div>
              <div *ngIf="p.titreEvenement" class="cb-wiz-recap-detail">{{p.titreEvenement}}</div>
            </div>
            <button class="cb-wiz-recap-edit" (click)="wizBackToEdit(i)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Modifier
            </button>
          </div>
        </div>
      </ng-container>

    </div><!-- /body -->

    <!-- ── Pied wizard ── -->
    <div class="cb-wiz-foot">
      <!-- Bouton gauche -->
      <button class="cb-btn cb-btn--secondary" style="width:auto;" (click)="wizBack()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><polyline points="15 18 9 12 15 6"/></svg>
        {{wizStep>1?'Précédent':'Annuler'}}
      </button>

      <!-- Dots -->
      <div style="display:flex;gap:6px;align-items:center;">
        <span *ngFor="let _ of [1,2,3,4,5]; let idx=index" class="cb-wiz-dot"
          [class.cb-wiz-dot--active]="wizStep===idx+1"
          [class.cb-wiz-dot--done]="wizStep>idx+1"></span>
      </div>

      <!-- Bouton droit -->
      <ng-container [ngSwitch]="wizStep">
        <button *ngSwitchCase="1" class="cb-btn cb-btn--primary" style="width:auto;" [disabled]="!wizCategory" (click)="wizNextFromCategory()">
          Suivant <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-left:4px"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button *ngSwitchCase="2" class="cb-btn cb-btn--primary" style="width:auto;" (click)="wizConfirmDesign()">
          {{wizDesign?'Continuer avec cette création':'Passer'}} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-left:4px"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button *ngSwitchCase="3" class="cb-btn cb-btn--primary" style="width:auto;" (click)="wizEntreprise?wizConfirmEntreprise():wizSkipEntreprise()">
          {{wizEntreprise?'Continuer avec '+wizEntreprise.raisonSocial:'Passer'}} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-left:4px"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button *ngSwitchCase="4" class="cb-btn cb-btn--primary" style="width:auto;" [disabled]="wizPersons.length===0" (click)="wizEditPersonId ? wizSaveAll() : wizGoRecap()">
          <ng-container *ngIf="wizEditPersonId">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
            {{wizSaving ? '⏳ Enregistrement...' : 'Enregistrer les modifications'}}
          </ng-container>
          <ng-container *ngIf="!wizEditPersonId">
            Voir le résumé ({{wizPersons.length}}) <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-left:4px"><polyline points="9 18 15 12 9 6"/></svg>
          </ng-container>
        </button>
        <button *ngSwitchCase="5" class="cb-btn cb-btn--primary" style="width:auto;" [disabled]="wizSaving" (click)="wizSaveAll()">
          <svg *ngIf="!wizSaving" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {{wizSaving?'⏳ Enregistrement...':'Enregistrer tout ('+wizPersons.length+')'}}
        </button>
      </ng-container>
    </div>

  </div>
</div>


<!-- ═══ MODAL PRODUCTION ═══ -->
<div *ngIf="productionModalOpen" class="cb-overlay">
  <div class="cb-prod-modal" (click)="stopProp($event)">
    <div class="cb-modal-head">
      <span>▶ Produire les cartes</span>
      <button class="cb-modal-close" (click)="productionModalOpen=false">✕</button>
    </div>
    <div class="cb-prod-body">
      <!-- Colonne gauche : options + créations -->
      <div class="cb-prod-col">
        <div class="cb-prod-section-title">Options de production</div>
        <div class="cb-field-group">
          <label class="cb-label">Format papier</label>
          <select class="cb-input" [(ngModel)]="prodPaperSize">
            <option value="a4">A4 (210×297 mm)</option>
            <option value="a3">A3 (297×420 mm)</option>
            <option value="letter">Letter (216×279 mm)</option>
          </select>
        </div>
        <div class="cb-field-group">
          <label class="cb-label">Orientation</label>
          <select class="cb-input" [(ngModel)]="prodOrientation">
            <option value="portrait">Portrait</option>
            <option value="landscape">Paysage</option>
          </select>
        </div>
        <div class="cb-field-group">
          <label class="cb-label">Copies par personne</label>
          <input type="number" class="cb-input" [(ngModel)]="prodCopies" min="1" max="100"/>
        </div>

        <div class="cb-prod-section-title" style="margin-top:16px;">Créations disponibles</div>
        <div class="cb-field-group">
          <label class="cb-label">Filtrer par catégorie</label>
          <select class="cb-input" [(ngModel)]="prodFilterCategory" (change)="onProdCategoryChange()">
            <option value="">Toutes</option>
            <option *ngFor="let cat of categories" [value]="cat.catEnum">{{cat.label}}</option>
          </select>
        </div>
        <div class="cb-prod-designs-list">
          <div *ngIf="prodFilteredDesigns.length===0" style="color:#9ca3af;font-size:12px;padding:10px;">Aucune création disponible</div>
          <div *ngFor="let d of prodFilteredDesigns" class="cb-prod-design-item"
            [class.cb-prod-design-item--selected]="prodSelectedDesignId===d.id"
            (click)="prodSelectedDesignId=d.id">
            <div class="cb-prod-design-radio">{{prodSelectedDesignId===d.id?'●':'○'}}</div>
            <div class="cb-prod-design-info">
              <span class="cb-ws-name">{{d.name}}</span>
              <span class="cb-ws-meta">{{d.templateId}} · {{d.category}}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Colonne droite : personnes -->
      <div class="cb-prod-col">
        <div class="cb-prod-section-title">Personnes</div>
        <!-- Filtres : entreprise + catégorie côte à côte -->
        <div class="cb-prod-filters-row">
          <div class="cb-prod-filter-item">
            <label class="cb-label">Entreprise / Établissement</label>
            <select class="cb-input" [(ngModel)]="prodFilterEntreprise" (change)="onProdEntrepriseChange()">
              <option value="">Toutes</option>
              <option *ngFor="let e of prodEntreprises" [value]="e">{{e}}</option>
            </select>
          </div>
          <div class="cb-prod-filter-item">
            <label class="cb-label">Catégorie</label>
            <select class="cb-input" [(ngModel)]="prodFilterCatDropdown" (change)="onProdCatDropdownChange()"
              [disabled]="!prodFilterEntreprise || prodCategoriesForEnt.length===0">
              <option value="">Toutes ({{prodAllPersonsForEnt.length}})</option>
              <option *ngFor="let c of prodCategoriesForEnt" [value]="c.cat">{{c.label}} ({{c.count}})</option>
            </select>
          </div>
        </div>
        <div class="cb-prod-persons-toolbar">
          <button class="cb-expand-all-btn" (click)="toggleAllProdPersons()">
            {{prodSelectedPersonIds.size===prodFilteredPersons.length?'Tout désélectionner':'Tout sélectionner'}}
          </button>
          <span style="font-size:11px;color:#6b7280;">{{prodSelectedPersonIds.size}} / {{prodFilteredPersons.length}}</span>
        </div>
        <div class="cb-prod-persons-list">
          <div *ngIf="prodFilteredPersons.length===0" style="color:#6b7280;font-size:12px;padding:14px;text-align:center;line-height:1.6;">
            Aucune personne trouvée.<br>
            <span style="color:#9ca3af;font-size:11px;">Changez le filtre catégorie ou ajoutez des personnes via "Personnes" en haut.</span>
          </div>
          <!-- Grouped by category when enterprise selected -->
          <ng-container *ngIf="prodPersonsByCatGroup.length>0">
            <ng-container *ngFor="let grp of prodPersonsByCatGroup">
              <div class="cb-prod-cat-group-hdr">
                <label class="cb-prod-grp-chk" title="Tout cocher / décocher ce groupe" (click)="$event.stopPropagation(); toggleProdGroup(grp.cat, grp.persons)">
                  <span class="cb-prod-grp-chk-box"
                    [class.cb-prod-grp-chk-box--checked]="prodGroupAllChecked(grp.persons)"
                    [class.cb-prod-grp-chk-box--partial]="prodGroupPartialChecked(grp.persons)">
                    <svg *ngIf="prodGroupAllChecked(grp.persons)" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <svg *ngIf="prodGroupPartialChecked(grp.persons)" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </span>
                </label>
                <span class="cb-prod-cat-badge-sm">{{grp.label}}</span>
                <span class="cb-prod-cat-grp-count">{{grp.persons.length}}</span>
              </div>
              <div *ngFor="let p of grp.persons" class="cb-prod-person-item"
                [class.cb-prod-person-item--selected]="prodSelectedPersonIds.has(p.id!)"
                (click)="toggleProdPerson(p.id!)">
                <div class="cb-prod-person-check">{{prodSelectedPersonIds.has(p.id!)?'☑':'☐'}}</div>
                <div class="cb-person-avatar-ph" style="width:28px;height:28px;font-size:10px;flex-shrink:0;background:#0d9488;">
                  {{((p.prenoms||p.nom||'?')[0]).toUpperCase()}}
                </div>
                <div class="cb-prod-person-info">
                  <span class="cb-person-name" style="font-size:13px;">{{(p.prenoms||'')+' '+(p.nom||'')||p.code}}</span>
                  <span class="cb-person-titre" style="font-size:11px;">{{p.titre||p.profession||p.entreprise||p.etablissementScolaire||p.code}}</span>
                </div>
              </div>
            </ng-container>
          </ng-container>
          <!-- Flat list when no enterprise filter -->
          <ng-container *ngIf="prodPersonsByCatGroup.length===0">
            <div *ngFor="let p of prodFilteredPersons" class="cb-prod-person-item"
              [class.cb-prod-person-item--selected]="prodSelectedPersonIds.has(p.id!)"
              (click)="toggleProdPerson(p.id!)">
              <div class="cb-prod-person-check">{{prodSelectedPersonIds.has(p.id!)?'☑':'☐'}}</div>
              <div class="cb-person-avatar-ph" style="width:28px;height:28px;font-size:10px;flex-shrink:0;background:#0d9488;">
                {{((p.prenoms||p.nom||'?')[0]).toUpperCase()}}
              </div>
              <div class="cb-prod-person-info">
                <span class="cb-person-name" style="font-size:13px;">{{(p.prenoms||'')+' '+(p.nom||'')||p.code}}</span>
                <span class="cb-person-titre" style="font-size:11px;">{{p.titre||p.profession||p.entreprise||p.etablissementScolaire||p.code}}</span>
              </div>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
    <div class="cb-modal-foot">
      <div style="font-size:12px;color:#6b7280;">
        {{prodSelectedPersonIds.size}} personne(s) × {{prodCopies}} copie(s) = {{prodSelectedPersonIds.size*prodCopies}} carte(s)
      </div>
      <div style="display:flex;gap:8px;">
        <button class="cb-btn cb-btn--secondary" style="width:auto;" (click)="productionModalOpen=false">Annuler</button>
        <button class="cb-btn cb-btn--generate" style="width:auto;" (click)="produirePdf()"
          [disabled]="!prodSelectedDesignId||prodSelectedPersonIds.size===0||pdfLoading">
          <span *ngIf="!pdfLoading">▶ Produire le PDF</span><span *ngIf="pdfLoading">⏳ Génération...</span>
        </button>
      </div>
    </div>
  </div>
</div>

<!-- ═══ WORKSPACE ═══ -->
<div *ngIf="workspaceOpen" class="cb-overlay" (click)="workspaceOpen=false">
  <div class="cb-workspace-modal" (click)="stopProp($event)">
    <div class="cb-modal-head"><span>📂 Mes créations</span><button class="cb-modal-close" (click)="workspaceOpen=false">✕</button></div>
    <div class="cb-ws-body">
      <div *ngIf="workspaceLoading" class="cb-ws-loading">⏳ Chargement...</div>
      <div *ngIf="!workspaceLoading&&savedDesigns.length===0" class="cb-ws-empty">Aucune création sauvegardée.</div>
      <div *ngFor="let d of savedDesigns" class="cb-ws-item">
        <!-- Thumbnail -->
        <div class="cb-ws-thumb" [class.cb-ws-thumb--vert]="isDesignVertical(d)" [class.cb-ws-thumb--horiz]="!isDesignVertical(d)">
          <div class="cb-ws-thumb-inner" [innerHTML]="getDesignPreviewHtml(d)"></div>
        </div>
        <div class="cb-ws-info">
          <span class="cb-ws-name">{{d.name}}</span>
          <span class="cb-ws-meta">{{d.templateId}} · {{d.category}}</span>
          <span class="cb-ws-date">{{d.createdAt|date:'dd/MM/yyyy HH:mm'}}</span>
        </div>
        <div class="cb-ws-acts">
          <button class="cb-btn cb-btn--outline" style="width:auto;font-size:12px;padding:6px 12px;" (click)="loadDesign(d)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            Charger
          </button>
          <button class="cb-row-act cb-row-act--del" title="Supprimer" (click)="deleteDesign(d.id)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ MES CARTES (2 onglets) ═══ -->
<div *ngIf="myCardsOpen" class="cb-overlay">
  <div class="cb-mc-modal">

    <!-- En-tête -->
    <div class="cb-modal-head">
      <span>🪪 Mes Cartes</span>
      <button class="cb-modal-close" (click)="myCardsOpen=false">✕</button>
    </div>

    <!-- Onglets -->
    <div class="cb-mc-tabs">
      <button class="cb-mc-tab" [class.cb-mc-tab--active]="myCardsTab===1" (click)="myCardsTab=1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Personnes <span class="cb-mc-tab-count">{{savedPersonsList.length}}</span>
      </button>
      <button class="cb-mc-tab" [class.cb-mc-tab--active]="myCardsTab===2" (click)="myCardsTab=2;loadProdHistory()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        Cartes produites <span class="cb-mc-tab-count">{{prodHistory.length}}</span>
      </button>
    </div>

    <!-- ── ONGLET 1 : PERSONNES ── -->
    <div *ngIf="myCardsTab===1" class="cb-mc-body">

      <!-- Barre d'actions rapides -->
      <div class="cb-mc-quickbar">
        <button class="cb-mc-qbtn cb-mc-qbtn--ent" (click)="myCardsOpen=false;entrepriseModalOpen=true" title="Créer une entreprise / organisation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
          Nouvelle entreprise
        </button>
        <button class="cb-mc-qbtn cb-mc-qbtn--per" (click)="myCardsOpen=false;openBulkModal()" title="Ajouter des personnes">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Ajouter des personnes
        </button>
      </div>

      <div *ngIf="savedPersonsList.length===0" class="cb-mc-empty" style="margin-top:8px;">
        <div style="font-size:40px;margin-bottom:8px;">👥</div>
        <div>Aucune personne enregistrée.</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:4px;">Commencez par créer une entreprise, puis ajoutez des personnes.</div>
      </div>
      <div *ngFor="let entGrp of personsByEntrepriseGrouped" class="cb-mc-ent-group">
        <!-- En-tête entreprise (accordéon) -->
        <div class="cb-mc-ent-head" (click)="myCardsToggleEnt(entGrp.entKey)">
          <div class="cb-mc-ent-avatar">{{entGrp.entKey[0]|uppercase}}</div>
          <div class="cb-mc-ent-info">
            <span class="cb-mc-ent-name">{{entGrp.entKey}}</span>
            <span class="cb-mc-ent-count">{{entGrp.totalPersons}} personne(s) · {{entGrp.groups.length}} catégorie(s)</span>
          </div>
          <svg class="cb-mc-chevron" [class.cb-mc-chevron--open]="myCardsExpandedEnts.has(entGrp.entKey)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <!-- Groupes par catégorie -->
        <div *ngIf="myCardsExpandedEnts.has(entGrp.entKey)" class="cb-mc-cat-body">
          <div *ngFor="let catGrp of entGrp.groups" class="cb-mc-cat-group">
            <!-- En-tête catégorie -->
            <div class="cb-mc-cat-head" (click)="myCardsToggleCat(entGrp.entKey+'|||'+catGrp.catKey)">
              <span class="cb-mc-cat-badge">{{catGrp.catLabel}}</span>
              <span class="cb-mc-cat-count">{{catGrp.persons.length}} personne(s)</span>
              <button class="cb-mc-cat-add" title="Ajouter une personne dans cette catégorie"
                (click)="$event.stopPropagation();mcAddPersonToGroup(entGrp.entKey,catGrp.catKey)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Ajouter
              </button>
              <svg class="cb-mc-chevron cb-mc-chevron--sm" [class.cb-mc-chevron--open]="myCardsExpandedCats.has(entGrp.entKey+'|||'+catGrp.catKey)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <!-- Personnes de cette catégorie -->
            <div *ngIf="myCardsExpandedCats.has(entGrp.entKey+'|||'+catGrp.catKey)" class="cb-mc-persons">

              <!-- Template partagé ligne personne -->
              <ng-template #personTpl let-p="p">
                <div class="cb-mc-person">
                  <div class="cb-mc-person-row" (click)="myCardsTogglePerson(p.id!)">
                    <div class="cb-mc-person-av" [style.background]="p.photo ? 'transparent' : mcAvatarColor(p)">
                      <img *ngIf="p.photo" [src]="p.photo" class="cb-mc-person-av-img" alt=""/>
                      <span *ngIf="!p.photo">{{(p.prenoms||p.nom||'?')[0]|uppercase}}</span>
                    </div>
                    <div class="cb-mc-person-main">
                      <span class="cb-mc-person-name">{{p.nom}} {{p.prenoms}}</span>
                      <span class="cb-mc-person-sub">{{p.profession||p.titre||p.specialite||p.titreParticipant||p.typeApprenant||p.classe||'—'}}</span>
                    </div>
                    <div class="cb-mc-person-row-acts" (click)="$event.stopPropagation()">
                      <button class="cb-mc-act cb-mc-act--edit" title="Modifier" (click)="myCardsStartEdit(p,$event)">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="cb-mc-act cb-mc-act--del" title="Supprimer" (click)="myCardsDeletePerson(p.id!,$event)">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                    <svg class="cb-mc-chevron cb-mc-chevron--sm" [class.cb-mc-chevron--open]="myCardsExpandedPersons.has(p.id!)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                  <div *ngIf="myCardsEditPersonId===p.id" class="cb-mc-edit-form">
                    <div class="cb-mc-edit-grid">
                      <div class="cb-field-group"><label class="cb-label">Civilité</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.civilite" placeholder="M./Mme"/></div>
                      <div class="cb-field-group"><label class="cb-label">Nom *</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.nom" placeholder="Nom de famille"/></div>
                      <div class="cb-field-group"><label class="cb-label">Prénoms *</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.prenoms" placeholder="Prénoms"/></div>
                      <div class="cb-field-group" *ngIf="p.category==='BADGE_IDENTITE'"><label class="cb-label">Profession</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.profession" placeholder="Profession / Poste"/></div>
                      <div class="cb-field-group" *ngIf="p.category==='BADGE_IDENTITE'"><label class="cb-label">Département</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.departement" placeholder="Département"/></div>
                      <div class="cb-field-group" *ngIf="p.category==='CARTE_VISITE'"><label class="cb-label">Spécialité</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.specialite" placeholder="Spécialité"/></div>
                      <div class="cb-field-group" *ngIf="p.category==='CARTE_VISITE'"><label class="cb-label">Slogan</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.slogan" placeholder="Slogan"/></div>
                      <div class="cb-field-group" *ngIf="p.category==='BADGE_EVENEMENT'"><label class="cb-label">Organisation</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.organisationParticipant" placeholder="Organisation"/></div>
                      <div class="cb-field-group" *ngIf="p.category==='BADGE_EVENEMENT'"><label class="cb-label">Titre participant</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.titreParticipant" placeholder="Intervenant, Visiteur..."/></div>
                      <div class="cb-field-group" *ngIf="p.category==='BADGE_EVENEMENT'"><label class="cb-label">Titre événement</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.titreEvenement" placeholder="Nom de l'événement"/></div>
                      <div class="cb-field-group" *ngIf="p.category==='CARTE_SCOLAIRE'"><label class="cb-label">Classe</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.classe" placeholder="Classe"/></div>
                      <div class="cb-field-group" *ngIf="p.category==='CARTE_SCOLAIRE'"><label class="cb-label">Année scolaire</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.anneeScolaire" placeholder="2024-2025"/></div>
                      <div class="cb-field-group" *ngIf="p.category==='CARTE_SCOLAIRE'"><label class="cb-label">Matricule</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.numeroMatricule" placeholder="N° Matricule"/></div>
                      <div class="cb-field-group"><label class="cb-label">Contact</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.contact" placeholder="Téléphone"/></div>
                      <div class="cb-field-group"><label class="cb-label">Email</label><input class="cb-input" [(ngModel)]="myCardsEditDraft.email" placeholder="Email"/></div>
                    </div>
                    <div class="cb-mc-edit-actions">
                      <button class="cb-btn cb-btn--secondary" style="width:auto;" (click)="myCardsCancelEdit()">Annuler</button>
                      <button class="cb-btn cb-btn--primary" style="width:auto;" (click)="myCardsSaveEdit()">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Enregistrer
                      </button>
                    </div>
                  </div>
                  <div *ngIf="myCardsExpandedPersons.has(p.id!) && myCardsEditPersonId!==p.id" class="cb-mc-detail">
                    <div class="cb-mc-detail-grid">
                      <div *ngIf="p.photo" class="cb-mc-detail-photo"><img [src]="p.photo" alt="photo"/></div>
                      <div class="cb-mc-detail-fields">
                        <div *ngIf="p.civilite" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Civilité</span><span class="cb-mc-detail-val">{{p.civilite}}</span></div>
                        <div *ngIf="p.dateNaissance" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Naissance</span><span class="cb-mc-detail-val">{{p.dateNaissance}}</span></div>
                        <div *ngIf="p.lieuNaissance" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Lieu naiss.</span><span class="cb-mc-detail-val">{{p.lieuNaissance}}</span></div>
                        <div *ngIf="p.nationalite" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Nationalité</span><span class="cb-mc-detail-val">{{p.nationalite}}</span></div>
                        <div *ngIf="p.profession" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Profession</span><span class="cb-mc-detail-val">{{p.profession}}</span></div>
                        <div *ngIf="p.titre" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Titre</span><span class="cb-mc-detail-val">{{p.titre}}</span></div>
                        <div *ngIf="p.departement" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Département</span><span class="cb-mc-detail-val">{{p.departement}}</span></div>
                        <div *ngIf="p.matricule||p.numeroMatricule" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Matricule</span><span class="cb-mc-detail-val">{{p.matricule||p.numeroMatricule}}</span></div>
                        <div *ngIf="p.classe" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Classe</span><span class="cb-mc-detail-val">{{p.classe}}</span></div>
                        <div *ngIf="p.typeApprenant" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Type</span><span class="cb-mc-detail-val">{{p.typeApprenant}}</span></div>
                        <div *ngIf="p.anneeScolaire" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Année scolaire</span><span class="cb-mc-detail-val">{{p.anneeScolaire}}</span></div>
                        <div *ngIf="p.etablissementScolaire" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Établissement</span><span class="cb-mc-detail-val">{{p.etablissementScolaire}}</span></div>
                        <div *ngIf="p.titreEvenement" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Événement</span><span class="cb-mc-detail-val">{{p.titreEvenement}}</span></div>
                        <div *ngIf="p.titreParticipant" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Titre</span><span class="cb-mc-detail-val">{{p.titreParticipant}}</span></div>
                        <div *ngIf="p.organisationParticipant" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Organisation</span><span class="cb-mc-detail-val">{{p.organisationParticipant}}</span></div>
                        <div *ngIf="p.specialite" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Spécialité</span><span class="cb-mc-detail-val">{{p.specialite}}</span></div>
                        <div *ngIf="p.contact" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Contact</span><span class="cb-mc-detail-val">{{p.contact}}</span></div>
                        <div *ngIf="p.email" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Email</span><span class="cb-mc-detail-val">{{p.email}}</span></div>
                        <div *ngIf="p.adresse" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Adresse</span><span class="cb-mc-detail-val">{{p.adresse}}</span></div>
                        <div *ngIf="p.entreprise" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Entreprise</span><span class="cb-mc-detail-val">{{p.entreprise}}</span></div>
                        <div *ngIf="p.code" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Code</span><span class="cb-mc-detail-val">{{p.code}}</span></div>
                        <div *ngIf="p.createdAt" class="cb-mc-detail-row"><span class="cb-mc-detail-lbl">Créé le</span><span class="cb-mc-detail-val">{{p.createdAt|date:'dd/MM/yyyy'}}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </ng-template>

              <!-- CARTE_SCOLAIRE : sous-groupes par année·établissement + filtre classe -->
              <!-- BADGE_EVENEMENT : sous-groupes par nom d'événement                    -->
              <ng-container *ngIf="catGrp.hasSubGroups">
                <div *ngFor="let sg of catGrp.subGroups" class="cb-mc-subgroup">
                  <div class="cb-mc-sg-head">
                    <span class="cb-mc-sg-icon">{{catGrp.catKey==='CARTE_SCOLAIRE'?'📅':'🎫'}}</span>
                    <span class="cb-mc-sg-label">{{sg.subLabel}}</span>
                    <span class="cb-mc-sg-total">{{sg.allPersons.length}} pers.</span>
                    <select *ngIf="sg.availableClasses.length>0" class="cb-mc-sg-select"
                      [value]="sg.selectedClasse"
                      (change)="mcSetClasseFilter(sg.filterKey, $any($event.target).value)">
                      <option value="">Toutes les classes ({{sg.allPersons.length}})</option>
                      <option *ngFor="let c of sg.availableClasses" [value]="c">{{c}} — {{mcClasseCount(sg.allPersons,c)}} élève(s)</option>
                    </select>
                    <span *ngIf="sg.selectedClasse" class="cb-mc-sg-filter-info">
                      {{sg.filteredPersons.length}} / {{sg.allPersons.length}}
                      <button class="cb-mc-sg-clear" (click)="mcSetClasseFilter(sg.filterKey,'')">✕</button>
                    </span>
                    <button class="cb-mc-sg-add" title="Ajouter une personne dans ce groupe"
                      (click)="$event.stopPropagation(); mcAddPersonToGroup(entGrp.entKey, catGrp.catKey, sg.hints)">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Ajouter
                    </button>
                  </div>
                  <ng-container *ngFor="let p of sg.filteredPersons">
                    <ng-container *ngTemplateOutlet="personTpl; context:{p:p}"></ng-container>
                  </ng-container>
                </div>
              </ng-container>

              <!-- Autres catégories : liste plate -->
              <ng-container *ngIf="!catGrp.hasSubGroups">
                <ng-container *ngFor="let p of catGrp.persons">
                  <ng-container *ngTemplateOutlet="personTpl; context:{p:p}"></ng-container>
                </ng-container>
              </ng-container>

            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── ONGLET 2 : CARTES PRODUITES ── -->
    <div *ngIf="myCardsTab===2" class="cb-mc-body">
      <div *ngIf="prodHistory.length===0" class="cb-mc-empty">
        <div style="font-size:40px;margin-bottom:8px;">🖨️</div>
        <div style="font-weight:600;color:#374151;">Aucune carte produite</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:6px;">Utilisez <strong>Produire les cartes</strong> pour générer votre premier PDF — il apparaîtra ici.</div>
      </div>
      <div *ngFor="let rec of prodHistory" class="cb-mc-prod-row">
        <div class="cb-mc-prod-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div class="cb-mc-prod-info">
          <span class="cb-mc-prod-name">{{rec.designName}}</span>
          <span class="cb-mc-prod-meta">{{mcCatLabel(rec.category)}} · {{rec.personCount}} personne(s) × {{rec.copies}} copie(s) = <strong>{{rec.personCount * rec.copies}} cartes</strong></span>
          <span *ngIf="rec.entreprise" class="cb-mc-prod-org">🏢 {{rec.entreprise}}</span>
          <div class="cb-mc-prod-persons">{{rec.personNames.slice(0,4).join(', ')}}{{rec.personNames.length>4?' + '+(rec.personNames.length-4)+' autres':''}}</div>
          <span class="cb-mc-prod-date">📅 {{rec.timestamp | date:'dd/MM/yyyy HH:mm'}}</span>
        </div>
        <div class="cb-mc-prod-acts">
          <button class="cb-btn cb-btn--primary" style="width:auto;font-size:12px;padding:7px 14px;gap:5px;"
            [disabled]="myCardsPdfLoading===rec.id"
            (click)="mcReprintPdf(rec)" title="Télécharger à nouveau le PDF">
            <svg *ngIf="myCardsPdfLoading!==rec.id" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {{myCardsPdfLoading===rec.id?'⏳...':'📥 PDF'}}
          </button>
          <button class="cb-mc-act cb-mc-act--del" title="Supprimer de l'historique" (click)="mcDeleteProdRecord(rec.id)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- ═══ MODAL SOCIÉTÉ (multi-step) ═══ -->
<div *ngIf="entrepriseModalOpen" class="cb-overlay" style="z-index:10050;" (click)="entrepriseModalOpen=false">
  <div class="cb-ent-modal" (click)="stopProp($event)">

    <!-- En-tête -->
    <div class="cb-ent-head">
      <div class="cb-ent-head-top">
        <div>
          <div class="cb-ent-head-title">🏢 Nouvelle Société / Organisation</div>
          <div class="cb-ent-head-sub">Étape {{entStep}} sur 4 — {{ENT_STEPS[entStep-1].label}}</div>
        </div>
        <button class="cb-modal-close" (click)="entrepriseModalOpen=false">✕</button>
      </div>

      <!-- Stepper -->
      <div class="cb-ent-stepper">
        <ng-container *ngFor="let s of ENT_STEPS; let idx=index">
          <div class="cb-ent-step" [class.cb-ent-step--done]="entStep>idx+1" [class.cb-ent-step--active]="entStep===idx+1"
            (click)="entStep>idx+1 ? (entStep=idx+1) : null" [style.cursor]="entStep>idx+1?'pointer':'default'">
            <div class="cb-ent-step-dot">
              <svg *ngIf="entStep>idx+1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span *ngIf="entStep<=idx+1">{{idx+1}}</span>
            </div>
            <span class="cb-ent-step-label">{{s.label}}</span>
          </div>
          <div *ngIf="idx<3" class="cb-ent-step-line" [class.cb-ent-step-line--done]="entStep>idx+1"></div>
        </ng-container>
      </div>

      <!-- Barre de progression -->
      <div class="cb-ent-progress">
        <div class="cb-ent-progress-fill" [style.width]="((entStep-1)/3*100)+'%'"></div>
      </div>
    </div>

    <!-- Corps -->
    <div class="cb-ent-body">

      <!-- ── ÉTAPE 1 : Identité légale ── -->
      <ng-container *ngIf="entStep===1">
        <div class="cb-ent-step-intro">
          <div class="cb-ent-step-icon">🏛</div>
          <div>
            <div class="cb-ent-step-name">Identité légale</div>
            <div class="cb-ent-step-desc">Raison sociale, forme juridique et immatriculation</div>
          </div>
        </div>
        <div class="cb-form-2col">
          <div class="cb-field-group">
            <label class="cb-label">Raison Sociale *</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.raisonSocial" placeholder="Ex: Creative Agency SARL" autofocus/>
          </div>
          <div class="cb-field-group">
            <label class="cb-label">Sigle / Abréviation</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.sigleEntreprise" placeholder="Ex: CA"/>
          </div>
        </div>
        <div class="cb-form-2col">
          <div class="cb-field-group">
            <label class="cb-label">Forme juridique</label>
            <select class="cb-input" [(ngModel)]="newEntreprise.formeJuridique">
              <option value="">— Choisir —</option>
              <option>SARL</option><option>SA</option><option>SAS</option><option>SASU</option>
              <option>SNC</option><option>GIE</option><option>Association</option><option>ONG</option>
              <option>École</option><option>Université</option><option>Ministère</option><option>Mairie</option><option>Autre</option>
            </select>
          </div>
          <div class="cb-field-group">
            <label class="cb-label">Capital social</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.capitalSocial" placeholder="Ex: 5 000 000 FCFA"/>
          </div>
        </div>
        <div class="cb-form-2col">
          <div class="cb-field-group">
            <label class="cb-label">IFU — N° Identification Fiscale</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.ifu" placeholder="Ex: 0012345678901"/>
          </div>
          <div class="cb-field-group">
            <label class="cb-label">RCCM — Registre Commerce</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.rccm" placeholder="Ex: RB/COT/24 A 12345"/>
          </div>
        </div>
        <div class="cb-field-group">
          <label class="cb-label">Description / Objet social</label>
          <textarea class="cb-input" [(ngModel)]="newEntreprise.description" placeholder="Décrivez l'activité principale de la société..." rows="2" style="resize:vertical;"></textarea>
        </div>
      </ng-container>

      <!-- ── ÉTAPE 2 : Contact & Localisation ── -->
      <ng-container *ngIf="entStep===2">
        <div class="cb-ent-step-intro">
          <div class="cb-ent-step-icon">📍</div>
          <div>
            <div class="cb-ent-step-name">Contact & Localisation</div>
            <div class="cb-ent-step-desc">Coordonnées et adresse du siège social</div>
          </div>
        </div>
        <div class="cb-form-2col">
          <div class="cb-field-group">
            <label class="cb-label">Email</label>
            <input class="cb-input" type="email" [(ngModel)]="newEntreprise.email" placeholder="contact@societe.com"/>
          </div>
          <div class="cb-field-group">
            <label class="cb-label">Téléphone</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.telephone" placeholder="+229 XX XX XX XX"/>
          </div>
        </div>
        <div class="cb-form-2col">
          <div class="cb-field-group">
            <label class="cb-label">Fax</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.fax" placeholder="+229 XX XX XX XX"/>
          </div>
          <div class="cb-field-group">
            <label class="cb-label">Site web</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.siteWeb" placeholder="www.societe.com"/>
          </div>
        </div>
        <div class="cb-field-group">
          <label class="cb-label">Adresse complète</label>
          <input class="cb-input" [(ngModel)]="newEntreprise.adresse" placeholder="Ex: 12, Rue des Palmiers, Quartier Akpakpa"/>
        </div>
        <div class="cb-form-2col">
          <div class="cb-field-group">
            <label class="cb-label">Boîte Postale</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.boitePostale" placeholder="Ex: BP 1234"/>
          </div>
          <div class="cb-field-group">
            <label class="cb-label">Ville</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.ville" placeholder="Ex: Cotonou"/>
          </div>
        </div>
        <div class="cb-field-group">
          <label class="cb-label">Pays</label>
          <input class="cb-input" [(ngModel)]="newEntreprise.pays" placeholder="Ex: Bénin"/>
        </div>
      </ng-container>

      <!-- ── ÉTAPE 3 : Activité & Équipe ── -->
      <ng-container *ngIf="entStep===3">
        <div class="cb-ent-step-intro">
          <div class="cb-ent-step-icon">💼</div>
          <div>
            <div class="cb-ent-step-name">Activité & Équipe dirigeante</div>
            <div class="cb-ent-step-desc">Secteur, niche et responsable principal</div>
          </div>
        </div>
        <div class="cb-form-2col">
          <div class="cb-field-group">
            <label class="cb-label">Secteur d'activité</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.secteurActivite" placeholder="Ex: Technologie, Éducation, Santé..."/>
          </div>
          <div class="cb-field-group">
            <label class="cb-label">Niche / Spécialité</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.niche" placeholder="Ex: E-learning, FinTech..."/>
          </div>
        </div>
        <div class="cb-form-2col">
          <div class="cb-field-group">
            <label class="cb-label">Responsable / DG</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.responsable" placeholder="Nom complet du Directeur Général"/>
          </div>
          <div class="cb-field-group">
            <label class="cb-label">Titre du responsable</label>
            <input class="cb-input" [(ngModel)]="newEntreprise.titreResponsable" placeholder="Ex: Directeur Général, PDG..."/>
          </div>
        </div>
        <!-- Couleurs marque -->
        <div class="cb-ent-subsection">Identité visuelle de marque</div>
        <div class="cb-form-2col">
          <div class="cb-field-group">
            <label class="cb-label">Couleur principale</label>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="color" class="cb-color" style="width:52px;height:36px;" [(ngModel)]="newEntreprise.couleur1"/>
              <span style="font-size:12px;color:#6b7280;font-family:monospace;">{{newEntreprise.couleur1||'Non définie'}}</span>
            </div>
          </div>
          <div class="cb-field-group">
            <label class="cb-label">Couleur secondaire</label>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="color" class="cb-color" style="width:52px;height:36px;" [(ngModel)]="newEntreprise.couleur2"/>
              <span style="font-size:12px;color:#6b7280;font-family:monospace;">{{newEntreprise.couleur2||'Non définie'}}</span>
            </div>
          </div>
        </div>
        <div *ngIf="newEntreprise.couleur1||newEntreprise.couleur2" class="cb-ent-color-preview">
          <div class="cb-ent-color-swatch" [style.background]="newEntreprise.couleur1||'#ccc'"></div>
          <div class="cb-ent-color-swatch" [style.background]="newEntreprise.couleur2||'#ccc'"></div>
          <span style="font-size:12px;color:#6b7280;">Aperçu palette de marque</span>
        </div>
      </ng-container>

      <!-- ── ÉTAPE 4 : Visuels & Documents ── -->
      <ng-container *ngIf="entStep===4">
        <div class="cb-ent-step-intro">
          <div class="cb-ent-step-icon">🎨</div>
          <div>
            <div class="cb-ent-step-name">Visuels & Documents officiels</div>
            <div class="cb-ent-step-desc">Logo, armoirie, cachet et signature — utilisés automatiquement sur les cartes</div>
          </div>
        </div>
        <div class="cb-ent-upload-grid">
          <div class="cb-ent-upload-card">
            <div class="cb-ent-upload-lbl">Logo</div>
            <div class="cb-ent-upload-zone" (click)="triggerEntLogo()" (dragover)="onDragOver($event)">
              <img *ngIf="newEntreprise.logo" [src]="newEntreprise.logo" class="cb-ent-upload-img"/>
              <div *ngIf="!newEntreprise.logo" class="cb-ent-upload-ph">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                <span>Logo entreprise</span>
              </div>
            </div>
            <button *ngIf="newEntreprise.logo" class="cb-ent-upload-clear" (click)="newEntreprise.logo=undefined">✕</button>
            <input id="ent-logo" type="file" accept="image/*" style="display:none" (change)="onEntFileChange($event,'logo')"/>
          </div>
          <div class="cb-ent-upload-card">
            <div class="cb-ent-upload-lbl">Armoirie / Sceau</div>
            <div class="cb-ent-upload-zone" (click)="triggerEntArm()" (dragover)="onDragOver($event)">
              <img *ngIf="newEntreprise.armoirie" [src]="newEntreprise.armoirie" class="cb-ent-upload-img"/>
              <div *ngIf="!newEntreprise.armoirie" class="cb-ent-upload-ph">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Armoirie officielle</span>
              </div>
            </div>
            <button *ngIf="newEntreprise.armoirie" class="cb-ent-upload-clear" (click)="newEntreprise.armoirie=undefined">✕</button>
            <input id="ent-arm" type="file" accept="image/*" style="display:none" (change)="onEntFileChange($event,'armoirie')"/>
          </div>
          <div class="cb-ent-upload-card">
            <div class="cb-ent-upload-lbl">Cachet officiel</div>
            <div class="cb-ent-upload-zone" (click)="triggerEntCachet()" (dragover)="onDragOver($event)">
              <img *ngIf="newEntreprise.cachet" [src]="newEntreprise.cachet" class="cb-ent-upload-img"/>
              <div *ngIf="!newEntreprise.cachet" class="cb-ent-upload-ph">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                <span>Cachet / Tampon</span>
              </div>
            </div>
            <button *ngIf="newEntreprise.cachet" class="cb-ent-upload-clear" (click)="newEntreprise.cachet=undefined">✕</button>
            <input id="ent-cachet" type="file" accept="image/*" style="display:none" (change)="onEntFileChange($event,'cachet')"/>
          </div>
          <div class="cb-ent-upload-card">
            <div class="cb-ent-upload-lbl">Signature responsable</div>
            <div class="cb-ent-upload-zone" (click)="triggerEntSig()" (dragover)="onDragOver($event)">
              <img *ngIf="newEntreprise.signatureResponsable" [src]="newEntreprise.signatureResponsable" class="cb-ent-upload-img"/>
              <div *ngIf="!newEntreprise.signatureResponsable" class="cb-ent-upload-ph">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"><path d="M3 17l4-4 4 4 4-8 4 4"/></svg>
                <span>Signature du DG</span>
              </div>
            </div>
            <button *ngIf="newEntreprise.signatureResponsable" class="cb-ent-upload-clear" (click)="newEntreprise.signatureResponsable=undefined">✕</button>
            <input id="ent-sig" type="file" accept="image/*" style="display:none" (change)="onEntFileChange($event,'signatureResponsable')"/>
          </div>
        </div>

        <!-- Résumé final -->
        <div class="cb-ent-summary" *ngIf="newEntreprise.raisonSocial">
          <div class="cb-ent-summary-title">Récapitulatif</div>
          <div class="cb-ent-summary-row"><span>Raison sociale</span><strong>{{newEntreprise.raisonSocial}}</strong></div>
          <div *ngIf="newEntreprise.sigleEntreprise" class="cb-ent-summary-row"><span>Sigle</span><strong>{{newEntreprise.sigleEntreprise}}</strong></div>
          <div *ngIf="newEntreprise.formeJuridique" class="cb-ent-summary-row"><span>Forme</span><strong>{{newEntreprise.formeJuridique}}</strong></div>
          <div *ngIf="newEntreprise.ville" class="cb-ent-summary-row"><span>Localisation</span><strong>{{newEntreprise.ville}}{{newEntreprise.pays?', '+newEntreprise.pays:''}}</strong></div>
          <div *ngIf="newEntreprise.responsable" class="cb-ent-summary-row"><span>Responsable</span><strong>{{newEntreprise.responsable}}</strong></div>
        </div>
      </ng-container>

    </div>

    <!-- Pied de page / Navigation -->
    <div class="cb-ent-foot">
      <button class="cb-btn cb-btn--secondary" style="width:auto;" (click)="entStep>1?entPrev():(entrepriseModalOpen=false)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><polyline points="15 18 9 12 15 6"/></svg>
        {{entStep>1?'Précédent':'Annuler'}}
      </button>
      <div style="display:flex;align-items:center;gap:6px;">
        <span *ngFor="let s of ENT_STEPS; let idx=index" class="cb-ent-dot"
          [class.cb-ent-dot--active]="entStep===idx+1"
          [class.cb-ent-dot--done]="entStep>idx+1"></span>
      </div>
      <button *ngIf="entStep<4" class="cb-btn cb-btn--primary" style="width:auto;"
        [disabled]="entStep===1&&!newEntreprise.raisonSocial?.trim()" (click)="entNext()">
        Suivant
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-left:4px"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <button *ngIf="entStep===4" class="cb-btn cb-btn--primary" style="width:auto;" (click)="saveEntreprise()"
        [disabled]="!newEntreprise.raisonSocial?.trim()||savingEntreprise">
        <span *ngIf="!savingEntreprise">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Créer la société
        </span>
        <span *ngIf="savingEntreprise">⏳ Enregistrement...</span>
      </button>
    </div>

  </div>
</div>

<!-- ═══ CHATBOT IA ═══ -->
<div *ngIf="showChatbotModal" class="cb-overlay" (click)="showChatbotModal=false">
  <div class="cb-chatbot-modal" (click)="stopProp($event)">
    <div class="cb-modal-head"><span>💬 Assistant IA Card Builder</span><button class="cb-modal-close" (click)="showChatbotModal=false">✕</button></div>
    <div class="cb-chat-messages">
      <div *ngIf="chatMessages.length===0" class="cb-chat-empty">
        <div style="font-size:2rem;margin-bottom:8px;">🤖</div>
        <div>Posez une question ou demandez de générer du contenu.</div>
        <div class="cb-chat-quick">
          <button *ngFor="let q of aiQuickPrompts" class="cb-quick-prompt" (click)="chatInput=q;sendChatMessage()">{{q}}</button>
        </div>
      </div>
      <div *ngFor="let msg of chatMessages" class="cb-chat-msg"
        [class.cb-chat-msg--user]="msg.role==='user'" [class.cb-chat-msg--ai]="msg.role==='assistant'">
        <span class="cb-chat-role">{{msg.role==='user'?'Vous':'🤖 IA'}}</span>
        <div class="cb-chat-content">{{msg.content}}</div>
        <button *ngIf="msg.role==='assistant'" class="cb-apply-btn" (click)="applyAiMessage(msg.content)">Pré-remplir les champs</button>
      </div>
      <div *ngIf="aiChatLoading" class="cb-chat-msg cb-chat-msg--ai">
        <span class="cb-chat-role">🤖 IA</span>
        <div class="cb-chat-content" style="color:#9ca3af;font-style:italic;">⏳ Traitement...</div>
      </div>
    </div>
    <div class="cb-chat-input-row">
      <input class="cb-chat-input" [(ngModel)]="chatInput" placeholder="Posez votre question..." (keyup.enter)="sendChatMessage()" [disabled]="aiChatLoading"/>
      <button class="cb-chat-send" (click)="sendChatMessage()" [disabled]="!chatInput.trim()||aiChatLoading">Envoyer</button>
    </div>
  </div>
</div>

<!-- ═══ CONFIG IA ═══ -->
<div *ngIf="showAiConfigModal" class="cb-overlay" (click)="showAiConfigModal=false">
  <div class="cb-config-modal" (click)="stopProp($event)">
    <div class="cb-modal-head"><span>⚙ Configuration IA</span><button class="cb-modal-close" (click)="showAiConfigModal=false">✕</button></div>
    <div style="padding:16px;display:flex;flex-direction:column;gap:14px;">
      <div style="font-size:12px;color:#6b7280;background:#f0fdfa;border:1px solid #99f6e4;border-radius:6px;padding:8px;">
        ℹ️ Configuration partagée avec CV Builder et les autres modules Creative Studio.
      </div>
      <div *ngIf="aiProviders.length===0" style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">Aucun modèle configuré. Allez dans CV Builder → Config IA.</div>
      <div *ngFor="let fn of ['chatbot','suggest','batch','translate']" class="cb-ai-cfg-row">
        <span style="font-size:12px;color:#374151;">{{fnLabel(fn)}}</span>
        <select class="cb-input" [(ngModel)]="aiConfig[fn]" (change)="saveAiConfig()" style="width:180px;">
          <option value="">— Choisir —</option>
          <option *ngFor="let prov of aiProviders" [value]="prov.id">{{prov.name}}</option>
        </select>
      </div>
    </div>
    <div class="cb-modal-foot"><button class="cb-btn cb-btn--primary" style="width:auto;" (click)="showAiConfigModal=false">OK</button></div>
  </div>
</div>

<!-- ═══ TOAST ═══ -->
<div class="cb-toast" [class.cb-toast--show]="toastVisible">{{toastMsg}}</div>
  `,
  styles: [`
:host { display:flex; flex-direction:column; height:calc(100vh - 64px); overflow:hidden; }

/* Stepper */
.cb-stepper { display:flex; align-items:center; padding:10px 24px; background:#fff; border-bottom:1px solid #e5e7eb; flex-shrink:0; }
.cb-step { display:flex; align-items:center; gap:8px; cursor:pointer; }
.cb-step-dot { width:26px; height:26px; border-radius:50%; background:#e5e7eb; color:#6b7280; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; border:2px solid #e5e7eb; transition:all .2s; flex-shrink:0; }
.cb-step--active .cb-step-dot, .cb-step--done .cb-step-dot { background:#0d9488; color:#fff; border-color:#0d9488; }
.cb-step-label { font-size:11px; color:#6b7280; font-weight:500; white-space:nowrap; }
.cb-step--active .cb-step-label, .cb-step--done .cb-step-label { color:#0d9488; font-weight:700; }
.cb-step-line { flex:1; height:2px; background:#e5e7eb; min-width:24px; max-width:60px; margin:0 8px; }
.cb-step-line--done { background:#0d9488; }

/* Root */
.cb-root { display:flex; flex:1; overflow:hidden; background:#f8fafc; }

/* Sidebar */
.cb-sidebar { width:290px; flex-shrink:0; overflow-y:auto; background:#fff; border-right:1px solid #e5e7eb; display:flex; flex-direction:column; }
.cb-sidebar::-webkit-scrollbar { width:4px; }
.cb-sidebar::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:2px; }
.cb-section { padding:12px 14px; border-bottom:1px solid #f1f5f9; }
.cb-section-title { font-size:11px; font-weight:700; color:#4b5563; text-transform:uppercase; letter-spacing:.8px; margin-bottom:8px; }

/* Catégories */
.cb-cats { display:flex; flex-direction:column; gap:4px; }
.cb-cat-btn { display:flex; align-items:center; gap:8px; padding:7px 10px; border:1.5px solid #e5e7eb; border-radius:8px; background:#fff; cursor:pointer; font-size:12px; color:#374151; transition:all .15s; }
.cb-cat-btn:hover { border-color:#0d9488; background:#f0fdfa; }
.cb-cat-btn--active { border-color:#0d9488; background:#f0fdfa; color:#0d9488; font-weight:600; }
.cb-cat-label { font-size:12px; }

/* Templates */
.cb-templates-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; max-height:280px; overflow-y:auto; }
.cb-tpl-thumb { border:2px solid transparent; border-radius:8px; cursor:pointer; background:#f9fafb; transition:all .15s; }
.cb-tpl-thumb:hover { border-color:#94a3b8; transform:translateY(-1px); box-shadow:0 3px 8px rgba(0,0,0,.12); }
.cb-tpl-thumb--active { border-color:#0d9488; box-shadow:0 0 0 2px rgba(13,148,136,.2); }
.cb-tpl-thumb-clip { overflow:hidden; border-radius:6px 6px 0 0; }
.cb-tpl-thumb--vert .cb-tpl-thumb-clip { width:80px; height:126px; }
.cb-tpl-thumb--horiz .cb-tpl-thumb-clip { width:80px; height:51px; }
.cb-tpl-thumb--vert .cb-tpl-thumb-inner { width:204px; height:322px; transform:scale(0.392); transform-origin:top left; pointer-events:none; }
.cb-tpl-thumb--horiz .cb-tpl-thumb-inner { width:321px; height:204px; transform:scale(0.249); transform-origin:top left; pointer-events:none; }
.cb-tpl-thumb-label { font-size:9px; color:#6b7280; text-align:center; padding:3px 3px 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border-top:1px solid #f1f5f9; }

/* Couleurs */
.cb-field-row { display:flex; gap:12px; align-items:flex-start; }
.cb-color { width:40px; height:30px; border:1px solid #e5e7eb; border-radius:6px; cursor:pointer; }
.cb-label { font-size:12px; color:#4b5563; font-weight:600; display:block; margin-bottom:4px; }

/* Résumé personnes */
.cb-persons-summary { display:flex; flex-wrap:wrap; gap:5px; }
.cb-person-chip { display:flex; align-items:center; gap:5px; background:#f0fdfa; border:1px solid #99f6e4; border-radius:14px; padding:3px 8px; font-size:11px; color:#0d9488; }
.cb-person-chip-avatar { width:18px; height:18px; border-radius:50%; background:#0d9488; color:#fff; font-size:8px; font-weight:700; display:flex; align-items:center; justify-content:center; }
.cb-person-chip--more { background:#f5f3ff; border-color:#c4b5fd; color:#7c3aed; }

/* Actions */
.cb-actions-stack { display:flex; flex-direction:column; gap:8px; }
.cb-btn { padding:9px 14px; border-radius:8px; border:none; font-size:13px; font-weight:600; cursor:pointer; width:100%; transition:all .15s; display:flex; align-items:center; justify-content:center; gap:6px; }
.cb-btn:disabled { opacity:.5; cursor:not-allowed; }
.cb-btn--primary { background:#0d9488; color:#fff; }
.cb-btn--primary:hover:not(:disabled) { background:#0f766e; }
.cb-btn--secondary { background:#f1f5f9; color:#374151; border:1px solid #e5e7eb; }
.cb-btn--secondary:hover:not(:disabled) { background:#e2e8f0; }
.cb-btn--outline { background:transparent; color:#0d9488; border:1.5px solid #0d9488; }
.cb-btn--outline:hover:not(:disabled) { background:#f0fdfa; }
.cb-btn--persons { background:#f0fdfa; color:#0d9488; border:1.5px solid #0d9488; }
.cb-btn--persons:hover { background:#ccfbf1; }
.cb-btn--generate { background:linear-gradient(135deg,#7c3aed,#2563eb); color:#fff; }
.cb-btn--generate:hover:not(:disabled) { opacity:.9; }
.cb-btn--ia { background:linear-gradient(135deg,#7c3aed,#2563eb); color:#fff; }
.cb-badge { background:#0d9488; color:#fff; border-radius:10px; font-size:10px; font-weight:700; padding:1px 6px; }
.cb-badge--sm { font-size:9px; padding:1px 5px; }

/* Preview panel */
.cb-preview-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; background:#f8fafc; }

/* AI Toolbar */
.cb-ai-toolbar { display:flex; align-items:center; gap:3px; padding:5px 10px; background:#1e1b4b; border-bottom:1px solid #312e81; flex-shrink:0; overflow-x:auto; }
.cb-ait-label { font-size:10px; font-weight:700; color:#a5b4fc; margin:0 3px; white-space:nowrap; }
.cb-ait { position:relative; width:30px; height:30px; border-radius:6px; border:none; background:rgba(255,255,255,.1); color:#e0e7ff; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; transition:all .15s; flex-shrink:0; }
.cb-ait:hover:not(:disabled) { background:rgba(255,255,255,.2); }
.cb-ait:disabled { opacity:.4; cursor:not-allowed; }
.cb-ait--active { background:#7c3aed !important; }
.cb-ait--config { margin-left:auto; }
.cb-ait-sep { width:1px; height:20px; background:rgba(255,255,255,.2); margin:0 3px; flex-shrink:0; }
.cb-ait-tip { display:none; position:absolute; top:36px; left:50%; transform:translateX(-50%); background:#0f172a; color:#e2e8f0; font-size:11px; padding:4px 8px; border-radius:5px; white-space:nowrap; z-index:200; border:1px solid #1e293b; box-shadow:0 4px 12px rgba(0,0,0,.4); }
.cb-ait:hover .cb-ait-tip { display:block; }
/* Action buttons in toolbar */
.cb-ait--act { width:auto; height:30px; padding:0 8px; gap:5px; border-radius:7px; font-size:12px; font-weight:600; }
.cb-ait--edit { background:rgba(13,148,136,.3); border:1px solid rgba(13,148,136,.4); }
.cb-ait--edit:hover { background:rgba(13,148,136,.5) !important; }
.cb-ait--persons { background:rgba(124,58,237,.3); border:1px solid rgba(124,58,237,.4); }
.cb-ait--persons:hover { background:rgba(124,58,237,.5) !important; }
.cb-ait--gen { background:rgba(37,99,235,.3); border:1px solid rgba(37,99,235,.4); }
.cb-ait--gen:hover { background:rgba(37,99,235,.5) !important; }
.cb-ait--ws { background:rgba(234,88,12,.3); border:1px solid rgba(234,88,12,.4); }
.cb-ait--ws:hover { background:rgba(234,88,12,.5) !important; }
.cb-ait--mycards { background:rgba(5,150,105,.3); border:1px solid rgba(5,150,105,.4); }
.cb-ait--mycards:hover { background:rgba(5,150,105,.5) !important; }
.cb-ait-lbl { font-size:11px; font-weight:600; }

/* ─── MES CARTES MODAL ─────────────────────────────────────────────── */
.cb-mc-modal { width:860px; max-width:97vw; height:88vh; max-height:88vh; background:#fff; border-radius:16px; display:flex; flex-direction:column; box-shadow:0 24px 64px rgba(0,0,0,.3); overflow:hidden; }
.cb-mc-tabs { display:flex; gap:0; border-bottom:2px solid #f1f5f9; background:#fafafa; padding:0 16px; flex-shrink:0; }
.cb-mc-tab { display:flex; align-items:center; gap:6px; padding:12px 18px; background:none; border:none; border-bottom:2.5px solid transparent; cursor:pointer; font-size:13px; font-weight:600; color:#6b7280; transition:all .2s; margin-bottom:-2px; }
.cb-mc-tab--active { color:#0d9488; border-bottom-color:#0d9488; }
.cb-mc-tab-count { background:#e5e7eb; border-radius:10px; padding:1px 7px; font-size:11px; font-weight:700; }
.cb-mc-tab--active .cb-mc-tab-count { background:#ccfbf1; color:#0d9488; }
.cb-mc-body { flex:1; min-height:0; overflow-y:auto; padding:16px; }
.cb-mc-ent-group { margin-bottom:10px; }
.cb-mc-empty { text-align:center; padding:40px 20px; color:#6b7280; font-size:14px; }
/* Groupe entreprise */
.cb-mc-ent-group { border:1.5px solid #e5e7eb; border-radius:12px; overflow:hidden; }
.cb-mc-ent-head { display:flex; align-items:center; gap:12px; padding:14px 16px; cursor:pointer; background:linear-gradient(135deg,#1e40af,#0d9488); transition:filter .15s; user-select:none; border-radius:10px 10px 0 0; }
.cb-mc-ent-head:hover { filter:brightness(1.08); }
.cb-mc-ent-avatar { width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,.25); color:#fff; font-size:18px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:2px solid rgba(255,255,255,.4); }
.cb-mc-ent-info { flex:1; }
.cb-mc-ent-name { font-size:14px; font-weight:800; color:#fff; display:block; }
.cb-mc-ent-count { font-size:11px; color:rgba(255,255,255,.8); }
.cb-mc-cat-body { border:1.5px solid #e2e8f0; border-top:none; border-radius:0 0 10px 10px; overflow:hidden; }
.cb-mc-cat-group { border-bottom:1px solid #f1f5f9; }
.cb-mc-cat-group:last-child { border-bottom:none; }
.cb-mc-cat-head { display:flex; align-items:center; gap:8px; padding:9px 16px; background:#f8fafc; cursor:pointer; user-select:none; transition:background .15s; }
.cb-mc-cat-head:hover { background:#f0fdf4; }
.cb-mc-cat-badge { font-size:11px; font-weight:700; padding:2px 8px; border-radius:99px; background:#0d9488; color:#fff; flex-shrink:0; }
.cb-mc-cat-count { font-size:11px; color:#6b7280; flex:1; }
.cb-mc-cat-add { display:flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:4px 10px; border-radius:6px; border:1.5px solid #0d9488; color:#0d9488; background:#fff; cursor:pointer; transition:all .15s; flex-shrink:0; }
.cb-mc-cat-add:hover { background:#0d9488; color:#fff; }
.cb-mc-chevron { color:#6b7280; transition:transform .2s; flex-shrink:0; }
.cb-mc-chevron--open { transform:rotate(180deg); }
.cb-mc-chevron--sm { margin-left:4px; }
/* Personnes */
.cb-mc-persons { display:flex; flex-direction:column; border-top:1px solid #f1f5f9; }
.cb-mc-subgroup { border-bottom:1px solid #f1f5f9; }
.cb-mc-subgroup:last-child { border-bottom:none; }
.cb-mc-sg-head { display:flex; align-items:center; gap:8px; padding:8px 14px; background:#fffbeb; border-bottom:1px solid #fef3c7; flex-wrap:wrap; }
.cb-mc-sg-icon { font-size:14px; flex-shrink:0; }
.cb-mc-sg-label { font-size:12px; font-weight:700; color:#1e293b; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cb-mc-sg-total { font-size:11px; color:#6b7280; flex-shrink:0; }
.cb-mc-sg-select { font-size:11px; padding:3px 6px; border:1px solid #d1d5db; border-radius:6px; background:#fff; color:#1e293b; cursor:pointer; max-width:200px; }
.cb-mc-sg-filter-info { display:flex; align-items:center; gap:4px; font-size:11px; color:#0d9488; font-weight:600; }
.cb-mc-sg-clear { background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px; padding:0 2px; }
.cb-mc-sg-add { display:flex; align-items:center; gap:3px; font-size:11px; font-weight:600; padding:3px 8px; border-radius:5px; border:1.5px solid #0d9488; color:#0d9488; background:#fff; cursor:pointer; margin-left:auto; flex-shrink:0; transition:all .15s; }
.cb-mc-sg-add:hover { background:#0d9488; color:#fff; }
.cb-mc-person { border-bottom:1px solid #f1f5f9; }
.cb-mc-person:last-child { border-bottom:none; }
.cb-mc-person-row { display:flex; align-items:center; gap:10px; padding:10px 16px; cursor:pointer; transition:background .1s; }
.cb-mc-person-row:hover { background:#f9fafb; }
.cb-mc-person-av { width:38px; height:38px; border-radius:50%; color:#fff; font-size:14px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
.cb-mc-person-av-img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
.cb-mc-person-main { flex:1; }
.cb-mc-person-name { font-size:13px; font-weight:600; color:#111827; display:block; }
.cb-mc-person-sub { font-size:11px; color:#6b7280; }
.cb-mc-person-row-acts { display:flex; gap:4px; }
.cb-mc-act { width:28px; height:28px; border-radius:6px; border:1.5px solid #e5e7eb; background:#f9fafb; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; color:#6b7280; }
.cb-mc-act--edit { border-color:#3b82f6; color:#3b82f6; background:#eff6ff; }
.cb-mc-act--edit:hover { background:#2563eb; color:#fff; border-color:#2563eb; }
.cb-mc-act--del { border-color:#ef4444; color:#ef4444; background:#fef2f2; }
.cb-mc-act--del:hover { background:#ef4444; color:#fff; }
/* Détail complet */
.cb-mc-detail { padding:16px; background:#f8fafc; border-top:2px solid #e2e8f0; border-radius:0 0 12px 12px; }
.cb-mc-detail-grid { display:flex; gap:16px; align-items:flex-start; }
.cb-mc-detail-photo { width:96px; height:96px; border-radius:10px; overflow:hidden; flex-shrink:0; border:2px solid #cbd5e1; box-shadow:0 2px 6px rgba(0,0,0,.08); }
.cb-mc-detail-photo img { width:100%; height:100%; object-fit:cover; }
.cb-mc-detail-fields { flex:1; display:grid; grid-template-columns:1fr 1fr; gap:0; }
.cb-mc-detail-row { display:flex; align-items:center; gap:0; padding:6px 10px; border-bottom:1px solid #f1f5f9; }
.cb-mc-detail-row:last-child { border-bottom:none; }
.cb-mc-detail-lbl { font-weight:800; color:#0f172a; font-size:11.5px; letter-spacing:.3px; min-width:95px; flex-shrink:0; text-transform:uppercase; font-size:10.5px; }
.cb-mc-detail-val { color:#1e293b; font-weight:500; font-size:12.5px; }
/* Formulaire édition */
.cb-mc-edit-form { padding:14px 16px; background:#eff6ff; border-top:1px solid #bfdbfe; }
.cb-mc-edit-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
.cb-mc-edit-actions { display:flex; gap:8px; justify-content:flex-end; }
/* Onglet 2 — créations */
.cb-mc-design-row { display:flex; align-items:center; gap:14px; padding:12px; border:1.5px solid #e5e7eb; border-radius:12px; transition:border-color .15s; }
.cb-mc-design-row:hover { border-color:#0d9488; }
.cb-mc-design-thumb { width:80px; height:54px; border-radius:8px; overflow:hidden; flex-shrink:0; background:#f3f4f6; display:flex; align-items:center; justify-content:center; }
.cb-mc-design-info { flex:1; display:flex; flex-direction:column; gap:2px; }
.cb-mc-design-name { font-size:13px; font-weight:700; color:#111827; }
.cb-mc-design-meta { font-size:11px; color:#0d9488; font-weight:600; }
.cb-mc-design-date { font-size:11px; color:#9ca3af; }
.cb-mc-design-count { font-size:11px; color:#6b7280; }
.cb-mc-design-acts { display:flex; gap:6px; align-items:center; flex-shrink:0; }
.cb-mc-prod-row { display:flex; align-items:flex-start; gap:14px; padding:14px 12px; border:1.5px solid #e5e7eb; border-radius:12px; transition:border-color .15s; background:#fff; }
.cb-mc-prod-row:hover { border-color:#0d9488; background:#f0fdf9; }
.cb-mc-prod-icon { width:42px; height:42px; border-radius:10px; background:#f0fdf9; border:1.5px solid #99f6e4; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.cb-mc-prod-info { flex:1; display:flex; flex-direction:column; gap:3px; }
.cb-mc-prod-name { font-size:13px; font-weight:700; color:#111827; }
.cb-mc-prod-meta { font-size:12px; color:#0d9488; font-weight:500; }
.cb-mc-prod-org { font-size:11px; color:#6b7280; }
.cb-mc-prod-persons { font-size:11px; color:#374151; font-style:italic; margin-top:2px; }
.cb-mc-prod-date { font-size:11px; color:#9ca3af; margin-top:2px; }
.cb-mc-prod-acts { display:flex; flex-direction:column; gap:6px; align-items:flex-end; flex-shrink:0; }
.cb-prod-filters-row { display:flex; gap:8px; margin-bottom:6px; }
.cb-prod-filter-item { flex:1; display:flex; flex-direction:column; gap:4px; }
.cb-prod-filter-item .cb-label { font-size:10px; }
.cb-prod-filter-item select:disabled { opacity:.5; cursor:not-allowed; }
.cb-prod-cats-block { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; margin-bottom:10px; }
.cb-prod-cat-item { display:flex; align-items:center; gap:8px; padding:6px 4px; cursor:pointer; border-radius:6px; transition:background .1s; }
.cb-prod-cat-item:hover { background:#f0fdf4; }
.cb-prod-cat-check { font-size:16px; color:#0d9488; flex-shrink:0; }
.cb-prod-cat-label { flex:1; font-size:12px; font-weight:600; color:#1e293b; }
.cb-prod-cat-count { font-size:11px; color:#6b7280; background:#e2e8f0; padding:1px 6px; border-radius:99px; }
.cb-prod-cat-group-hdr { display:flex; align-items:center; gap:8px; padding:6px 10px 4px; background:#f8fafc; border-top:1px solid #e2e8f0; margin-top:4px; cursor:pointer; }
.cb-prod-cat-group-hdr:first-child { margin-top:0; border-top:none; }
.cb-prod-grp-chk { display:flex; align-items:center; cursor:pointer; flex-shrink:0; }
.cb-prod-grp-chk-box { width:16px; height:16px; border-radius:4px; border:2px solid #d1d5db; background:#fff; display:flex; align-items:center; justify-content:center; transition:all .15s; flex-shrink:0; }
.cb-prod-grp-chk-box--checked { background:#0d9488; border-color:#0d9488; }
.cb-prod-grp-chk-box--partial { background:#6ee7b7; border-color:#0d9488; }
.cb-prod-cat-badge-sm { font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; background:#0d9488; color:#fff; }
.cb-prod-cat-grp-count { font-size:10px; color:#6b7280; }
.cb-mc-quickbar { display:flex; gap:8px; flex-wrap:wrap; padding-bottom:4px; border-bottom:1.5px solid #f1f5f9; margin-bottom:4px; }
.cb-mc-qbtn { display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; border:1.5px solid; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; }
.cb-mc-qbtn--ent { background:#eff6ff; border-color:#93c5fd; color:#1d4ed8; }
.cb-mc-qbtn--ent:hover { background:#dbeafe; border-color:#3b82f6; }
.cb-mc-qbtn--per { background:#f0fdf4; border-color:#86efac; color:#15803d; }
.cb-mc-qbtn--per:hover { background:#dcfce7; border-color:#22c55e; }

/* AI Suggest bar */
.cb-ai-suggest-bar { padding:10px 14px; background:#f5f3ff; border-bottom:1px solid #ddd6fe; display:flex; flex-direction:column; gap:8px; flex-shrink:0; }
.cb-ai-suggest-input { padding:8px 10px; border:1px solid #c4b5fd; border-radius:8px; font-size:12px; outline:none; background:#fff; color:#111; width:100%; box-sizing:border-box; }
.cb-ai-suggest-input::placeholder { color:#9ca3af; }
.cb-ai-suggest-input:focus { border-color:#7c3aed; }
.cb-ai-suggest-prompts { display:flex; flex-wrap:wrap; gap:5px; }
.cb-quick-prompt { font-size:10px; padding:3px 8px; border:1px solid #c4b5fd; border-radius:12px; background:#fff; color:#7c3aed; cursor:pointer; transition:all .15s; }
.cb-quick-prompt:hover { background:#7c3aed; color:#fff; }

/* Preview toolbar */
.cb-preview-toolbar { display:flex; align-items:center; gap:10px; padding:8px 14px; background:#fff; border-bottom:1px solid #e5e7eb; flex-shrink:0; }
.cb-zoom-wrap { display:flex; align-items:center; gap:8px; }
.cb-zoom-label { font-size:12px; color:#6b7280; min-width:48px; }
.cb-zoom-slider { width:90px; accent-color:#0d9488; }
.cb-preview-nav { display:flex; align-items:center; gap:8px; }
.cb-nav-btn { padding:3px 8px; border:1px solid #e5e7eb; border-radius:4px; background:#fff; cursor:pointer; font-size:12px; }
.cb-nav-btn:disabled { opacity:.4; }
.cb-nav-info { font-size:12px; color:#6b7280; }
.cb-reset-btn { padding:5px 10px; background:#f1f5f9; color:#374151; border:1px solid #e5e7eb; border-radius:6px; font-size:11px; cursor:pointer; }

/* Preview area */
.cb-preview-area { flex:1; display:flex; align-items:center; justify-content:center; overflow:auto; padding:24px; }
.cb-checkerboard { background-image:linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%); background-size:16px 16px; background-position:0 0,0 8px,8px -8px,-8px 0; background-color:#f3f4f6; padding:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; min-width:200px; min-height:200px; }
.cb-card-wrapper { transition:transform .2s; display:inline-block; }
.cb-preview-info { padding:8px 16px; background:#fff; border-top:1px solid #e5e7eb; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.cb-tpl-badge { background:#f0fdfa; color:#0d9488; border:1px solid #99f6e4; border-radius:20px; padding:3px 10px; font-size:11px; font-weight:600; }
.cb-tpl-size { font-size:11px; color:#9ca3af; }
.cb-edited-badge { background:#f5f3ff; color:#7c3aed; border:1px solid #c4b5fd; border-radius:20px; padding:3px 8px; font-size:11px; }
.cb-design-badge { background:#fefce8; color:#854d0e; border:1px solid #fde68a; border-radius:20px; padding:3px 8px; font-size:11px; }

/* Editor overlay */
.cb-editor-overlay { position:fixed; inset:0; z-index:9999; background:#fff; display:flex; flex-direction:column; }
.cb-editor-float-bar { display:flex; align-items:center; justify-content:space-between; padding:6px 16px; background:#1e1b4b; border-bottom:1px solid #312e81; flex-shrink:0; position:relative; z-index:10010; }
.cb-efb-left, .cb-efb-right { position:relative; }
.cb-efb-center { flex:1; text-align:center; }
.cb-efb-btn { background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.2); color:#e0e7ff; padding:5px 12px; border-radius:6px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:6px; }
.cb-efb-btn:hover { background:rgba(255,255,255,.25); }
.cb-efb-dropdown { position:absolute; top:36px; left:0; background:#fff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.2); min-width:280px; z-index:10020; }
.cb-efb-dd-title { padding:8px 12px; font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; border-bottom:1px solid #f1f5f9; }
.cb-efb-dd-item { padding:8px 12px; display:flex; align-items:center; gap:6px; }
.cb-efb-dd-item:hover { background:#f0fdfa; }
.cb-efb-dd-name { font-size:12px; font-weight:600; color:#111; display:block; }
.cb-efb-dd-meta { font-size:10px; color:#9ca3af; display:block; }
.cb-efb-dd-del { background:none; border:none; cursor:pointer; font-size:14px; padding:3px 5px; border-radius:4px; flex-shrink:0; opacity:.6; }
.cb-efb-dd-del:hover { background:#fee2e2; opacity:1; }
.cb-save-inline { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:10040; display:flex; align-items:center; justify-content:center; }
.cb-save-dialog { width:420px; background:#fff; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,.3); }

/* Overlays */
.cb-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:10030; display:flex; align-items:center; justify-content:center; padding:16px; }
.cb-modal-head { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid #e5e7eb; font-size:15px; font-weight:700; color:#111; flex-shrink:0; }
.cb-modal-close { background:none; border:none; font-size:18px; cursor:pointer; color:#ef4444; padding:2px 6px; border-radius:4px; transition:background .15s,color .15s; }
.cb-modal-close:hover { background:#fee2e2; color:#b91c1c; }
.cb-modal-foot { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-top:1px solid #e5e7eb; gap:8px; flex-shrink:0; }

/* Bulk modal */
.cb-bulk-modal { width:780px; max-width:96vw; max-height:90vh; background:#fff; border-radius:14px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.3); }
.cb-bulk-toolbar { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid #f1f5f9; flex-shrink:0; }
.cb-bulk-list { flex:1; overflow-y:auto; padding:12px 16px; display:flex; flex-direction:column; gap:8px; }
.cb-bulk-item { border:1.5px solid #e5e7eb; border-radius:10px; overflow:hidden; transition:border-color .15s; }
.cb-bulk-item:hover { border-color:#0d9488; }
.cb-bulk-item-hdr { display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:pointer; background:#fafafa; }
.cb-bulk-item-form { padding:14px 16px; border-top:1px solid #f1f5f9; background:#fff; display:flex; flex-direction:column; gap:10px; max-height:480px; overflow-y:auto; scroll-behavior:smooth; }
.cb-form-2col { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.cb-field-group { display:flex; flex-direction:column; gap:3px; }
.cb-input { padding:8px 10px; border:1px solid #d1d5db; border-radius:7px; font-size:13px; color:#111; outline:none; transition:border-color .15s; background:#fff; width:100%; box-sizing:border-box; }
.cb-input:focus { border-color:#0d9488; }
.cb-upload-zone { border:2px dashed #d1d5db; border-radius:8px; padding:8px; text-align:center; cursor:pointer; min-height:55px; display:flex; align-items:center; justify-content:center; transition:border-color .15s; background:#fafafa; }
.cb-upload-zone:hover { border-color:#0d9488; }
.cb-upload-zone--sm { min-height:42px; }
.cb-upload-hint { font-size:11px; color:#9ca3af; }
.cb-upload-preview { max-width:100%; max-height:60px; border-radius:4px; object-fit:cover; }
.cb-upload-preview-sm { max-width:100%; max-height:34px; border-radius:4px; object-fit:contain; }
.cb-person-row-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.cb-person-name { font-size:13px; font-weight:600; color:#111; }
.cb-person-titre { font-size:11px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cb-person-row-acts { display:flex; align-items:center; gap:4px; flex-shrink:0; }
.cb-row-act { background:none; border:1px solid transparent; cursor:pointer; font-size:14px; padding:5px 7px; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#6b7280; transition:all .12s; }
.cb-row-act:hover { background:#f1f5f9; border-color:#e5e7eb; color:#374151; }
.cb-row-act--del { color:#dc2626; }
.cb-row-act--del:hover { background:#fee2e2; border-color:#fca5a5; color:#b91c1c; }
.cb-person-chevron { font-size:12px; color:#9ca3af; transition:transform .2s; }
.cb-person-chevron.open { transform:rotate(180deg); }
.cb-person-avatar-ph { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#fff; flex-shrink:0; }
.cb-persons-empty { color:#9ca3af; font-size:13px; text-align:center; padding:30px; }
.cb-saved-persons-section { border-top:1px dashed #e5e7eb; padding-top:8px; margin-top:8px; }
.cb-saved-person-row { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; }
.cb-saved-person-row:hover { background:#f8fafc; }

/* ─────────────────── WIZARD PERSONNES ─────────────────── */
.cb-wiz-modal { width:860px; max-width:97vw; max-height:92vh; background:#fff; border-radius:16px; display:flex; flex-direction:column; box-shadow:0 24px 80px rgba(0,0,0,.28); overflow:hidden; }
.cb-wiz-head { background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%); color:#fff; padding:20px 24px 16px; flex-shrink:0; }
.cb-wiz-head-top { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
.cb-wiz-title { font-size:16px; font-weight:700; display:flex; align-items:center; }
.cb-wiz-subtitle { font-size:11px; color:#94a3b8; margin-top:3px; }
.cb-wiz-stepper { display:flex; align-items:center; gap:0; margin-bottom:10px; }
.cb-wiz-step { display:flex; align-items:center; gap:6px; }
.cb-wiz-step-dot { width:24px; height:24px; border-radius:50%; border:2px solid #475569; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#94a3b8; transition:all .25s; flex-shrink:0; }
.cb-wiz-step--active .cb-wiz-step-dot { background:#0d9488; border-color:#0d9488; color:#fff; box-shadow:0 0 0 3px rgba(13,148,136,.25); }
.cb-wiz-step--done .cb-wiz-step-dot { background:#10b981; border-color:#10b981; color:#fff; }
.cb-wiz-step-lbl { font-size:10px; color:#64748b; white-space:nowrap; transition:color .25s; }
.cb-wiz-step--active .cb-wiz-step-lbl { color:#e2e8f0; }
.cb-wiz-step--done .cb-wiz-step-lbl { color:#10b981; }
.cb-wiz-step-bar { flex:1; height:2px; background:#334155; margin:0 6px; min-width:12px; transition:background .25s; }
.cb-wiz-step-bar--done { background:#10b981; }
.cb-wiz-progress { height:3px; background:#334155; border-radius:2px; overflow:hidden; margin-top:4px; }
.cb-wiz-progress-fill { height:100%; background:linear-gradient(90deg,#0d9488,#10b981); border-radius:2px; transition:width .4s ease; }
/* Bandeau quick-add */
.cb-wiz-quickadd-banner { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 12px; background:rgba(13,148,136,.12); border:1px solid rgba(13,148,136,.3); border-radius:8px; margin-top:10px; flex-wrap:wrap; }
.cb-wiz-qa-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.cb-wiz-qa-chip { display:flex; align-items:center; font-size:11px; font-weight:600; padding:3px 8px; border-radius:12px; }
.cb-wiz-qa-chip--cat    { background:#dbeafe; color:#1d4ed8; }
.cb-wiz-qa-chip--ent    { background:#dcfce7; color:#166534; }
.cb-wiz-qa-chip--design { background:#fef9c3; color:#854d0e; }
.cb-wiz-qa-reset { display:flex; align-items:center; font-size:11px; color:#94a3b8; background:none; border:1px solid #475569; border-radius:6px; padding:3px 8px; cursor:pointer; white-space:nowrap; }
.cb-wiz-qa-reset:hover { color:#fff; background:#475569; }

.cb-wiz-body { flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:16px; }
.cb-wiz-foot { display:flex; align-items:center; justify-content:space-between; padding:14px 24px; border-top:1px solid #e5e7eb; flex-shrink:0; background:#fafafa; }

.cb-wiz-intro { display:flex; align-items:center; gap:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; }
.cb-wiz-intro-icon { font-size:28px; flex-shrink:0; }
.cb-wiz-intro-title { font-size:14px; font-weight:700; color:#111; margin-bottom:3px; }
.cb-wiz-intro-desc { font-size:12px; color:#6b7280; line-height:1.5; }

.cb-wiz-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:40px; color:#9ca3af; font-size:13px; background:#fafafa; border-radius:12px; border:2px dashed #e5e7eb; text-align:center; }

/* Étape 1 — Catégories */
.cb-wiz-cat-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.cb-wiz-cat-card { position:relative; border:2px solid #e5e7eb; border-radius:14px; padding:20px 18px; cursor:pointer; transition:all .2s; background:#fff; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; }
.cb-wiz-cat-card:hover { border-color:var(--cat-color,#0d9488); box-shadow:0 4px 16px rgba(0,0,0,.08); transform:translateY(-2px); }
.cb-wiz-cat-card--sel { border-color:var(--cat-color,#0d9488)!important; background:color-mix(in srgb, var(--cat-color,#0d9488) 6%, white); box-shadow:0 4px 20px rgba(0,0,0,.12); transform:translateY(-2px); }
.cb-wiz-cat-icon { width:64px; height:64px; border-radius:16px; display:flex; align-items:center; justify-content:center; }
.cb-wiz-cat-name { font-size:15px; font-weight:700; color:#111; }
.cb-wiz-cat-desc { font-size:12px; color:#6b7280; }
.cb-wiz-cat-check { position:absolute; top:10px; right:10px; width:22px; height:22px; background:var(--cat-color,#0d9488); border-radius:50%; display:flex; align-items:center; justify-content:center; }

/* Étape 2 — Designs */
.cb-wiz-designs-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:12px; }
.cb-wiz-design-card { position:relative; border:2px solid #e5e7eb; border-radius:10px; overflow:hidden; cursor:pointer; transition:all .2s; background:#f8fafc; }
.cb-wiz-design-card:hover { border-color:#0d9488; box-shadow:0 3px 12px rgba(0,0,0,.1); }
.cb-wiz-design-card--sel { border-color:#0d9488; box-shadow:0 0 0 3px rgba(13,148,136,.2); }
.cb-wiz-design-thumb { width:100%; padding-top:140%; position:relative; overflow:hidden; background:#f0f4f8; }
.cb-wiz-design-thumb--horiz { padding-top:75%; }
.cb-wiz-design-thumb-inner { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.cb-wiz-design-thumb-inner > * { transform:scale(.28); transform-origin:center; }
.cb-wiz-design-name { font-size:11px; font-weight:600; color:#374151; padding:6px 8px; text-align:center; background:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cb-wiz-design-check { position:absolute; top:6px; right:6px; width:20px; height:20px; background:#0d9488; border-radius:50%; display:flex; align-items:center; justify-content:center; }

/* Étape 3 — Entreprises */
.cb-wiz-ents-grid { display:flex; flex-direction:column; gap:10px; }
.cb-wiz-ent-card { display:flex; align-items:center; gap:12px; border:2px solid #e5e7eb; border-radius:12px; padding:12px 14px; cursor:pointer; transition:all .2s; background:#fff; position:relative; }
.cb-wiz-ent-card:hover { border-color:#0d9488; background:#f0fdfa; }
.cb-wiz-ent-card--sel { border-color:#0d9488; background:#f0fdfa; box-shadow:0 0 0 3px rgba(13,148,136,.15); }
.cb-wiz-ent-card--new:hover { border-color:#16a34a; background:#f0fdf4; }
.cb-wiz-ent-logo { width:44px; height:44px; border-radius:8px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; border:1px solid #e5e7eb; }
.cb-wiz-ent-info { flex:1; min-width:0; }
.cb-wiz-ent-name { font-size:13px; font-weight:700; color:#111; }
.cb-wiz-ent-sub { font-size:11px; color:#6b7280; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cb-wiz-ent-palette { display:flex; gap:4px; align-items:center; }
.cb-wiz-ent-check { width:22px; height:22px; background:#0d9488; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

/* Étape 4 — Personnes */
.cb-wiz-persons-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.cb-wiz-persons-list { display:flex; flex-direction:column; gap:10px; }
.cb-wiz-person-item { border:2px solid #e5e7eb; border-radius:12px; overflow:hidden; transition:border-color .15s; }
.cb-wiz-person-hdr { display:flex; align-items:center; gap:10px; padding:12px 14px; cursor:pointer; background:#fafafa; transition:background .12s; }
.cb-wiz-person-hdr:hover { background:#f1f5f9; }
.cb-wiz-person-avatar { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#fff; flex-shrink:0; overflow:hidden; }
.cb-wiz-person-hdr-info { flex:1; min-width:0; }
.cb-wiz-person-form { padding:16px; border-top:1px solid #f1f5f9; background:#fff; display:flex; flex-direction:column; gap:10px; }
.cb-wiz-form-section { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:#7c3aed; padding:6px 0 4px; border-bottom:1px solid #f3f4f6; margin-top:4px; }
.cb-wiz-photo-zone { width:64px; height:64px; border-radius:50%; border:2px dashed #d1d5db; cursor:pointer; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; transition:border-color .15s; background:#f8fafc; }
.cb-wiz-photo-zone:hover { border-color:#0d9488; }

/* Étape 5 — Résumé */
.cb-wiz-recap-session { display:flex; gap:12px; flex-wrap:wrap; background:#f0fdfa; border:1px solid #99f6e4; border-radius:10px; padding:12px 16px; }
.cb-wiz-recap-meta { display:flex; flex-direction:column; gap:2px; min-width:120px; }
.cb-wiz-recap-meta span { font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:.5px; }
.cb-wiz-recap-meta strong { font-size:13px; color:#111; }
.cb-wiz-recap-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; }
.cb-wiz-recap-card { border:1.5px solid #e5e7eb; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; }
.cb-wiz-recap-card-head { height:60px; display:flex; align-items:center; justify-content:center; }
.cb-wiz-recap-avatar { width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,.25); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; overflow:hidden; }
.cb-wiz-recap-card-body { padding:10px 12px; flex:1; }
.cb-wiz-recap-name { font-size:13px; font-weight:700; color:#111; margin-bottom:2px; }
.cb-wiz-recap-role { font-size:11px; color:#6b7280; margin-bottom:6px; }
.cb-wiz-recap-detail { font-size:11px; color:#374151; background:#f8fafc; border-radius:4px; padding:2px 6px; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cb-wiz-recap-edit { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:#0d9488; background:none; border:none; border-top:1px solid #f1f5f9; cursor:pointer; padding:8px 12px; width:100%; justify-content:center; transition:background .12s; }
.cb-wiz-recap-edit:hover { background:#f0fdfa; }

/* Dot stepper in footer */
.cb-wiz-dot { width:8px; height:8px; border-radius:50%; background:#d1d5db; transition:all .2s; }
.cb-wiz-dot--active { background:#0d9488; transform:scale(1.3); }
.cb-wiz-dot--done { background:#10b981; }

/* Production modal */
.cb-prod-modal { width:940px; max-width:96vw; max-height:88vh; background:#fff; border-radius:14px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.3); }
.cb-prod-body { display:flex; flex:1; overflow:hidden; }
.cb-prod-col { flex:1; overflow-y:auto; padding:16px; border-right:1px solid #f1f5f9; display:flex; flex-direction:column; gap:10px; }
.cb-prod-col:last-child { border-right:none; }
.cb-prod-section-title { font-size:12px; font-weight:700; color:#4b5563; text-transform:uppercase; letter-spacing:.6px; margin-bottom:6px; }
.cb-prod-designs-list { display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto; }
.cb-prod-design-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border:1.5px solid #e5e7eb; border-radius:8px; cursor:pointer; transition:all .15s; }
.cb-prod-design-item:hover, .cb-prod-design-item--selected { border-color:#0d9488; background:#f0fdfa; }
.cb-prod-design-radio { font-size:16px; color:#0d9488; }
.cb-prod-design-info { display:flex; flex-direction:column; gap:2px; }
.cb-prod-persons-toolbar { display:flex; align-items:center; justify-content:space-between; }
.cb-expand-all-btn { font-size:11px; color:#0d9488; background:none; border:none; cursor:pointer; }
.cb-prod-persons-list { display:flex; flex-direction:column; gap:4px; overflow-y:auto; max-height:280px; }
.cb-prod-person-item { display:flex; align-items:center; gap:8px; padding:7px 10px; border:1px solid #e5e7eb; border-radius:7px; cursor:pointer; transition:all .15s; }
.cb-prod-person-item:hover, .cb-prod-person-item--selected { border-color:#0d9488; background:#f0fdfa; }
.cb-prod-person-check { font-size:16px; color:#0d9488; flex-shrink:0; }
.cb-prod-person-info { display:flex; flex-direction:column; gap:1px; flex:1; }

/* Workspace */
.cb-workspace-modal { width:680px; max-width:95vw; max-height:82vh; background:#fff; border-radius:14px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.3); }
.cb-ws-body { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }
.cb-ws-loading, .cb-ws-empty { text-align:center; padding:30px; color:#9ca3af; font-size:13px; }
.cb-ws-item { display:flex; align-items:center; gap:14px; padding:12px 14px; border:1px solid #e5e7eb; border-radius:10px; transition:border-color .15s; }
.cb-ws-item:hover { border-color:#0d9488; background:#fafff9; }
.cb-ws-thumb { overflow:hidden; border-radius:6px; border:1px solid #e5e7eb; background:#f9fafb; flex-shrink:0; box-shadow:0 2px 6px rgba(0,0,0,.08); }
.cb-ws-thumb--vert { width:52px; height:82px; }
.cb-ws-thumb--horiz { width:82px; height:52px; }
.cb-ws-thumb--vert .cb-ws-thumb-inner { width:204px; height:322px; transform:scale(0.255); transform-origin:top left; pointer-events:none; }
.cb-ws-thumb--horiz .cb-ws-thumb-inner { width:321px; height:204px; transform:scale(0.255); transform-origin:top left; pointer-events:none; }
.cb-ws-info { flex:1; display:flex; flex-direction:column; gap:3px; min-width:0; }
.cb-ws-name { font-size:14px; font-weight:600; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cb-ws-meta { font-size:12px; color:#6b7280; }
.cb-ws-date { font-size:11px; color:#9ca3af; }
.cb-ws-acts { display:flex; align-items:center; gap:8px; flex-shrink:0; }

/* ── Modal Société multistep ── */
.cb-ent-modal { width:680px; max-width:96vw; max-height:90vh; background:#fff; border-radius:16px; display:flex; flex-direction:column; box-shadow:0 24px 64px rgba(0,0,0,.35); overflow:hidden; }

/* En-tête */
.cb-ent-head { background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%); padding:20px 24px 0; flex-shrink:0; }
.cb-ent-head-top { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
.cb-ent-head-title { font-size:16px; font-weight:700; color:#fff; }
.cb-ent-head-sub { font-size:12px; color:#a5b4fc; margin-top:3px; }
.cb-ent-head .cb-modal-close { color:#c7d2fe; background:rgba(255,255,255,.1); border:none; }
.cb-ent-head .cb-modal-close:hover { background:rgba(255,255,255,.2); color:#fff; }

/* Stepper */
.cb-ent-stepper { display:flex; align-items:center; gap:0; margin-bottom:16px; }
.cb-ent-step { display:flex; align-items:center; gap:7px; flex-shrink:0; }
.cb-ent-step-dot { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; background:rgba(255,255,255,.15); color:#c7d2fe; border:2px solid rgba(255,255,255,.2); transition:all .2s; flex-shrink:0; }
.cb-ent-step--active .cb-ent-step-dot { background:#fff; color:#312e81; border-color:#fff; }
.cb-ent-step--done .cb-ent-step-dot { background:#4ade80; color:#fff; border-color:#4ade80; }
.cb-ent-step-label { font-size:11px; font-weight:600; color:rgba(255,255,255,.5); white-space:nowrap; }
.cb-ent-step--active .cb-ent-step-label { color:#e0e7ff; }
.cb-ent-step--done .cb-ent-step-label { color:#86efac; }
.cb-ent-step-line { flex:1; height:2px; background:rgba(255,255,255,.15); margin:0 8px; transition:background .3s; }
.cb-ent-step-line--done { background:#4ade80; }

/* Progress bar */
.cb-ent-progress { height:3px; background:rgba(255,255,255,.1); border-radius:0; }
.cb-ent-progress-fill { height:100%; background:linear-gradient(90deg,#6366f1,#a78bfa); transition:width .4s cubic-bezier(.4,0,.2,1); border-radius:0 2px 2px 0; }

/* Corps */
.cb-ent-body { flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:14px; }

/* Intro étape */
.cb-ent-step-intro { display:flex; align-items:center; gap:14px; background:#f5f3ff; border:1px solid #ede9fe; border-radius:10px; padding:14px 16px; }
.cb-ent-step-icon { font-size:28px; flex-shrink:0; }
.cb-ent-step-name { font-size:15px; font-weight:700; color:#312e81; }
.cb-ent-step-desc { font-size:12px; color:#6b7280; margin-top:2px; }
.cb-ent-subsection { font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.8px; padding-bottom:6px; border-bottom:1px solid #f1f5f9; margin-top:4px; }

/* Upload grid (step 4) */
.cb-ent-upload-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.cb-ent-upload-card { display:flex; flex-direction:column; gap:8px; position:relative; }
.cb-ent-upload-lbl { font-size:12px; font-weight:600; color:#4b5563; }
.cb-ent-upload-zone { border:2px dashed #d1d5db; border-radius:10px; min-height:100px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s; background:#fafafa; overflow:hidden; }
.cb-ent-upload-zone:hover { border-color:#7c3aed; background:#f5f3ff; }
.cb-ent-upload-img { max-width:100%; max-height:100px; object-fit:contain; padding:8px; }
.cb-ent-upload-ph { display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px; }
.cb-ent-upload-ph span { font-size:11px; color:#9ca3af; text-align:center; }
.cb-ent-upload-clear { position:absolute; top:30px; right:6px; background:#fee2e2; border:none; border-radius:50%; width:22px; height:22px; font-size:10px; cursor:pointer; color:#dc2626; display:flex; align-items:center; justify-content:center; }

/* Couleurs preview */
.cb-ent-color-preview { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#f9fafb; border-radius:8px; border:1px solid #f1f5f9; }
.cb-ent-color-swatch { width:36px; height:36px; border-radius:8px; border:2px solid rgba(0,0,0,.08); }

/* Résumé final */
.cb-ent-summary { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:8px; }
.cb-ent-summary-title { font-size:12px; font-weight:700; color:#166534; text-transform:uppercase; letter-spacing:.6px; margin-bottom:2px; }
.cb-ent-summary-row { display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#374151; border-bottom:1px solid rgba(0,0,0,.04); padding-bottom:6px; }
.cb-ent-summary-row:last-child { border-bottom:none; padding-bottom:0; }
.cb-ent-summary-row span { color:#6b7280; }
.cb-ent-summary-row strong { color:#111; font-weight:600; }

/* Pied de page navigation */
.cb-ent-foot { display:flex; align-items:center; justify-content:space-between; padding:14px 24px; border-top:1px solid #e5e7eb; background:#fafafa; flex-shrink:0; }
.cb-ent-dot { width:8px; height:8px; border-radius:50%; background:#e5e7eb; transition:all .2s; }
.cb-ent-dot--active { background:#7c3aed; transform:scale(1.3); }
.cb-ent-dot--done { background:#4ade80; }

/* Chatbot */
.cb-chatbot-modal { width:580px; max-width:95vw; max-height:82vh; background:#fff; border-radius:14px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.3); }
.cb-chat-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; min-height:0; max-height:380px; }
.cb-chat-empty { text-align:center; color:#9ca3af; font-size:13px; padding:20px; }
.cb-chat-quick { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; justify-content:center; }
.cb-chat-msg { display:flex; flex-direction:column; gap:4px; max-width:85%; }
.cb-chat-msg--user { align-self:flex-end; align-items:flex-end; }
.cb-chat-msg--ai { align-self:flex-start; }
.cb-chat-role { font-size:10px; color:#9ca3af; font-weight:600; }
.cb-chat-content { background:#f1f5f9; padding:8px 12px; border-radius:8px; font-size:13px; color:#111; white-space:pre-wrap; }
.cb-chat-msg--user .cb-chat-content { background:#0d9488; color:#fff; }
.cb-apply-btn { font-size:10px; color:#0d9488; background:none; border:none; cursor:pointer; padding:2px 0; }
.cb-chat-input-row { display:flex; gap:8px; padding:12px 16px; border-top:1px solid #e5e7eb; flex-shrink:0; }
.cb-chat-input { flex:1; padding:8px 12px; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; outline:none; color:#111; background:#fff; }
.cb-chat-input::placeholder { color:#9ca3af; }
.cb-chat-input:focus { border-color:#0d9488; }
.cb-chat-send { padding:8px 16px; background:#0d9488; color:#fff; border:none; border-radius:8px; font-size:13px; cursor:pointer; font-weight:600; }

/* Config IA */
.cb-config-modal { width:480px; max-width:95vw; background:#fff; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.3); }
.cb-ai-cfg-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }

/* Toast */
.cb-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(80px); background:#111; color:#fff; padding:10px 20px; border-radius:8px; font-size:13px; z-index:10000; transition:transform .3s; pointer-events:none; }
.cb-toast--show { transform:translateX(-50%) translateY(0); }
  `]
})
export class CardBuilderComponent implements OnInit {

  @ViewChild('bulkCsvRef') bulkCsvRef!: ElementRef<HTMLInputElement>;

  categories = CATEGORIES;
  templates  = TEMPLATES;
  accessTypeGroups = ACCESS_TYPES;
  aiQuickPrompts = [
    'Badge VIP festival musique Paris été 2025',
    'Badge manager senior TechCorp',
    'Carte scolaire lycée international',
    'Carte visite consultant indépendant',
  ];
  steps = ['Catégorie','Template','Designer','Personnes','Produire'];

  currentStep = 1;
  selectedCategory = 'badge-identite';
  selectedTemplate = 't01';
  sharedCouleur1 = '#1565c0';
  sharedCouleur2 = '#ffd600';

  zoom = 100;
  currentPersonIndex = 0;
  previewHtml: SafeHtml = '';

  editorOpen = false;
  editorBaseHtml = '';
  editorWidth = 204;
  editorHeight = 322;
  savedEditorObjects: DesignObject[] = [];
  editedCardHtml: string | null = null;
  currentDesign: SavedDesign | null = null;
  showDesignerCreations = false;

  showSaveDialog = false;
  designName = '';
  savingDesign = false;

  workspaceOpen = false;
  savedDesigns: SavedDesign[] = [];
  workspaceLoading = false;

  /* ── Mes Cartes ───────────────────────────────────────────────────── */
  myCardsOpen = false;
  myCardsTab = 1;
  myCardsExpandedEnts = new Set<string>();
  myCardsExpandedCats = new Set<string>();
  myCardsExpandedPersons = new Set<string>();
  myCardsEditPersonId: string | null = null;
  myCardsEditDraft: Partial<CardPerson> = {};
  myCardsPdfLoading: string | null = null;
  myCardsClasseFilter = new Map<string, string>();
  prodHistory: ProdRecord[] = [];

  private slugify(s: string): string {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  mcSetClasseFilter(filterKey: string, classe: string): void {
    const m = new Map(this.myCardsClasseFilter);
    if (classe) m.set(filterKey, classe); else m.delete(filterKey);
    this.myCardsClasseFilter = m;
    this.cdr.detectChanges();
  }

  mcClasseCount(persons: CardPerson[], classe: string): number {
    return persons.filter(p => p.classe === classe).length;
  }

  get personsByEntrepriseGrouped() {
    const entMap = new Map<string, Map<string, CardPerson[]>>();
    for (const p of this.savedPersonsList) {
      const ent = p.entreprise || p.organisationParticipant || p.etablissementScolaire || 'Sans organisation';
      const cat = p.category || 'AUTRE';
      if (!entMap.has(ent)) entMap.set(ent, new Map());
      const catMap = entMap.get(ent)!;
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(p);
    }
    return Array.from(entMap.entries()).map(([entKey, catMap]) => ({
      entKey,
      totalPersons: Array.from(catMap.values()).reduce((s, ps) => s + ps.length, 0),
      groups: Array.from(catMap.entries()).map(([catKey, persons]) => {
        const isScol = catKey === 'CARTE_SCOLAIRE';
        const isEvt  = catKey === 'BADGE_EVENEMENT';
        const hasSubGroups = isScol || isEvt;

        let subGroups: {
          sgKey: string; filterKey: string; subLabel: string;
          allPersons: CardPerson[]; filteredPersons: CardPerson[];
          availableClasses: string[]; selectedClasse: string;
          hints: { anneeScolaire?: string; etablissementScolaire?: string; titreEvenement?: string };
        }[] = [];

        if (isScol) {
          const sgMap = new Map<string, CardPerson[]>();
          for (const p of persons) {
            const annee = p.anneeScolaire || 'Année ?';
            const ets   = p.etablissementScolaire || entKey;
            const sgKey = `${annee}|||${ets}`;
            if (!sgMap.has(sgKey)) sgMap.set(sgKey, []);
            sgMap.get(sgKey)!.push(p);
          }
          subGroups = Array.from(sgMap.entries()).map(([sgKey, sgPersons]) => {
            const [annee, ets] = sgKey.split('|||');
            const filterKey = `${entKey}|||${catKey}|||${this.slugify(sgKey)}`;
            const selectedClasse = this.myCardsClasseFilter.get(filterKey) || '';
            const availableClasses = [...new Set(sgPersons.map(p => p.classe).filter(Boolean))] as string[];
            const filteredPersons = selectedClasse ? sgPersons.filter(p => p.classe === selectedClasse) : sgPersons;
            return { sgKey, filterKey, subLabel: `${annee}  ·  ${ets}`, allPersons: sgPersons, filteredPersons, availableClasses, selectedClasse, hints: { anneeScolaire: annee, etablissementScolaire: ets } };
          });
        } else if (isEvt) {
          const sgMap = new Map<string, CardPerson[]>();
          for (const p of persons) {
            const evtName = p.titreEvenement || 'Événement ?';
            if (!sgMap.has(evtName)) sgMap.set(evtName, []);
            sgMap.get(evtName)!.push(p);
          }
          subGroups = Array.from(sgMap.entries()).map(([evtName, sgPersons]) => {
            const filterKey = `${entKey}|||${catKey}|||${this.slugify(evtName)}`;
            return { sgKey: this.slugify(evtName), filterKey, subLabel: evtName, allPersons: sgPersons, filteredPersons: sgPersons, availableClasses: [], selectedClasse: '', hints: { titreEvenement: evtName } };
          });
        }

        return { catKey, catLabel: this.mcCatLabel(catKey), persons, hasSubGroups, subGroups };
      })
    }));
  }

  get personsByEntreprise(): { key: string; persons: CardPerson[] }[] {
    const map = new Map<string, CardPerson[]>();
    for (const p of this.savedPersonsList) {
      const key = p.entreprise || p.organisationParticipant || p.etablissementScolaire || 'Sans organisation';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).map(([key, persons]) => ({ key, persons }));
  }

  mcCatLabel(cat?: string): string {
    return ({
      'BADGE_IDENTITE':  'Badge Identité',
      'CARTE_VISITE':    'Carte de Visite',
      'BADGE_EVENEMENT': 'Badge Événement',
      'CARTE_SCOLAIRE':  'Carte Scolaire',
    } as Record<string,string>)[cat||''] || cat || '—';
  }

  mcPersonsForDesign(d: SavedDesign): CardPerson[] {
    const byId = this.savedPersonsList.filter(p => p.cardDesignId === d.id);
    return byId.length > 0 ? byId : this.savedPersonsList.filter(p => p.category === d.category);
  }

  mcAvatarColor(p: CardPerson): string {
    const colors = ['#2563eb','#7c3aed','#0d9488','#ea580c','#16a34a','#db2777'];
    const idx = (p.nom||'').charCodeAt(0) % colors.length;
    return colors[idx];
  }

  bulkModalOpen = false;
  bulkDrafts: CardPerson[] = [];
  expandedBulkIdx = new Set<number>();
  savedPersonsList: CardPerson[] = [];
  savedEntreprises: CardEntreprise[] = [];
  entrepriseModalOpen = false;
  savingEntreprise = false;
  loadingEntreprises = false;
  newEntreprise: Partial<CardEntreprise> = { raisonSocial: '' };
  entStep = 1;
  readonly ENT_STEPS = [
    { label: 'Identité légale',   icon: '🏛' },
    { label: 'Contact & Lieu',    icon: '📍' },
    { label: 'Activité & Équipe', icon: '💼' },
    { label: 'Visuels',           icon: '🎨' },
  ];
  savingPersons = false;

  /* ── Wizard Personnes multi-step ─────────────────────────────────── */
  wizOpen = false;
  wizStep = 1;           // 1=catégorie 2=création 3=société 4=personnes 5=résumé
  wizCategory = '';
  wizDesign: SavedDesign | null = null;
  wizEntreprise: CardEntreprise | null = null;
  wizPersons: CardPerson[] = [];
  wizExpandedIdx = new Set<number>();
  wizSaving = false;
  wizQuickAdd = false;   // true quand ouvert depuis "+" d'un groupe existant (contexte pré-rempli)
  wizEditPersonId: string | null = null;  // non-null = mode édition d'une personne existante

  readonly WIZARD_CATEGORIES = [
    { value:'BADGE_IDENTITE',  label:'Badge Identité',   desc:'Employés, membres, agents',     color:'#2563eb', grad:'linear-gradient(135deg,#1e40af,#2563eb)' },
    { value:'CARTE_VISITE',    label:'Carte de Visite',  desc:'Professionnels, freelances',    color:'#7c3aed', grad:'linear-gradient(135deg,#5b21b6,#7c3aed)' },
    { value:'BADGE_EVENEMENT', label:'Badge Événement',  desc:'Conférences, salons, fêtes',    color:'#0d9488', grad:'linear-gradient(135deg,#0f766e,#0d9488)' },
    { value:'CARTE_SCOLAIRE',  label:'Carte Scolaire',   desc:'Élèves, étudiants, personnel',  color:'#ea580c', grad:'linear-gradient(135deg,#c2410c,#ea580c)' },
  ];
  readonly ACCESS_TYPES2 = ['EMPLOYE','DIRECTEUR','DIRECTRICE','MANAGER','RH','SECURITE','INFORMATIQUE','VIP','VISITEUR','INVITE','SPEAKER','STAFF','EXPOSANT','PRESSE','SPONSOR','BENEVOLE'];
  readonly TYPE_APPRENANTS = ['ELEVE','ETUDIANT','APPRENANT','APPRENTI','STAGIAIRE','ENSEIGNANT','ADMINISTRATION'];
  readonly NIVEAUX_SCOLAIRES = ['CP','CE1','CE2','CM1','CM2','6ème','5ème','4ème','3ème','2nde','1ère','Terminale','L1','L2','L3','M1','M2','Doctorat','BTS','DUT','Licence Pro'];
  readonly TYPE_ETABS = ['PRIMAIRE','SECONDAIRE','LYCEE','UNIVERSITE','FORMATION_PRO','GRANDE_ECOLE'];

  productionModalOpen = false;
  prodFilterCategory = '';
  prodFilterEntreprise = '';
  prodFilterCatDropdown = '';
  prodFilteredDesigns: SavedDesign[] = [];
  prodFilteredPersons: CardPerson[] = [];
  prodAllPersonsForEnt: CardPerson[] = [];
  prodCategoriesForEnt: { cat: string; label: string; count: number; checked: boolean }[] = [];
  prodEntreprises: string[] = [];
  prodSelectedDesignId = '';
  prodSelectedPersonIds = new Set<string>();
  prodPaperSize = 'a4';
  prodOrientation = 'portrait';
  prodCopies = 1;
  pdfLoading = false;

  aiProviders: any[] = [];
  aiConfig: Record<string, string> = {};
  showAiConfigModal = false;
  showChatbotModal = false;
  chatMessages: Array<{role:string; content:string}> = [];
  chatInput = '';
  aiChatLoading = false;
  showAiSuggest = false;
  aiSuggestPrompt = '';
  aiSuggestLoading = false;
  aiBatchLoading = false;

  toastMsg = ''; toastVisible = false;
  private toastTimer: any;

  constructor(
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  private async authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.auth.getToken();
    const headers = new Headers((options.headers as Record<string, string>) || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(url, { ...options, credentials: 'include', headers });
    if (res.status === 401 || res.status === 403) {
      this.auth.logout('/auth');
    }
    return res;
  }

  ngOnInit(): void {
    this.loadAiProviders();
    this.loadWorkspace();
    this.loadPersons();
    this.refreshPreview();
  }

  get filteredTemplates(): CardTemplate[] { return this.templates.filter(t => t.category === this.selectedCategory); }
  get selectedTemplateObj(): CardTemplate | undefined { return this.templates.find(t => t.id === this.selectedTemplate); }
  get activeCategoryLabel(): string { return this.categories.find(c => c.id === this.selectedCategory)?.label || ''; }

  get prodPersonsByCatGroup(): { cat: string; label: string; persons: CardPerson[] }[] {
    if (!this.prodFilterEntreprise) return [];
    const map = new Map<string, CardPerson[]>();
    for (const p of this.prodFilteredPersons) {
      const k = p.category || 'AUTRE';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries()).map(([cat, persons]) => ({ cat, label: this.mcCatLabel(cat), persons }));
  }
  get activeCategoryEnum(): string { return this.categories.find(c => c.id === this.selectedCategory)?.catEnum || ''; }
  get zoomFactor(): number { return this.zoom / 100; }
  get previewPersons(): CardPerson[] { return this.savedPersonsList.length > 0 ? this.savedPersonsList : [DEFAULT_PERSON]; }

  selectCategory(id: string): void {
    this.selectedCategory = id;
    const first = this.filteredTemplates[0];
    if (first) this.selectedTemplate = first.id;
    this.currentStep = Math.max(this.currentStep, 1);
    this.refreshPreview();
  }

  selectTemplate(id: string): void {
    this.selectedTemplate = id;
    this.editedCardHtml = null;
    this.savedEditorObjects = [];
    this.currentDesign = null;
    this.currentStep = Math.max(this.currentStep, 2);
    this.refreshPreview();
  }

  goStep(s: number): void { if (s <= this.currentStep) this.currentStep = s; }

  refreshPreview(): void {
    const p = this.previewPersons[this.currentPersonIndex] ?? DEFAULT_PERSON;
    const cd = personToCardData({ ...p, couleur1: this.sharedCouleur1, couleur2: this.sharedCouleur2 });
    const baseHtml = this.editedCardHtml || this.renderCard(cd);
    const overlayHtml = this.savedEditorObjects?.length
      ? this.renderEditorObjects(this.savedEditorObjects)
      : '';
    const fullHtml = overlayHtml
      ? `<div style="position:relative;width:100%;height:100%;">${baseHtml}${overlayHtml}</div>`
      : baseHtml;
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(fullHtml);
    this.cdr.detectChanges();
  }

  renderCard(cd: CardData): string {
    const tpl = this.templates.find(t => t.id === this.selectedTemplate);
    return tpl ? tpl.render(cd) : '';
  }

  getThumbnail(tpl: CardTemplate): SafeHtml {
    const cd = personToCardData({ ...DEFAULT_PERSON, couleur1: this.sharedCouleur1, couleur2: this.sharedCouleur2 });
    return this.sanitizer.bypassSecurityTrustHtml(tpl.render(cd));
  }

  getDesignPreviewHtml(d: SavedDesign): SafeHtml {
    if (d.editedHtml) return this.sanitizer.bypassSecurityTrustHtml(d.editedHtml);
    const tpl = TEMPLATES.find(t => t.id === d.templateId);
    if (!tpl) return this.sanitizer.bypassSecurityTrustHtml('');
    const cd = personToCardData({ ...DEFAULT_PERSON, couleur1: this.sharedCouleur1, couleur2: this.sharedCouleur2 });
    return this.sanitizer.bypassSecurityTrustHtml(tpl.render(cd));
  }

  isDesignVertical(d: SavedDesign): boolean {
    return TEMPLATES.find(t => t.id === d.templateId)?.isVertical ?? true;
  }

  prevCard(): void { if (this.currentPersonIndex > 0) { this.currentPersonIndex--; this.refreshPreview(); } }
  nextCard(): void { if (this.currentPersonIndex < this.previewPersons.length - 1) { this.currentPersonIndex++; this.refreshPreview(); } }
  stopProp(e: Event): void { e.stopPropagation(); }

  openEditor(): void {
    const p = this.previewPersons[this.currentPersonIndex] ?? DEFAULT_PERSON;
    const cd = personToCardData({ ...p, couleur1: this.sharedCouleur1, couleur2: this.sharedCouleur2 });
    // Use manually-edited HTML if present, else re-render from template (don't use full saved HTML with overlay wrapper)
    this.editorBaseHtml = this.editedCardHtml || this.renderCard(cd);
    const tpl = this.selectedTemplateObj;
    this.editorWidth  = tpl?.isVertical ? 204 : 321;
    this.editorHeight = tpl?.isVertical ? 322 : 204;
    this.showDesignerCreations = false;
    this.editorOpen = true;
    this.currentStep = Math.max(this.currentStep, 3);
  }

  closeEditor(): void { this.editorOpen = false; }

  onEditorSaved(result: DesignEditorResult): void {
    this.editedCardHtml = result.html;
    this.savedEditorObjects = result.objects || [];
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(this.editedCardHtml);
    if (!this.designName) {
      this.designName = `${this.selectedTemplateObj?.label || 'Carte'} — ${new Date().toLocaleDateString('fr-FR')}`;
    }
    this.showSaveDialog = true;
    this.cdr.detectChanges();
  }

  resetEdits(): void { this.editedCardHtml = null; this.savedEditorObjects = []; this.currentDesign = null; this.refreshPreview(); }

  toggleDesignerCreations(): void {
    this.showDesignerCreations = !this.showDesignerCreations;
    if (this.showDesignerCreations) this.loadWorkspace();
  }

  loadDesignInEditor(d: SavedDesign): void {
    this.currentDesign = d;
    this.selectedTemplate = d.templateId;
    this.editedCardHtml = d.editedHtml || null;
    try { this.savedEditorObjects = JSON.parse(d.editorObjects || '[]'); } catch { this.savedEditorObjects = []; }
    const tpl = this.selectedTemplateObj;
    this.editorWidth  = tpl?.isVertical ? 204 : 321;
    this.editorHeight = tpl?.isVertical ? 322 : 204;
    const p = this.previewPersons[0] ?? DEFAULT_PERSON;
    const cd = personToCardData({ ...p, couleur1: this.sharedCouleur1, couleur2: this.sharedCouleur2 });
    this.editorBaseHtml = this.editedCardHtml || this.renderCard(cd);
    this.showDesignerCreations = false;
    // Ferme et rouvre l'éditeur pour forcer le rechargement du canvas
    this.editorOpen = false;
    this.cdr.detectChanges();
    setTimeout(() => { this.editorOpen = true; this.cdr.detectChanges(); }, 50);
    this.showToast(`📂 ${d.name} chargé`);
  }

  async deleteDesignFromEditor(id: string, e: Event): Promise<void> {
    e.stopPropagation();
    await this.deleteDesign(id);
    this.showToast('🗑 Création supprimée');
  }

  async saveCurrentDesign(): Promise<void> {
    if (!this.designName.trim()) return;
    this.savingDesign = true;
    // Derive category strictly from the selected template, not from the left panel
    const tpl = this.templates.find(t => t.id === this.selectedTemplate);
    const tplCatId = tpl?.category || this.selectedCategory;
    const categoryEnum = this.categories.find(c => c.id === tplCatId)?.catEnum || this.activeCategoryEnum;
    // Build card data from the current preview person
    const previewPerson = this.previewPersons[0] ?? DEFAULT_PERSON;
    const cd = personToCardData({ ...previewPerson, couleur1: this.sharedCouleur1, couleur2: this.sharedCouleur2 });
    // Build full HTML: manual edit OR template render, plus any editor objects overlay
    const baseHtml = this.editedCardHtml || (tpl ? tpl.render(cd) : '');
    const overlayHtml = this.savedEditorObjects?.length
      ? this.renderEditorObjects(this.savedEditorObjects)
      : '';
    const fullHtml = overlayHtml ? `<div style="position:relative;width:100%;height:100%;">${baseHtml}${overlayHtml}</div>` : baseHtml;
    const body = {
      name:          this.designName.trim(),
      templateId:    this.selectedTemplate,
      category:      categoryEnum,
      cardData:      JSON.stringify(cd),
      persons:       '[]',
      editorObjects: JSON.stringify(this.savedEditorObjects || []),
      editedHtml:    fullHtml,
      copies:        1,
      pdfFormat:     tpl?.isVertical ? 'portrait' : 'landscape',
      company:       previewPerson.entreprise || '',
    };
    try {
      // PUT if updating an existing design, POST to create a new one
      const isUpdate = !!this.currentDesign?.id;
      const url = isUpdate ? `/api/card-designs/${this.currentDesign!.id}` : '/api/card-designs';
      const method = isUpdate ? 'PUT' : 'POST';
      const res = await this.authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const saved = await res.json();
        if (isUpdate) {
          this.savedDesigns = this.savedDesigns.map(d => d.id === saved.id ? saved : d);
        } else {
          this.savedDesigns = [saved, ...this.savedDesigns];
        }
        this.currentDesign = saved;
        this.showSaveDialog = false;
        this.editorOpen = false;
        this.designName = '';
        this.showToast(isUpdate ? '✅ Création mise à jour — ' + saved.name : '💾 Création sauvegardée — ' + saved.name);
      } else {
        const errText = await res.text().catch(() => '');
        this.showToast(`❌ Erreur ${res.status} : ${errText.slice(0, 80) || 'sauvegarde impossible'}`);
      }
    } catch (err) { this.showToast('❌ Erreur réseau'); }
    this.savingDesign = false;
    this.cdr.detectChanges();
  }

  async openWorkspace(): Promise<void> { this.workspaceOpen = true; await this.loadWorkspace(); }

  /* ── Mes Cartes ──────────────────────────────────────────────────── */
  async openMyCards(): Promise<void> {
    this.myCardsOpen = true;
    this.myCardsTab = 1;
    this.myCardsExpandedEnts = new Set();
    this.myCardsExpandedPersons = new Set();
    this.myCardsEditPersonId = null;
    await Promise.all([this.loadPersons(), this.loadWorkspace(), this.loadProdHistory()]);
    this.cdr.detectChanges();
  }

  myCardsToggleEnt(key: string): void {
    const s = new Set(this.myCardsExpandedEnts);
    s.has(key) ? s.delete(key) : s.add(key);
    this.myCardsExpandedEnts = s;
    this.cdr.detectChanges();
  }

  myCardsToggleCat(key: string): void {
    const s = new Set(this.myCardsExpandedCats);
    if (s.has(key)) s.delete(key); else s.add(key);
    this.myCardsExpandedCats = s;
    this.cdr.detectChanges();
  }

  async mcAddPersonToGroup(
    entKey: string,
    catKey: string,
    sgHints?: { anneeScolaire?: string; etablissementScolaire?: string; titreEvenement?: string }
  ): Promise<void> {
    this.myCardsOpen = false;

    // Charger les entreprises si besoin
    if (this.savedEntreprises.length === 0) await this.loadEntreprises();

    // Initialiser le wizard en mode "quick add" — contexte pré-rempli, directo step 4
    this.wizOpen = true;
    this.wizQuickAdd = true;
    this.wizPersons = [];
    this.wizExpandedIdx = new Set();
    this.wizSaving = false;

    this.wizCategory = catKey;

    // Retrouver l'entreprise par raisonSocial
    this.wizEntreprise = this.savedEntreprises.find(e => e.raisonSocial === entKey) || null;

    // Meilleure création pour cette catégorie
    const designsForCat = this.savedDesigns.filter(d => d.category === catKey);
    this.wizDesign = designsForCat.length > 0 ? designsForCat[0] : null;

    // Sauter directement à l'étape 4
    this.wizStep = 4;
    this.wizAddPerson();

    // Pré-remplir les hints de sous-groupe (année scolaire, établissement, titre événement)
    if (sgHints && this.wizPersons.length > 0) {
      const p = { ...this.wizPersons[0] };
      if (sgHints.anneeScolaire)       p.anneeScolaire        = sgHints.anneeScolaire;
      if (sgHints.etablissementScolaire) p.etablissementScolaire = sgHints.etablissementScolaire;
      if (sgHints.titreEvenement)      p.titreEvenement       = sgHints.titreEvenement;
      this.wizPersons = [p];
    }

    this.cdr.detectChanges();
  }

  myCardsTogglePerson(id: string): void {
    const s = new Set(this.myCardsExpandedPersons);
    s.has(id) ? s.delete(id) : s.add(id);
    this.myCardsExpandedPersons = s;
    this.cdr.detectChanges();
  }

  async myCardsStartEdit(p: CardPerson, e: Event): Promise<void> {
    e.stopPropagation();
    // Fermer le modal Mes Cartes et ouvrir le wizard en mode édition
    this.myCardsOpen = false;

    if (this.savedEntreprises.length === 0) await this.loadEntreprises();

    this.wizOpen = true;
    this.wizQuickAdd = true;
    this.wizEditPersonId = p.id!;
    this.wizSaving = false;
    this.wizPersons = [{ ...p }];
    this.wizExpandedIdx = new Set([0]);

    // Pré-remplir le contexte depuis la personne
    this.wizCategory = p.category || '';
    this.wizEntreprise = this.savedEntreprises.find(e => e.raisonSocial === (p.entreprise || p.etablissementScolaire || p.organisationParticipant)) || null;
    const designsForCat = this.savedDesigns.filter(d => d.category === this.wizCategory);
    this.wizDesign = designsForCat.length > 0 ? designsForCat[0] : null;

    this.wizStep = 4;
    this.cdr.detectChanges();
  }

  myCardsCancelEdit(): void {
    this.myCardsEditPersonId = null;
    this.myCardsEditDraft = {};
    this.cdr.detectChanges();
  }

  async myCardsSaveEdit(): Promise<void> {
    if (!this.myCardsEditPersonId) return;
    try {
      const res = await this.authFetch(`/api/card-data/${this.myCardsEditPersonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.myCardsEditDraft),
      });
      if (res.ok) {
        const updated: CardPerson = await res.json();
        this.savedPersonsList = this.savedPersonsList.map(p => p.id === updated.id ? updated : p);
        this.myCardsEditPersonId = null;
        this.myCardsEditDraft = {};
        this.showToast('✅ Personne mise à jour');
      } else { this.showToast('❌ Erreur mise à jour'); }
    } catch { this.showToast('❌ Erreur réseau'); }
    this.cdr.detectChanges();
  }

  async myCardsDeletePerson(id: string, e: Event): Promise<void> {
    e.stopPropagation();
    if (!confirm('Supprimer cette personne ?')) return;
    await this.deleteSavedPerson(id);
    this.cdr.detectChanges();
  }

  async myCardsDownloadPdf(design: SavedDesign): Promise<void> {
    this.myCardsPdfLoading = design.id;
    this.cdr.detectChanges();
    const persons = this.mcPersonsForDesign(design);
    if (!persons.length) { this.showToast('⚠️ Aucune personne liée'); this.myCardsPdfLoading = null; return; }
    const tpl = this.templates.find(t => t.id === design.templateId);
    if (!tpl) { this.showToast('❌ Template introuvable'); this.myCardsPdfLoading = null; return; }
    const win = this.openPrintWindow(design, tpl, persons, 1);
    if (!win) { this.showToast('❌ Popup bloqué — autorisez les popups pour ce site'); this.myCardsPdfLoading = null; return; }
    await this.saveProdRecord(design, persons, 1);
    this.showToast(`✅ Fenêtre d'impression ouverte — ${persons.length} carte(s)`);
    this.myCardsPdfLoading = null;
    this.cdr.detectChanges();
  }

  async loadProdHistory(): Promise<void> {
    try {
      const res = await this.authFetch('/api/card-productions');
      if (res.ok) {
        const list: any[] = await res.json();
        this.prodHistory = list.map(r => ({
          id: r.id,
          designId: r.designId,
          designName: r.designName,
          templateId: r.templateId,
          category: r.category,
          entreprise: r.entreprise,
          personCount: r.personCount,
          copies: r.copies,
          personNames: JSON.parse(r.personNames || '[]'),
          timestamp: new Date(r.createdAt).getTime(),
        }));
      }
    } catch { this.prodHistory = []; }
  }

  private async saveProdRecord(design: SavedDesign, persons: CardPerson[], copies: number): Promise<void> {
    const body = {
      designId: design.id,
      designName: design.name,
      templateId: design.templateId,
      category: design.category,
      entreprise: persons[0]?.entreprise || persons[0]?.organisationParticipant || persons[0]?.etablissementScolaire || null,
      personCount: persons.length,
      copies,
      personIds: JSON.stringify(persons.map(p => p.id).filter(Boolean)),
      personNames: JSON.stringify(persons.map(p => [p.prenoms, p.nom].filter(Boolean).join(' '))),
    };
    try {
      const res = await this.authFetch('/api/card-productions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const saved = await res.json();
        const rec: ProdRecord = {
          id: saved.id, designId: saved.designId, designName: saved.designName,
          templateId: saved.templateId, category: saved.category, entreprise: saved.entreprise,
          personCount: saved.personCount, copies: saved.copies,
          personNames: JSON.parse(saved.personNames || '[]'),
          timestamp: new Date(saved.createdAt).getTime(),
        };
        this.prodHistory = [rec, ...this.prodHistory];
        this.cdr.detectChanges();
      } else {
        const errText = await res.text().catch(() => '');
        console.error('saveProdRecord HTTP', res.status, errText);
      }
    } catch (err) { console.error('saveProdRecord', err); }
  }

  async mcReprintPdf(rec: ProdRecord): Promise<void> {
    const design = this.savedDesigns.find(d => d.id === rec.designId);
    if (!design) { this.showToast('❌ Création introuvable'); return; }
    const persons = this.savedPersonsList.filter(p =>
      rec.personNames.includes([p.prenoms, p.nom].filter(Boolean).join(' '))
    );
    if (!persons.length) { this.showToast('⚠️ Personnes introuvables — relancez depuis "Produire les cartes"'); return; }
    this.myCardsPdfLoading = rec.id;
    this.cdr.detectChanges();
    const tpl = this.templates.find(t => t.id === design.templateId);
    if (!tpl) { this.myCardsPdfLoading = null; return; }
    const win = this.openPrintWindow(design, tpl, persons, rec.copies);
    if (!win) { this.showToast('❌ Popup bloqué — autorisez les popups pour ce site'); this.myCardsPdfLoading = null; return; }
    this.showToast(`✅ Réimpression : ${persons.length * rec.copies} carte(s)`);
    this.myCardsPdfLoading = null;
    this.cdr.detectChanges();
  }

  async mcDeleteProdRecord(id: string): Promise<void> {
    try {
      await this.authFetch(`/api/card-productions/${id}`, { method: 'DELETE' });
    } catch {}
    this.prodHistory = this.prodHistory.filter(r => r.id !== id);
    this.cdr.detectChanges();
  }

  async loadWorkspace(): Promise<void> {
    this.workspaceLoading = true;
    try {
      const res = await this.authFetch('/api/card-designs');
      if (res.ok) this.savedDesigns = await res.json();
    } catch {}
    this.workspaceLoading = false;
    this.cdr.detectChanges();
  }

  loadDesign(d: SavedDesign): void {
    this.currentDesign = d;
    this.selectedTemplate = d.templateId;
    this.editedCardHtml = d.editedHtml || null;
    try { this.savedEditorObjects = JSON.parse(d.editorObjects || '[]'); } catch { this.savedEditorObjects = []; }
    // Sync left-panel category from the template (source of truth)
    const tpl = TEMPLATES.find(t => t.id === d.templateId);
    if (tpl?.category) this.selectedCategory = tpl.category;
    else if (d.category) {
      const cat = this.categories.find(c => c.catEnum === d.category);
      if (cat) this.selectedCategory = cat.id;
    }
    this.workspaceOpen = false;
    this.refreshPreview();
    this.showToast('📂 Création chargée');
  }

  async deleteDesign(id: string): Promise<void> {
    try {
      const res = await this.authFetch(`/api/card-designs/${id}`, { method: 'DELETE' });
      if (res.ok) { this.savedDesigns = this.savedDesigns.filter(d => d.id !== id); this.cdr.detectChanges(); }
    } catch {}
  }

  openBulkModal(): void {
    this.wizOpen = true;
    this.wizQuickAdd = false;
    this.wizEditPersonId = null;
    this.wizStep = 1;
    this.wizCategory = '';
    this.wizDesign = null;
    this.wizEntreprise = null;
    this.wizPersons = [];
    this.wizExpandedIdx = new Set();
    if (this.savedEntreprises.length === 0) this.loadEntreprises();
  }

  closeBulkModal(): void { this.wizOpen = false; }

  /* ── Wizard navigation ─────────────────────────────────────────── */

  wizBack(): void {
    if (this.wizStep > 1) {
      this.wizStep--;
      this.cdr.detectChanges();
    } else {
      if (this.wizPersons.length > 0) {
        if (!confirm('Annuler le wizard ? Les personnes saisies seront perdues.')) return;
      }
      this.closeBulkModal();
    }
  }

  wizSelectCategory(cat: string): void {
    this.wizCategory = cat;
    this.cdr.detectChanges();
  }

  wizNextFromCategory(): void {
    if (!this.wizCategory) return;
    this.wizStep = 2;
    this.cdr.detectChanges();
  }

  wizSelectDesign(d: SavedDesign): void {
    this.wizDesign = this.wizDesign?.id === d.id ? null : d;
  }

  wizConfirmDesign(): void { this.wizStep = 3; }
  wizSkipDesign(): void { this.wizDesign = null; this.wizStep = 3; }

  wizSelectEntreprise(e: CardEntreprise): void {
    this.wizEntreprise = this.wizEntreprise?.id === e.id ? null : e;
  }

  wizConfirmEntreprise(): void {
    this.wizStep = 4;
    if (this.wizPersons.length === 0) this.wizAddPerson();
  }

  wizSkipEntreprise(): void {
    this.wizEntreprise = null;
    this.wizStep = 4;
    if (this.wizPersons.length === 0) this.wizAddPerson();
  }

  wizAddPerson(): void {
    const e = this.wizEntreprise;
    const idx = this.wizPersons.length;
    const p: CardPerson = {
      nom: '', prenoms: '',
      category: this.wizCategory,
      couleur1: e?.couleur1 || this.sharedCouleur1,
      couleur2: e?.couleur2 || this.sharedCouleur2,
      entreprise:           e?.raisonSocial      || '',
      sigleEntreprise:      e?.sigleEntreprise   || '',
      logo:                 e?.logo              || '',
      armoirie:             e?.armoirie          || '',
      cachet:               e?.cachet            || '',
      signatureResponsable: e?.signatureResponsable || '',
      siteWeb:              e?.siteWeb           || '',
      adresse:              e?.adresse           || '',
      etablissementScolaire:e?.raisonSocial      || '',
      sigleEts:             e?.sigleEntreprise   || '',
      logoEts:              e?.logo              || '',
      ownerEvenement:       e?.raisonSocial      || '',
      typeApprenant: 'ELEVE',
      anneeScolaire: `${new Date().getFullYear()}-${new Date().getFullYear()+1}`,
      titreCarte: 'IDENTITY CARD',
    };
    this.wizPersons = [...this.wizPersons, p];
    this.wizExpandedIdx = new Set([...this.wizExpandedIdx, idx]);
    this.cdr.detectChanges();
  }

  wizRemovePerson(i: number, ev: Event): void {
    ev.stopPropagation();
    this.wizPersons = this.wizPersons.filter((_, idx) => idx !== i);
    const s = new Set<number>();
    this.wizExpandedIdx.forEach(idx => { if (idx < i) s.add(idx); else if (idx > i) s.add(idx - 1); });
    this.wizExpandedIdx = s;
    this.cdr.detectChanges();
  }

  wizToggle(i: number): void {
    const s = new Set(this.wizExpandedIdx);
    s.has(i) ? s.delete(i) : s.add(i);
    this.wizExpandedIdx = s;
    this.cdr.detectChanges();
  }

  wizGoRecap(): void {
    if (!this.wizPersons.length) return;
    const firstInvalid = this.wizPersons.findIndex(p => !p.nom?.trim() && !p.prenoms?.trim());
    if (firstInvalid >= 0) {
      this.showToast(`⚠️ Personne ${firstInvalid + 1} sans nom — remplissez au minimum le nom ou les prénoms`);
      this.wizExpandedIdx = new Set([firstInvalid]);
      this.cdr.detectChanges();
      return;
    }
    this.wizStep = 5;
    this.cdr.detectChanges();
  }

  async wizSaveAll(): Promise<void> {
    this.wizSaving = true;
    try {
      if (this.wizEditPersonId) {
        // ── Mode édition : PUT sur la personne existante ──────────────────
        const updated = { ...this.wizPersons[0], category: this.wizCategory };
        const res = await this.authFetch(`/api/card-data/${this.wizEditPersonId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        if (res.ok) {
          const saved: CardPerson = await res.json();
          this.savedPersonsList = this.savedPersonsList.map(p => p.id === saved.id ? saved : p);
          this.wizOpen = false;
          this.wizEditPersonId = null;
          this.myCardsOpen = true;
          this.showToast('✅ Personne mise à jour');
        } else { this.showToast('❌ Erreur mise à jour'); }
      } else {
        // ── Mode création : POST bulk ──────────────────────────────────────
        const toSave = this.wizPersons.map(p => ({
          ...p,
          category:     this.wizCategory,
          cardDesignId: this.wizDesign?.id    || undefined,
          entrepriseId: this.wizEntreprise?.id || undefined,
        }));
        const res = await this.authFetch('/api/card-data/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSave),
        });
        if (res.ok) {
          const saved: CardPerson[] = await res.json();
          this.savedPersonsList = [...saved, ...this.savedPersonsList];
          this.wizOpen = false;
          this.currentPersonIndex = 0;
          this.refreshPreview();
          this.showToast(`✅ ${saved.length} personne(s) enregistrée(s)`);
        } else { this.showToast('❌ Erreur enregistrement'); }
      }
    } catch { this.showToast('❌ Erreur réseau'); }
    this.wizSaving = false;
    this.cdr.detectChanges();
  }

  wizCategoryLabel(): string {
    return this.WIZARD_CATEGORIES.find(c => c.value === this.wizCategory)?.label ?? this.wizCategory;
  }

  wizBackToEdit(i: number): void {
    this.wizStep = 4;
    this.wizExpandedIdx = new Set([i]);
    this.cdr.detectChanges();
  }

  wizDesignsForCat(): SavedDesign[] {
    return this.savedDesigns.filter(d => !d.category || d.category === this.wizCategory);
  }

  wizAvatarColor(i: number): string {
    return ['#2563eb','#7c3aed','#0d9488','#ea580c','#16a34a','#db2777'][i % 6];
  }

  wizPersonLabel(p: CardPerson, i: number): string {
    const n = [p.prenoms, p.nom].filter(Boolean).join(' ').trim();
    return n || `Personne ${i + 1}`;
  }

  onWizPhoto(e: Event, i: number): void {
    this.readImg(e, url => { this.wizPersons[i].photo = url; this.cdr.detectChanges(); });
  }
  onWizLogo(e: Event, i: number): void {
    this.readImg(e, url => { this.wizPersons[i].logo = url; this.wizPersons[i].logoEts = url; this.cdr.detectChanges(); });
  }

  addBulkDraft(): void {
    const idx = this.bulkDrafts.length;
    this.bulkDrafts = [...this.bulkDrafts, {
      nom: '', prenoms: '',
      couleur1: this.sharedCouleur1,
      couleur2: this.sharedCouleur2,
      category: this.activeCategoryEnum,
    }];
    this.expandedBulkIdx = new Set([...this.expandedBulkIdx, idx]);
    this.cdr.detectChanges();
  }

  removeBulkDraft(i: number, e: Event): void {
    e.stopPropagation();
    this.bulkDrafts = this.bulkDrafts.filter((_, idx) => idx !== i);
    const newSet = new Set<number>();
    this.expandedBulkIdx.forEach(idx => { if (idx < i) newSet.add(idx); else if (idx > i) newSet.add(idx - 1); });
    this.expandedBulkIdx = newSet;
    this.cdr.detectChanges();
  }

  toggleBulkExpand(i: number): void {
    const s = new Set(this.expandedBulkIdx);
    if (s.has(i)) s.delete(i); else s.add(i);
    this.expandedBulkIdx = s;
    this.cdr.detectChanges();
  }

  bulkAvatarColor(i: number): string {
    const colors = ['#0d9488','#7c3aed','#2563eb','#ea580c','#16a34a','#db2777'];
    return colors[i % colors.length];
  }

  async saveBulkPersons(): Promise<void> {
    if (!this.bulkDrafts.length) return;
    this.savingPersons = true;
    const toSave = this.bulkDrafts.map(p => {
      this.generateQr(p);
      return { ...p, category: this.activeCategoryEnum, cardDesignId: this.currentDesign?.id || null };
    });
    try {
      const res = await this.authFetch('/api/card-data/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });
      if (res.ok) {
        const saved: CardPerson[] = await res.json();
        this.savedPersonsList = [...saved, ...this.savedPersonsList];
        this.bulkDrafts = [];
        this.expandedBulkIdx.clear();
        this.currentPersonIndex = 0;
        this.refreshPreview();
        this.showToast(`✅ ${saved.length} personne(s) enregistrée(s)`);
        this.currentStep = Math.max(this.currentStep, 5);
      } else { this.showToast('❌ Erreur d\'enregistrement'); }
    } catch { this.showToast('❌ Erreur réseau'); }
    this.savingPersons = false;
    this.cdr.detectChanges();
  }

  previewBulkPerson(i: number): void {
    const p = this.bulkDrafts[i];
    const cd = personToCardData({ ...p, couleur1: this.sharedCouleur1, couleur2: this.sharedCouleur2 });
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(this.renderCard(cd));
    this.closeBulkModal();
    this.cdr.detectChanges();
  }

  previewSavedPerson(i: number): void { this.currentPersonIndex = i; this.editedCardHtml = null; this.refreshPreview(); this.closeBulkModal(); }

  async deleteSavedPerson(id: string): Promise<void> {
    try {
      const res = await this.authFetch(`/api/card-data/${id}`, { method: 'DELETE' });
      if (res.ok) { this.savedPersonsList = this.savedPersonsList.filter(p => p.id !== id); this.cdr.detectChanges(); }
    } catch {}
  }

  async loadPersons(): Promise<void> {
    try {
      const res = await this.authFetch('/api/card-data');
      if (res.ok) { this.savedPersonsList = await res.json(); }
    } catch {}
    this.cdr.detectChanges();
  }

  async loadEntreprises(): Promise<void> {
    this.loadingEntreprises = true;
    try {
      const res = await this.authFetch('/api/card-entreprises');
      if (res.ok) this.savedEntreprises = await res.json();
    } catch {}
    this.loadingEntreprises = false;
    this.cdr.detectChanges();
  }

  openEntrepriseModal(): void {
    this.newEntreprise = { raisonSocial: '', couleur1: this.sharedCouleur1, couleur2: this.sharedCouleur2 };
    this.entStep = 1;
    this.entrepriseModalOpen = true;
  }

  entNext(): void { if (this.entStep < 4) this.entStep++; }
  entPrev(): void { if (this.entStep > 1) this.entStep--; }

  onEntrepriseSelect(event: Event, p: CardPerson): void {
    const id = (event.target as HTMLSelectElement).value;
    const e = this.savedEntreprises.find(ent => ent.id === id);
    if (!e) return;
    p.entrepriseId = e.id;
    p.entreprise = e.raisonSocial;
    p.sigleEntreprise = e.sigleEntreprise || p.sigleEntreprise;
    if (e.logo) p.logo = e.logo;
    if (e.armoirie) p.armoirie = e.armoirie;
    if (e.cachet) p.cachet = e.cachet;
    if (e.signatureResponsable) p.signatureResponsable = e.signatureResponsable;
    if (e.couleur1) p.couleur1 = e.couleur1;
    if (e.couleur2) p.couleur2 = e.couleur2;
    if (e.siteWeb) p.siteWeb = e.siteWeb;
    if (e.adresse) p.adresse = e.adresse;
    if (e.email) p.email = e.email;
    if (e.contact) p.contact = e.contact;
    this.cdr.detectChanges();
  }

  async saveEntreprise(): Promise<void> {
    if (!this.newEntreprise.raisonSocial?.trim()) return;
    this.savingEntreprise = true;
    try {
      const res = await this.authFetch('/api/card-entreprises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.newEntreprise),
      });
      if (res.ok) {
        const saved: CardEntreprise = await res.json();
        this.savedEntreprises = [saved, ...this.savedEntreprises];
        this.newEntreprise = { raisonSocial: '' };
        this.entStep = 1;
        this.entrepriseModalOpen = false;
        this.showToast(`✅ "${saved.raisonSocial}" créée (${saved.code})`);
      } else { this.showToast('❌ Erreur création société'); }
    } catch { this.showToast('❌ Erreur réseau'); }
    this.savingEntreprise = false;
  }

  async deleteEntreprise(id: string): Promise<void> {
    if (!confirm('Supprimer cette société ?')) return;
    try {
      const res = await this.authFetch(`/api/card-entreprises/${id}`, { method: 'DELETE' });
      if (res.ok) { this.savedEntreprises = this.savedEntreprises.filter(e => e.id !== id); this.cdr.detectChanges(); }
    } catch {}
  }

  triggerEntLogo(): void { (document.getElementById('ent-logo') as HTMLInputElement)?.click(); }
  triggerEntArm(): void { (document.getElementById('ent-arm') as HTMLInputElement)?.click(); }
  triggerEntCachet(): void { (document.getElementById('ent-cachet') as HTMLInputElement)?.click(); }
  triggerEntSig(): void { (document.getElementById('ent-sig') as HTMLInputElement)?.click(); }

  onEntFileChange(event: Event, field: keyof CardEntreprise): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { (this.newEntreprise as any)[field] = reader.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
  }

  onDragOver(e: DragEvent): void { e.preventDefault(); }

  triggerBulkPhoto(i: number): void { (document.getElementById(`bph-${i}`) as HTMLInputElement)?.click(); }
  triggerBulkLogo(i: number): void  { (document.getElementById(`blo-${i}`) as HTMLInputElement)?.click(); }
  triggerBulkArm(i: number): void   { (document.getElementById(`bar-${i}`) as HTMLInputElement)?.click(); }
  triggerBulkCachet(i: number): void { (document.getElementById(`bca-${i}`) as HTMLInputElement)?.click(); }
  triggerBulkSig(i: number): void   { (document.getElementById(`bsi-${i}`) as HTMLInputElement)?.click(); }

  onBulkPhotoChange(e: Event, i: number): void  { this.readImg(e, url => { this.bulkDrafts[i].photo = url; this.cdr.detectChanges(); }); }
  onBulkLogoChange(e: Event, i: number): void   { this.readImg(e, url => { this.bulkDrafts[i].logo = url; this.cdr.detectChanges(); }); }
  onBulkArmChange(e: Event, i: number): void    { this.readImg(e, url => { this.bulkDrafts[i].armoirie = url; this.cdr.detectChanges(); }); }
  onBulkCachetChange(e: Event, i: number): void { this.readImg(e, url => { this.bulkDrafts[i].cachet = url; this.cdr.detectChanges(); }); }
  onBulkSigChange(e: Event, i: number): void    { this.readImg(e, url => { this.bulkDrafts[i].signatureResponsable = url; this.cdr.detectChanges(); }); }

  onDropBulkPhoto(e: DragEvent, i: number): void { e.preventDefault(); const f=e.dataTransfer?.files?.[0]; if(f) this.readFileToUrl(f,url=>{this.bulkDrafts[i].photo=url;this.cdr.detectChanges();}); }
  onDropBulkLogo(e: DragEvent, i: number): void  { e.preventDefault(); const f=e.dataTransfer?.files?.[0]; if(f) this.readFileToUrl(f,url=>{this.bulkDrafts[i].logo=url;this.cdr.detectChanges();}); }

  private readImg(e: Event, cb: (url:string)=>void): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.readFileToUrl(f, cb);
  }
  private readFileToUrl(file: File, cb: (url:string)=>void): void {
    const r = new FileReader();
    r.onload = ev => cb(ev.target?.result as string);
    r.readAsDataURL(file);
  }

  onCsvChange(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.name.match(/\.xlsx?$/i)) {
      const XLSX = (window as any).XLSX;
      if (!XLSX) { this.showToast('❌ xlsx.js non chargé'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type:'array' });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' });
        this.importCsvRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = ev => {
        const lines = (ev.target?.result as string).split('\n').filter(l=>l.trim());
        if (!lines.length) return;
        const sep = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(sep).map(h=>h.trim());
        const rows = lines.slice(1).map(line => {
          const vals = line.split(sep);
          const obj: any = {};
          headers.forEach((h,i) => obj[h]=(vals[i]||'').trim());
          return obj;
        });
        this.importCsvRows(rows);
      };
      reader.readAsText(file, 'UTF-8');
    }
  }

  private importCsvRows(rows: any[]): void {
    const startIdx = this.bulkDrafts.length;
    rows.forEach(r => {
      this.bulkDrafts.push({
        nom:                  r['nom']||r['Nom']||'',
        prenoms:              r['prenoms']||r['Prénom']||r['prenom']||'',
        titre:                r['titre']||r['Titre']||'',
        profession:           r['profession']||'',
        entreprise:           r['entreprise']||r['Entreprise']||'',
        sigleEntreprise:      r['sigleEntreprise']||'',
        email:                r['email']||r['Email']||'',
        contact:              r['contact']||r['telephone']||'',
        adresse:              r['adresse']||'',
        siteWeb:              r['siteWeb']||'',
        matricule:            r['matricule']||r['Matricule']||'',
        etablissementScolaire:r['etablissementScolaire']||r['Etablissement']||'',
        classe:               r['classe']||'',
        anneeScolaire:        r['anneeScolaire']||'2024-2025',
        dateNaissance:        r['dateNaissance']||'',
        lieuNaissance:        r['lieuNaissance']||'',
        titreEvenement:       r['titreEvenement']||'',
        dateDebut:            r['dateEvenement']||r['dateDebut']||'',
        salleEvenement:       r['salleEvenement']||'',
        accessType:           r['accessType']||'',
        couleur1:             r['couleur1']||this.sharedCouleur1,
        couleur2:             r['couleur2']||this.sharedCouleur2,
        category:             this.activeCategoryEnum,
      });
    });
    rows.forEach((_,i) => this.expandedBulkIdx.add(startIdx+i));
    this.showToast(`📂 ${rows.length} ligne(s) importée(s)`);
    this.cdr.detectChanges();
  }

  private generateQr(p: any): void {
    const qrGen = (window as any).qrcode;
    if (!qrGen) return;
    try {
      const info = `CODE:${p.code||''};NOM:${p.prenoms||''} ${p.nom||''};TEL:${p.contact||''};ORG:${p.entreprise||p.etablissementScolaire||''}`;
      const qr = qrGen(0, 'M');
      qr.addData(btoa(unescape(encodeURIComponent(info))));
      qr.make();
      p.qrCode = qr.createDataURL(2, 0);
      p.qrDataUrl = p.qrCode;
    } catch { p.qrCode = ''; }
  }

  async openProductionModal(): Promise<void> {
    this.prodSelectedDesignId = this.currentDesign?.id || '';
    this.prodFilterCategory = '';
    this.prodFilterEntreprise = '';
    this.productionModalOpen = true;
    this.currentStep = 5;
    this.prodFilteredDesigns = this.savedDesigns.filter(d => !this.prodFilterCategory || d.category === this.prodFilterCategory);
    await this.loadProdPersonsAndEntreprises();
  }

  private async loadProdPersonsAndEntreprises(): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (this.prodFilterCategory) params.set('category', this.prodFilterCategory);
      if (this.prodFilterEntreprise) params.set('entreprise', this.prodFilterEntreprise);
      const res = await this.authFetch(`/api/card-data?${params}`);
      if (res.ok) {
        this.prodFilteredPersons = await res.json();
        this.prodSelectedPersonIds = new Set(this.prodFilteredPersons.map(p => p.id!));
      }
      const eRes = await this.authFetch(`/api/card-data?category=${this.prodFilterCategory}`);
      if (eRes.ok) {
        const all: CardPerson[] = await eRes.json();
        this.prodEntreprises = [...new Set(all.map(p => p.entreprise || p.organisationParticipant || p.etablissementScolaire || '').filter(Boolean))];
      }
    } catch {}
    this.cdr.detectChanges();
  }

  async onProdCategoryChange(): Promise<void> {
    this.prodFilteredDesigns = this.savedDesigns.filter(d => !this.prodFilterCategory || d.category === this.prodFilterCategory);
    this.prodFilterEntreprise = '';
    await this.loadProdPersonsAndEntreprises();
  }

  async onProdEntrepriseChange(): Promise<void> {
    this.prodFilterCatDropdown = '';
    this.prodCategoriesForEnt = [];
    if (this.prodFilterEntreprise) {
      try {
        const params = new URLSearchParams({ entreprise: this.prodFilterEntreprise });
        const res = await this.authFetch(`/api/card-data?${params}`);
        if (res.ok) {
          const persons: CardPerson[] = await res.json();
          this.prodAllPersonsForEnt = persons;
          this.prodFilteredPersons = persons;
          this.prodSelectedPersonIds = new Set<string>();
          const catMap = new Map<string, number>();
          for (const p of persons) { catMap.set(p.category||'', (catMap.get(p.category||'')||0)+1); }
          this.prodCategoriesForEnt = Array.from(catMap.entries()).map(([cat, count]) => ({
            cat, label: this.mcCatLabel(cat), count, checked: true
          }));
          const linkedDesignId = persons.find(p => p.cardDesignId)?.cardDesignId;
          if (linkedDesignId && this.savedDesigns.find(d => d.id === linkedDesignId)) {
            this.prodSelectedDesignId = linkedDesignId;
            const linked = this.savedDesigns.find(d => d.id === linkedDesignId);
            if (linked) this.prodFilteredDesigns = this.savedDesigns.filter(d => d.category === linked.category);
          } else {
            this.prodFilteredDesigns = this.savedDesigns;
          }
          this.cdr.detectChanges();
          return;
        }
      } catch {}
    } else {
      this.prodAllPersonsForEnt = [];
      this.prodFilterCategory = '';
      this.prodFilteredDesigns = this.savedDesigns;
    }
    await this.loadProdPersonsAndEntreprises();
  }

  onProdCatDropdownChange(): void {
    const cat = this.prodFilterCatDropdown;
    this.prodFilteredPersons = cat
      ? this.prodAllPersonsForEnt.filter(p => (p.category||'') === cat)
      : this.prodAllPersonsForEnt;
    this.prodSelectedPersonIds = new Set<string>();
    if (cat) {
      this.prodFilteredDesigns = this.savedDesigns.filter(d => d.category === cat);
      const first = this.prodFilteredDesigns[0];
      if (first && !this.prodFilteredDesigns.find(d => d.id === this.prodSelectedDesignId)) {
        this.prodSelectedDesignId = first.id;
      }
    } else {
      this.prodFilteredDesigns = this.savedDesigns;
    }
    this.cdr.detectChanges();
  }

  onProdCatToggle(cat: string): void {
    const item = this.prodCategoriesForEnt.find(c => c.cat === cat);
    if (item) item.checked = !item.checked;
    const checkedCats = new Set(this.prodCategoriesForEnt.filter(c => c.checked).map(c => c.cat));
    this.prodFilteredPersons = this.prodAllPersonsForEnt.filter(p => checkedCats.has(p.category||''));
    this.prodSelectedPersonIds = new Set(this.prodFilteredPersons.map(p => p.id!));
    this.prodFilteredDesigns = this.savedDesigns.filter(d => checkedCats.has(d.category));
    this.cdr.detectChanges();
  }

  toggleProdPerson(id: string): void {
    if (this.prodSelectedPersonIds.has(id)) this.prodSelectedPersonIds.delete(id);
    else this.prodSelectedPersonIds.add(id);
  }

  toggleAllProdPersons(): void {
    if (this.prodSelectedPersonIds.size === this.prodFilteredPersons.length) this.prodSelectedPersonIds.clear();
    else this.prodSelectedPersonIds = new Set(this.prodFilteredPersons.map(p => p.id!));
  }

  toggleProdGroup(cat: string, persons: CardPerson[]): void {
    const ids = persons.map(p => p.id!);
    const allChecked = ids.every(id => this.prodSelectedPersonIds.has(id));
    const s = new Set(this.prodSelectedPersonIds);
    if (allChecked) ids.forEach(id => s.delete(id));
    else ids.forEach(id => s.add(id));
    this.prodSelectedPersonIds = s;
    this.cdr.detectChanges();
  }

  prodGroupAllChecked(persons: CardPerson[]): boolean {
    return persons.length > 0 && persons.every(p => this.prodSelectedPersonIds.has(p.id!));
  }

  prodGroupPartialChecked(persons: CardPerson[]): boolean {
    return persons.some(p => this.prodSelectedPersonIds.has(p.id!)) && !this.prodGroupAllChecked(persons);
  }

  async produirePdf(): Promise<void> {
    const design = this.savedDesigns.find(d => d.id === this.prodSelectedDesignId);
    if (!design || !this.prodSelectedPersonIds.size) return;
    const tpl = this.templates.find(t => t.id === design.templateId);
    if (!tpl) return;
    this.pdfLoading = true;
    this.cdr.detectChanges();
    const persons = this.prodFilteredPersons.filter(p => this.prodSelectedPersonIds.has(p.id!));
    const win = this.openPrintWindow(design, tpl, persons, this.prodCopies, this.prodOrientation);
    if (!win) { this.showToast('❌ Popup bloqué — autorisez les popups pour ce site'); this.pdfLoading = false; return; }
    await this.saveProdRecord(design, persons, this.prodCopies);
    this.productionModalOpen = false;
    this.showToast(`✅ Fenêtre d'impression ouverte — ${persons.length * this.prodCopies} carte(s)`);
    this.pdfLoading = false;
    this.cdr.detectChanges();
  }

  private openPrintWindow(design: SavedDesign, tpl: any, persons: CardPerson[], copies: number, orientation: string = 'portrait'): Window | null {
    let editorObjs: DesignObject[] = [];
    try { editorObjs = JSON.parse(design.editorObjects || '[]'); } catch {}

    // Couleurs de la création sauvegardée (source de vérité)
    let designC1 = this.sharedCouleur1;
    let designC2 = this.sharedCouleur2;
    try {
      const savedCd = JSON.parse(design.cardData || '{}');
      if (savedCd.couleur1) designC1 = savedCd.couleur1;
      if (savedCd.couleur2) designC2 = savedCd.couleur2;
    } catch {}

    const cardW = tpl.isVertical ? 204 : 321;
    const cardH = tpl.isVertical ? 322 : 204;
    const isLandscape = orientation === 'landscape';
    const pageWmm = isLandscape ? 297 : 210;
    const pageHmm = isLandscape ? 210 : 297;

    const cardsHtml = persons.flatMap(p =>
      Array(copies).fill(null).map(() => {
        // Priorité : couleurs de la personne (enterprise) → couleurs de la création → fallback partagées
        const c1 = p.couleur1 || designC1;
        const c2 = p.couleur2 || designC2;
        const cd = personToCardData({ ...p, couleur1: c1, couleur2: c2 });
        const html = tpl.render(cd);
        const overlay = editorObjs.length ? this.renderEditorObjects(editorObjs) : '';
        return `<div style="position:relative;width:${cardW}px;height:${cardH}px;overflow:hidden;flex-shrink:0;">${html}${overlay}</div>`;
      })
    );

    const perPage = tpl.isVertical ? (isLandscape ? 8 : 12) : (isLandscape ? 8 : 8);
    const pages: string[][] = [];
    for (let i = 0; i < cardsHtml.length; i += perPage) pages.push(cardsHtml.slice(i, i + perPage));
    const totalCards = persons.length * copies;

    const pagesHtml = pages.map(page =>
      `<div class="page">${page.map(c => `<div class="card-slot">${c}</div>`).join('')}</div>`
    ).join('');

    const win = window.open('', '_blank', 'width=1100,height=800,scrollbars=yes,resizable=yes');
    if (!win) return null;

    win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${design.name} — ${totalCards} carte(s)</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#e5e7eb;font-family:system-ui,sans-serif;}
.toolbar{
  position:sticky;top:0;z-index:100;
  background:linear-gradient(135deg,#1e40af,#0d9488);
  color:#fff;padding:10px 20px;
  display:flex;align-items:center;gap:12px;
  box-shadow:0 2px 8px rgba(0,0,0,.2);
}
.toolbar-info{flex:1;}
.toolbar-title{font-size:14px;font-weight:800;line-height:1.3;}
.toolbar-sub{font-size:11px;opacity:.8;}
.btn-print{
  background:#fff;color:#0d9488;border:none;
  padding:9px 20px;border-radius:8px;font-weight:700;font-size:13px;
  cursor:pointer;display:flex;align-items:center;gap:6px;
}
.btn-print:hover{background:#f0fdf4;}
.btn-close{
  background:rgba(255,255,255,.15);color:#fff;
  border:1px solid rgba(255,255,255,.3);
  padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;
}
.btn-close:hover{background:rgba(255,255,255,.25);}
.tip{
  background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;
  padding:10px 16px;margin:12px 20px;
  font-size:12px;color:#92400e;display:flex;align-items:center;gap:8px;
}
.pages{padding:20px;}
.page{
  background:#fff;
  width:${pageWmm}mm;min-height:${pageHmm}mm;
  margin:0 auto 16px;padding:8mm;
  display:flex;flex-wrap:wrap;gap:4mm;
  align-content:flex-start;
  box-shadow:0 2px 12px rgba(0,0,0,.1);border-radius:4px;
}
.card-slot{display:flex;justify-content:center;align-items:center;}
@media print{
  body{background:#fff;}
  .toolbar,.tip{display:none!important;}
  .pages{padding:0;}
  .page{
    margin:0;box-shadow:none;border-radius:0;
    width:${pageWmm}mm;min-height:${pageHmm}mm;
    page-break-after:always;break-after:page;
  }
}
@page{size:${pageWmm}mm ${pageHmm}mm;margin:0;}
</style>
</head>
<body>
<div class="toolbar">
  <div class="toolbar-info">
    <div class="toolbar-title">🖨 ${design.name}</div>
    <div class="toolbar-sub">${persons.length} personne(s) × ${copies} copie(s) = ${totalCards} carte(s) — ${pages.length} page(s)</div>
  </div>
  <button class="btn-print" onclick="window.print()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    Imprimer / Enregistrer PDF
  </button>
  <button class="btn-close" onclick="window.close()">✕ Fermer</button>
</div>
<div class="tip">💡 Cliquez <strong>"Imprimer / Enregistrer PDF"</strong> → sélectionnez <strong>"Enregistrer en PDF"</strong> comme destination → cliquez Enregistrer</div>
<div class="pages">${pagesHtml}</div>
</body>
</html>`);
    win.document.close();
    return win;
  }

  private renderEditorObjects(objects: DesignObject[]): string {
    return objects.map(obj => {
      const s = `position:absolute;left:${obj.x}px;top:${obj.y}px;width:${obj.w}px;height:${obj.h}px;z-index:${obj.zIndex||10};`;
      if (obj.isTextBox || obj.type==='text') {
        const ts = `color:${obj.fontColor||'#000'};font-size:${obj.fontSize||14}px;font-family:${obj.fontFamily||'sans-serif'};text-align:${obj.textAlign||'left'};${obj.bold?'font-weight:bold;':''}${obj.italic?'font-style:italic;':''}${obj.underline?'text-decoration:underline;':''}`;
        return `<div style="${s}${ts}">${obj.text||obj.content||''}</div>`;
      }
      if (obj.isLine) return `<div style="${s}border-top:${obj.sw||1}px solid ${obj.stroke||'#000'};"></div>`;
      return `<div style="${s}background:${obj.fill||'transparent'};border:${obj.sw||0}px solid ${obj.stroke||'transparent'};opacity:${obj.opacity||1};"></div>`;
    }).join('');
  }

  loadAiProviders(): void {
    const p = localStorage.getItem('cvb_ai_providers');
    if (p) this.aiProviders = JSON.parse(p);
    const c = localStorage.getItem('cvb_ai_config');
    if (c) this.aiConfig = JSON.parse(c);
  }

  saveAiConfig(): void { localStorage.setItem('cvb_ai_config', JSON.stringify(this.aiConfig)); }

  fnLabel(fn: string): string {
    return fn==='chatbot'?'💬 Chatbot':fn==='suggest'?'✨ Suggérer':fn==='batch'?'🎯 Batch':'🌐 Traduire';
  }

  private getProviderId(): string { return this.aiConfig['chatbot']||this.aiConfig['suggest']||this.aiProviders[0]?.id||''; }

  private aiPost(prompt: string): Promise<string> {
    return new Promise((resolve,reject) => {
      this.http.post('/api/agent/cv/stream', {prompt, stream:false, provider:this.getProviderId()}, {responseType:'text'})
        .subscribe({next:r=>resolve(r),error:reject});
    });
  }

  toggleAiSuggest(): void { this.showAiSuggest = !this.showAiSuggest; }

  async aiSuggestData(): Promise<void> {
    if (!this.aiSuggestPrompt.trim()) return;
    this.aiSuggestLoading = true; this.cdr.detectChanges();
    try {
      const resp = await this.aiPost(
        `Génère des données JSON pour ${this.activeCategoryLabel} avec: "${this.aiSuggestPrompt}". ` +
        `Réponds UNIQUEMENT avec du JSON valide contenant les champs: ` +
        `prenoms,nom,titre,profession,entreprise,email,contact,adresse,siteWeb,matricule,accessType,` +
        `titreEvenement,ownerEvenement,dateEvenement,salleEvenement,standEvenement,etablissementScolaire,classe,anneeScolaire,dateNaissance`
      );
      const match = resp.match(/\{[\s\S]*\}/);
      if (match) {
        const data = JSON.parse(match[0]);
        this.addBulkDraft();
        Object.assign(this.bulkDrafts[this.bulkDrafts.length-1], data);
        this.openBulkModal();
        this.showToast('✨ Données générées');
      }
    } catch { this.showToast('❌ IA indisponible'); }
    this.aiSuggestLoading = false; this.cdr.detectChanges();
  }

  async aiBatchGenerate(): Promise<void> {
    this.aiBatchLoading = true; this.cdr.detectChanges();
    try {
      const resp = await this.aiPost(
        `Génère 5 personnes fictives pour des ${this.activeCategoryLabel}s. ` +
        `Réponds UNIQUEMENT avec un tableau JSON, chaque objet: prenoms,nom,titre,entreprise,email,contact,matricule.`
      );
      const match = resp.match(/\[[\s\S]*\]/);
      if (match) {
        const arr: any[] = JSON.parse(match[0]);
        const startIdx = this.bulkDrafts.length;
        arr.forEach(item => this.bulkDrafts.push({ ...item, category:this.activeCategoryEnum, couleur1:this.sharedCouleur1, couleur2:this.sharedCouleur2 }));
        arr.forEach((_,i) => this.expandedBulkIdx.add(startIdx+i));
        this.openBulkModal();
        this.showToast(`🎯 ${arr.length} personnes générées`);
      }
    } catch { this.showToast('❌ IA indisponible'); }
    this.aiBatchLoading = false; this.cdr.detectChanges();
  }

  async aiTranslate(): Promise<void> {
    const lang = prompt('Langue cible (ex: en, es, de, ar) :', 'en');
    if (!lang) return;
    const p = this.savedPersonsList[0] || DEFAULT_PERSON;
    try {
      const resp = await this.aiPost(
        `Traduis ces données en ${lang}. UNIQUEMENT JSON (mêmes clés): ` +
        JSON.stringify({prenoms:p.prenoms,nom:p.nom,titre:p.titre,entreprise:p.entreprise})
      );
      const match = resp.match(/\{[\s\S]*\}/);
      if (match) { Object.assign(p, JSON.parse(match[0])); this.refreshPreview(); this.showToast('🌐 Traduit'); }
    } catch { this.showToast('❌ IA indisponible'); }
  }

  async sendChatMessage(): Promise<void> {
    if (!this.chatInput.trim() || this.aiChatLoading) return;
    const msg = this.chatInput.trim();
    this.chatMessages.push({role:'user',content:msg});
    this.chatInput = '';
    this.aiChatLoading = true; this.cdr.detectChanges();
    try {
      const resp = await this.aiPost(
        `Tu es un expert Card Builder (badges identité/événement, cartes visite/scolaires). ` +
        `Catégorie courante: ${this.activeCategoryLabel}. Question: ${msg}`
      );
      this.chatMessages.push({role:'assistant',content:resp});
    } catch { this.chatMessages.push({role:'assistant',content:'Service IA indisponible.'}); }
    this.aiChatLoading = false; this.cdr.detectChanges();
  }

  applyAiMessage(content: string): void {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return;
    try {
      const data = JSON.parse(match[0]);
      this.addBulkDraft();
      Object.assign(this.bulkDrafts[this.bulkDrafts.length-1], data);
      this.openBulkModal();
    } catch {}
  }

  showToast(msg: string): void {
    this.toastMsg = msg; this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastVisible = false; this.cdr.detectChanges(); }, 2800);
    this.cdr.detectChanges();
  }
}
