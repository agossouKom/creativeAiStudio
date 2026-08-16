
const TEMPLATE_DATA = [
  { id:'moderne-beige', name:'Moderne Beige', category:'Moderne', color:'#c8b89a', accent:'#7a5c3e', hasPhoto:true, isNew:false, ats:false, layout:'two-left' },
  { id:'bordeaux', name:'Bordeaux', category:'Corporate', color:'#8b2535', accent:'#8b2535', hasPhoto:true, isNew:false, ats:false, layout:'two-left' },
  { id:'bleu-pro', name:'Bleu Professionnel', category:'Corporate', color:'#1e3a6e', accent:'#1e3a6e', hasPhoto:true, isNew:false, ats:true, layout:'two-left' },
  { id:'minimaliste-gris', name:'Minimaliste Gris', category:'Minimaliste', color:'#718096', accent:'#718096', hasPhoto:false, isNew:false, ats:true, layout:'one' },
  { id:'minimaliste-noir', name:'Minimaliste Noir', category:'Minimaliste', color:'#1a202c', accent:'#1a202c', hasPhoto:false, isNew:false, ats:true, layout:'one' },
  { id:'vert-moderne', name:'Vert Moderne', category:'Moderne', color:'#276749', accent:'#276749', hasPhoto:true, isNew:false, ats:false, layout:'two-left' },
  { id:'bleu-clair', name:'Bleu Clair', category:'IT/Développeur', color:'#3182ce', accent:'#3182ce', hasPhoto:true, isNew:false, ats:true, layout:'two-left' },
  { id:'beige-elegant', name:'Beige Élégant', category:'Executive', color:'#b7a68e', accent:'#9c7c5a', hasPhoto:true, isNew:false, ats:false, layout:'two-left' },
  { id:'vert-pastel', name:'Vert Pastel', category:'Créatif', color:'#68d391', accent:'#38a169', hasPhoto:true, isNew:true, ats:false, layout:'two-left' },
  { id:'photographe', name:'Photographe', category:'Designer', color:'#1a202c', accent:'#e2b97f', hasPhoto:true, isNew:true, ats:false, layout:'two-left' },
  { id:'violet', name:'Violet', category:'Créatif', color:'#6b46c1', accent:'#6b46c1', hasPhoto:true, isNew:false, ats:false, layout:'two-left' },
  { id:'orange', name:'Orange', category:'Marketing', color:'#dd6b20', accent:'#dd6b20', hasPhoto:true, isNew:true, ats:false, layout:'two-left' },
  { id:'bleu-marine', name:'Bleu Marine', category:'IT/Développeur', color:'#1a365d', accent:'#2b6cb0', hasPhoto:true, isNew:false, ats:true, layout:'two-left' },
  { id:'rouge', name:'Rouge', category:'Marketing', color:'#c53030', accent:'#c53030', hasPhoto:true, isNew:false, ats:false, layout:'two-left' },
  { id:'gris', name:'Gris', category:'Corporate', color:'#4a5568', accent:'#718096', hasPhoto:false, isNew:false, ats:true, layout:'one' },
];

