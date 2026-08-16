// ─── State ───────────────────────────────────────────────
const state = {
  templates: TEMPLATE_DATA,
  filtered: [...TEMPLATE_DATA],
  selected: null,
  favorites: new Set(),
  activeTab: 'content',
  activeNav: 'all',
  expandedExp: new Set([0]),
  expandedEdu: new Set([0]),
  filters: { category:'all', color:'', search:'', photo:null, ats:false, isNew:false },
  cvData: getDefaultData(),
  previewId: null,
};

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderGrid();
  renderEditorPlaceholder();
  bindSidebar();
  bindToolbar();
  bindEditor();
  bindModal();
});

// ─── Grid ─────────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('templateGrid');
  if (!state.filtered.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>Aucun modèle trouvé</p></div>`;
    return;
  }
  grid.innerHTML = state.filtered.map(tpl => {
    const isFav = state.favorites.has(tpl.id);
    const isSelected = state.selected?.id === tpl.id;
    return `
    <div class="tpl-card${isSelected?' selected':''}${isFav?' favorited':''}" id="card-${tpl.id}">
      <div class="tpl-preview">
        <div class="tpl-preview-inner" id="preview-${tpl.id}">${renderCV(tpl, state.cvData)}</div>
        <div class="tpl-overlay">
          <button class="tpl-action-btn btn-preview-tpl" onclick="openPreview('${tpl.id}')" title="Aperçu"><i class="fas fa-eye"></i></button>
          <button class="tpl-action-btn btn-edit-tpl" onclick="openEditor('${tpl.id}')" title="Éditer"><i class="fas fa-pen"></i></button>
          <button class="tpl-action-btn btn-fav-tpl" onclick="toggleFav('${tpl.id}')" title="Favori"><i class="fas fa-heart"></i></button>
        </div>
      </div>
      <div class="tpl-footer">
        <span class="tpl-name">${tpl.name}</span>
        <div class="tpl-footer-actions">
          <button class="fav-btn" onclick="toggleFav('${tpl.id}')" title="Favori"><i class="${isFav?'fas':'far'} fa-heart"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function applyFilters() {
  let f = [...state.templates];
  const { category, color, search, ats, isNew } = state.filters;
  if (state.activeNav === 'favorites') { f = f.filter(t => state.favorites.has(t.id)); }
  if (category && category !== 'all') f = f.filter(t => t.category === category);
  if (color) f = f.filter(t => t.color.toLowerCase() === color.toLowerCase() || t.accent.toLowerCase() === color.toLowerCase());
  if (search) f = f.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()));
  if (ats) f = f.filter(t => t.ats);
  if (isNew) f = f.filter(t => t.isNew);
  const photo = document.getElementById('togglePhoto').classList.contains('active');
  const noPhoto = document.getElementById('toggleNoPhoto').classList.contains('active');
  if (photo && !noPhoto) f = f.filter(t => t.hasPhoto);
  if (noPhoto && !photo) f = f.filter(t => !t.hasPhoto);
  state.filtered = f;
  renderGrid();
}

// ─── Editor open/close ────────────────────────────────────
function openEditor(id) {
  const tpl = state.templates.find(t => t.id === id);
  if (!tpl) return;
  state.selected = tpl;
  document.getElementById('editorPanel').classList.remove('hidden');
  renderEditorContent();
  document.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('card-' + id);
  if (card) card.classList.add('selected');
}

function renderEditorPlaceholder() {
  const body = document.getElementById('editorBody');
  body.innerHTML = `
  <div class="editor-placeholder">
    <i class="fas fa-mouse-pointer"></i>
    <h3>Sélectionnez un modèle</h3>
    <p>Cliquez sur l'icône <strong>crayon</strong> d'un modèle pour l'éditer en temps réel.</p>
  </div>`;
}

function renderEditorContent() {
  const tab = state.activeTab;
  const body = document.getElementById('editorBody');
  if (tab === 'content') body.innerHTML = buildContentTab();
  else if (tab === 'layout') body.innerHTML = buildLayoutTab();
  else body.innerHTML = buildThemeTab();
  bindFormListeners();
}

