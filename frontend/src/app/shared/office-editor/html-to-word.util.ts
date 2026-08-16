/**
 * Transforme un HTML avec CSS moderne (flex, backgrounds) en HTML compatible
 * Word/LibreOffice pour une meilleure conversion DOCX via ConvertService.
 */
export function htmlToWordCompatible(rawHtml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // 1. Flex multi-colonnes → <table> (préservation des couleurs de fond)
  convertFlexToTable(doc);

  // 2. Nettoyer les propriétés CSS non supportées par LibreOffice/Word
  cleanStyles(doc);

  // 3. Images : float:left → image flottante dans Word = déplaçable librement
  //    LibreOffice convertit float en "habillage du texte", ce qui permet le
  //    glisser-déposer et le redimensionnement par les poignées dans OnlyOffice.
  doc.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') ?? '';
    if (!src) return; // ignorer les images vides
    const s = img.getAttribute('style') ?? '';
    // Préserver une taille lisible et activer le float
    const w = s.match(/width\s*:\s*(\d+)(\w+)/);
    const size = w ? `width:${Math.min(parseInt(w[1]), 120)}${w[2]};` : 'width:100pt;';
    img.setAttribute('style', `${size}float:left;margin:0 10pt 6pt 0;`);
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body  { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; }
    h1    { font-size: 20pt; margin: 0 0 4pt; }
    h2    { font-size: 11pt; font-weight: bold; text-transform: uppercase;
            letter-spacing: 1px; border-bottom: 1pt solid currentColor;
            padding-bottom: 2pt; margin: 8pt 0 4pt; }
    h3    { font-size: 10.5pt; font-weight: bold; margin: 5pt 0 2pt; }
    p, li { font-size: 10pt; margin: 1pt 0; line-height: 1.35; }
    table { width: 100%; border-collapse: collapse; }
    td    { vertical-align: top; padding: 6pt 8pt; }
    ul    { margin: 2pt 0; padding-left: 14pt; }
    span  { display: inline; }
  </style>
</head>
<body>${doc.body.innerHTML}</body>
</html>`;
}

// ─── Convertit les conteneurs flex en tableaux HTML ──────────────────────────

function convertFlexToTable(doc: Document) {
  // On travaille sur une copie snapshot pour éviter les mutations en cours de boucle
  const flexEls = Array.from(doc.querySelectorAll<HTMLElement>('*')).filter(el => {
    const s = el.getAttribute('style') ?? '';
    return /display\s*:\s*flex/.test(s) && !/flex-direction\s*:\s*column/.test(s);
  });

  for (const el of flexEls) {
    const children = Array.from(el.children) as HTMLElement[];
    if (children.length < 2) continue;

    const table = doc.createElement('table');
    // border:none → pas de bordure de tableau visible, colonnes ajustables librement dans Word
    table.setAttribute('style', 'width:100%;border-collapse:collapse;border:none;');
    const tr = doc.createElement('tr');

    for (const child of children) {
      const td = doc.createElement('td');
      const childStyle = child.getAttribute('style') ?? '';

      // Construire le style td en préservant : width, background, color, padding, font
      const tdStyleParts: string[] = ['vertical-align:top;'];

      // Largeur — convertit px → pt (1pt ≈ 1.33px, page Word ~595pt)
      const widthMatch = childStyle.match(/(?:^|;)\s*width\s*:\s*([\d.]+)(px|pt|%)/);
      if (widthMatch) {
        const val = parseFloat(widthMatch[1]);
        const unit = widthMatch[2];
        const ptVal = unit === 'px' ? Math.round(val * 0.75) : Math.round(val);
        // Ramener dans un range raisonnable (max ~45% pour ne pas casser la page)
        const pct = unit === '%' ? Math.min(val, 45) : Math.min(ptVal, 200);
        tdStyleParts.push(unit === '%' ? `width:${pct}%;` : `width:${ptVal}pt;`);
      }

      // Background-color → fond de cellule (Word le supporte via shading)
      const bgMatch = childStyle.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/);
      if (bgMatch) {
        const bg = bgMatch[1].trim();
        if (!bg.includes('gradient') && !bg.includes('rgba')) {
          tdStyleParts.push(`background-color:${bg};`);
        }
      }

      // Color du texte
      const colorMatch = childStyle.match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
      if (colorMatch) tdStyleParts.push(`color:${colorMatch[1].trim()};`);

      // Padding
      const padMatch = childStyle.match(/(?:^|;)\s*padding\s*:\s*([^;]+)/);
      if (padMatch) tdStyleParts.push(`padding:${padMatch[1].trim()};`);

      // Font-size
      const fsMatch = childStyle.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/);
      if (fsMatch) tdStyleParts.push(`font-size:${fsMatch[1].trim()};`);

      td.setAttribute('style', tdStyleParts.join(''));
      td.innerHTML = child.innerHTML;
      tr.appendChild(td);
    }

    table.appendChild(tr);
    el.replaceWith(table);
  }
}

// ─── Supprime les propriétés CSS non supportées par Word/LibreOffice ─────────

function cleanStyles(doc: Document) {
  // Propriétés à supprimer (regex-safe, pas de regex complex chars)
  const REMOVE = [
    'display', 'flex', 'flex-direction', 'flex-wrap', 'flex-shrink', 'flex-grow',
    'align-items', 'align-self', 'justify-content', 'justify-self', 'gap',
    'grid', 'grid-template', 'grid-column', 'grid-row', 'grid-area',
    'position', 'z-index',
    'backdrop-filter', 'transition', 'animation', 'transform',
    'overflow', 'overflow-x', 'overflow-y', 'overflow-wrap',
    'box-sizing', 'min-height', 'max-height', 'min-width', 'max-width',
    'pointer-events', 'user-select', 'cursor', 'resize',
    'background-image', 'background-size', 'background-position', 'background-repeat',
    '-webkit-background-clip', '-webkit-text-fill-color', 'background-clip',
    'clip-path', 'filter', 'opacity',
    'letter-spacing', 'line-height',  // Garde ces deux commentés si tu veux les conserver
  ];
  // On garde : color, background-color, font-size, font-weight, font-family,
  //            text-align, border, padding, width, margin, text-decoration

  const elements = Array.from(doc.querySelectorAll<HTMLElement>('[style]'));
  for (const el of elements) {
    let style = el.getAttribute('style') ?? '';
    for (const prop of REMOVE) {
      // Supprime "prop: valeur;" (avec variantes d'espaces)
      style = style.replace(
        new RegExp(`(^|;)\\s*${prop.replace('-', '[-]?')}[^:]*:[^;]*(;|$)`, 'gi'),
        '$1'
      );
    }
    style = style.replace(/;{2,}/g, ';').replace(/^\s*;/, '').trim();
    if (style && style !== ';') {
      el.setAttribute('style', style);
    } else {
      el.removeAttribute('style');
    }
  }

  // Supprimer les span vides résultant du nettoyage -webkit-text-fill-color
  doc.querySelectorAll('span').forEach(span => {
    if (!span.hasChildNodes() && !span.textContent?.trim()) span.remove();
  });
}