function renderCV(tpl, data) {
  const d = data || getDefaultData();
  const accent = tpl.accent;
  const light = hexToRgba(accent, 0.10);
  const photo = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : `<div style="width:100%;height:100%;background:#e2e8f0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;color:#a0aec0;">&#9786;</div>`;

  const skillsHtml = (d.skills||[]).map(s=>`<div style="display:inline-block;background:${light};color:${accent};border-radius:20px;padding:3px 10px;font-size:10px;font-weight:600;margin:2px;">${s}</div>`).join('');
  const langsHtml = (d.languages||[]).map(l=>`<div style="font-size:11px;color:#4a5568;margin-bottom:4px;">• ${l.name} <span style="color:${accent};font-weight:600;">${l.level}</span></div>`).join('');

  const expHtml = (d.experiences||[]).map(e=>`
    <div style="margin-bottom:14px;">
      <div style="font-weight:700;font-size:12px;color:#1a202c;">${e.title||'Titre du poste'}</div>
      <div style="font-size:11px;color:${accent};font-weight:600;margin:2px 0;">${e.company||''} ${e.period?'| '+e.period:''}</div>
      <div style="font-size:10.5px;color:#4a5568;line-height:1.5;margin-top:4px;">${(e.description||'').replace(/\n/g,'<br>')}</div>
    </div>`).join('');

  const eduHtml = (d.education||[]).map(e=>`
    <div style="margin-bottom:10px;">
      <div style="font-weight:700;font-size:11.5px;color:#1a202c;">${e.degree||''}</div>
      <div style="font-size:11px;color:${accent};">${e.school||''}</div>
      <div style="font-size:10px;color:#718096;">${e.year||''}</div>
    </div>`).join('');

  if (tpl.layout === 'one') return renderOneCol(d, tpl, accent, light, photo, skillsHtml, langsHtml, expHtml, eduHtml);
  return renderTwoCol(d, tpl, accent, light, photo, skillsHtml, langsHtml, expHtml, eduHtml);
}

function renderTwoCol(d, tpl, accent, light, photo, skillsHtml, langsHtml, expHtml, eduHtml) {
  const isDark = isDarkColor(tpl.color);
  const sideText = isDark ? '#fff' : '#1a202c';
  const sideMuted = isDark ? 'rgba(255,255,255,0.7)' : '#4a5568';
  return `
<div style="font-family:'Inter',sans-serif;display:flex;width:794px;min-height:1123px;background:#fff;">
  <div style="width:260px;background:${tpl.color};padding:30px 22px;flex-shrink:0;">
    ${tpl.hasPhoto ? `<div style="width:90px;height:90px;border-radius:50%;margin:0 auto 16px;border:3px solid rgba(255,255,255,0.3);overflow:hidden;">${photo}</div>` : ''}
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:18px;font-weight:800;color:${sideText};line-height:1.2;">${d.firstName||'Prénom'} ${d.lastName||'Nom'}</div>
      <div style="font-size:11px;color:${sideMuted};margin-top:4px;font-weight:500;">${d.title||'Titre du poste'}</div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:16px;margin-bottom:16px;">
      <div style="font-size:10px;font-weight:800;color:${sideMuted};letter-spacing:1.5px;margin-bottom:10px;">CONTACT</div>
      ${d.email?`<div style="font-size:10px;color:${sideText};margin-bottom:6px;word-break:break-all;">✉ ${d.email}</div>`:''}
      ${d.phone?`<div style="font-size:10px;color:${sideText};margin-bottom:6px;">📞 ${d.phone}</div>`:''}
      ${d.address?`<div style="font-size:10px;color:${sideText};margin-bottom:6px;">📍 ${d.address}</div>`:''}
      ${d.linkedin?`<div style="font-size:10px;color:${sideText};margin-bottom:6px;word-break:break-all;">🔗 ${d.linkedin}</div>`:''}
    </div>
    ${(d.skills&&d.skills.length)?`<div style="margin-bottom:16px;">
      <div style="font-size:10px;font-weight:800;color:${sideMuted};letter-spacing:1.5px;margin-bottom:10px;">COMPÉTENCES</div>
      ${d.skills.map(s=>`<div style="background:rgba(255,255,255,0.15);border-radius:20px;padding:4px 10px;font-size:10px;color:${sideText};margin-bottom:4px;display:inline-block;margin-right:4px;">${s}</div>`).join('')}
    </div>`:''}
    ${(d.languages&&d.languages.length)?`<div>
      <div style="font-size:10px;font-weight:800;color:${sideMuted};letter-spacing:1.5px;margin-bottom:10px;">LANGUES</div>
      ${d.languages.map(l=>`<div style="font-size:10px;color:${sideText};margin-bottom:5px;">${l.name} - <span style="opacity:.8;">${l.level}</span></div>`).join('')}
    </div>`:''}
  </div>
  <div style="flex:1;padding:36px 28px;">
    ${d.about?`<div style="margin-bottom:22px;">
      <div style="font-size:13px;font-weight:800;color:${accent};border-bottom:2px solid ${accent};padding-bottom:5px;margin-bottom:10px;letter-spacing:1px;">À PROPOS</div>
      <div style="font-size:11px;color:#4a5568;line-height:1.7;">${d.about}</div>
    </div>`:''}
    ${(d.experiences&&d.experiences.length)?`<div style="margin-bottom:22px;">
      <div style="font-size:13px;font-weight:800;color:${accent};border-bottom:2px solid ${accent};padding-bottom:5px;margin-bottom:12px;letter-spacing:1px;">EXPÉRIENCES PROFESSIONNELLES</div>
      ${expHtml}
    </div>`:''}
    ${(d.education&&d.education.length)?`<div>
      <div style="font-size:13px;font-weight:800;color:${accent};border-bottom:2px solid ${accent};padding-bottom:5px;margin-bottom:12px;letter-spacing:1px;">FORMATION</div>
      ${eduHtml}
    </div>`:''}
  </div>
</div>`;
}