// ─── Content tab ──────────────────────────────────────────
function buildContentTab() {
  const d = state.cvData;
  return `
  <div class="editor-section">
    <div class="editor-section-title">Informations Personnelles</div>
    <div class="photo-upload-area">
      <div style="width:60px;height:60px;border-radius:50%;overflow:hidden;border:3px solid #e2e8f0;flex-shrink:0;">
        ${d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;" id="photoPreviewImg">` : `<div style="width:100%;height:100%;background:#edf2f7;display:flex;align-items:center;justify-content:center;font-size:22px;color:#a0aec0;">&#9786;</div>`}
      </div>
      <div class="photo-actions">
        <button class="btn-photo btn-change-photo" onclick="document.getElementById('photoInput').click()"><i class="fas fa-camera"></i> Changer la photo</button>
        <button class="btn-photo btn-delete-photo" onclick="removePhoto()"><i class="fas fa-trash"></i></button>
        <input type="file" id="photoInput" accept="image/*" onchange="handlePhoto(event)">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Prénom</label><input id="f-firstName" value="${d.firstName||''}" placeholder="Prénom"></div>
      <div class="form-group"><label>Nom</label><input id="f-lastName" value="${d.lastName||''}" placeholder="Nom"></div>
    </div>
    <div class="form-group"><label>Métier / Titre</label><input id="f-title" value="${d.title||''}" placeholder="Ex: Développeur Full Stack"></div>
    <div class="form-group"><label>Email</label><input id="f-email" type="email" value="${d.email||''}" placeholder="email@exemple.com"></div>
    <div class="form-row">
      <div class="form-group"><label>Téléphone</label><input id="f-phone" value="${d.phone||''}" placeholder="06 00 00 00 00"></div>
      <div class="form-group"><label>Adresse</label><input id="f-address" value="${d.address||''}" placeholder="Paris, France"></div>
    </div>
    <div class="form-group"><label>LinkedIn</label><input id="f-linkedin" value="${d.linkedin||''}" placeholder="linkedin.com/in/..."></div>
  </div>
  <div class="section-divider"></div>
  <div class="editor-section">
    <div class="editor-section-title">À Propos</div>
    <div class="form-group">
      <textarea id="f-about" maxlength="500" oninput="document.getElementById('aboutCount').textContent=this.value.length+'/500'">${d.about||''}</textarea>
      <span class="char-count" id="aboutCount">${(d.about||'').length}/500</span>
    </div>
  </div>
  <div class="section-divider"></div>
  <div class="editor-section">
    <div class="editor-section-title">Expériences Professionnelles</div>
    <div id="expList">${buildExpList()}</div>
    <button class="btn-add" onclick="addExperience()"><i class="fas fa-plus"></i> Ajouter une expérience</button>
  </div>
  <div class="section-divider"></div>
  <div class="editor-section">
    <div class="editor-section-title">Formation</div>
    <div id="eduList">${buildEduList()}</div>
    <button class="btn-add" onclick="addEducation()"><i class="fas fa-plus"></i> Ajouter une formation</button>
  </div>
  <div class="section-divider"></div>
  <div class="editor-section">
    <div class="editor-section-title">Compétences</div>
    <div class="skills-container" id="skillsTags">${buildSkillTags()}</div>
    <div class="skill-input-row">
      <input class="skill-input" id="skillInput" placeholder="Nouvelle compétence..." onkeydown="if(event.key==='Enter')addSkill()">
      <button class="btn-add-skill" onclick="addSkill()">+ Ajouter</button>
    </div>
  </div>
  <div class="section-divider"></div>
  <div class="editor-section">
    <div class="editor-section-title">Langues</div>
    <div id="langList">${buildLangList()}</div>
    <button class="btn-add" onclick="addLanguage()"><i class="fas fa-plus"></i> Ajouter une langue</button>
  </div>`;
}

function buildExpList() {
  return (state.cvData.experiences||[]).map((e,i) => `
  <div class="exp-item" id="exp-item-${i}">
    <div class="exp-header" onclick="toggleExp(${i})">
      <div class="exp-header-left">
        <i class="fas fa-${state.expandedExp.has(i)?'chevron-up':'chevron-down'}"></i>
        <span class="exp-label">${e.title||'Expérience '+(i+1)}</span>
      </div>
      <button class="exp-delete" onclick="event.stopPropagation();removeExp(${i})"><i class="fas fa-trash"></i></button>
    </div>
    ${state.expandedExp.has(i)?`
    <div class="exp-body">
      <div class="form-group"><label>Titre du poste</label><input value="${e.title||''}" oninput="updateExp(${i},'title',this.value)" placeholder="Ex: Chef de projet"></div>
      <div class="form-row">
        <div class="form-group"><label>Entreprise</label><input value="${e.company||''}" oninput="updateExp(${i},'company',this.value)" placeholder="Nom société"></div>
        <div class="form-group"><label>Période</label><input value="${e.period||''}" oninput="updateExp(${i},'period',this.value)" placeholder="2021 - Aujourd'hui"></div>
      </div>
      <div class="form-group"><label>Description</label><textarea oninput="updateExp(${i},'description',this.value)" placeholder="• Tâches et réalisations...">${e.description||''}</textarea></div>
    </div>`:''}`
  ).join('');
}

function buildEduList() {
  return (state.cvData.education||[]).map((e,i) => `
  <div class="exp-item" id="edu-item-${i}">
    <div class="exp-header" onclick="toggleEdu(${i})">
      <div class="exp-header-left">
        <i class="fas fa-${state.expandedEdu.has(i)?'chevron-up':'chevron-down'}"></i>
        <span class="exp-label">${e.degree||'Formation '+(i+1)}</span>
      </div>
      <button class="exp-delete" onclick="event.stopPropagation();removeEdu(${i})"><i class="fas fa-trash"></i></button>
    </div>
    ${state.expandedEdu.has(i)?`
    <div class="exp-body">
      <div class="form-group"><label>Diplôme</label><input value="${e.degree||''}" oninput="updateEdu(${i},'degree',this.value)" placeholder="Ex: Master Informatique"></div>
      <div class="form-row">
        <div class="form-group"><label>École</label><input value="${e.school||''}" oninput="updateEdu(${i},'school',this.value)" placeholder="Université..."></div>
        <div class="form-group"><label>Année</label><input value="${e.year||''}" oninput="updateEdu(${i},'year',this.value)" placeholder="2019"></div>
      </div>
    </div>`:''}`
  ).join('');
}

function buildSkillTags() {
  return (state.cvData.skills||[]).map((s,i) => `
    <div class="skill-tag">${s}<button class="skill-remove" onclick="removeSkill(${i})">×</button></div>`).join('');
}

function buildLangList() {
  return (state.cvData.languages||[]).map((l,i) => `
  <div class="form-row" id="lang-${i}" style="align-items:center;margin-bottom:6px;">
    <div class="form-group" style="margin:0"><input value="${l.name||''}" oninput="updateLang(${i},'name',this.value)" placeholder="Ex: Anglais"></div>
    <div class="form-group" style="margin:0"><select oninput="updateLang(${i},'level',this.value)" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;">
      ${['Débutant','Intermédiaire','Avancé','Courant','Natif'].map(v=>`<option ${l.level===v?'selected':''}>${v}</option>`).join('')}
    </select></div>
    <button class="exp-delete" onclick="removeLang(${i})" style="margin-top:0;"><i class="fas fa-trash"></i></button>
  </div>`).join('');
}

// ─── Layout tab ───────────────────────────────────────────
function buildLayoutTab() {
  const tpl = state.selected;
  return `
  <div class="editor-section">
    <div class="editor-section-title">Type de mise en page</div>
    <div class="layout-grid">
      <div class="layout-option ${tpl?.layout==='two-left'?'active':''}" onclick="setLayout('two-left')">
        <i class="fas fa-columns"></i><span>Deux colonnes</span>
      </div>
      <div class="layout-option ${tpl?.layout==='one'?'active':''}" onclick="setLayout('one')">
        <i class="fas fa-align-justify"></i><span>Une colonne</span>
      </div>
    </div>
  </div>
  <div class="section-divider"></div>
  <div class="editor-section">
    <div class="editor-section-title">Police d'écriture</div>
    <select class="font-select" id="fontSelect" onchange="setFont(this.value)">
      <option value="Inter" selected>Inter (Modern)</option>
      <option value="Playfair Display">Playfair Display (Élégant)</option>
      <option value="Georgia">Georgia (Classique)</option>
      <option value="Arial">Arial (Neutre)</option>
    </select>
  </div>
  <div class="section-divider"></div>
  <div class="editor-section">
    <div class="editor-section-title">Taille de police</div>
    <div class="form-group">
      <label>Taille du corps (px)</label>
      <input type="range" min="9" max="14" value="11" id="fontSizeRange" oninput="document.getElementById('fontSizeVal').textContent=this.value">
      <div style="text-align:right;font-size:11px;color:#a0aec0;margin-top:2px;" id="fontSizeVal">11</div>
    </div>
  </div>`;
}

// ─── Theme tab ────────────────────────────────────────────
function buildThemeTab() {
  const palettes = ['#6c47ff','#1e3a6e','#8b2535','#276749','#dd6b20','#6b46c1','#c53030','#1a365d','#718096','#1a202c'];
  return `
  <div class="editor-section">
    <div class="editor-section-title">Couleur principale</div>
    <div class="color-palette">${palettes.map(c=>`<div class="palette-swatch${state.selected?.accent===c?' active':''}" style="background:${c}" onclick="setAccentColor('${c}')"></div>`).join('')}</div>
    <div class="custom-color-row">
      <label>Couleur personnalisée :</label>
      <input type="color" value="${state.selected?.accent||'#6c47ff'}" onchange="setAccentColor(this.value)">
    </div>
  </div>
  <div class="section-divider"></div>
  <div class="editor-section">
    <div class="editor-section-title">Couleur de fond (sidebar)</div>
    <div class="color-palette">${palettes.map(c=>`<div class="palette-swatch${state.selected?.color===c?' active':''}" style="background:${c}" onclick="setSideColor('${c}')"></div>`).join('')}</div>
    <div class="custom-color-row">
      <label>Couleur personnalisée :</label>
      <input type="color" value="${state.selected?.color||'#1a202c'}" onchange="setSideColor(this.value)">
    </div>
  </div>`;
}

// ─── Mutations ────────────────────────────────────────────
function updateField(key, val) {
  state.cvData[key] = val;
  refreshPreviews();
}
function updateExp(i, key, val) { state.cvData.experiences[i][key] = val; refreshPreviews(); }
function updateEdu(i, key, val) { state.cvData.education[i][key] = val; refreshPreviews(); }
function updateLang(i, key, val) { state.cvData.languages[i][key] = val; refreshPreviews(); }

function addExperience() {
  state.cvData.experiences.push({ title:'', company:'', period:'', description:'' });
  const idx = state.cvData.experiences.length - 1;
  state.expandedExp.add(idx);
  renderEditorContent();
}
function removeExp(i) { state.cvData.experiences.splice(i,1); state.expandedExp.delete(i); renderEditorContent(); refreshPreviews(); }
function toggleExp(i) { state.expandedExp.has(i)?state.expandedExp.delete(i):state.expandedExp.add(i); document.getElementById('expList').innerHTML = buildExpList(); bindFormListeners(); }

function addEducation() {
  state.cvData.education.push({ degree:'', school:'', year:'' });
  const idx = state.cvData.education.length - 1;
  state.expandedEdu.add(idx);
  renderEditorContent();
}
function removeEdu(i) { state.cvData.education.splice(i,1); state.expandedEdu.delete(i); renderEditorContent(); refreshPreviews(); }
function toggleEdu(i) { state.expandedEdu.has(i)?state.expandedEdu.delete(i):state.expandedEdu.add(i); document.getElementById('eduList').innerHTML = buildEduList(); bindFormListeners(); }

function addSkill() {
  const inp = document.getElementById('skillInput');
  const val = (inp?.value||'').trim();
  if (!val) return;
  state.cvData.skills.push(val);
  inp.value = '';
  document.getElementById('skillsTags').innerHTML = buildSkillTags();
  refreshPreviews();
}
function removeSkill(i) { state.cvData.skills.splice(i,1); document.getElementById('skillsTags').innerHTML = buildSkillTags(); refreshPreviews(); }

function addLanguage() {
  state.cvData.languages.push({ name:'', level:'Débutant' });
  document.getElementById('langList').innerHTML = buildLangList();
  bindFormListeners();
}
function removeLang(i) { state.cvData.languages.splice(i,1); document.getElementById('langList').innerHTML = buildLangList(); refreshPreviews(); }

function setLayout(layout) { if(state.selected){state.selected.layout=layout;} renderEditorContent(); refreshPreviews(); }
function setAccentColor(c) { if(state.selected){state.selected.accent=c;} refreshPreviews(); renderEditorContent(); }
function setSideColor(c) { if(state.selected){state.selected.color=c;} refreshPreviews(); renderEditorContent(); }

function handlePhoto(e) {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => { state.cvData.photo = ev.target.result; renderEditorContent(); refreshPreviews(); };
  reader.readAsDataURL(file);
}
function removePhoto() { state.cvData.photo = ''; renderEditorContent(); refreshPreviews(); }

function toggleFav(id) {
  state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
  const card = document.getElementById('card-'+id);
  if (card) {
    card.classList.toggle('favorited');
    const icon = card.querySelector('.fav-btn i');
    if (icon) { icon.classList.toggle('fas'); icon.classList.toggle('far'); }
  }
  if (state.activeNav === 'favorites') applyFilters();
  showToast(state.favorites.has(id) ? '❤️ Ajouté aux favoris' : 'Retiré des favoris');
}

// ─── Preview ──────────────────────────────────────────────
function openPreview(id) {
  const tpl = state.templates.find(t => t.id === id);
  if (!tpl) return;
  state.previewId = id;
  document.getElementById('previewTitle').textContent = 'Aperçu – ' + tpl.name;
  document.getElementById('previewBody').innerHTML = `<div style="transform-origin:top center;transform:scale(0.75);">${renderCV(tpl, state.cvData)}</div>`;
  document.getElementById('previewModal').classList.add('open');
}

function refreshPreviews() {
  state.filtered.forEach(tpl => {
    const el = document.getElementById('preview-'+tpl.id);
    if (el) el.innerHTML = renderCV(tpl, state.cvData);
  });
}

// ─── PDF Export ───────────────────────────────────────────
function exportPDF() {
  if (!state.selected) { showToast('⚠️ Sélectionnez un modèle d\'abord'); return; }
  const el = document.createElement('div');
  el.innerHTML = renderCV(state.selected, state.cvData);
  el.style.fontFamily = 'Inter, sans-serif';
  const name = `${state.cvData.firstName||'CV'}_${state.cvData.lastName||''}`.trim();
  showToast('📄 Génération du PDF...');
  html2pdf().set({
    margin:0, filename:`${name}.pdf`,
    image:{type:'jpeg',quality:0.98},
    html2canvas:{scale:2,useCORS:true},
    jsPDF:{unit:'px',format:[794,1123],orientation:'portrait'}
  }).from(el).save().then(() => showToast('✅ PDF téléchargé !'));
}

// ─── Bindings ─────────────────────────────────────────────
function bindSidebar() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeNav = btn.dataset.nav;
      applyFilters();
    });
  });
  document.querySelectorAll('.cat-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.category = btn.dataset.cat;
      applyFilters();
    });
  });
  document.querySelectorAll('.color-swatch:not(.color-more)').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = btn.dataset.color;
      if (state.filters.color === c) { state.filters.color = ''; btn.classList.remove('active'); }
      else {
        document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
        state.filters.color = c; btn.classList.add('active');
      }
      applyFilters();
    });
  });
  ['togglePhoto','toggleNoPhoto','toggleATS','toggleNew'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', function() {
      this.classList.toggle('active');
      if (id === 'toggleATS') state.filters.ats = this.classList.contains('active');
      if (id === 'toggleNew') state.filters.isNew = this.classList.contains('active');
      applyFilters();
    });
  });
}

function bindToolbar() {
  document.getElementById('searchInput').addEventListener('input', e => { state.filters.search = e.target.value; applyFilters(); });
  document.getElementById('sortSelect').addEventListener('change', e => {
    const v = e.target.value;
    if (v === 'name') state.filtered.sort((a,b) => a.name.localeCompare(b.name));
    else if (v === 'recent') state.filtered.sort((a,b) => b.isNew - a.isNew);
    renderGrid();
  });
}

function bindEditor() {
  document.getElementById('btnCloseEditor').addEventListener('click', () => {
    document.getElementById('editorPanel').classList.add('hidden');
    state.selected = null;
    document.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('selected'));
    renderEditorPlaceholder();
  });
  document.getElementById('btnDownloadPDF').addEventListener('click', exportPDF);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;
      if (state.selected) renderEditorContent();
    });
  });
  document.getElementById('btnExpand').addEventListener('click', () => {
    if (!state.selected) return; openPreview(state.selected.id);
  });
}

function bindFormListeners() {
  const fields = { firstName:'f-firstName', lastName:'f-lastName', title:'f-title', email:'f-email', phone:'f-phone', address:'f-address', linkedin:'f-linkedin', about:'f-about' };
  Object.entries(fields).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', e => updateField(key, e.target.value));
  });
}

function bindModal() {
  document.getElementById('btnCloseModal').addEventListener('click', () => document.getElementById('previewModal').classList.remove('open'));
  document.getElementById('previewModal').addEventListener('click', e => { if(e.target.id==='previewModal') e.target.classList.remove('open'); });
  document.getElementById('btnUseTemplate').addEventListener('click', () => {
    if (state.previewId) { openEditor(state.previewId); document.getElementById('previewModal').classList.remove('open'); }
  });
}

// ─── Toast ────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