function renderOneCol(d, tpl, accent, light, photo, skillsHtml, langsHtml, expHtml, eduHtml) {
  return `
<div style="font-family:'Inter',sans-serif;width:794px;min-height:1123px;background:#fff;padding:50px 60px;">
  <div style="border-bottom:3px solid ${accent};padding-bottom:20px;margin-bottom:28px;display:flex;align-items:flex-end;justify-content:space-between;">
    <div>
      <div style="font-size:28px;font-weight:800;color:#1a202c;">${d.firstName||'Prénom'} ${d.lastName||'Nom'}</div>
      <div style="font-size:14px;color:${accent};font-weight:600;margin-top:4px;">${d.title||'Titre du poste'}</div>
    </div>
    <div style="text-align:right;font-size:10.5px;color:#4a5568;line-height:1.8;">
      ${d.email?`<div>${d.email}</div>`:''}
      ${d.phone?`<div>${d.phone}</div>`:''}
      ${d.address?`<div>${d.address}</div>`:''}
    </div>
  </div>
  ${d.about?`<div style="margin-bottom:22px;"><div style="font-size:12px;font-weight:800;color:${accent};letter-spacing:1.5px;margin-bottom:8px;text-transform:uppercase;">À Propos</div><div style="font-size:11px;color:#4a5568;line-height:1.7;">${d.about}</div></div>`:''}
  ${(d.experiences&&d.experiences.length)?`<div style="margin-bottom:22px;"><div style="font-size:12px;font-weight:800;color:${accent};letter-spacing:1.5px;margin-bottom:10px;text-transform:uppercase;">Expériences</div>${expHtml}</div>`:''}
  ${(d.skills&&d.skills.length)?`<div style="margin-bottom:22px;"><div style="font-size:12px;font-weight:800;color:${accent};letter-spacing:1.5px;margin-bottom:10px;text-transform:uppercase;">Compétences</div>${skillsHtml}</div>`:''}
  ${(d.education&&d.education.length)?`<div><div style="font-size:12px;font-weight:800;color:${accent};letter-spacing:1.5px;margin-bottom:10px;text-transform:uppercase;">Formation</div>${eduHtml}</div>`:''}
</div>`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function isDarkColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (r*299 + g*587 + b*114) / 1000 < 128;
}
function getDefaultData() {
  return {
    firstName:'Sacha', lastName:'Dubois', title:'Chargée de Projet',
    email:'sacha.dubois@mail.com', phone:'07 58 34 21 01',
    address:'Paris, France', linkedin:'linkedin.com/in/sachadubois', photo:'',
    about:'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    experiences:[{ title:'Cheffe de Projet', company:'Lorem Ipsum SARL', period:'2021 - Aujourd\'hui', description:'• Gestion de projets\n• Coordination des équipes\n• Reporting et suivi' }],
    education:[{ degree:'Master Management de Projet', school:'Université Paris Dauphine', year:'2019' }],
    skills:['Gestion de projet','Planification','Communication','Leadership','Excel','Google Sheets'],
    languages:[{ name:'Français', level:'Natif' },{ name:'Anglais', level:'Courant' }]
  };
}
