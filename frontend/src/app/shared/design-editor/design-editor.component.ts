import {
  Component, Input, Output, EventEmitter, ViewChild, ElementRef,
  inject, ChangeDetectorRef, AfterViewInit, OnDestroy, HostListener, NgZone,
  Pipe, PipeTransform
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/** Filtre les DesignObjects : true = textboxes, false = formes normales */
@Pipe({ name: 'tbFilter', standalone: true, pure: false })
export class TbFilterPipe implements PipeTransform {
  transform(objects: DesignObject[], isTextBox: boolean): DesignObject[] {
    return objects.filter(o => !!o.isTextBox === isTextBox);
  }
}

// ═══════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════

export interface DesignObject {
  id: string; type: string;
  x: number; y: number; w: number; h: number;
  fill: string; stroke: string; sw: number; opacity: number;
  text: string; fontSize: number; fontColor: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  zIndex: number; isLine: boolean;
  // ── Zone de texte (textbox) ──────────────────────────────
  isTextBox?:    boolean;
  content?:      string;   // HTML riche de la zone de texte
  fontFamily?:   string;
  bold?:         boolean;
  italic?:       boolean;
  underline?:    boolean;
  strikethrough?:boolean;
  lineHeight?:   number;   // ex: 1.4
  bgColor?:      string;   // fond de la zone
  borderRadius?: number;   // arrondi
  shadowText?:   boolean;
  highlight?:    string;   // surlignage
  paddingPx?:    number;
}

interface ShapeDef {
  id: string; label: string; defaultW: number; defaultH: number;
  preview: string; isLine?: boolean;
}

interface ShapeCategory { id: string; label: string; icon: string; shapes: ShapeDef[]; open: boolean; }

export interface DesignEditorResult { html: string; objects: DesignObject[]; }

// ═══════════════════════════════════════════════════════════
// PATH GENERATORS
// ═══════════════════════════════════════════════════════════

export function shapePath(type: string, x: number, y: number, w: number, h: number): string {
  const cx = x+w/2, cy = y+h/2;
  switch (type) {
    case 'rect':          return `M${x},${y}h${w}v${h}h-${w}z`;
    case 'rect-rounded':  { const r=Math.min(14,w/4,h/4); return `M${x+r},${y}h${w-2*r}a${r},${r},0,0,1,${r},${r}v${h-2*r}a${r},${r},0,0,1,-${r},${r}h-${w-2*r}a${r},${r},0,0,1,-${r},-${r}v-${h-2*r}a${r},${r},0,0,1,${r},-${r}z`; }
    case 'rect-cut':      { const c=Math.min(18,w*.15,h*.2); return `M${x+c},${y}H${x+w}V${y+h-c}L${x+w-c},${y+h}H${x}V${y}z`; }
    case 'rect-fold':     { const f=Math.min(20,w*.18,h*.2); return `M${x},${y}H${x+w-f}L${x+w},${y+f}V${y+h}H${x}zM${x+w-f},${y}V${y+f}H${x+w}`; }
    case 'rect-tab':      { const tw=w*.25,th=h*.2; return `M${x},${y+th}H${x+tw}L${x+tw+th*.5},${y}H${x+w}V${y+h}H${x}z`; }
    case 'ellipse':       return `M${cx},${y}a${w/2},${h/2},0,1,0,0.001,0z`;
    case 'triangle':      return `M${cx},${y}L${x+w},${y+h}L${x},${y+h}z`;
    case 'triangle-rt':   return `M${x},${y}L${x+w},${y+h}L${x},${y+h}z`;
    case 'diamond':       return `M${cx},${y}L${x+w},${cy}L${cx},${y+h}L${x},${cy}z`;
    case 'trapezoid':     { const o=w*.15; return `M${x+o},${y}L${x+w-o},${y}L${x+w},${y+h}L${x},${y+h}z`; }
    case 'parallelogram': { const o=w*.22; return `M${x+o},${y}L${x+w},${y}L${x+w-o},${y+h}L${x},${y+h}z`; }
    case 'pentagon':      return polyPath(cx,cy,w/2,h/2,5,-90);
    case 'hexagon':       return polyPath(cx,cy,w/2,h/2,6,0);
    case 'octagon':       return polyPath(cx,cy,w/2,h/2,8,22.5);
    case 'cross':         { const sw3=w/3,sh3=h/3; return `M${x+sw3},${y}h${w-2*sw3}v${sh3}h${sw3}v${sh3}h-${sw3}v${sh3}h-${w-2*sw3}v-${sh3}h-${sw3}v-${sh3}h${sw3}z`; }
    case 'heart':         return `M${cx},${y+h*.35}C${cx},${y}${x+w},${y}${x+w},${y+h*.35}C${x+w},${y+h*.62}${cx},${y+h*.88}${cx},${y+h}C${cx},${y+h*.88}${x},${y+h*.62}${x},${y+h*.35}C${x},${y}${cx},${y}${cx},${y+h*.35}z`;
    case 'donut':         return `M${cx},${y}a${w/2},${h/2},0,1,0,0.001,0zM${cx},${y+h*.22}a${w*.28},${h*.28},0,1,1,0.001,0z`;
    case 'semicircle':    return `M${x},${y+h}A${w/2},${h},0,0,1,${x+w},${y+h}z`;
    case 'arc':           return `M${x},${cy}A${w/2},${h/2},0,0,1,${x+w},${cy}`;
    case 'cylinder':      { const ry=h*.11; return `M${x},${y+ry}A${w/2},${ry},0,0,1,${x+w},${y+ry}V${y+h-ry}A${w/2},${ry},0,0,1,${x},${y+h-ry}zM${x},${y+ry}A${w/2},${ry},0,0,0,${x+w},${y+ry}`; }
    case 'cube':          { const d=w*.22; return `M${x+d},${y}H${x+w}V${y+h-d}L${x+w-d},${y+h}H${x}V${y+d}zM${x+d},${y}L${x},${y+d}M${x+w},${y+h-d}L${x+w-d},${y+h}`; }
    case 'cloud':         return cloudPath(x,y,w,h);
    case 'star4':         return starPath(cx,cy,w/2,h/2,4,0.38);
    case 'star5':         return starPath(cx,cy,w/2,h/2,5,0.44);
    case 'star6':         return starPath(cx,cy,w/2,h/2,6,0.50);
    case 'star8':         return starPath(cx,cy,w/2,h/2,8,0.54);
    case 'explosion':     return starPath(cx,cy,w/2,h/2,16,0.70);
    case 'seal':          return starPath(cx,cy,w/2,h/2,20,0.86);
    case 'banner':        { const f=h*.18; return `M${x},${y}H${x+w}V${y+h}L${x+w*.8},${y+h-f}L${x},${y+h}z`; }
    case 'ribbon':        { const rn=w*.12; return `M${x+rn},${y}H${x+w-rn}L${x+w},${cy}L${x+w-rn},${y+h}H${x+rn}L${x},${cy}z`; }
    case 'parchemin':     return `M${x},${y+h*.15}Q${cx},${y}${x+w},${y+h*.15}V${y+h*.85}Q${cx},${y+h}${x},${y+h*.85}z`;
    case 'arrow-right':   { const ah=h*.3,aw=w*.45; return `M${x},${y+ah}H${x+aw}V${y}L${x+w},${cy}L${x+aw},${y+h}V${y+h-ah}H${x}z`; }
    case 'arrow-left':    { const ah=h*.3,aw=w*.55; return `M${x+w},${y+ah}H${x+aw}V${y}L${x},${cy}L${x+aw},${y+h}V${y+h-ah}H${x+w}z`; }
    case 'arrow-up':      { const aw=w*.3,aah=h*.45; return `M${x+aw},${y+h}V${y+aah}H${x}L${cx},${y}L${x+w},${y+aah}H${x+w-aw}V${y+h}z`; }
    case 'arrow-down':    { const aw=w*.3,aah=h*.55; return `M${x+aw},${y}V${y+aah}H${x}L${cx},${y+h}L${x+w},${y+aah}H${x+w-aw}V${y}z`; }
    case 'arrow-double':  { const ah=h*.3,aw=w*.35; return `M${x},${cy}L${x+aw},${y}V${y+ah}H${x+w-aw}V${y}L${x+w},${cy}L${x+w-aw},${y+h}V${y+h-ah}H${x+aw}V${y+h}z`; }
    case 'chevron':       { const n=w*.15; return `M${x},${y}H${x+w-n}L${x+w},${cy}L${x+w-n},${y+h}H${x}L${x+n},${cy}z`; }
    case 'speech-rect':   return speechRectPath(x,y,w,h);
    case 'speech-round':  return speechRoundPath(x,y,w,h);
    case 'fc-decision':   return `M${cx},${y}L${x+w},${cy}L${cx},${y+h}L${x},${cy}z`;
    case 'fc-data':       { const sl=w*.12; return `M${x+sl},${y}L${x+w},${y}L${x+w-sl},${y+h}L${x},${y+h}z`; }
    case 'fc-db':         { const ry=h*.1; return `M${x},${y+ry}A${w/2},${ry},0,0,1,${x+w},${y+ry}V${y+h-ry}A${w/2},${ry},0,0,1,${x},${y+h-ry}zM${x},${y+ry}A${w/2},${ry},0,0,0,${x+w},${y+ry}M${x},${y+ry*3}A${w/2},${ry},0,0,0,${x+w},${y+ry*3}`; }
    case 'fc-prep':       { const sl=w*.15; return `M${x+sl},${y}L${x+w-sl},${y}L${x+w},${cy}L${x+w-sl},${y+h}L${x+sl},${y+h}L${x},${cy}z`; }
    case 'line':          return `M${x},${cy}H${x+w}`;
    case 'arrow-line':    return `M${x},${cy}H${x+w-14}M${x+w-14},${y+h*.18}L${x+w},${cy}L${x+w-14},${y+h*.82}`;
    case 'dbl-arrow-line':return `M${x+14},${cy}H${x+w-14}M${x+14},${y+h*.18}L${x},${cy}L${x+14},${y+h*.82}M${x+w-14},${y+h*.18}L${x+w},${cy}L${x+w-14},${y+h*.82}`;
    case 'curve':         return `M${x},${y+h}Q${cx},${y}${x+w},${y+h}`;
    case 'text':          return `M${x},${y}h${w}v${h}h-${w}z`;
    case 'textbox':       return `M${x},${y}h${w}v${h}h-${w}z`; // rendu séparé en foreignObject
    default:              return `M${x},${y}h${w}v${h}h-${w}z`;
  }
}

function polyPath(cx:number,cy:number,rx:number,ry:number,n:number,sa:number): string {
  return Array.from({length:n},(_,i)=>{
    const a=(sa+i*(360/n))*Math.PI/180;
    return `${i===0?'M':'L'}${cx+rx*Math.cos(a)},${cy+ry*Math.sin(a)}`;
  }).join('')+'z';
}
function starPath(cx:number,cy:number,rx:number,ry:number,n:number,inner:number): string {
  return Array.from({length:n*2},(_,i)=>{
    const a=(i*Math.PI/n)-Math.PI/2;
    const r=i%2===0?1:inner;
    return `${i===0?'M':'L'}${cx+rx*r*Math.cos(a)},${cy+ry*r*Math.sin(a)}`;
  }).join('')+'z';
}
function cloudPath(x:number,y:number,w:number,h:number): string {
  const cx=x+w/2;
  return `M${x+w*.18},${y+h}A${w*.24},${h*.42},0,0,1,${x+w*.06},${y+h*.7}A${w*.18},${h*.26},0,0,1,${x+w*.18},${y+h*.38}A${w*.22},${w*.22},0,0,1,${cx},${y+h*.1}A${w*.2},${w*.2},0,0,1,${x+w*.82},${y+h*.3}A${w*.18},${h*.26},0,0,1,${x+w*.94},${y+h*.62}A${w*.24},${h*.42},0,0,1,${x+w*.82},${y+h}z`;
}
function speechRectPath(x:number,y:number,w:number,h:number): string {
  const bh=h*.78,r=Math.min(10,w/10,bh/8);
  return `M${x+r},${y}H${x+w-r}A${r},${r},0,0,1,${x+w},${y+r}V${y+bh-r}A${r},${r},0,0,1,${x+w-r},${y+bh}H${x+w*.52}L${x+w*.4},${y+h}L${x+w*.27},${y+bh}H${x+r}A${r},${r},0,0,1,${x},${y+bh-r}V${y+r}A${r},${r},0,0,1,${x+r},${y}z`;
}
function speechRoundPath(x:number,y:number,w:number,h:number): string {
  const bh=h*.78,rx=w*.44,ry=bh*.48,ecx=x+w/2,ecy=y+bh/2;
  return `M${ecx},${ecy-ry}a${rx},${ry},0,1,0,0.001,0zM${x+w*.35},${y+bh}L${x+w*.27},${y+h}L${x+w*.54},${y+bh}z`;
}

// ── Gallery data ──────────────────────────────────────────────────────────
const sp = (t:string) => shapePath(t,5,5,90,60);

const SHAPE_CATS: ShapeCategory[] = [
  { id:'lines', label:'Lignes', icon:'↗', open:true, shapes:[
    {id:'line',         label:'Ligne',        defaultW:140,defaultH:40, isLine:true, preview:'M5,35H95'},
    {id:'arrow-line',   label:'Flèche',       defaultW:140,defaultH:40, isLine:true, preview:'M5,35H83M76,24L95,35L76,46'},
    {id:'dbl-arrow-line',label:'Double flèche',defaultW:140,defaultH:40,isLine:true, preview:'M17,35H83M5,24L17,35L5,46M83,24L95,35M83,46L95,35'},
    {id:'curve',        label:'Courbe',       defaultW:160,defaultH:60, isLine:true, preview:'M5,55Q50,5,95,55'},
  ]},
  { id:'rects', label:'Rectangles', icon:'⬜', open:false, shapes:[
    {id:'rect',          label:'Rectangle',    defaultW:130,defaultH:80, preview:sp('rect')},
    {id:'rect-rounded',  label:'Arrondi',      defaultW:130,defaultH:80, preview:sp('rect-rounded')},
    {id:'rect-cut',      label:'Coin tronqué', defaultW:130,defaultH:80, preview:sp('rect-cut')},
    {id:'rect-fold',     label:'Replié',       defaultW:130,defaultH:80, preview:sp('rect-fold')},
    {id:'rect-tab',      label:'Onglet',       defaultW:130,defaultH:80, preview:sp('rect-tab')},
  ]},
  { id:'basic', label:'Formes de base', icon:'⬟', open:false, shapes:[
    {id:'ellipse',      label:'Ellipse',      defaultW:120,defaultH:80,  preview:sp('ellipse')},
    {id:'triangle',     label:'Triangle',     defaultW:110,defaultH:90,  preview:sp('triangle')},
    {id:'triangle-rt',  label:'Tr. rect.',    defaultW:110,defaultH:90,  preview:sp('triangle-rt')},
    {id:'diamond',      label:'Losange',      defaultW:110,defaultH:90,  preview:sp('diamond')},
    {id:'trapezoid',    label:'Trapèze',      defaultW:130,defaultH:80,  preview:sp('trapezoid')},
    {id:'parallelogram',label:'Parallélogramme',defaultW:130,defaultH:80,preview:sp('parallelogram')},
    {id:'pentagon',     label:'Pentagone',    defaultW:100,defaultH:100, preview:shapePath('pentagon',5,5,90,90)},
    {id:'hexagon',      label:'Hexagone',     defaultW:100,defaultH:100, preview:shapePath('hexagon',5,5,90,90)},
    {id:'octagon',      label:'Octogone',     defaultW:100,defaultH:100, preview:shapePath('octagon',5,5,90,90)},
    {id:'cross',        label:'Croix',        defaultW:90,defaultH:90,   preview:shapePath('cross',5,5,90,90)},
    {id:'heart',        label:'Cœur',         defaultW:100,defaultH:90,  preview:sp('heart')},
    {id:'donut',        label:'Anneau',       defaultW:100,defaultH:100, preview:shapePath('donut',5,5,90,90)},
    {id:'semicircle',   label:'Demi-cercle',  defaultW:120,defaultH:60,  preview:'M5,60A45,55,0,0,1,95,60z'},
    {id:'cloud',        label:'Nuage',        defaultW:130,defaultH:80,  preview:sp('cloud')},
    {id:'cylinder',     label:'Cylindre',     defaultW:100,defaultH:120, preview:shapePath('cylinder',10,5,80,90)},
    {id:'cube',         label:'Cube',         defaultW:100,defaultH:100, preview:shapePath('cube',5,5,90,90)},
  ]},
  { id:'arrows', label:'Flèches', icon:'➡', open:false, shapes:[
    {id:'arrow-right',  label:'Droite',   defaultW:130,defaultH:80, preview:sp('arrow-right')},
    {id:'arrow-left',   label:'Gauche',   defaultW:130,defaultH:80, preview:sp('arrow-left')},
    {id:'arrow-up',     label:'Haut',     defaultW:80,defaultH:130, preview:shapePath('arrow-up',5,5,60,90)},
    {id:'arrow-down',   label:'Bas',      defaultW:80,defaultH:130, preview:shapePath('arrow-down',5,5,60,90)},
    {id:'arrow-double', label:'Double',   defaultW:140,defaultH:80, preview:sp('arrow-double')},
    {id:'chevron',      label:'Chevron',  defaultW:140,defaultH:70, preview:shapePath('chevron',5,5,90,60)},
    {id:'ribbon',       label:'Ruban',    defaultW:140,defaultH:70, preview:shapePath('ribbon',5,5,90,60)},
  ]},
  { id:'stars', label:'Étoiles & Bannières', icon:'⭐', open:false, shapes:[
    {id:'star4',     label:'Étoile 4',  defaultW:100,defaultH:100, preview:starPath(50,37,43,43,4,0.38)},
    {id:'star5',     label:'Étoile 5',  defaultW:100,defaultH:100, preview:starPath(50,37,43,43,5,0.44)},
    {id:'star6',     label:'Étoile 6',  defaultW:100,defaultH:100, preview:starPath(50,37,43,43,6,0.50)},
    {id:'star8',     label:'Étoile 8',  defaultW:100,defaultH:100, preview:starPath(50,37,43,43,8,0.54)},
    {id:'explosion', label:'Explosion', defaultW:100,defaultH:100, preview:starPath(50,37,43,43,16,0.70)},
    {id:'seal',      label:'Sceau',     defaultW:100,defaultH:100, preview:starPath(50,37,43,43,20,0.86)},
    {id:'banner',    label:'Bannière',  defaultW:140,defaultH:80,  preview:sp('banner')},
    {id:'parchemin', label:'Parchemin', defaultW:140,defaultH:90,  preview:sp('parchemin')},
  ]},
  { id:'bubbles', label:'Bulles & Légendes', icon:'💬', open:false, shapes:[
    {id:'speech-rect', label:'Bulle rect.',  defaultW:150,defaultH:100, preview:speechRectPath(5,5,90,65)},
    {id:'speech-round',label:'Bulle ronde',  defaultW:150,defaultH:100, preview:speechRoundPath(5,5,90,65)},
    {id:'cloud',       label:'Nuage',        defaultW:150,defaultH:90,  preview:sp('cloud')},
  ]},
  { id:'flowchart', label:'Organigramme', icon:'⬡', open:false, shapes:[
    {id:'rect',        label:'Processus',   defaultW:130,defaultH:70, preview:sp('rect')},
    {id:'fc-decision', label:'Décision',    defaultW:130,defaultH:80, preview:sp('fc-decision')},
    {id:'fc-data',     label:'Données',     defaultW:130,defaultH:70, preview:sp('fc-data')},
    {id:'fc-db',       label:'Base données',defaultW:100,defaultH:120,preview:shapePath('fc-db',10,5,80,90)},
    {id:'fc-prep',     label:'Préparation', defaultW:130,defaultH:70, preview:sp('fc-prep')},
    {id:'cylinder',    label:'Stockage',    defaultW:100,defaultH:120,preview:shapePath('cylinder',10,5,80,90)},
  ]},
  { id:'text-cat', label:'Texte', icon:'T', open:false, shapes:[
    {id:'text',        label:'Zone texte',  defaultW:160,defaultH:60, preview:'M5,20H65M5,38H50M5,56H60'},
  ]},
];

function isColorFaded(cssColor: string): boolean {
  // Returns true if the color is very light/muted (likely a placeholder style)
  const m = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return false;
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
  return luminance > 0.75; // very light color = likely placeholder
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

@Component({
  selector: 'app-design-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TbFilterPipe],
  template: `
<div class="de-root" (click)="onRootClick($event)">

  <!-- ── Top bar ── -->
  <div class="de-topbar">
    <div class="de-topbar-left">
      <!-- Mode unifié : tout est sélectionnable ET éditable par défaut -->
      <label class="de-tb-mode-wrap" title="Mode édition : formes déplaçables + texte éditable">
        <input type="checkbox" [(ngModel)]="editMode" (ngModelChange)="onEditModeChange()" class="de-tb-checkbox">
        <span class="de-tb-mode-lbl">✏ Édition</span>
      </label>
      <div class="de-sep"></div>
      <button class="de-tb-btn" (mousedown)="$event.preventDefault();undo()" title="Annuler (Ctrl+Z)">↩</button>
      <button class="de-tb-btn" (mousedown)="$event.preventDefault();redo()" title="Rétablir (Ctrl+Y)">↪</button>
      <ng-container *ngIf="selObj">
        <div class="de-sep"></div>
        <button class="de-tb-btn" (click)="deleteSelected()">🗑</button>
        <button class="de-tb-btn" (click)="duplicateSelected()" title="Dupliquer (Ctrl+D)">⊞</button>
        <button class="de-tb-btn" (click)="bringToFront()">⬆</button>
        <button class="de-tb-btn" (click)="sendToBack()">⬇</button>
        <div class="de-sep"></div>
        <label class="de-tb-label" *ngIf="!selObj.isLine">Fond</label>
        <div class="de-color-wrap" *ngIf="!selObj.isLine">
          <button class="de-color-swatch" [style.background]="selObj.fill"
                  (click)="$event.stopPropagation(); togglePicker('fill')">
            <span *ngIf="selObj.fill==='none'" class="de-none-ico">⊘</span>
          </button>
          <div class="de-color-pop" *ngIf="showFill" (click)="$event.stopPropagation()">
            <button class="de-pop-none" (click)="selObj.fill='none';showFill=false">⊘ Aucun</button>
            <div class="de-color-grid">
              <button *ngFor="let c of PALETTE" [style.background]="c" class="de-pal-btn" (click)="selObj.fill=c;showFill=false"></button>
            </div>
            <input type="color" class="de-color-input" [value]="selObj.fill==='none'?'#6366f1':selObj.fill"
                   (input)="selObj.fill=$any($event.target).value">
          </div>
        </div>
        <label class="de-tb-label">Contour</label>
        <div class="de-color-wrap">
          <button class="de-color-swatch" [style.background]="selObj.stroke"
                  (click)="$event.stopPropagation(); togglePicker('stroke')">
            <span *ngIf="selObj.stroke==='none'" class="de-none-ico">⊘</span>
          </button>
          <div class="de-color-pop" *ngIf="showStroke" (click)="$event.stopPropagation()">
            <button class="de-pop-none" (click)="selObj.stroke='none';showStroke=false">⊘ Aucun</button>
            <div class="de-color-grid">
              <button *ngFor="let c of PALETTE" [style.background]="c" class="de-pal-btn" (click)="selObj.stroke=c;showStroke=false"></button>
            </div>
            <input type="color" class="de-color-input" [value]="selObj.stroke==='none'?'#000000':selObj.stroke"
                   (input)="selObj.stroke=$any($event.target).value">
          </div>
        </div>
        <label class="de-tb-label">Ép.</label>
        <input class="de-tb-num" type="number" min="0" max="20" [(ngModel)]="selObj.sw">
        <label class="de-tb-label">Opac.</label>
        <input class="de-tb-range" type="range" min="10" max="100" step="5" [(ngModel)]="selObj.opacity">
        <span class="de-tb-tiny">{{selObj.opacity}}%</span>
      </ng-container>
      <!-- Image selected -->
      <ng-container *ngIf="selImgEl">
        <div class="de-sep"></div>
        <span class="de-tb-label" style="color:#f59e0b">📷 Photo sélectionnée</span>
        <label class="de-tb-label">Forme</label>
        <select class="de-tb-select" [(ngModel)]="imgShape" (ngModelChange)="applyImgShape()">
          <option value="circle">Rond</option>
          <option value="square">Carré</option>
          <option value="rect">Rectangle</option>
          <option value="hex">Hexagone</option>
        </select>
        <button class="de-tb-btn" (click)="deleteHtmlEl(selImgEl)">🗑 Supprimer</button>
      </ng-container>
    </div>
    <div class="de-topbar-right">
      <!-- Photo -->
      <label class="de-photo-btn" title="Ajouter une photo">
        📷 Photo
        <input type="file" accept="image/*" style="display:none" (change)="addPhotoFromFile($event)">
      </label>
      <!-- Fond -->
      <button class="de-bg-btn" (click)="$event.stopPropagation();showBgPanel=!showBgPanel" title="Modifier l'arrière-plan">
        🎨 Fond
      </button>
      <!-- Panneau fond -->
      <div class="de-bg-panel" *ngIf="showBgPanel" (click)="$event.stopPropagation()">
        <div class="de-bg-section-lbl">Couleur unie</div>
        <input type="color" class="de-bg-color-pick" [value]="bgColor"
               (input)="bgColor=$any($event.target).value;bgGradient='';bgImgUrl=''">
        <div class="de-bg-section-lbl" style="margin-top:8px">Dégradés</div>
        <div class="de-bg-grad-grid">
          <button *ngFor="let g of BG_GRADIENTS" class="de-bg-grad-btn"
                  [style.background]="g.value||bgColor"
                  [class.active]="bgGradient===g.value"
                  (click)="bgGradient=g.value;bgImgUrl=''">{{g.label}}</button>
        </div>
        <div class="de-bg-section-lbl" style="margin-top:8px">Image de fond</div>
        <label class="de-bg-img-btn">
          📂 Choisir une image
          <input type="file" accept="image/*" style="display:none" (change)="setBgImage($event)">
        </label>
        <button *ngIf="bgImgUrl" class="de-bg-clear-btn" (click)="bgImgUrl=''">✕ Supprimer l'image</button>
      </div>
      <button class="de-ai-btn" (mousedown)="$event.preventDefault();openAiPanel()" title="Assistant IA">🤖 IA</button>
      <button class="de-save-btn"   (click)="onSave()"     title="Sauvegarder">💾 Sauvegarder</button>
      <button class="de-cancel-btn" (click)="onCancel()"   title="Fermer">✕ Fermer</button>
    </div>
  </div>

  <!-- ── AI PANEL ── -->
  <div class="de-ai-panel" *ngIf="showAiPanel" (click)="$event.stopPropagation()">
    <!-- Head -->
    <div class="de-ai-panel-head">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="de-ai-avatar">🤖</div>
        <div>
          <div class="de-ai-title">Assistant IA</div>
          <div class="de-ai-subtitle">CV Builder Pro</div>
        </div>
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <label class="de-ai-head-btn" [class.de-ai-head-btn--active]="!!aiKb" title="Base de connaissance">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span *ngIf="aiKb" class="de-ai-kb-dot"></span>
          <input type="file" style="display:none" accept=".txt,.pdf,.docx,.doc" (change)="onAiKbFile($event)">
        </label>
        <label class="de-ai-head-btn" title="Charger un modèle de CV à reproduire">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <input type="file" style="display:none" accept="image/*" (change)="loadModelImage($event)">
        </label>
        <button class="de-ai-head-btn" title="Effacer la conversation" (mousedown)="$event.preventDefault();aiMessages=[]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
        <button class="de-ai-head-btn de-ai-head-btn--close" (click)="closeAiPanel()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Section cible + auto-insert -->
    <div class="de-ai-sec-bar">
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;flex:1">
        <span class="de-ai-sec-lbl">Cible :</span>
        <button *ngFor="let s of aiSections" class="de-ai-sec-btn"
          [class.active]="aiTargetSection===s.key"
          (mousedown)="$event.preventDefault();aiTargetSection=s.key">{{s.label}}</button>
        <button class="de-ai-sec-btn de-ai-sec-btn--list"
          (mousedown)="$event.preventDefault();listCvSections()" title="Analyser les sections du CV">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
      </div>
      <label class="de-ai-auto-lbl" title="Insertion automatique dans la section après rédaction">
        <input type="checkbox" [(ngModel)]="aiAutoInsert" style="margin:0;accent-color:#6366f1;cursor:pointer">
        Auto
      </label>
    </div>

    <!-- Translation bar -->
    <div class="de-ai-trans-bar" *ngIf="showTranslation">
      <span class="de-ai-sec-lbl">De :</span>
      <select class="de-ai-trans-sel" [(ngModel)]="translateFrom">
        <option value="fr">Français</option><option value="en">Anglais</option>
        <option value="ar">Arabe</option><option value="es">Espagnol</option><option value="de">Allemand</option>
      </select>
      <span class="de-ai-sec-lbl">→</span>
      <select class="de-ai-trans-sel" [(ngModel)]="translateTo">
        <option value="en">Anglais</option><option value="fr">Français</option>
        <option value="ar">Arabe</option><option value="es">Espagnol</option><option value="de">Allemand</option>
      </select>
      <button class="de-ai-trans-go" (mousedown)="$event.preventDefault();translateCv()">Traduire CV</button>
    </div>

    <!-- Texte sélectionné -->
    <div class="de-ai-sel-preview" *ngIf="aiSelectedText">
      <span class="de-ai-sel-lbl">Sélection :</span>
      <div class="de-ai-sel-text">{{aiSelectedText.slice(0,100)}}{{aiSelectedText.length>100?'…':''}}</div>
    </div>

    <!-- Messages + welcome -->
    <div class="de-ai-msgs">
      <div class="de-ai-welcome" *ngIf="aiMessages.length===0">
        <div class="de-ai-welcome-bubble">
          <div class="de-ai-welcome-ico">🤖</div>
          <div class="de-ai-welcome-body">
            <strong>Bonjour ! Je suis votre assistant IA CV.</strong>
            <p>Je peux rédiger votre profil, vos expériences, compétences, ou optimiser votre CV pour les ATS. Utilisez les boutons de section pour diriger le résultat.</p>
            <p class="de-ai-welcome-hint">Que souhaitez-vous faire ?</p>
          </div>
        </div>
        <div class="de-ai-quick-grid">
          <button class="de-ai-qp" *ngFor="let p of aiQuickPromptsEd"
            (mousedown)="$event.preventDefault();sendAiMessage(p.prompt)">
            <span class="de-ai-qp-ico">{{p.icon}}</span>
            <span>{{p.label}}</span>
          </button>
        </div>
      </div>

      <div *ngFor="let m of aiMessages" class="de-ai-msg" [class.de-ai-msg--user]="m.role==='user'">
        <div class="de-ai-bubble" [class.de-ai-bubble--user]="m.role==='user'">
          <div class="de-ai-text" style="white-space:pre-wrap">{{m.content}}</div>
          <div *ngIf="m.role==='assistant'" class="de-ai-action-row">
            <button class="de-ai-act-btn de-ai-act-btn--apply"
              title="Appliquer dans la section cible du CV"
              (mousedown)="$event.preventDefault();applyAiToSection(m.content)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
              Appliquer
            </button>
            <button class="de-ai-act-btn de-ai-act-btn--insert"
              title="Insérer à la position du curseur"
              (mousedown)="$event.preventDefault();insertAiContent(m.content)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              Insérer
            </button>
            <button class="de-ai-act-btn de-ai-act-btn--copy"
              title="Copier le texte"
              (mousedown)="$event.preventDefault();copyAiText(m.content)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="de-ai-act-btn de-ai-act-btn--speak"
              [class.de-ai-act-btn--speaking]="ttsSpeaking===m.content"
              title="Lire à voix haute (TTS)"
              (mousedown)="$event.preventDefault();toggleTts(m.content)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div *ngIf="aiLoading" class="de-ai-msg">
        <div class="de-ai-bubble">
          <div style="display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:.7rem">
            <span class="de-ai-dots">●●●</span> Rédaction en cours…
          </div>
        </div>
      </div>
    </div>

    <!-- Tools row -->
    <div class="de-ai-tools-row">
      <button class="de-ai-tool-btn" [class.active]="showTranslation"
        (mousedown)="$event.preventDefault();showTranslation=!showTranslation" title="Paramètres de traduction">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        Traduire
      </button>
      <button class="de-ai-tool-btn"
        (mousedown)="$event.preventDefault();sendAiMessage('Optimise ce CV pour les ATS : mots-clés, lisibilité, structure. Donne des recommandations concrètes et applique-les.')"
        title="Optimisation ATS">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        ATS
      </button>
      <button class="de-ai-tool-btn"
        (mousedown)="$event.preventDefault();sendAiMessage('Rends ce CV plus percutant et dynamique. Améliore le vocabulaire, les verbes d’action et la structure.')"
        title="Booster le CV">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        Booster
      </button>
    </div>

    <!-- Input row -->
    <div class="de-ai-input-row">
      <button class="de-ai-mic" [class.de-ai-mic--rec]="aiRecording"
        (mousedown)="$event.preventDefault();toggleAiVoice()" title="Saisie vocale">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      </button>
      <input class="de-ai-input" placeholder="Demandez à l'IA…"
        [(ngModel)]="aiInput"
        (keydown.enter)="$event.preventDefault();sendAiMessage()"
        [disabled]="aiLoading">
      <button class="de-ai-send" (mousedown)="$event.preventDefault();sendAiMessage()" [disabled]="aiLoading||!aiInput.trim()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>

  <!-- ── Barre mise en forme (Word-like) — toujours visible ── -->
  <div class="de-format-bar" (click)="$event.stopPropagation()">
    <!-- Police -->
    <select class="de-fb-font" [(ngModel)]="fbFont" (mousedown)="fbSaveRange()"
            (change)="fbExec('fontName', fbFont)">
      <option value="Arial">Arial</option>
      <option value="Calibri">Calibri</option>
      <option value="Inter">Inter</option>
      <option value="Georgia">Georgia</option>
      <option value="Times New Roman">Times New Roman</option>
      <option value="Verdana">Verdana</option>
      <option value="Trebuchet MS">Trebuchet MS</option>
      <option value="Courier New">Courier New</option>
    </select>
    <!-- Taille -->
    <input class="de-fb-size" type="number" [(ngModel)]="fbSize" min="6" max="96"
           (mousedown)="fbSaveRange()" (change)="fbApplySize()">
    <button class="de-fb-btn" (mousedown)="$event.preventDefault();fbSaveRange();fbIncSize()" title="Agrandir">A▲</button>
    <button class="de-fb-btn" (mousedown)="$event.preventDefault();fbSaveRange();fbDecSize()" title="Réduire">A▼</button>
    <div class="de-fb-sep"></div>
    <!-- B I U S -->
    <button class="de-fb-btn" [class.active]="fbState.bold"
            (mousedown)="$event.preventDefault();fbSaveRange();fbExec('bold')" title="Gras"><b>B</b></button>
    <button class="de-fb-btn" [class.active]="fbState.italic"
            (mousedown)="$event.preventDefault();fbSaveRange();fbExec('italic')" title="Italique"><i>I</i></button>
    <button class="de-fb-btn" [class.active]="fbState.underline"
            (mousedown)="$event.preventDefault();fbSaveRange();fbExec('underline')" title="Souligné"><u>U</u></button>
    <button class="de-fb-btn"
            (mousedown)="$event.preventDefault();fbSaveRange();fbExec('strikeThrough')" title="Barré"><s>S</s></button>
    <button class="de-fb-btn"
            (mousedown)="$event.preventDefault();fbSaveRange();fbExec('superscript')" title="Exposant">A<sup style="font-size:.55em">1</sup></button>
    <button class="de-fb-btn"
            (mousedown)="$event.preventDefault();fbSaveRange();fbExec('subscript')" title="Indice">A<sub style="font-size:.55em">1</sub></button>
    <div class="de-fb-sep"></div>
    <!-- Couleurs -->
    <label class="de-fb-color-lbl" title="Couleur du texte" (mousedown)="fbSaveRange()">
      <span class="de-fb-color-letter" [style.color]="fbTextColor">A</span>
      <span class="de-fb-color-bar" [style.background]="fbTextColor"></span>
      <input type="color" style="display:none" [value]="fbTextColor"
             (input)="applyForeColorSync($any($event.target).value)"
             (change)="applyForeColorSync($any($event.target).value)">
    </label>
    <label class="de-fb-color-lbl" title="Couleur de surlignage" (mousedown)="fbSaveRange()">
      <span class="de-fb-color-letter" style="opacity:.7">&#x26A7;</span>
      <span class="de-fb-color-bar" [style.background]="fbHighColor"></span>
      <input type="color" style="display:none" [value]="fbHighColor"
             (input)="applyBgColorSync($any($event.target).value)"
             (change)="applyBgColorSync($any($event.target).value)">
    </label>
    <button class="de-fb-btn" (mousedown)="$event.preventDefault();fbSaveRange();fbExec('removeFormat')" title="Effacer format">◇</button>
    <div class="de-fb-sep"></div>
    <!-- Alignement -->
    <button class="de-fb-btn" [class.active]="fbState.justLeft"
            (mousedown)="$event.preventDefault();fbSaveRange();fbExec('justifyLeft')"   title="Gauche">⬅</button>
    <button class="de-fb-btn" [class.active]="fbState.justCenter"
            (mousedown)="$event.preventDefault();fbSaveRange();fbExec('justifyCenter')" title="Centré">⬌</button>
    <button class="de-fb-btn" [class.active]="fbState.justRight"
            (mousedown)="$event.preventDefault();fbSaveRange();fbExec('justifyRight')"  title="Droite">➡</button>
    <button class="de-fb-btn" [class.active]="fbState.justFull"
            (mousedown)="$event.preventDefault();fbSaveRange();fbExec('justifyFull')"   title="Justifié">≡</button>
    <div class="de-fb-sep"></div>
    <!-- Listes -->
    <button class="de-fb-btn" (mousedown)="$event.preventDefault();fbSaveRange();fbExec('insertUnorderedList')" title="Puces">•≡</button>
    <button class="de-fb-btn" (mousedown)="$event.preventDefault();fbSaveRange();fbExec('insertOrderedList')"   title="Numéros">1≡</button>
    <button class="de-fb-btn" (mousedown)="$event.preventDefault();fbSaveRange();fbExec('indent')"   title="Retrait +">→≡</button>
    <button class="de-fb-btn" (mousedown)="$event.preventDefault();fbSaveRange();fbExec('outdent')"  title="Retrait −">←≡</button>
    <!-- Section HTML sélectionnée -->
    <ng-container *ngIf="selHtmlSection">
      <div class="de-fb-sep"></div>
      <span class="de-fb-sec-lbl">{{selHtmlSection.tagName==='HR'?'Trait':'Section'}} sélectionné·e</span>
      <button class="de-fb-btn" (mousedown)="$event.preventDefault();moveHtmlSectionUp()"   title="Monter">↑</button>
      <button class="de-fb-btn" (mousedown)="$event.preventDefault();moveHtmlSectionDown()" title="Descendre">↓</button>
      <button class="de-fb-btn de-fb-del"
              (mousedown)="$event.preventDefault();deleteHtmlSection()" title="Supprimer">🗑</button>
    </ng-container>

    <!-- ── Zoom controls (PDF-like) ── -->
    <div class="de-fb-sep" style="margin-left:auto"></div>
    <div class="de-zoom-bar">
      <button class="de-zoom-btn" (mousedown)="$event.preventDefault();setZoom(canvasZoom-10)" title="Dézoomer">−</button>
      <span class="de-zoom-pct" (click)="setZoom(100)" title="Réinitialiser à 100%">{{canvasZoom}}%</span>
      <button class="de-zoom-btn" (mousedown)="$event.preventDefault();setZoom(canvasZoom+10)" title="Zoomer">+</button>
      <button class="de-zoom-btn de-zoom-fit" (mousedown)="$event.preventDefault();fitZoom()" title="Ajuster à la fenêtre">⊡</button>
    </div>
  </div>

  <!-- ── Body ── -->
  <div class="de-body">

    <!-- ── Gallery ── -->
    <aside class="de-gallery" [class.de-gallery--collapsed]="galleryCollapsed">

      <!-- Toggle tab -->
      <button class="de-gallery-toggle" (click)="galleryCollapsed=!galleryCollapsed"
              [title]="galleryCollapsed ? 'Déployer le panneau' : 'Réduire le panneau'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <polyline *ngIf="!galleryCollapsed" points="15 18 9 12 15 6"/>
          <polyline *ngIf="galleryCollapsed"  points="9 18 15 12 9 6"/>
        </svg>
      </button>

      <!-- ══ CHAMPS DYNAMIQUES (depuis Excel) ══ -->
      <ng-container *ngIf="dynamicFields.length > 0">
        <div class="de-gallery-title">CHAMPS EXCEL</div>
        <div class="de-dyn-hint">Cliquez pour insérer un champ</div>
        <div class="de-dyn-fields">
          <button *ngFor="let f of dynamicFields" class="de-dyn-chip" (click)="insertDynField(f)">
            {{'{{'}}{{f}}{{'}}'}}
          </button>
        </div>
      </ng-container>

      <!-- ══ ZONES DE TEXTE ══ -->
      <div class="de-gallery-title">ZONES DE TEXTE</div>
      <div class="de-tb-zone-btns">
        <button class="de-tb-zone-btn" (click)="insertTextBox(200,80)"  title="Zone de texte standard">
          <svg viewBox="0 0 80 32"><rect x="2" y="2" width="76" height="28" rx="3" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="4,2"/><text x="40" y="20" text-anchor="middle" font-size="10" fill="#6366f1">Aa</text></svg>
          <span>Standard</span>
        </button>
        <button class="de-tb-zone-btn" (click)="insertTextBox(120,120)" title="Zone carrée">
          <svg viewBox="0 0 50 50"><rect x="2" y="2" width="46" height="46" rx="3" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="4,2"/><text x="25" y="30" text-anchor="middle" font-size="10" fill="#6366f1">Aa</text></svg>
          <span>Carrée</span>
        </button>
        <button class="de-tb-zone-btn" (click)="insertTextBox(300,50)" title="Zone titre">
          <svg viewBox="0 0 120 28"><rect x="2" y="2" width="116" height="24" rx="3" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="4,2"/><text x="60" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="#6366f1">Titre</text></svg>
          <span>Titre</span>
        </button>
        <button class="de-tb-zone-btn" (click)="insertTextBox(380,160)" title="Zone large">
          <svg viewBox="0 0 120 50"><rect x="2" y="2" width="116" height="46" rx="3" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="4,2"/><text x="60" y="28" text-anchor="middle" font-size="9" fill="#6366f1">Paragraphe</text></svg>
          <span>Paragraphe</span>
        </button>
      </div>

      <div class="de-gallery-title" style="margin-top:6px">FORMES</div>
      <div *ngFor="let cat of cats" class="de-cat">
        <button class="de-cat-hdr" (click)="cat.open=!cat.open">
          <span class="de-cat-icon">{{cat.icon}}</span>
          <span class="de-cat-label">{{cat.label}}</span>
          <span class="de-cat-arrow">{{cat.open?'▴':'▾'}}</span>
        </button>
        <div class="de-shapes-grid" *ngIf="cat.open">
          <button *ngFor="let s of cat.shapes" class="de-shape-btn" (click)="insertShape(s)" [title]="s.label">
            <svg viewBox="0 0 100 70" class="de-shape-preview">
              <path [attr.d]="s.preview" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
            </svg>
            <span class="de-shape-lbl">{{s.label}}</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- ── Canvas ── -->
    <div class="de-canvas-wrap" #canvasWrap>
      <div class="de-canvas-scale-host"
           [style.width.px]="width  * canvasZoom/100"
           [style.height.px]="height * canvasZoom/100">
        <div class="de-canvas" #canvas
           [style.width.px]="width" [style.height.px]="height"
           [style.transform]="'scale('+canvasZoom/100+')'"
           style="transform-origin:top left"
           [style.background]="canvasStyle">

        <!-- HTML base layer — toujours éditable en mode édition -->
        <div class="de-html-layer" #htmlLayer
             [class.de-html-text-mode]="editMode"
             [attr.contenteditable]="editMode ? 'true' : 'false'"></div>

        <!-- SVG overlay — pointer-events:none sur le fond, all sur les éléments -->
        <svg class="de-svg-layer" #svgLayer
             [attr.width]="width" [attr.height]="height"
             style="pointer-events:none"
             (mousedown)="onSvgDown($event)"
             (contextmenu)="onCtxMenu($event)">

          <!-- ── Formes normales ── -->
          <g *ngFor="let o of objectsSorted | tbFilter:false"
             [attr.opacity]="o.opacity/100"
             (mousedown)="onObjDown($event,o.id)"
             style="cursor:move;pointer-events:all">
            <path [attr.d]="getPath(o)"
                  [attr.data-oid]="o.id"
                  [attr.fill]="o.isLine?'none':o.fill"
                  [attr.stroke]="o.stroke==='none'?'none':o.stroke"
                  [attr.stroke-width]="o.sw"
                  stroke-linejoin="round" stroke-linecap="round"/>
            <foreignObject *ngIf="o.text && !o.isLine"
                           [attr.x]="o.x+8" [attr.y]="o.y+8"
                           [attr.width]="Math.max(0,o.w-16)" [attr.height]="Math.max(0,o.h-16)">
              <div xmlns="http://www.w3.org/1999/xhtml"
                   style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;word-break:break-word"
                   [style.textAlign]="o.textAlign" [style.fontSize.px]="o.fontSize"
                   [style.color]="o.fontColor" [style.fontFamily]="'Inter,sans-serif'" [style.fontWeight]="'600'">{{o.text}}</div>
            </foreignObject>
          </g>

          <!-- ── Zones de texte (foreignObject + point d'ancrage) ── -->
          <ng-container *ngFor="let o of objectsSorted | tbFilter:true">
            <g [attr.opacity]="o.opacity/100" style="pointer-events:all">
              <!-- Fond + bordure de la zone -->
              <rect [attr.x]="o.x" [attr.y]="o.y"
                    [attr.width]="o.w" [attr.height]="o.h"
                    [attr.rx]="o.borderRadius||4"
                    [attr.fill]="o.bgColor||'transparent'"
                    [attr.stroke]="editingTbId===o.id?'#6366f1':(selId===o.id?'#6366f1':'#94a3b8')"
                    [attr.stroke-width]="editingTbId===o.id?2:1.5"
                    [attr.stroke-dasharray]="editingTbId===o.id?'0':'5,3'"
                    pointer-events="none"/>
              <!-- Contenu HTML éditable -->
              <foreignObject [attr.x]="o.x" [attr.y]="o.y"
                             [attr.width]="o.w" [attr.height]="o.h"
                             [attr.id]="'fo-'+o.id">
                <div xmlns="http://www.w3.org/1999/xhtml"
                     [attr.id]="'tb-'+o.id"
                     [attr.contenteditable]="editingTbId===o.id ? 'true' : 'false'"
                     class="de-tb-fo-content"
                     [style.fontFamily]="o.fontFamily||'Inter,sans-serif'"
                     [style.fontSize.px]="o.fontSize||14"
                     [style.color]="o.fontColor||'#1e293b'"
                     [style.fontWeight]="o.bold?'bold':'normal'"
                     [style.fontStyle]="o.italic?'italic':'normal'"
                     [style.textDecoration]="tbDecoration(o)"
                     [style.textAlign]="o.textAlign||'left'"
                     [style.lineHeight]="o.lineHeight||1.4"
                     [style.padding.px]="o.paddingPx||10"
                     [style.cursor]="editingTbId===o.id?'text':'default'"
                     [style.outline]="'none'"
                     [style.width]="'100%'"
                     [style.height]="'100%'"
                     [style.boxSizing]="'border-box'"
                     [style.wordBreak]="'break-word'"
                     [style.overflow]="'hidden'"
                     [innerHTML]="o.content||o.text||'Zone de texte'"
                     (mousedown)="editingTbId===o.id ? $event.stopPropagation() : onObjDown($event,o.id)"
                     (dblclick)="$event.stopPropagation(); startEditTb(o)"
                     (input)="saveTbContent(o)"
                     (keydown)="onTbKeydown($event,o)">
                </div>
              </foreignObject>
              <!-- Rect transparent pour la sélection (devant le foreignObject quand pas en édition) -->
              <rect *ngIf="editingTbId!==o.id"
                    [attr.x]="o.x" [attr.y]="o.y"
                    [attr.width]="o.w" [attr.height]="o.h"
                    fill="transparent" stroke="transparent" stroke-width="6"
                    style="cursor:move"
                    [attr.data-oid]="o.id"
                    (mousedown)="onObjDown($event,o.id)"
                    (dblclick)="startEditTb(o)"/>
            </g>
          </ng-container>

          <!-- Shape selection handles — pointer-events:all pour cliquer les poignées -->
          <ng-container *ngIf="selObj">
            <rect class="sel-rect"
                  [attr.x]="selObj.x-3" [attr.y]="selObj.y-3"
                  [attr.width]="selObj.w+6" [attr.height]="selObj.h+6"
                  fill="none" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="6,3" pointer-events="none"/>
            <circle *ngFor="let h of handles" class="sel-handle"
                    [attr.cx]="h.cx" [attr.cy]="h.cy" r="6"
                    fill="white" stroke="#6366f1" stroke-width="2"
                    style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.3));pointer-events:all"
                    [attr.cursor]="h.cur"
                    (mousedown)="onHandleDown($event,h.id)"/>
            <circle class="rot-handle"
                    [attr.cx]="selObj.x+selObj.w/2" [attr.cy]="selObj.y-22" r="6"
                    fill="#6366f1" stroke="white" stroke-width="2" cursor="grab"
                    style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.25))"/>
            <line class="rot-line"
                  [attr.x1]="selObj.x+selObj.w/2" [attr.y1]="selObj.y-16"
                  [attr.x2]="selObj.x+selObj.w/2" [attr.y2]="selObj.y-3"
                  stroke="#6366f1" stroke-width="1.5" pointer-events="none"/>
          </ng-container>

          <!-- Image selection handles (orange) -->
          <ng-container *ngIf="selImgEl">
            <!-- Transparent hit zone for dragging the photo -->
            <rect [attr.x]="selImgPos.x-3" [attr.y]="selImgPos.y-3"
                  [attr.width]="selImgPos.w+6" [attr.height]="selImgPos.h+6"
                  fill="transparent" stroke="none" pointer-events="all" cursor="move"
                  (mousedown)="onImgBodyDown($event)"/>
            <rect [attr.x]="selImgPos.x-3" [attr.y]="selImgPos.y-3"
                  [attr.width]="selImgPos.w+6" [attr.height]="selImgPos.h+6"
                  fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6,3" pointer-events="none"/>
            <circle *ngFor="let h of imgHandles" class="img-handle"
                    [attr.cx]="h.cx" [attr.cy]="h.cy" r="7"
                    fill="white" stroke="#f59e0b" stroke-width="2.5"
                    style="filter:drop-shadow(0 1px 4px rgba(0,0,0,.35));pointer-events:all"
                    [attr.cursor]="h.cur"
                    (mousedown)="onImgHandleDown($event,h.id)"/>
          </ng-container>

          <!-- ── Sélection section HTML (HR, div coloré) ── -->
          <ng-container *ngIf="selHtmlSection">
            <!-- Bordure orange de sélection -->
            <rect [attr.x]="htmlSecPos.x - 4" [attr.y]="htmlSecPos.y - 4"
                  [attr.width]="htmlSecPos.w + 8" [attr.height]="Math.max(htmlSecPos.h + 8, 12)"
                  fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6,3"
                  pointer-events="none"/>
            <!-- Poignée MONTER ↑ -->
            <g style="cursor:pointer" (click)="moveHtmlSectionUp()">
              <circle [attr.cx]="htmlSecPos.x + htmlSecPos.w/2"
                      [attr.cy]="htmlSecPos.y - 18" r="12"
                      fill="#f59e0b" stroke="white" stroke-width="2"
                      style="filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))"/>
              <text [attr.x]="htmlSecPos.x + htmlSecPos.w/2"
                    [attr.y]="htmlSecPos.y - 13"
                    text-anchor="middle" font-size="14" fill="white"
                    font-weight="bold" pointer-events="none">↑</text>
            </g>
            <!-- Poignée DESCENDRE ↓ -->
            <g style="cursor:pointer" (click)="moveHtmlSectionDown()">
              <circle [attr.cx]="htmlSecPos.x + htmlSecPos.w/2"
                      [attr.cy]="htmlSecPos.y + Math.max(htmlSecPos.h, 4) + 18" r="12"
                      fill="#f59e0b" stroke="white" stroke-width="2"
                      style="filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))"/>
              <text [attr.x]="htmlSecPos.x + htmlSecPos.w/2"
                    [attr.y]="htmlSecPos.y + Math.max(htmlSecPos.h, 4) + 23"
                    text-anchor="middle" font-size="14" fill="white"
                    font-weight="bold" pointer-events="none">↓</text>
            </g>
            <!-- Poignée SUPPRIMER × -->
            <g style="cursor:pointer" (click)="deleteHtmlSection()">
              <circle [attr.cx]="htmlSecPos.x + htmlSecPos.w + 16"
                      [attr.cy]="htmlSecPos.y + htmlSecPos.h/2" r="10"
                      fill="#ef4444" stroke="white" stroke-width="2"
                      style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))"/>
              <text [attr.x]="htmlSecPos.x + htmlSecPos.w + 16"
                    [attr.y]="htmlSecPos.y + htmlSecPos.h/2 + 5"
                    text-anchor="middle" font-size="13" fill="white"
                    pointer-events="none">×</text>
            </g>
          </ng-container>

        </svg>
      </div>
      </div><!-- /de-canvas-scale-host -->
    </div>

    <!-- ── Properties ── -->
    <aside class="de-props" *ngIf="selObj || selImgEl">
      <div class="de-props-title">PROPRIÉTÉS</div>
      <!-- Shape props -->
      <ng-container *ngIf="selObj">
        <label class="de-prop-lbl">X</label><input class="de-prop-input" type="number" [(ngModel)]="selObj.x">
        <label class="de-prop-lbl">Y</label><input class="de-prop-input" type="number" [(ngModel)]="selObj.y">
        <label class="de-prop-lbl">Largeur</label><input class="de-prop-input" type="number" min="10" [(ngModel)]="selObj.w">
        <label class="de-prop-lbl">Hauteur</label><input class="de-prop-input" type="number" min="10" [(ngModel)]="selObj.h">
        <div class="de-prop-div"></div>
        <ng-container *ngIf="!selObj.isLine">
          <label class="de-prop-lbl">Remplissage</label>
          <div class="de-prop-row">
            <div class="de-prop-swatch" [style.background]="selObj.fill==='none'?'transparent':selObj.fill"
                 [class.de-swatch-none]="selObj.fill==='none'"></div>
            <input type="color" class="de-prop-color" [value]="selObj.fill==='none'?'#6366f1':selObj.fill"
                   (input)="selObj.fill=$any($event.target).value">
            <button class="de-prop-none-btn" (click)="selObj.fill='none'">⊘</button>
          </div>
        </ng-container>
        <label class="de-prop-lbl">Contour</label>
        <div class="de-prop-row">
          <div class="de-prop-swatch" [style.background]="selObj.stroke==='none'?'transparent':selObj.stroke"
               [class.de-swatch-none]="selObj.stroke==='none'"></div>
          <input type="color" class="de-prop-color" [value]="selObj.stroke==='none'?'#000000':selObj.stroke"
                 (input)="selObj.stroke=$any($event.target).value">
          <button class="de-prop-none-btn" (click)="selObj.stroke='none'">⊘</button>
        </div>
        <label class="de-prop-lbl">Épaisseur</label>
        <input class="de-prop-input" type="number" min="0" max="30" [(ngModel)]="selObj.sw">
        <label class="de-prop-lbl">Opacité</label>
        <input type="range" style="width:calc(100% - 24px);margin:0 12px;accent-color:#6366f1" min="10" max="100" step="5" [(ngModel)]="selObj.opacity">
        <div class="de-prop-div"></div>
        <!-- ── Texte dans une forme normale ── -->
        <ng-container *ngIf="!selObj.isTextBox">
          <label class="de-prop-lbl">Texte dans la forme</label>
          <input class="de-prop-input" placeholder="Texte…" [(ngModel)]="selObj.text">
          <ng-container *ngIf="selObj.text">
            <label class="de-prop-lbl">Taille</label>
            <div class="de-slider-row">
              <input type="range" min="8" max="72" [(ngModel)]="selObj.fontSize" style="flex:1;accent-color:#6366f1">
              <span class="de-slider-val">{{selObj.fontSize}}px</span>
            </div>
            <label class="de-prop-lbl">Couleur texte</label>
            <input type="color" class="de-prop-color-full"
                   [value]="selObj.fontColor" (input)="selObj.fontColor=$any($event.target).value">
            <label class="de-prop-lbl">Alignement</label>
            <div class="de-align-row">
              <button [class.active]="selObj.textAlign==='left'"   (click)="selObj.textAlign='left'">⬅</button>
              <button [class.active]="selObj.textAlign==='center'" (click)="selObj.textAlign='center'">⬌</button>
              <button [class.active]="selObj.textAlign==='right'"  (click)="selObj.textAlign='right'">➡</button>
            </div>
          </ng-container>
          <div class="de-prop-div"></div>
          <button class="de-prop-del-btn" (click)="deleteSelected()">🗑 Supprimer la forme</button>
        </ng-container>

        <!-- ══ ZONE DE TEXTE — Mise en forme complète ══ -->
        <ng-container *ngIf="selObj.isTextBox">
          <div class="de-tb-format-title">📝 Mise en forme du texte</div>

          <!-- Police -->
          <label class="de-prop-lbl">Police</label>
          <select class="de-prop-input" [(ngModel)]="selObj.fontFamily" (ngModelChange)="applyTbFormat()">
            <option value="Inter, sans-serif">Inter</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="'Calibri', sans-serif">Calibri</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="Verdana, sans-serif">Verdana</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="'Outfit', sans-serif">Outfit</option>
          </select>

          <!-- Taille (slider + chiffre) -->
          <label class="de-prop-lbl">Taille</label>
          <div class="de-slider-row">
            <input type="range" min="8" max="96" [(ngModel)]="selObj.fontSize" (ngModelChange)="applyTbFormat()"
                   style="flex:1;accent-color:#6366f1">
            <input type="number" min="8" max="96" [(ngModel)]="selObj.fontSize" (ngModelChange)="applyTbFormat()"
                   class="de-tb-size-num">
          </div>

          <!-- Style : B I U S -->
          <label class="de-prop-lbl">Style</label>
          <div class="de-fmt-row">
            <button class="de-fmt-btn" [class.active]="selObj.bold"          (click)="selObj.bold=!selObj.bold;applyTbFormat()"><b>B</b></button>
            <button class="de-fmt-btn" [class.active]="selObj.italic"        (click)="selObj.italic=!selObj.italic;applyTbFormat()"><i>I</i></button>
            <button class="de-fmt-btn" [class.active]="selObj.underline"     (click)="selObj.underline=!selObj.underline;applyTbFormat()"><u>U</u></button>
            <button class="de-fmt-btn" [class.active]="selObj.strikethrough" (click)="selObj.strikethrough=!selObj.strikethrough;applyTbFormat()"><s>S</s></button>
          </div>

          <!-- Couleur texte + surlignage -->
          <label class="de-prop-lbl">Couleur du texte</label>
          <div class="de-prop-row">
            <div class="de-prop-swatch" [style.background]="selObj.fontColor"></div>
            <input type="color" class="de-prop-color" [value]="selObj.fontColor"
                   (input)="selObj.fontColor=$any($event.target).value;applyTbFormat()">
          </div>
          <label class="de-prop-lbl">Surlignage</label>
          <div class="de-prop-row">
            <div class="de-prop-swatch" [style.background]="selObj.highlight||'transparent'"
                 style="border:1px dashed #475569"></div>
            <input type="color" class="de-prop-color" [value]="selObj.highlight||'#ffff00'"
                   (input)="selObj.highlight=$any($event.target).value;applyTbFormat()">
            <button class="de-prop-none-btn" (click)="selObj.highlight=undefined;applyTbFormat()">⊘</button>
          </div>

          <!-- Alignement -->
          <label class="de-prop-lbl">Alignement</label>
          <div class="de-align-row">
            <button [class.active]="selObj.textAlign==='left'"    (click)="selObj.textAlign='left';applyTbFormat()"    title="Gauche">≡⬅</button>
            <button [class.active]="selObj.textAlign==='center'"  (click)="selObj.textAlign='center';applyTbFormat()"  title="Centre">≡⬌</button>
            <button [class.active]="selObj.textAlign==='right'"   (click)="selObj.textAlign='right';applyTbFormat()"   title="Droite">≡➡</button>
            <button [class.active]="selObj.textAlign==='justify'" (click)="selObj.textAlign='justify';applyTbFormat()" title="Justifié">≡≡</button>
          </div>

          <!-- Interligne -->
          <label class="de-prop-lbl">Interligne</label>
          <div class="de-slider-row">
            <input type="range" min="1.0" max="3.0" step="0.1"
                   [(ngModel)]="selObj.lineHeight" (ngModelChange)="applyTbFormat()"
                   style="flex:1;accent-color:#6366f1">
            <span class="de-slider-val">×{{(selObj.lineHeight||1.4).toFixed(1)}}</span>
          </div>

          <div class="de-prop-div"></div>
          <div class="de-tb-format-title">🎨 Apparence de la zone</div>

          <!-- Fond de la zone -->
          <label class="de-prop-lbl">Fond de la zone</label>
          <div class="de-prop-row">
            <div class="de-prop-swatch" [style.background]="selObj.bgColor||'transparent'"
                 style="border:1px dashed #475569"></div>
            <input type="color" class="de-prop-color" [value]="selObj.bgColor||'#ffffff'"
                   (input)="selObj.bgColor=$any($event.target).value">
            <button class="de-prop-none-btn" (click)="selObj.bgColor=undefined">⊘</button>
          </div>

          <!-- Contour -->
          <label class="de-prop-lbl">Contour</label>
          <div class="de-prop-row">
            <div class="de-prop-swatch" [style.background]="selObj.stroke==='none'?'transparent':selObj.stroke"
                 [class.de-swatch-none]="selObj.stroke==='none'"></div>
            <input type="color" class="de-prop-color" [value]="selObj.stroke==='none'?'#000000':selObj.stroke"
                   (input)="selObj.stroke=$any($event.target).value">
            <button class="de-prop-none-btn" (click)="selObj.stroke='none'">⊘</button>
          </div>

          <!-- Épaisseur contour -->
          <label class="de-prop-lbl">Épaisseur contour</label>
          <input class="de-prop-input" type="number" min="0" max="20" [(ngModel)]="selObj.sw">

          <!-- Arrondi -->
          <label class="de-prop-lbl">Coins arrondis</label>
          <div class="de-slider-row">
            <input type="range" min="0" max="50" [(ngModel)]="selObj.borderRadius"
                   style="flex:1;accent-color:#6366f1">
            <span class="de-slider-val">{{selObj.borderRadius||0}}px</span>
          </div>

          <!-- Opacité -->
          <label class="de-prop-lbl">Opacité</label>
          <div class="de-slider-row">
            <input type="range" min="10" max="100" step="5" [(ngModel)]="selObj.opacity"
                   style="flex:1;accent-color:#6366f1">
            <span class="de-slider-val">{{selObj.opacity}}%</span>
          </div>

          <!-- Padding interne -->
          <label class="de-prop-lbl">Marge interne (px)</label>
          <input class="de-prop-input" type="number" min="0" max="40" [(ngModel)]="selObj.paddingPx">

          <div class="de-prop-div"></div>
          <button class="de-prop-del-btn" (click)="deleteSelected()">🗑 Supprimer la zone</button>
        </ng-container>
      </ng-container>
      <!-- Image props -->
      <ng-container *ngIf="selImgEl && !selObj">
        <label class="de-prop-lbl">Largeur px</label>
        <input class="de-prop-input" type="number" [value]="selImgEl.offsetWidth" (change)="resizeImgTo($any($event.target).value, null)">
        <label class="de-prop-lbl">Hauteur px</label>
        <input class="de-prop-input" type="number" [value]="selImgEl.offsetHeight" (change)="resizeImgTo(null, $any($event.target).value)">
        <div class="de-prop-div"></div>
        <label class="de-prop-lbl">Forme</label>
        <select class="de-prop-input" [(ngModel)]="imgShape" (ngModelChange)="applyImgShape()">
          <option value="circle">Rond</option>
          <option value="square">Carré</option>
          <option value="rect">Rectangle</option>
          <option value="hex">Hexagone</option>
        </select>
        <div class="de-prop-div"></div>
        <button class="de-prop-del-btn" (click)="deleteHtmlEl(selImgEl)">🗑 Supprimer la photo</button>
      </ng-container>
    </aside>

  </div><!-- de-body -->

  <!-- ── Preview Overlay ── -->
  <div class="de-preview-ov" *ngIf="showPreviewOverlay" (click)="showPreviewOverlay=false">
    <div class="de-preview-ov-inner" (click)="$event.stopPropagation()">
      <div class="de-preview-ov-head">
        <span>Aperçu du CV</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="de-preview-zoom-btn" (click)="previewOvZoom=Math.max(40,previewOvZoom-10)">−</button>
          <span class="de-preview-zoom-lbl">{{previewOvZoom}}%</span>
          <button class="de-preview-zoom-btn" (click)="previewOvZoom=Math.min(150,previewOvZoom+10)">+</button>
          <button class="de-preview-close-btn" (click)="showPreviewOverlay=false">✕</button>
        </div>
      </div>
      <div class="de-preview-ov-body">
        <div class="de-preview-ov-page"
             [style.width.px]="width"
             [style.transform]="'scale('+previewOvZoom/100+')'"
             style="transform-origin:top center"
             [innerHTML]="previewHtml"></div>
      </div>
    </div>
  </div>

  <!-- ── Context menu : Formes SVG ── -->
  <div class="de-ctx" *ngIf="ctx.visible && !ctx.isHtml"
       [style.left.px]="ctx.x" [style.top.px]="ctx.y"
       (click)="$event.stopPropagation()">
    <div class="de-ctx-header">Forme</div>
    <button class="de-ctx-item" (click)="duplicateSelected();ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      Dupliquer
    </button>
    <div class="de-ctx-sep"></div>
    <button class="de-ctx-item" (click)="bringToFront();ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
      Premier plan
    </button>
    <button class="de-ctx-item" (click)="bringForward();ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
      Monter d'un cran
    </button>
    <button class="de-ctx-item" (click)="sendBackward();ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      Descendre d'un cran
    </button>
    <button class="de-ctx-item" (click)="sendToBack();ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 6 12 11 17 6"/><polyline points="7 13 12 18 17 13"/></svg>
      Arrière-plan
    </button>
    <div class="de-ctx-sep"></div>
    <button class="de-ctx-item de-ctx-danger" (click)="deleteSelected();ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      Supprimer
    </button>
  </div>

  <!-- ── Context menu : Éléments HTML du CV ── -->
  <div class="de-ctx" *ngIf="ctx.visible && ctx.isHtml"
       [style.left.px]="ctx.x" [style.top.px]="ctx.y"
       (click)="$event.stopPropagation()">
    <div class="de-ctx-header">Élément CV</div>

    <!-- ▶ Mise en forme (collapsible) -->
    <button class="de-ctx-item de-ctx-submenu-btn" (click)="ctxFmtExpanded=!ctxFmtExpanded">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h10M4 17h13"/></svg>
      Mise en forme
      <svg class="de-ctx-chevron" [class.de-ctx-chevron--open]="ctxFmtExpanded" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </button>

    <!-- Format panel (expanded) -->
    <div class="de-ctx-fmt-panel" *ngIf="ctxFmtExpanded">
      <!-- Row 1 : Police + Taille + B I U + Effacer -->
      <div class="de-ctx-fmt-row">
        <select class="de-ctx-fsel" title="Police"
          (mousedown)="$event.stopPropagation()"
          (change)="fbRestoreRangePub();document.execCommand('fontName',$any($event.target).value)">
          <option value="Inter">Inter</option>
          <option value="Arial">Arial</option>
          <option value="Calibri">Calibri</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times NR</option>
          <option value="Verdana">Verdana</option>
          <option value="Courier New">Courier</option>
          <option value="Outfit">Outfit</option>
        </select>
        <select class="de-ctx-fsel de-ctx-fsel--size" title="Taille"
          (mousedown)="$event.stopPropagation()"
          (change)="ctxFmtSize=+$any($event.target).value;applyCtxFontSize()">
          <option *ngFor="let s of [8,9,10,11,12,14,16,18,20,22,24,28,32,36,42,48,60,72]" [value]="s" [selected]="s===ctxFmtSize">{{s}}</option>
        </select>
        <button class="de-ctx-fbt" title="Gras (Ctrl+B)"
          (mousedown)="$event.preventDefault();fbRestoreRangePub();document.execCommand('bold')">
          <b>B</b>
        </button>
        <button class="de-ctx-fbt" title="Italique (Ctrl+I)"
          (mousedown)="$event.preventDefault();fbRestoreRangePub();document.execCommand('italic')">
          <i>I</i>
        </button>
        <button class="de-ctx-fbt" title="Souligné (Ctrl+U)"
          (mousedown)="$event.preventDefault();fbRestoreRangePub();document.execCommand('underline')">
          <u>U</u>
        </button>
        <button class="de-ctx-fbt" title="Effacer la mise en forme"
          (mousedown)="$event.preventDefault();fbRestoreRangePub();document.execCommand('removeFormat')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M20 20H7l-4-4 9.75-9.75m1.77-1.77L20 2l2 2-1.48 1.48"/></svg>
        </button>
      </div>
      <!-- Row 2 : couleurs + interligne (icônes + tooltips seulement) -->
      <div class="de-ctx-fmt-row de-ctx-fmt-row--icons">
        <!-- Couleur texte -->
        <label class="de-ctx-fbt de-ctx-clr-btn" title="Couleur du texte" (mousedown)="$event.preventDefault()">
          <span class="de-ctx-clr-ico">
            <span class="de-ctx-clr-letter">A</span>
            <span class="de-ctx-clr-bar" [style.background]="ctxFmtColor"></span>
          </span>
          <input type="color" [value]="ctxFmtColor"
                 (input)="ctxFmtColor=$any($event.target).value;applyForeColorSync(ctxFmtColor)"
                 (change)="ctxFmtColor=$any($event.target).value;applyForeColorSync(ctxFmtColor)">
        </label>
        <!-- Surlignage -->
        <label class="de-ctx-fbt de-ctx-clr-btn" title="Couleur de surlignage" (mousedown)="$event.preventDefault()">
          <span class="de-ctx-clr-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span class="de-ctx-clr-bar" [style.background]="ctxHighColor"></span>
          </span>
          <input type="color" [value]="ctxHighColor"
                 (input)="ctxHighColor=$any($event.target).value;applyBgColorSync(ctxHighColor)"
                 (change)="ctxHighColor=$any($event.target).value;applyBgColorSync(ctxHighColor)">
        </label>

        <!-- Séparateur vertical -->
        <span class="de-ctx-vsep"></span>

        <!-- Interligne — boutons rapides -->
        <span class="de-ctx-lh-lbl" title="Interligne">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
        </span>
        <button class="de-ctx-fbt de-ctx-lh-btn" title="Interligne 1.0"
          (mousedown)="$event.preventDefault();setCtxLineHeight(1.0)">1</button>
        <button class="de-ctx-fbt de-ctx-lh-btn" title="Interligne 1.2"
          (mousedown)="$event.preventDefault();setCtxLineHeight(1.2)">1.2</button>
        <button class="de-ctx-fbt de-ctx-lh-btn" title="Interligne 1.5"
          (mousedown)="$event.preventDefault();setCtxLineHeight(1.5)">1.5</button>
        <button class="de-ctx-fbt de-ctx-lh-btn" title="Interligne 2.0"
          (mousedown)="$event.preventDefault();setCtxLineHeight(2.0)">2</button>
      </div>
    </div>

    <div class="de-ctx-sep"></div>

    <button class="de-ctx-item" (click)="addSpacing(ctx.htmlEl, 8);ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 5 5 12"/></svg>
      + Espace avant
    </button>
    <button class="de-ctx-item" (click)="addSpacing(ctx.htmlEl, -8);ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 19 19 12"/></svg>
      − Espace avant
    </button>

    <div class="de-ctx-sep"></div>

    <button class="de-ctx-item" (click)="moveHtmlElUp(ctx.htmlEl);ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
      Monter d'un cran
    </button>
    <button class="de-ctx-item" (click)="moveHtmlElDown(ctx.htmlEl);ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      Descendre d'un cran
    </button>
    <button class="de-ctx-item" (click)="duplicateHtmlEl(ctx.htmlEl);ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      Dupliquer
    </button>

    <div class="de-ctx-sep"></div>

    <button class="de-ctx-item de-ctx-danger" (click)="deleteHtmlEl(ctx.htmlEl);ctx.visible=false">
      <svg class="de-ctx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      Supprimer l'élément
    </button>
  </div>

</div>
  `,
  styles: [`
    :host { display:contents; }
    .de-root {
      display: flex; flex-direction: column; height: 100%;
      background: #1a1f2e; font-family: 'Inter',system-ui,sans-serif;
      color: #e2e8f0; position: relative; overflow: hidden;
    }
    /* ── Topbar ── */
    .de-topbar {
      display:flex; align-items:center; justify-content:space-between;
      padding:6px 12px; background:#0f172a; border-bottom:1px solid #2d3548;
      flex-shrink:0; gap:6px; flex-wrap:wrap; min-height:46px;
    }
    .de-topbar-left  { display:flex; align-items:center; gap:5px; flex-wrap:wrap; flex:1; min-width:0; }
    .de-topbar-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
    .de-tb-btn {
      padding:4px 9px; background:rgba(255,255,255,.08); border:none;
      color:#e2e8f0; border-radius:6px; font-size:.73rem; font-weight:600;
      cursor:pointer; white-space:nowrap; transition:background .1s;
    }
    .de-tb-btn:hover  { background:rgba(255,255,255,.16); color:#fff; }
    .de-tb-btn--on    { background:#6366f1 !important; color:#fff; }
    .de-tb-btn[disabled]{ opacity:.35; cursor:not-allowed; }
    .de-sep { width:1px; height:20px; background:#2d3548; flex-shrink:0; }
    .de-tb-label { font-size:.67rem; color:#94a3b8; white-space:nowrap; }
    .de-tb-num {
      width:42px; padding:3px 4px; background:#1e293b; border:1px solid #334155;
      color:#f1f5f9; border-radius:5px; font-size:.73rem; text-align:center;
    }
    .de-tb-range { accent-color:#6366f1; width:68px; }
    .de-tb-tiny  { font-size:.64rem; color:#94a3b8; min-width:26px; }
    .de-tb-select {
      padding:3px 5px; background:#1e293b; border:1px solid #334155;
      color:#f1f5f9; border-radius:5px; font-size:.72rem; cursor:pointer;
    }
    /* Mode édition toggle */
    .de-tb-mode-wrap {
      display:flex; align-items:center; gap:5px; cursor:pointer;
      padding:3px 9px; border-radius:8px; border:1px solid #334155;
      background:rgba(255,255,255,.05); transition:.15s;
    }
    .de-tb-mode-wrap:hover { border-color:#6366f1; background:rgba(99,102,241,.1); }
    .de-tb-checkbox { accent-color:#6366f1; width:14px; height:14px; cursor:pointer; }
    .de-tb-mode-lbl { font-size:.73rem; font-weight:700; color:#e2e8f0; }
    /* Bouton télécharger */
    .de-dl-btn {
      padding:5px 12px; background:#16a34a; color:#fff; border:none;
      border-radius:7px; font-size:.78rem; font-weight:700; cursor:pointer; transition:.15s;
    }
    .de-dl-btn:hover { background:#15803d; }
    .de-save-btn {
      padding:5px 14px; background:#6366f1; color:#fff; border:none;
      border-radius:7px; font-size:.78rem; font-weight:700; cursor:pointer;
    }
    .de-save-btn:hover   { background:#4f46e5; }
    .de-cancel-btn {
      padding:5px 10px; background:rgba(255,255,255,.08); color:#c9d1e0; border:none;
      border-radius:7px; font-size:.78rem; cursor:pointer;
    }
    .de-cancel-btn:hover { background:rgba(255,255,255,.14); color:#fff; }
    /* ── Color widgets ── */
    .de-color-wrap  { position:relative; }
    .de-color-swatch {
      width:26px; height:26px; border-radius:6px; border:2px solid #475569;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
    }
    .de-none-ico { font-size:.8rem; color:#94a3b8; }
    .de-color-pop {
      position:absolute; top:32px; left:0; z-index:9999;
      background:#1e293b; border:1px solid #334155; border-radius:10px;
      padding:10px; width:170px; box-shadow:0 8px 28px rgba(0,0,0,.6);
    }
    .de-pop-none {
      width:100%; padding:4px 8px; background:rgba(255,255,255,.06); border:none;
      color:#94a3b8; border-radius:6px; cursor:pointer; font-size:.7rem; margin-bottom:8px;
    }
    .de-color-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:3px; margin-bottom:8px; }
    .de-pal-btn { width:18px; height:18px; border-radius:4px; border:none; cursor:pointer; }
    .de-pal-btn:hover { transform:scale(1.3); }
    .de-color-input { width:100%; height:26px; border:none; border-radius:5px; cursor:pointer; }
    /* ── Text mode hint ── */
    .de-text-hint {
      background:#312e81; color:#e0e7ff; font-size:.72rem; padding:6px 14px;
      flex-shrink:0; text-align:center;
    }
    .de-text-hint kbd {
      background:#4f46e5; padding:1px 6px; border-radius:4px; font-size:.68rem;
    }
    /* ── Body ── */
    .de-body { display:flex; flex:1; overflow:hidden; min-height:0; }
    /* ── Gallery ── */
    .de-gallery {
      width:170px; flex-shrink:0; background:#0f172a;
      border-right:1px solid #2d3548; overflow-y:auto; overflow-x:hidden;
      scrollbar-width:thin; scrollbar-color:#334155 transparent;
      position:relative; transition:width .2s ease;
    }
    .de-gallery--collapsed {
      width:28px; overflow:hidden;
    }
    .de-gallery--collapsed > *:not(.de-gallery-toggle) { display:none; }
    .de-gallery-toggle {
      position:sticky; top:0; z-index:10;
      display:flex; align-items:center; justify-content:center;
      width:100%; height:28px;
      background:#dc2626; border:none; cursor:pointer;
      color:#fff; flex-shrink:0;
      transition:background .15s;
    }
    .de-gallery-toggle:hover { background:#b91c1c; }
    .de-gallery--collapsed .de-gallery-toggle { border-radius:0; }
    .de-gallery::-webkit-scrollbar { width:3px; }
    .de-gallery::-webkit-scrollbar-thumb { background:#334155; }
    .de-gallery-title { font-size:.62rem; font-weight:800; color:#cbd5e1; letter-spacing:1.5px; padding:10px 10px 4px; }
    .de-cat { border-bottom:1px solid #1e293b; }
    .de-cat-hdr {
      width:100%; display:flex; align-items:center; gap:6px; padding:7px 10px;
      background:none; border:none; color:#cbd5e1; cursor:pointer; font-size:.7rem; font-weight:600;
    }
    .de-cat-hdr:hover { background:rgba(255,255,255,.06); color:#fff; }
    .de-cat-icon  { font-size:.85rem; }
    .de-cat-label { flex:1; text-align:left; color:#e2e8f0; }
    .de-cat-arrow { font-size:.55rem; color:#94a3b8; }
    .de-shapes-grid { display:grid; grid-template-columns:1fr 1fr; gap:3px; padding:3px 6px 6px; }
    .de-shape-btn {
      display:flex; flex-direction:column; align-items:center; gap:2px;
      background:rgba(255,255,255,.04); border:1px solid #1e293b; border-radius:6px;
      padding:5px 2px; cursor:pointer; transition:all .1s;
    }
    .de-shape-btn:hover { background:#1e293b; border-color:#6366f1; }
    .de-shape-preview { width:52px; height:36px; }
    .de-shape-lbl { font-size:.57rem; color:#94a3b8; text-align:center; line-height:1.1; }
    /* ── Zoom bar ── */
    .de-zoom-bar {
      display:flex; align-items:center; gap:2px; margin-left:auto; flex-shrink:0;
      background:rgba(15,23,42,.6); border:1px solid #334155; border-radius:7px; padding:2px 4px;
    }
    .de-zoom-btn {
      background:none; border:none; color:#94a3b8; cursor:pointer;
      font-size:.9rem; font-weight:700; padding:2px 7px; border-radius:5px; line-height:1;
    }
    .de-zoom-btn:hover { background:rgba(99,102,241,.2); color:#a5b4fc; }
    .de-zoom-fit { font-size:.75rem; }
    .de-zoom-pct {
      font-size:.72rem; font-weight:700; color:#e2e8f0; min-width:36px; text-align:center;
      cursor:pointer; padding:2px 4px; border-radius:4px;
    }
    .de-zoom-pct:hover { background:rgba(255,255,255,.08); }

    /* ── Canvas ── */
    .de-canvas-wrap {
      flex:1; min-width:0; background:#374151;
      display:flex; align-items:flex-start; justify-content:center;
      overflow:auto; padding:20px;
    }
    .de-canvas-scale-host {
      flex-shrink:0; display:flex; align-items:flex-start; justify-content:center;
    }
    .de-canvas { position:relative; background:#fff; box-shadow:0 6px 40px rgba(0,0,0,.5); flex-shrink:0; }
    /* Photo + Fond buttons */
    .de-photo-btn {
      display:inline-flex; align-items:center; gap:.35rem; padding:5px 12px;
      background:linear-gradient(135deg,#0d9488,#10b981); color:#fff; border:none;
      border-radius:7px; font-size:.78rem; font-weight:700; cursor:pointer; transition:.15s;
    }
    .de-photo-btn:hover { opacity:.88; }
    .de-bg-btn {
      padding:5px 12px; background:rgba(255,255,255,.1); color:#e2e8f0; border:1px solid rgba(255,255,255,.15);
      border-radius:7px; font-size:.78rem; font-weight:700; cursor:pointer; transition:.15s; position:relative;
    }
    .de-bg-btn:hover { background:rgba(255,255,255,.18); }
    .de-bg-panel {
      position:absolute; top:46px; right:8px; z-index:9999;
      background:#1e293b; border:1px solid #334155; border-radius:12px;
      padding:12px; width:240px; box-shadow:0 8px 28px rgba(0,0,0,.6);
    }
    .de-bg-section-lbl { font-size:.62rem; font-weight:800; color:#94a3b8; letter-spacing:1px; text-transform:uppercase; margin-bottom:5px; }
    .de-bg-color-pick { width:100%; height:36px; border-radius:8px; border:1px solid #334155; cursor:pointer; }
    .de-bg-grad-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; }
    .de-bg-grad-btn {
      height:28px; border-radius:6px; border:2px solid transparent; cursor:pointer;
      font-size:.58rem; font-weight:700; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.6);
      transition:.12s;
    }
    .de-bg-grad-btn:hover,.de-bg-grad-btn.active { border-color:#6366f1; transform:scale(1.05); }
    .de-bg-img-btn {
      display:block; width:100%; padding:6px 10px; background:rgba(255,255,255,.08); border:1px dashed #475569;
      border-radius:7px; color:#94a3b8; font-size:.72rem; font-weight:600; cursor:pointer; text-align:center; transition:.15s;
    }
    .de-bg-img-btn:hover { background:rgba(99,102,241,.12); border-color:#6366f1; color:#e2e8f0; }
    .de-bg-clear-btn {
      margin-top:6px; width:100%; padding:5px; background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.3);
      border-radius:6px; color:#f87171; font-size:.7rem; cursor:pointer;
    }
    /* Dynamic fields */
    .de-dyn-hint { font-size:.6rem; color:#64748b; padding:0 10px 4px; }
    .de-dyn-fields { display:flex; flex-wrap:wrap; gap:4px; padding:0 8px 8px; }
    .de-dyn-chip {
      background:rgba(99,102,241,.18); border:1px solid rgba(99,102,241,.35); border-radius:6px;
      color:#a5b4fc; font-size:.62rem; font-weight:700; padding:3px 7px; cursor:pointer; transition:.12s;
    }
    .de-dyn-chip:hover { background:rgba(99,102,241,.35); color:#fff; }
    .de-html-layer {
      position:absolute; inset:0; outline:none;
      caret-color:#6366f1;
    }
    /* Editing mode: highlight editable elements */
    .de-html-text-mode { cursor:text !important; }
    .de-html-text-mode *:hover:not(img) {
      outline: 1.5px dashed rgba(99,102,241,.55) !important;
      outline-offset: 1px;
      cursor: text !important;
    }
    .de-html-text-mode img:hover {
      outline: 2px solid #f59e0b !important;
      outline-offset: 2px;
      cursor: pointer !important;
    }
    .de-svg-layer { position:absolute; inset:0; overflow:visible; }
    /* ── Props ── */
    .de-props {
      width:205px; flex-shrink:0; background:#0f172a;
      border-left:1px solid #2d3548; overflow-y:auto; padding:0 0 20px;
      scrollbar-width:thin; scrollbar-color:#334155 transparent;
    }
    .de-props::-webkit-scrollbar { width:3px; }
    .de-props::-webkit-scrollbar-thumb { background:#334155; }
    .de-props-title { font-size:.62rem; font-weight:800; color:#cbd5e1; letter-spacing:1.5px; padding:10px 12px 4px; }
    .de-prop-lbl { display:block; font-size:.67rem; color:#94a3b8; margin:7px 12px 2px; }
    .de-prop-input {
      display:block; width:calc(100% - 24px); margin:0 12px;
      padding:4px 8px; background:#1e293b; border:1px solid #334155;
      color:#f1f5f9; border-radius:6px; font-size:.76rem;
    }
    .de-prop-div { height:1px; background:#1e293b; margin:10px 0; }
    .de-prop-row { display:flex; align-items:center; gap:5px; padding:0 12px; }
    .de-prop-swatch { width:26px; height:26px; border-radius:6px; flex-shrink:0; border:1px solid #334155; }
    .de-swatch-none { background: repeating-linear-gradient(45deg,#1e293b,#1e293b 4px,#334155 4px,#334155 8px) !important; }
    .de-prop-color { flex:1; height:26px; border-radius:5px; border:none; cursor:pointer; }
    .de-prop-none-btn {
      width:26px; height:26px; background:rgba(255,255,255,.06); border:none;
      color:#94a3b8; border-radius:5px; cursor:pointer; font-size:.7rem;
    }
    .de-prop-none-btn:hover { background:rgba(255,255,255,.14); color:#f1f5f9; }
    .de-prop-del-btn {
      width:calc(100% - 24px); margin:0 12px; padding:7px; background:#7f1d1d;
      color:#fca5a5; border:none; border-radius:7px; cursor:pointer; font-size:.73rem; font-weight:700;
    }
    .de-prop-del-btn:hover { background:#991b1b; }
    /* ── Format bar ── */
    .de-format-bar {
      display:flex; align-items:center; gap:2px; flex-wrap:wrap;
      padding:3px 10px; background:#111827; border-bottom:1px solid #1e293b;
      flex-shrink:0; min-height:34px;
    }
    .de-fb-font {
      background:#1e293b; border:1px solid #334155; border-radius:5px;
      color:#e2e8f0; font-size:.72rem; padding:2px 4px; height:26px; width:110px;
    }
    .de-fb-size {
      background:#1e293b; border:1px solid #334155; border-radius:5px;
      color:#e2e8f0; font-size:.72rem; padding:2px 4px; height:26px; width:38px; text-align:center;
    }
    .de-fb-btn {
      padding:2px 6px; height:26px; min-width:26px;
      background:rgba(255,255,255,.06); border:1px solid transparent;
      color:#c9d1e0; border-radius:4px; cursor:pointer; font-size:.75rem;
      transition:.12s; display:flex; align-items:center; justify-content:center;
    }
    .de-fb-btn:hover { background:rgba(99,102,241,.2); color:#fff; border-color:#6366f1; }
    .de-fb-btn.active { background:#6366f1; color:#fff; }
    .de-fb-del { color:#fca5a5; }
    .de-fb-del:hover { background:rgba(239,68,68,.2) !important; }
    .de-fb-sep {
      width:1px; height:20px; background:#334155; margin:0 3px; flex-shrink:0;
    }
    .de-fb-color-lbl {
      display:flex; flex-direction:column; align-items:center;
      cursor:pointer; gap:1px; padding:2px 4px;
      border:1px solid transparent; border-radius:4px;
    }
    .de-fb-color-lbl:hover { background:rgba(255,255,255,.06); border-color:#334155; }
    .de-fb-color-letter { font-size:.8rem; font-weight:700; color:#e2e8f0; line-height:1.2; }
    .de-fb-color-bar { width:18px; height:3px; border-radius:2px; flex-shrink:0; }
    .de-fb-sec-lbl {
      font-size:.65rem; font-weight:700; color:#f59e0b; padding:0 4px;
      background:rgba(245,158,11,.1); border-radius:4px; white-space:nowrap;
    }

    .de-align-row { display:flex; gap:4px; padding:0 12px; }
    .de-align-row button {
      flex:1; padding:4px 2px; background:#1e293b; border:1px solid #334155;
      color:#64748b; border-radius:5px; cursor:pointer; font-size:.72rem;
    }
    .de-align-row button.active { background:#6366f1; color:#fff; border-color:#6366f1; }

    /* ── Zone de texte sidebar ── */
    .de-tb-zone-btns {
      display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px 6px 8px;
    }
    .de-tb-zone-btn {
      display:flex; flex-direction:column; align-items:center; gap:3px;
      background:#1e293b; border:1px solid #334155; border-radius:8px;
      padding:6px 4px; cursor:pointer; color:#94a3b8; font-size:.62rem; font-weight:600;
      transition:.15s;
    }
    .de-tb-zone-btn:hover { border-color:#6366f1; background:#1a2035; color:#fff; }
    .de-tb-zone-btn svg { width:60px; height:auto; }

    /* ── Zone de texte foreignObject content ── */
    .de-tb-fo-content { user-select:text; }
    .de-tb-fo-content:focus { outline:none; }
    .de-tb-fo-content[contenteditable=true] { cursor:text; }

    /* ── Format panel ── */
    .de-tb-format-title {
      font-size:.67rem; font-weight:800; color:#818cf8; letter-spacing:1px;
      padding:8px 12px 4px; text-transform:uppercase;
    }
    .de-fmt-row { display:flex; gap:4px; padding:0 12px; margin-bottom:4px; }
    .de-fmt-btn {
      flex:1; padding:5px; background:#1e293b; border:1px solid #334155;
      color:#94a3b8; border-radius:6px; cursor:pointer; font-size:.85rem;
      transition:.15s;
    }
    .de-fmt-btn:hover { background:rgba(99,102,241,.15); color:#fff; }
    .de-fmt-btn.active { background:#6366f1; color:#fff; border-color:#6366f1; }

    .de-slider-row { display:flex; align-items:center; gap:6px; padding:0 12px; margin-bottom:4px; }
    .de-slider-val { font-size:.65rem; color:#94a3b8; min-width:30px; text-align:right; }
    .de-tb-size-num {
      width:42px; background:#1e293b; border:1px solid #334155; border-radius:5px;
      color:#e2e8f0; font-size:.72rem; padding:3px 4px; text-align:center;
    }
    .de-prop-color-full {
      display:block; width:calc(100% - 24px); margin:0 12px; height:30px;
      border-radius:6px; border:none; cursor:pointer;
    }
    /* ═══ Context menu — refined Google-Docs style ═══ */
    .de-ctx {
      position:absolute; z-index:9999;
      background:#1e2435; border:1px solid rgba(255,255,255,.08);
      border-radius:12px; padding:6px 4px;
      min-width:210px; max-width:260px;
      box-shadow:0 12px 40px rgba(0,0,0,.7), 0 2px 8px rgba(0,0,0,.4);
      backdrop-filter:blur(12px);
    }
    .de-ctx-header {
      font-size:.62rem; font-weight:800; color:#475569;
      letter-spacing:1.2px; text-transform:uppercase;
      padding:3px 14px 7px;
    }
    .de-ctx-item {
      display:flex; align-items:center; gap:10px;
      width:100%; text-align:left; padding:7px 14px;
      background:none; border:none; color:#c8d3e6;
      font-size:.78rem; font-weight:500; cursor:pointer;
      border-radius:7px; transition:background .1s, color .1s;
    }
    .de-ctx-item:hover { background:rgba(255,255,255,.07); color:#fff; }
    .de-ctx-ico { width:15px; height:15px; flex-shrink:0; opacity:.7; }
    .de-ctx-item:hover .de-ctx-ico { opacity:1; }
    .de-ctx-danger { color:#f87171 !important; }
    .de-ctx-danger:hover { background:rgba(239,68,68,.1) !important; }
    .de-ctx-sep { height:1px; background:rgba(255,255,255,.07); margin:4px 10px; }

    /* Submenu header (Mise en forme) */
    .de-ctx-submenu-btn { justify-content:flex-start; font-weight:600; color:#a5b4fc; }
    .de-ctx-submenu-btn:hover { background:rgba(99,102,241,.1); color:#c7d2fe; }
    .de-ctx-chevron { width:14px; height:14px; margin-left:auto; opacity:.5; transition:transform .2s; flex-shrink:0; }
    .de-ctx-chevron--open { transform:rotate(90deg); opacity:1; }

    /* Format panel */
    .de-ctx-fmt-panel {
      padding:6px 8px 4px; background:rgba(0,0,0,.2);
      border-radius:8px; margin:2px 6px 4px; border:1px solid rgba(255,255,255,.06);
    }
    .de-ctx-fmt-row {
      display:flex; align-items:center; gap:3px; flex-wrap:nowrap;
      padding:2px 0;
    }
    .de-ctx-fmt-row + .de-ctx-fmt-row { margin-top:4px; border-top:1px solid rgba(255,255,255,.06); padding-top:6px; }

    /* Font / size selectors */
    .de-ctx-fsel {
      background:#0f172a; border:1px solid #334155; color:#e2e8f0;
      border-radius:5px; font-size:.68rem; padding:3px 5px; cursor:pointer; flex:1;
    }
    .de-ctx-fsel--size { flex:0 0 46px; }
    .de-ctx-fsel:focus { outline:none; border-color:#6366f1; }

    /* Format icon buttons */
    .de-ctx-fbt {
      flex-shrink:0; width:28px; height:28px; display:flex; align-items:center; justify-content:center;
      background:transparent; border:1px solid transparent; color:#94a3b8;
      border-radius:5px; font-size:.78rem; font-weight:800; cursor:pointer; transition:.12s;
    }
    .de-ctx-fbt:hover { background:#334155; border-color:#475569; color:#fff; }

    /* Row 2 — icon-only layout */
    .de-ctx-fmt-row--icons { gap:4px; }
    .de-ctx-clr-btn { cursor:pointer; position:relative; }
    .de-ctx-clr-btn input { position:absolute; inset:0; opacity:0; width:100%; height:100%; cursor:pointer; }
    .de-ctx-clr-ico { display:flex; flex-direction:column; align-items:center; gap:2px; pointer-events:none; }
    .de-ctx-clr-letter { font-size:.8rem; font-weight:800; color:#e2e8f0; line-height:1; }
    .de-ctx-clr-bar { width:16px; height:3px; border-radius:2px; }
    .de-ctx-vsep { width:1px; height:20px; background:rgba(255,255,255,.1); margin:0 3px; flex-shrink:0; }
    .de-ctx-lh-lbl { display:flex; align-items:center; color:#64748b; flex-shrink:0; }
    .de-ctx-lh-btn { font-size:.6rem !important; font-weight:700; width:auto !important; padding:0 5px; min-width:24px; }

    /* ── Preview button ── */
    .de-preview-btn {
      display:flex; align-items:center; gap:5px;
      padding:5px 12px; background:#374151; border:1px solid #4b5563;
      border-radius:7px; color:#d1d5db; font-size:.75rem; font-weight:700;
      cursor:pointer; transition:.15s; white-space:nowrap; flex-shrink:0;
    }
    .de-preview-btn:hover { background:#4b5563; color:#fff; border-color:#6b7280; }
    .de-preview-btn--active { background:#1d4ed8; border-color:#3b82f6; color:#fff; }

    /* ── Preview Overlay ── */
    .de-preview-ov {
      position:absolute; inset:0; background:rgba(0,0,0,.72); z-index:8888;
      display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);
    }
    .de-preview-ov-inner {
      background:#1e293b; border-radius:16px; display:flex; flex-direction:column;
      width:90%; max-width:900px; height:90%; overflow:hidden;
      box-shadow:0 32px 80px rgba(0,0,0,.7); border:1px solid #334155;
    }
    .de-preview-ov-head {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 16px; background:#0f172a; border-bottom:1px solid #2d3548;
      font-size:.82rem; font-weight:700; color:#e2e8f0; flex-shrink:0;
    }
    .de-preview-zoom-btn {
      background:#1e293b; border:1px solid #334155; color:#94a3b8;
      border-radius:6px; padding:3px 10px; font-size:.85rem; font-weight:700; cursor:pointer;
    }
    .de-preview-zoom-btn:hover { background:#334155; color:#fff; }
    .de-preview-zoom-lbl { font-size:.72rem; color:#94a3b8; min-width:36px; text-align:center; }
    .de-preview-close-btn {
      background:#dc2626; border:none; color:#fff; border-radius:6px;
      padding:4px 10px; font-size:.8rem; font-weight:700; cursor:pointer;
    }
    .de-preview-close-btn:hover { background:#b91c1c; }
    .de-preview-ov-body {
      flex:1; overflow:auto; display:flex; align-items:flex-start;
      justify-content:center; padding:24px; background:#374151;
    }
    .de-preview-ov-page {
      background:#fff; box-shadow:0 8px 40px rgba(0,0,0,.6);
      flex-shrink:0; transform-origin:top center;
    }

    /* ── AI Panel redesign ── */
    .de-ai-avatar   { font-size:1.3rem; line-height:1; }
    .de-ai-title    { font-size:.82rem; font-weight:700; color:#e2e8f0; line-height:1.2; }
    .de-ai-subtitle { font-size:.62rem; color:#4f46e5; font-weight:600; letter-spacing:.5px; }
    .de-ai-head-btn {
      background:transparent; border:1px solid #334155; color:#94a3b8;
      border-radius:6px; padding:4px 7px; cursor:pointer; display:flex; align-items:center;
      position:relative;
    }
    .de-ai-head-btn:hover { background:#334155; color:#fff; }
    .de-ai-head-btn--close { border-color:#ef4444; color:#ef4444; }
    .de-ai-head-btn--close:hover { background:#ef4444; color:#fff; }
    .de-ai-head-btn--active { border-color:#4f46e5; color:#a5b4fc; }
    .de-ai-kb-dot {
      position:absolute; top:-3px; right:-3px; width:7px; height:7px;
      background:#22c55e; border-radius:50%; border:1px solid #0f172a;
    }

    /* Welcome */
    .de-ai-welcome { padding:8px; display:flex; flex-direction:column; gap:8px; }
    .de-ai-welcome-bubble { display:flex; gap:8px; background:#1e293b; border-radius:12px; padding:10px 12px; border:1px solid #334155; }
    .de-ai-welcome-ico { font-size:1.4rem; flex-shrink:0; }
    .de-ai-welcome-body { font-size:.71rem; color:#cbd5e1; line-height:1.55; }
    .de-ai-welcome-body strong { color:#e2e8f0; display:block; margin-bottom:4px; font-size:.75rem; }
    .de-ai-welcome-body p { margin:4px 0 0; }
    .de-ai-welcome-hint { color:#6366f1 !important; font-weight:600; }

    /* Tools row */
    .de-ai-tools-row {
      display:flex; gap:4px; padding:5px 10px; border-top:1px solid #1e293b; flex-shrink:0;
    }
    .de-ai-tool-btn {
      display:flex; align-items:center; gap:4px; padding:4px 9px;
      background:#1e293b; border:1px solid #334155; color:#94a3b8;
      border-radius:6px; font-size:.68rem; font-weight:600; cursor:pointer; transition:.12s;
    }
    .de-ai-tool-btn:hover, .de-ai-tool-btn.active { background:#4f46e5; border-color:#6366f1; color:#fff; }

    /* Translation bar */
    .de-ai-trans-bar {
      display:flex; align-items:center; gap:5px; padding:6px 10px;
      background:#0f172a; border-bottom:1px solid #1e293b; flex-shrink:0; flex-wrap:wrap;
    }
    .de-ai-trans-sel {
      background:#1e293b; border:1px solid #334155; color:#e2e8f0;
      border-radius:5px; padding:3px 5px; font-size:.68rem;
    }
    .de-ai-trans-go {
      padding:3px 9px; background:#4f46e5; border:none; border-radius:5px;
      color:#fff; font-size:.68rem; font-weight:700; cursor:pointer;
    }
    .de-ai-trans-go:hover { background:#4338ca; }

    /* Auto toggle */
    .de-ai-auto-lbl {
      display:flex; align-items:center; gap:4px; font-size:.65rem;
      color:#64748b; cursor:pointer; white-space:nowrap; flex-shrink:0;
    }

    /* Section list button */
    .de-ai-sec-btn--list {
      background:#1e3a5f; border-color:#1d4ed8; color:#60a5fa; padding:3px 7px;
    }
    .de-ai-sec-btn--list:hover { background:#1d4ed8; color:#fff; }

    /* TTS speak button */
    .de-ai-act-btn--speak { background:#1e293b; border:1px solid #334155; color:#94a3b8; padding:5px 7px; }
    .de-ai-act-btn--speak:hover { background:#334155; color:#e2e8f0; }
    .de-ai-act-btn--speaking { background:#dc2626 !important; color:#fff !important; border-color:#ef4444 !important; }

    /* Section bar */
    .de-ai-sec-bar { display:flex; align-items:center; gap:6px; padding:6px 12px; background:#0f172a; border-bottom:1px solid #1e293b; flex-wrap:wrap; flex-shrink:0; }
    .de-ai-sec-lbl { font-size:.68rem; color:#64748b; white-space:nowrap; }
    .de-ai-sec-btns { display:flex; gap:4px; flex-wrap:wrap; }
    .de-ai-sec-btn {
      padding:3px 9px; border-radius:20px; font-size:.68rem; font-weight:600;
      background:#1e293b; border:1px solid #334155; color:#94a3b8; cursor:pointer; transition:.12s;
    }
    .de-ai-sec-btn:hover { background:#334155; color:#e2e8f0; }
    .de-ai-sec-btn.active { background:#4f46e5; border-color:#6366f1; color:#fff; }

    /* Quick prompts grid */
    .de-ai-quick-grid {
      display:grid; grid-template-columns:1fr 1fr; gap:5px; padding:10px 12px; flex-shrink:0;
    }
    .de-ai-qp {
      display:flex; align-items:center; gap:6px; padding:7px 9px;
      background:#1e293b; border:1px solid #334155; border-radius:8px;
      color:#cbd5e1; font-size:.7rem; cursor:pointer; text-align:left; transition:.12s;
    }
    .de-ai-qp:hover { background:#334155; color:#fff; border-color:#4f46e5; }
    .de-ai-qp-ico { font-size:.9rem; flex-shrink:0; }

    /* Action row (apply/insert/copy side by side) */
    .de-ai-action-row { display:flex; gap:5px; margin-top:7px; flex-wrap:wrap; }
    .de-ai-act-btn {
      display:flex; align-items:center; gap:4px; padding:5px 10px;
      border-radius:6px; font-size:.69rem; font-weight:600; cursor:pointer; transition:.12s;
      border:none; white-space:nowrap;
    }
    .de-ai-act-btn--apply  { background:#4f46e5; color:#fff; }
    .de-ai-act-btn--apply:hover { background:#4338ca; }
    .de-ai-act-btn--insert { background:#0f766e; color:#fff; }
    .de-ai-act-btn--insert:hover { background:#0d6b63; }
    .de-ai-act-btn--copy   { background:#334155; color:#94a3b8; padding:5px 8px; }
    .de-ai-act-btn--copy:hover { background:#475569; color:#fff; }

    /* Voice mic */
    .de-ai-mic {
      background:#1e293b; border:1px solid #334155; color:#94a3b8;
      border-radius:8px; padding:6px 8px; cursor:pointer; display:flex; align-items:center; flex-shrink:0;
    }
    .de-ai-mic:hover { background:#334155; color:#e2e8f0; }
    .de-ai-mic--rec { background:#dc2626; border-color:#ef4444; color:#fff; animation:ai-pulse .9s ease-in-out infinite; }
    @keyframes ai-pulse { 0%,100%{opacity:1} 50%{opacity:.55} }

    /* ── AI Button ── */
    .de-ai-btn {
      padding:5px 12px; background:linear-gradient(135deg,#6366f1,#0ea5e9);
      border:none; border-radius:7px; color:#fff; font-size:.75rem; font-weight:700;
      cursor:pointer; white-space:nowrap; transition:.15s; flex-shrink:0;
    }
    .de-ai-btn:hover { opacity:.87; transform:translateY(-1px); }

    /* ── AI Panel ── */
    .de-ai-panel {
      position:absolute; top:0; right:0; height:100%;
      width:300px; background:#0f172a; border-left:1px solid #1e293b;
      display:flex; flex-direction:column; z-index:900; overflow:hidden;
    }
    .de-ai-panel-head {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 12px; background:#1e293b; border-bottom:1px solid #334155;
      font-size:.8rem; font-weight:700; color:#e2e8f0; flex-shrink:0;
    }
    .de-ai-close {
      background:none; border:none; color:#94a3b8; cursor:pointer; font-size:.9rem; padding:2px 6px;
    }
    .de-ai-close:hover { color:#fff; }
    .de-ai-sel-preview {
      padding:8px 10px; background:rgba(99,102,241,.1); border-bottom:1px solid #1e293b; flex-shrink:0;
    }
    .de-ai-sel-lbl { font-size:.62rem; color:#6366f1; font-weight:700; display:block; margin-bottom:3px; }
    .de-ai-sel-text { font-size:.7rem; color:#94a3b8; line-height:1.4; word-break:break-word; }
    .de-ai-quick-row {
      display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:8px; flex-shrink:0;
    }
    .de-ai-qbtn {
      padding:5px 6px; background:#1e293b; border:1px solid #334155; border-radius:6px;
      color:#94a3b8; font-size:.65rem; font-weight:600; cursor:pointer; transition:.12s; text-align:left;
    }
    .de-ai-qbtn:hover { border-color:#6366f1; color:#a5b4fc; background:rgba(99,102,241,.1); }
    .de-ai-msgs {
      flex:1; overflow-y:auto; padding:6px 8px; display:flex; flex-direction:column; gap:6px;
      scrollbar-width:thin; scrollbar-color:#334155 transparent;
    }
    .de-ai-msg { display:flex; }
    .de-ai-msg--user { justify-content:flex-end; }
    .de-ai-bubble {
      max-width:90%; padding:7px 9px; background:#1e293b; border-radius:10px;
      border:1px solid #334155;
    }
    .de-ai-bubble--user { background:rgba(99,102,241,.2); border-color:#4f46e5; }
    .de-ai-text { font-size:.7rem; color:#cbd5e1; line-height:1.5; word-break:break-word; }
    .de-ai-insert-btn {
      display:block; margin-top:6px; padding:5px 8px;
      background:linear-gradient(135deg,#6366f1,#0ea5e9);
      border:none; border-radius:6px; color:#fff; font-size:.65rem; font-weight:700;
      cursor:pointer; width:100%; text-align:left; transition:.12s;
    }
    .de-ai-insert-btn:hover { opacity:.85; }
    .de-ai-dots {
      display:inline-block; font-size:.9rem; color:#6366f1; letter-spacing:3px;
      animation:de-ai-blink .9s steps(3,end) infinite;
    }
    @keyframes de-ai-blink { 0%,100%{opacity:1}33%{opacity:.3}66%{opacity:.6} }
    .de-ai-input-row {
      display:flex; gap:4px; padding:8px; border-top:1px solid #1e293b; flex-shrink:0;
    }
    .de-ai-input {
      flex:1; background:#1e293b; border:1px solid #334155; border-radius:7px;
      color:#e2e8f0; font-size:.72rem; padding:6px 9px; outline:none;
    }
    .de-ai-input:focus { border-color:#6366f1; }
    .de-ai-input::placeholder { color:#475569; }
    .de-ai-send {
      padding:6px 10px; background:#6366f1; border:none; border-radius:7px;
      color:#fff; font-size:.85rem; cursor:pointer; transition:.12s; flex-shrink:0;
    }
    .de-ai-send:hover { background:#4f46e5; }
    .de-ai-send:disabled { opacity:.4; cursor:not-allowed; }
  `]
})
export class DesignEditorComponent implements AfterViewInit, OnDestroy {
  @Input() baseHtml = '';
  @Input() width  = 794;
  @Input() height = 1123;
  @Input() initialObjects: DesignObject[] = [];
  @Input() canvasBg = '#ffffff';
  @Input() canvasBgGradient = '';
  @Input() dynamicFields: string[] = [];
  @Output() savedEvent  = new EventEmitter<DesignEditorResult>();
  @Output() cancelEvent = new EventEmitter<void>();

  @ViewChild('htmlLayer')  htmlLayerRef?:  ElementRef;
  @ViewChild('svgLayer')   svgLayerRef?:   ElementRef;
  @ViewChild('canvas')     canvasRef?:     ElementRef;
  @ViewChild('canvasWrap') canvasWrapRef?: ElementRef;

  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  readonly Math = Math;
  readonly document = document;

  cats = SHAPE_CATS;
  objects: DesignObject[] = [];
  selId: string | null = null;

  // Mode unifié : édition + sélection simultanées (actif par défaut)
  editMode = true;

  // Text box editing
  editingTbId: string | null = null;

  // HTML section selection (HR lines, colored divs)
  selHtmlSection: HTMLElement | null = null;
  htmlSecPos = {x:0, y:0, w:0, h:0};

  // Format bar state
  fbFont = 'Arial';
  fbSize = 11;
  fbTextColor = '#000000';
  fbHighColor = '#ffff00';
  fbState = {bold:false,italic:false,underline:false,justLeft:true,justCenter:false,justRight:false,justFull:false};
  private fbSavedRange: Range | null = null;

  // Image selection
  selImgEl: HTMLImageElement | null = null;
  selImgPos = {x:0, y:0, w:0, h:0};
  imgShape: 'circle'|'square'|'rect'|'hex' = 'circle';

  // History (undo/redo)
  private history:     DesignObject[][] = [];
  private redoStack:   DesignObject[][] = [];
  get canUndo() { return this.history.length > 0; }
  get canRedo()  { return this.redoStack.length > 0; }

  // Interaction (fast path — NOT going through Angular zone during drag)
  private isDragging   = false;
  private isResizing   = false;
  private isImgResizing= false;
  private dragStart    = {x:0, y:0};
  private objStart     = {x:0, y:0, w:0, h:0};
  private resizeHandle = '';
  private imgResizeHandle = '';
  private imgResizeStart  = {w:0, h:0};

  galleryCollapsed    = false;
  canvasZoom          = 85;
  showPreviewOverlay  = false;
  previewOvZoom       = 75;

  get previewHtml(): string {
    return this.htmlLayerRef?.nativeElement?.innerHTML ?? '';
  }

  // Image drag state
  isImgDragging    = false;
  imgDragStartLeft = 0;
  imgDragStartTop  = 0;

  // ── AI Assistant ──
  showAiPanel      = false;
  aiInput          = '';
  aiLoading        = false;
  aiSelectedText   = '';
  aiRecording      = false;
  aiTargetSection  = 'profil';
  aiRecognition: any = null;
  aiMessages: {role:'user'|'assistant', content:string}[] = [];

  readonly aiSections = [
    { key:'profil',      label:'Profil'       },
    { key:'experience',  label:'Expérience'   },
    { key:'formation',   label:'Formation'    },
    { key:'competences', label:'Compétences'  },
    { key:'contact',     label:'Contact'      },
    { key:'interets',    label:'Intérêts'     },
  ];

  readonly aiQuickPromptsEd = [
    { icon:'✨', label:'Améliorer mon résumé',               prompt:'Améliore et enrichis la section profil/résumé de ce CV pour la rendre plus percutante et professionnelle.' },
    { icon:'📌', label:'Bullet points d\'expérience',        prompt:'Rédige des bullet points percutants avec des verbes d\'action pour les expériences professionnelles de ce CV.' },
    { icon:'💼', label:'Générer un profil professionnel',    prompt:'Génère un profil professionnel accrocheur de 4 à 6 lignes basé sur le contenu de ce CV.' },
    { icon:'🎯', label:'Optimiser pour ATS',                 prompt:'Optimise ce CV pour passer les filtres ATS : mots-clés sectoriels, structure, lisibilité.' },
    { icon:'🌐', label:'Reformuler en anglais',              prompt:'Reformule et traduis le contenu de ce CV en anglais professionnel.' },
    { icon:'✂️', label:'Raccourcir le texte',                prompt:'Raccourcis le texte de ce CV en le rendant plus percutant, sans perdre l\'essentiel.' },
    { icon:'⚡', label:'Rendre plus percutant',              prompt:'Rends ce CV plus dynamique et percutant : verbes d\'action, chiffres clés, formulations impactantes.' },
    { icon:'💡', label:'Obtenir des conseils CV',            prompt:'Analyse ce CV et donne-moi 5 conseils concrets et prioritaires pour l\'améliorer.' },
  ];

  aiKb          = '';
  aiAutoInsert  = false;
  showTranslation = false;
  translateFrom   = 'fr';
  translateTo     = 'en';
  ttsSpeaking     = '';

  // Context menu format state
  ctxFmtColor    = '#111111';
  ctxHighColor   = '#ffff00';
  ctxFmtSize     = 14;
  ctxFmtExpanded = false;

  // ── AI methods ──

  private aiProviders(): any[]  { try { return JSON.parse(localStorage.getItem('cvb_ai_providers') ?? '[]'); } catch { return []; } }
  private aiConfig(): any       { try { return JSON.parse(localStorage.getItem('cvb_ai_config')    ?? '{}'); } catch { return {}; } }

  private aiProvider(fn = 'chatbot'): any {
    const providers = this.aiProviders();
    if (!providers.length) return null;
    const cfg = this.aiConfig();
    return providers.find((p: any) => p.id === cfg[fn]) ?? providers[0];
  }

  openAiPanel() {
    this.fbSaveRange();
    this.aiSelectedText = window.getSelection()?.toString().trim() ?? '';
    this.showAiPanel = true;
  }

  closeAiPanel() { this.showAiPanel = false; }

  private extractCvSections(): string {
    const html = this.htmlLayerRef?.nativeElement as HTMLElement;
    if (!html) return '';
    const text = html.innerText ?? '';
    return text.slice(0, 2500);
  }

  private buildAiSystemPrompt(): string {
    const cvContent = this.extractCvSections();
    const sectionLabel = this.aiSections.find(s => s.key === this.aiTargetSection)?.label ?? this.aiTargetSection;
    let sys = `Tu es un expert en rédaction de CV professionnels. Tu as une vraie présence, tu t'exprimes de façon engagée et personnalisée. Réponds toujours en français (sauf si traduction demandée). Produis du texte direct, sans markdown excessif, adapté à un CV. La section cible actuelle est "${sectionLabel}". Après avoir rédigé du contenu pour une section, indique clairement où l'insérer.`;
    if (this.aiKb) {
      sys += `\n\nDocument de référence fourni par l'utilisateur :\n"""\n${this.aiKb}\n"""`;
    }
    if (cvContent) {
      sys += `\n\nContenu actuel du CV en cours d'édition :\n"""\n${cvContent}\n"""\nUtilise ce contenu pour comprendre le profil et améliorer ou rédiger les sections demandées.`;
    }
    if (this.aiSelectedText) {
      sys += `\n\nTexte sélectionné par l'utilisateur : "${this.aiSelectedText}"`;
    }
    return sys;
  }

  async sendAiMessage(prompt?: string) {
    const msg = (prompt ?? this.aiInput).trim();
    if (!msg || this.aiLoading) return;
    this.aiInput = '';
    if (this.aiRecording) this.stopAiVoice();
    this.aiMessages.push({ role: 'user', content: msg });
    this.aiLoading = true;
    this.cdr.detectChanges();
    try {
      const prov = this.aiProvider('chatbot');
      if (!prov) throw new Error('Aucun modèle IA configuré. Ajoutez-en un dans le CV Builder → Paramètres IA.');
      const url = prov.url.replace(/\/$/, '') + '/chat/completions';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${prov.key}` },
        body: JSON.stringify({
          model: prov.model,
          messages: [
            { role: 'system', content: this.buildAiSystemPrompt() },
            ...this.aiMessages.slice(-8).map(m => ({ role: m.role, content: m.content }))
          ],
          stream: false
        })
      });
      if (!res.ok) throw new Error(`Erreur API (${res.status})`);
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? '';
      this.aiMessages.push({ role: 'assistant', content: reply });
      if (this.aiAutoInsert && reply && !reply.startsWith('❌')) {
        setTimeout(() => this.applyAiToSection(reply), 300);
      }
    } catch (e: any) {
      this.aiMessages.push({ role: 'assistant', content: `❌ ${e.message}` });
    } finally {
      this.aiLoading = false;
      this.cdr.detectChanges();
    }
  }

  applyAiToSection(content: string) {
    const html = this.htmlLayerRef?.nativeElement as HTMLElement;
    if (!html) { this.insertAiContent(content); return; }
    const clean = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    const sectionKey = this.aiTargetSection;
    const keywords: Record<string, string[]> = {
      profil:      ['profil','à propos','about','présentation','résumé','objectif'],
      experience:  ['expérience','experience','emploi','poste','carrière'],
      formation:   ['formation','éducation','diplôme','université','école'],
      competences: ['compétence','compétences','skill','aptitude','savoir'],
      contact:     ['contact','email','téléphone','adresse','linkedin'],
      interets:    ['intérêt','loisir','hobby','activité','passion'],
    };
    const kws = keywords[sectionKey] ?? [];
    const all = Array.from(html.querySelectorAll('[data-section],[data-id],[class]')) as HTMLElement[];
    let target: HTMLElement | null = null;
    for (const el of all) {
      const txt = (el.getAttribute('data-section') ?? el.className ?? el.innerText ?? '').toLowerCase();
      if (kws.some(k => txt.includes(k))) { target = el; break; }
    }
    if (target) {
      // Reset placeholder opacity/color so inserted text is fully visible
      target.style.opacity = '1';
      if (target.style.color && isColorFaded(target.style.color)) target.style.color = '';
      target.classList.remove('cv-placeholder', 'placeholder', 'ghost', 'muted', 'faded');
      target.innerHTML = clean;
    } else {
      this.insertAiContent(content);
    }
    this.zone.run(() => this.cdr.detectChanges());
  }

  copyAiText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  toggleAiVoice() {
    if (this.aiRecording) { this.stopAiVoice(); return; }
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Reconnaissance vocale non supportée dans ce navigateur.'); return; }
    this.aiRecognition = new SR();
    this.aiRecognition.lang = 'fr-FR';
    this.aiRecognition.continuous = true;
    this.aiRecognition.interimResults = false;
    this.aiRecognition.onresult = (e: any) => {
      const t = Array.from(e.results).slice(e.resultIndex).map((r: any) => r[0].transcript).join(' ');
      this.aiInput = (this.aiInput + ' ' + t).trim();
      this.cdr.detectChanges();
    };
    this.aiRecognition.onend = () => { this.aiRecording = false; this.cdr.detectChanges(); };
    this.aiRecognition.start();
    this.aiRecording = true;
    this.cdr.detectChanges();
  }

  stopAiVoice() {
    this.aiRecognition?.stop();
    this.aiRecording = false;
    this.cdr.detectChanges();
  }

  // TTS — text-to-speech
  toggleTts(text: string) {
    if (this.ttsSpeaking === text) {
      speechSynthesis.cancel();
      this.ttsSpeaking = '';
      this.cdr.detectChanges();
      return;
    }
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'fr-FR';
    utt.rate = 1.0;
    utt.onend = () => { this.ttsSpeaking = ''; this.zone.run(() => this.cdr.detectChanges()); };
    this.ttsSpeaking = text;
    speechSynthesis.speak(utt);
    this.cdr.detectChanges();
  }

  // KB file for AI panel (text files only, quick version)
  async onAiKbFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.aiKb = (ev.target?.result as string ?? '').slice(0, 3000);
      this.aiMessages.push({ role:'assistant', content:`📚 Document chargé : "${file.name}". Je vais m'en servir comme contexte.` });
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
  }

  // Load a CV template image and ask AI to reproduce it as HTML
  async loadModelImage(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      this.aiMessages.push({ role:'user', content:'📷 Charger ce modèle de CV et le reproduire en HTML/CSS.' });
      this.aiLoading = true;
      this.cdr.detectChanges();
      try {
        const prov = this.aiProvider('chatbot');
        if (!prov) throw new Error('Aucun modèle IA configuré.');
        const url = prov.url.replace(/\/$/, '') + '/chat/completions';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${prov.key}` },
          body: JSON.stringify({
            model: prov.model,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Analyse cette image de CV et génère le code HTML + CSS inline complet qui reproduit fidèlement ce design (couleurs, mise en page, typographie, sections). Retourne uniquement le code HTML complet, sans explication, sans balises ```html.' },
                { type: 'image_url', image_url: { url: dataUrl } }
              ]
            }],
            stream: false
          })
        });
        if (!res.ok) throw new Error(`Erreur API (${res.status})`);
        const data = await res.json();
        const html = data.choices?.[0]?.message?.content ?? '';
        this.aiMessages.push({ role:'assistant', content:html });
      } catch (err: any) {
        this.aiMessages.push({ role:'assistant', content:`❌ ${err.message}` });
      } finally {
        this.aiLoading = false;
        this.cdr.detectChanges();
      }
    };
    reader.readAsDataURL(file);
  }

  // List CV sections
  listCvSections() {
    const content = this.extractCvSections();
    const prompt = content
      ? `Analyse le CV suivant et liste toutes les sections identifiées avec leurs contenus (utilise des puces).\n\nCV:\n${content}`
      : 'Décris les sections typiques d\'un bon CV professionnel avec leurs contenus recommandés (utilise des puces et tirets).';
    this.sendAiMessage(prompt);
  }

  // Translate entire CV
  async translateCv() {
    const content = this.extractCvSections();
    if (!content) { alert('Le CV est vide — ajoutez du contenu d\'abord.'); return; }
    const langNames: Record<string, string> = { fr:'français', en:'anglais', ar:'arabe', es:'espagnol', de:'allemand' };
    const prompt = `Traduis l'intégralité du CV suivant du ${langNames[this.translateFrom]||this.translateFrom} vers le ${langNames[this.translateTo]||this.translateTo}. Conserve la mise en forme (sections, bullet points). Retourne uniquement le CV traduit.\n\nCV original:\n${content}`;
    this.sendAiMessage(prompt);
  }

  private resetFadedElement(el: HTMLElement) {
    el.style.opacity = '1';
    if (el.style.color && isColorFaded(el.style.color)) el.style.color = '';
    el.classList.remove('cv-placeholder','placeholder','ghost','muted','faded','watermark');
  }

  moveHtmlElUp(el: HTMLElement | null) {
    if (!el || !el.parentElement) return;
    const prev = el.previousElementSibling as HTMLElement;
    if (prev) el.parentElement.insertBefore(el, prev);
  }

  moveHtmlElDown(el: HTMLElement | null) {
    if (!el || !el.parentElement) return;
    const next = el.nextElementSibling as HTMLElement;
    if (next) el.parentElement.insertBefore(next, el);
  }

  duplicateHtmlEl(el: HTMLElement | null) {
    if (!el || !el.parentElement) return;
    const clone = el.cloneNode(true) as HTMLElement;
    el.parentElement.insertBefore(clone, el.nextSibling);
  }

  insertAiContent(content: string) {
    this.fbRestoreRange();
    requestAnimationFrame(() => {
      const clean = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      // Wrap in span to override any faded/placeholder color inherited from parent
      const wrapped = `<span style="opacity:1;color:inherit">${clean}</span>`;
      document.execCommand('insertHTML', false, wrapped);
      // Reset opacity on insertion target container
      const sel = window.getSelection();
      if (sel && sel.focusNode) {
        let el = sel.focusNode as HTMLElement;
        if (el.nodeType === Node.TEXT_NODE) el = el.parentElement as HTMLElement;
        while (el) {
          if (el === this.htmlLayerRef?.nativeElement) break;
          if (el.style?.opacity && el.style.opacity !== '1') el.style.opacity = '1';
          if (el.style?.color && isColorFaded(el.style.color)) el.style.color = '';
          el = el.parentElement as HTMLElement;
        }
      }
      this.zone.run(() => this.cdr.detectChanges());
    });
  }

  replaceSelection(content: string) {
    this.fbRestoreRange();
    requestAnimationFrame(() => {
      const clean = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
      if (this.aiSelectedText) {
        document.execCommand('insertHTML', false, clean);
      } else {
        document.execCommand('insertHTML', false, clean);
      }
      this.showAiPanel = false;
      this.zone.run(() => this.cdr.detectChanges());
    });
  }

  // ── Background editor
  bgColor  = '#ffffff';
  bgGradient = '';
  bgImgUrl = '';
  showBgPanel = false;
  readonly BG_GRADIENTS = [
    { label:'Aucun',    value:'' },
    { label:'Violet',   value:'linear-gradient(135deg,#0f172a,#1e1b4b)' },
    { label:'Marine',   value:'linear-gradient(135deg,#0c1445,#1e3a8a)' },
    { label:'Forêt',    value:'linear-gradient(135deg,#052e16,#064e3b)' },
    { label:'Coucher',  value:'linear-gradient(135deg,#7c2d12,#b45309)' },
    { label:'Rose',     value:'linear-gradient(135deg,#500724,#be185d)' },
    { label:'Violet clair', value:'linear-gradient(135deg,#f5f3ff,#ede9fe)' },
    { label:'Bleu clair',   value:'linear-gradient(135deg,#eff6ff,#dbeafe)' },
    { label:'Vert clair',   value:'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
    { label:'Corail',   value:'linear-gradient(135deg,#fff1f2,#fecdd3)' },
    { label:'Aurora',   value:'linear-gradient(135deg,#6366f1,#a855f7,#ec4899)' },
    { label:'Oceан',    value:'linear-gradient(135deg,#0284c7,#0d9488)' },
  ];

  get canvasStyle(): string {
    if (this.bgImgUrl) return `url("${this.bgImgUrl}") center/cover no-repeat`;
    if (this.bgGradient) return this.bgGradient;
    return this.bgColor;
  }

  // Context menu
  ctx: {visible:boolean,x:number,y:number,isHtml:boolean,htmlEl:HTMLElement|null} =
       {visible:false,x:0,y:0,isHtml:false,htmlEl:null};

  showFill   = false;
  showStroke = false;

  // Event listeners (for cleanup)
  private evts: Array<{el:EventTarget,type:string,fn:EventListener}> = [];

  readonly PALETTE = [
    '#000000','#1e293b','#334155','#475569','#64748b','#94a3b8','#cbd5e1','#f1f5f9','#ffffff',
    '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#14b8a6',
    '#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e',
    '#7c2d12','#92400e','#713f12','#365314','#064e3b','#164e63','#1e3a5f','#3b0764',
  ];

  // ── Getters ──────────────────────────────────────────────

  get selObj(): DesignObject | null {
    return this.objects.find(o => o.id === this.selId) ?? null;
  }

  get objectsSorted(): DesignObject[] {
    return [...this.objects].sort((a,b) => a.zIndex - b.zIndex);
  }

  get handles(): {id:string,cx:number,cy:number,cur:string}[] {
    const o = this.selObj; if (!o) return [];
    const {x,y,w,h} = o;
    return [
      {id:'nw',cx:x,    cy:y,    cur:'nwse-resize'},
      {id:'n', cx:x+w/2,cy:y,    cur:'ns-resize'},
      {id:'ne',cx:x+w,  cy:y,    cur:'nesw-resize'},
      {id:'e', cx:x+w,  cy:y+h/2,cur:'ew-resize'},
      {id:'se',cx:x+w,  cy:y+h,  cur:'nwse-resize'},
      {id:'s', cx:x+w/2,cy:y+h,  cur:'ns-resize'},
      {id:'sw',cx:x,    cy:y+h,  cur:'nesw-resize'},
      {id:'w', cx:x,    cy:y+h/2,cur:'ew-resize'},
    ];
  }

  get imgHandles(): {id:string,cx:number,cy:number,cur:string}[] {
    const p = this.selImgPos;
    const {x,y,w,h} = p;
    return [
      {id:'nw',cx:x,    cy:y,    cur:'nwse-resize'},
      {id:'n', cx:x+w/2,cy:y,    cur:'ns-resize'},
      {id:'ne',cx:x+w,  cy:y,    cur:'nesw-resize'},
      {id:'e', cx:x+w,  cy:y+h/2,cur:'ew-resize'},
      {id:'se',cx:x+w,  cy:y+h,  cur:'nwse-resize'},
      {id:'s', cx:x+w/2,cy:y+h,  cur:'ns-resize'},
      {id:'sw',cx:x,    cy:y+h,  cur:'nesw-resize'},
      {id:'w', cx:x,    cy:y+h/2,cur:'ew-resize'},
    ];
  }

  // ── Lifecycle ────────────────────────────────────────────

  ngAfterViewInit() {
    // Apply background
    this.bgColor     = this.canvasBg || '#ffffff';
    this.bgGradient  = this.canvasBgGradient || '';

    // Load initial objects (from design templates)
    if (this.initialObjects?.length) {
      this.objects = this.initialObjects.map(o => ({ ...o, id: o.id + '-' + Math.random().toString(36).slice(2,6) }));
      this.pushHistory();
    }

    // Set initial HTML content
    const hl = this.htmlLayerRef!.nativeElement as HTMLElement;
    hl.innerHTML = this.baseHtml;

    const svg = this.svgLayerRef!.nativeElement as SVGElement;

    // Run heavy mouse events OUTSIDE Angular zone for 60fps drag
    this.zone.runOutsideAngular(() => {
      const moveHandler = this.rawMove.bind(this);
      const upHandler   = this.rawUp.bind(this);
      const hlClick     = this.onHtmlClick.bind(this);
      const hlCtxMenu   = this.onHtmlCtxMenu.bind(this);

      svg.addEventListener('mousemove',  moveHandler, {passive:false});
      svg.addEventListener('mouseup',    upHandler);
      svg.addEventListener('mouseleave', upHandler);

      // Image handles also need mousemove on svg
      hl.addEventListener('click',       hlClick);
      hl.addEventListener('contextmenu', hlCtxMenu);

      this.evts = [
        {el:svg, type:'mousemove',  fn:moveHandler as EventListener},
        {el:svg, type:'mouseup',    fn:upHandler   as EventListener},
        {el:svg, type:'mouseleave', fn:upHandler   as EventListener},
        {el:hl,  type:'click',      fn:hlClick     as EventListener},
        {el:hl,  type:'contextmenu',fn:hlCtxMenu   as EventListener},
      ];
    });
  }

  ngOnDestroy() {
    this.evts.forEach(e => (e.el as EventTarget).removeEventListener(e.type, e.fn as EventListenerOrEventListenerObject));
  }

  // ── Raw mouse handlers (outside zone) ───────────────────

  private rawMove(e: MouseEvent) {
    if (!this.isDragging && !this.isResizing && !this.isImgResizing && !this.isImgDragging) return;
    e.preventDefault();

    const c  = this.svgCoordsRaw(e);
    const dx = c.x - this.dragStart.x;
    const dy = c.y - this.dragStart.y;

    if (this.isImgDragging && this.selImgEl) {
      const nl = Math.round(this.imgDragStartLeft + dx);
      const nt = Math.round(this.imgDragStartTop  + dy);
      this.selImgEl.style.left = nl + 'px';
      this.selImgEl.style.top  = nt + 'px';
      // Direct DOM update for zero-lag SVG handles
      const iw = this.selImgEl.offsetWidth;
      const ih = this.selImgEl.offsetHeight;
      const svg = this.svgLayerRef!.nativeElement as SVGElement;
      svg.querySelectorAll('rect[stroke="#f59e0b"]').forEach(r => {
        r.setAttribute('x', String(nl - 3));
        r.setAttribute('y', String(nt - 3));
        r.setAttribute('width',  String(iw + 6));
        r.setAttribute('height', String(ih + 6));
      });
      const hxs = [nl, nl+iw/2, nl+iw, nl+iw, nl+iw, nl+iw/2, nl, nl];
      const hys = [nt, nt, nt, nt+ih/2, nt+ih, nt+ih, nt+ih, nt+ih/2];
      svg.querySelectorAll('.img-handle').forEach((el, i) => {
        el.setAttribute('cx', String(hxs[i]));
        el.setAttribute('cy', String(hys[i]));
      });
      this.selImgPos = {x:nl, y:nt, w:iw, h:ih};
      return;
    }

    if (this.isImgResizing) {
      this.applyImgResize(dx, dy);
      return;
    }

    const o = this.objects.find(x => x.id === this.selId); if (!o) return;

    if (this.isDragging) {
      o.x = Math.round(this.objStart.x + dx);
      o.y = Math.round(this.objStart.y + dy);
    } else if (this.isResizing) {
      this.applyResize(o, dx, dy);
    }

    // Direct DOM update — zero Angular overhead
    const svg = this.svgLayerRef!.nativeElement as SVGElement;
    const pathEl = svg.querySelector(`[data-oid="${o.id}"]`);
    if (pathEl) pathEl.setAttribute('d', shapePath(o.type, o.x, o.y, o.w, o.h));
    this.updateSelectionDOM(svg, o);
  }

  private rawUp(_e: MouseEvent) {
    const changed = this.isDragging || this.isResizing || this.isImgResizing || this.isImgDragging;
    this.isDragging = this.isResizing = this.isImgResizing = this.isImgDragging = false;
    if (changed) {
      this.zone.run(() => {
        if (this.selImgEl) this.syncImgPos();
        this.cdr.detectChanges();
      });
    }
  }

  private applyResize(o: DesignObject, dx: number, dy: number) {
    const {x:ox,y:oy,w:ow,h:oh} = this.objStart, MIN=10;
    switch (this.resizeHandle) {
      case 'se': o.w=Math.max(MIN,ow+dx); o.h=Math.max(MIN,oh+dy); break;
      case 'sw': o.x=Math.min(ox+ow-MIN,ox+dx); o.w=Math.max(MIN,ow-dx); o.h=Math.max(MIN,oh+dy); break;
      case 'ne': o.y=Math.min(oy+oh-MIN,oy+dy); o.w=Math.max(MIN,ow+dx); o.h=Math.max(MIN,oh-dy); break;
      case 'nw': o.x=Math.min(ox+ow-MIN,ox+dx); o.y=Math.min(oy+oh-MIN,oy+dy); o.w=Math.max(MIN,ow-dx); o.h=Math.max(MIN,oh-dy); break;
      case 'e':  o.w=Math.max(MIN,ow+dx); break;
      case 'w':  o.x=Math.min(ox+ow-MIN,ox+dx); o.w=Math.max(MIN,ow-dx); break;
      case 'n':  o.y=Math.min(oy+oh-MIN,oy+dy); o.h=Math.max(MIN,oh-dy); break;
      case 's':  o.h=Math.max(MIN,oh+dy); break;
    }
  }

  private applyImgResize(dx: number, dy: number) {
    if (!this.selImgEl) return;
    const {w:ow,h:oh} = this.imgResizeStart, MIN=20;
    let nw=ow, nh=oh;
    switch (this.imgResizeHandle) {
      case 'se': nw=Math.max(MIN,ow+dx); nh=Math.max(MIN,oh+dy); break;
      case 'sw': nw=Math.max(MIN,ow-dx); nh=Math.max(MIN,oh+dy); break;
      case 'ne': nw=Math.max(MIN,ow+dx); nh=Math.max(MIN,oh-dy); break;
      case 'nw': nw=Math.max(MIN,ow-dx); nh=Math.max(MIN,oh-dy); break;
      case 'e':  nw=Math.max(MIN,ow+dx); break;
      case 'w':  nw=Math.max(MIN,ow-dx); break;
      case 's':  nh=Math.max(MIN,oh+dy); break;
      case 'n':  nh=Math.max(MIN,oh-dy); break;
    }
    this.selImgEl.style.width  = nw + 'px';
    this.selImgEl.style.height = nh + 'px';
    this.selImgEl.style.minWidth  = nw + 'px';
    this.selImgEl.style.minHeight = nh + 'px';
    // Update SVG handles position directly
    this.syncImgPos();
    const svg = this.svgLayerRef!.nativeElement as SVGElement;
    const p = this.selImgPos;
    svg.querySelectorAll('.img-handle').forEach((el, i) => {
      const hx = [p.x, p.x+p.w/2, p.x+p.w, p.x+p.w, p.x+p.w, p.x+p.w/2, p.x, p.x][i];
      const hy = [p.y, p.y, p.y, p.y+p.h/2, p.y+p.h, p.y+p.h, p.y+p.h, p.y+p.h/2][i];
      (el as SVGElement).setAttribute('cx', String(hx));
      (el as SVGElement).setAttribute('cy', String(hy));
    });
    // Update selection rect
    const imgRect = svg.querySelector('rect[stroke="#f59e0b"]') as SVGElement;
    if (imgRect) {
      imgRect.setAttribute('x', String(p.x-3));
      imgRect.setAttribute('y', String(p.y-3));
      imgRect.setAttribute('width',  String(p.w+6));
      imgRect.setAttribute('height', String(p.h+6));
    }
  }

  private syncImgPos() {
    if (!this.selImgEl) return;
    const canvas = this.canvasRef!.nativeElement as HTMLElement;
    const cr = canvas.getBoundingClientRect();
    const ir = this.selImgEl.getBoundingClientRect();
    const sx = this.width  / cr.width;
    const sy = this.height / cr.height;
    this.selImgPos = {
      x: (ir.left - cr.left) * sx,
      y: (ir.top  - cr.top)  * sy,
      w: ir.width  * sx,
      h: ir.height * sy,
    };
  }

  private updateSelectionDOM(svg: SVGElement, o: DesignObject) {
    const sr = svg.querySelector('.sel-rect') as SVGElement;
    if (sr) { sr.setAttribute('x',String(o.x-3)); sr.setAttribute('y',String(o.y-3)); sr.setAttribute('width',String(o.w+6)); sr.setAttribute('height',String(o.h+6)); }
    const H = [{cx:0,cy:0},{cx:.5,cy:0},{cx:1,cy:0},{cx:1,cy:.5},{cx:1,cy:1},{cx:.5,cy:1},{cx:0,cy:1},{cx:0,cy:.5}];
    svg.querySelectorAll('.sel-handle').forEach((el,i) => {
      if (H[i]) { (el as SVGElement).setAttribute('cx',String(o.x+H[i].cx*o.w)); (el as SVGElement).setAttribute('cy',String(o.y+H[i].cy*o.h)); }
    });
    const rh = svg.querySelector('.rot-handle') as SVGElement;
    if (rh) { rh.setAttribute('cx',String(o.x+o.w/2)); rh.setAttribute('cy',String(o.y-22)); }
    const rl = svg.querySelector('.rot-line') as SVGElement;
    if (rl) { rl.setAttribute('x1',String(o.x+o.w/2)); rl.setAttribute('x2',String(o.x+o.w/2)); rl.setAttribute('y1',String(o.y-16)); rl.setAttribute('y2',String(o.y-3)); }
  }

  // ── HTML layer event handlers ─────────────────────────────

  private onHtmlClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // ── Image sélectionnée ──
    if (target.tagName === 'IMG') {
      this.zone.run(() => {
        this.selId = null;
        this.selHtmlSection = null;
        this.selImgEl = target as HTMLImageElement;
        this.imgShape = this.readImgShape(this.selImgEl);
        this.syncImgPos();
        this.cdr.detectChanges();
      });
      return;
    }

    // ── HR sélectionnable ──
    if (target.tagName === 'HR') {
      this.zone.run(() => {
        this.selImgEl = null;
        this.selHtmlSection = target;
        this.syncHtmlSecPos();
        this.cdr.detectChanges();
      });
      return;
    }

    // ── Section colorée (div/section avec background) ──
    const section = this.findColoredSection(target);
    if (section) {
      this.zone.run(() => {
        this.selImgEl = null;
        this.selHtmlSection = section;
        this.syncHtmlSecPos();
        this.cdr.detectChanges();
      });
      return;
    }

    // Désélectionner si clic ailleurs
    if (this.selImgEl || this.selHtmlSection) {
      this.zone.run(() => {
        this.selImgEl = null;
        this.selHtmlSection = null;
        this.cdr.detectChanges();
      });
    }

    // Mettre à jour l'état de la barre de mise en forme
    setTimeout(() => this.zone.run(() => { this.fbUpdateState(); this.cdr.detectChanges(); }), 10);
  }

  private onHtmlCtxMenu(e: MouseEvent) {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (target === this.htmlLayerRef!.nativeElement) return;
    // Save text selection so context-menu format actions can restore it
    this.fbSaveRange();
    const rootRect = (this.svgLayerRef!.nativeElement as SVGElement).closest('.de-root')!.getBoundingClientRect();
    this.zone.run(() => {
      this.ctx = {visible:true, x:e.clientX-rootRect.left, y:e.clientY-rootRect.top, isHtml:true, htmlEl:target};
      this.cdr.detectChanges();
    });
  }

  private readImgShape(img: HTMLImageElement): 'circle'|'square'|'rect'|'hex' {
    const br = img.style.borderRadius || '';
    if (br.includes('50%') || br.includes('polygon')) return 'circle';
    if (br.includes('polygon')) return 'hex';
    return 'rect';
  }

  // ── SVG mouse handlers (Angular zone) ────────────────────

  onSvgDown(e: MouseEvent) {
    if (e.target === this.svgLayerRef?.nativeElement) {
      this.selId = null;
      this.ctx.visible = false;
      this.showFill = false; this.showStroke = false;
    }
  }

  onObjDown(e: MouseEvent, id: string) {
    e.stopPropagation();
    this.selId = id; this.selImgEl = null;
    this.isDragging = true;
    this.dragStart = this.svgCoordsRaw(e);
    const o = this.selObj!;
    this.objStart = {x:o.x, y:o.y, w:o.w, h:o.h};
    this.showFill = false; this.showStroke = false; this.ctx.visible = false;
  }

  onHandleDown(e: MouseEvent, handleId: string) {
    e.stopPropagation();
    this.isResizing = true;
    this.resizeHandle = handleId;
    this.dragStart = this.svgCoordsRaw(e);
    const o = this.selObj!;
    this.objStart = {x:o.x, y:o.y, w:o.w, h:o.h};
  }

  onImgHandleDown(e: MouseEvent, handleId: string) {
    e.stopPropagation();
    if (!this.selImgEl) return;
    this.isImgResizing = true;
    this.imgResizeHandle = handleId;
    this.dragStart = this.svgCoordsRaw(e);
    this.imgResizeStart = {w: this.selImgEl.offsetWidth, h: this.selImgEl.offsetHeight};
  }

  onCtxMenu(e: MouseEvent) {
    e.preventDefault();
    if (!this.selId) return;
    const rootRect = (e.currentTarget as Element).closest('.de-root')!.getBoundingClientRect();
    this.ctx = {visible:true, x:e.clientX-rootRect.left, y:e.clientY-rootRect.top, isHtml:false, htmlEl:null};
  }

  onRootClick(_e: MouseEvent) {
    this.ctx.visible = false;
    this.showFill    = false;
    this.showStroke  = false;
    // Quitter l'édition de la zone de texte si clic en dehors
    if (this.editingTbId) this.stopEditTb();
  }

  // ── Edit mode toggle ─────────────────────────────────────

  onEditModeChange() {
    this.selId = null;
    this.selImgEl = null;
    this.selHtmlSection = null;
    if (this.editingTbId) this.stopEditTb();
    this.cdr.detectChanges();
  }

  // ── Shape operations ─────────────────────────────────────

  getPath(o: DesignObject): string { return shapePath(o.type, o.x, o.y, o.w, o.h); }

  insertShape(s: {id:string,defaultW:number,defaultH:number,isLine?:boolean}) {
    this.pushHistory();
    const maxZ = this.objects.reduce((m,o)=>Math.max(m,o.zIndex),0);
    const obj: DesignObject = {
      id: uid(), type: s.id,
      x: Math.round((this.width - s.defaultW) / 2),
      y: Math.round((this.height - s.defaultH) / 2),
      w: s.defaultW, h: s.defaultH,
      fill:   s.isLine ? 'none' : '#6366f1',
      stroke: '#4f46e5', sw: s.isLine ? 2.5 : 0,
      opacity: 100,
      text:'', fontSize:14, fontColor:'#ffffff', textAlign:'center',
      zIndex: maxZ+1, isLine: !!s.isLine,
    };
    this.objects.push(obj);
    this.selId = obj.id;
  }

  // ── Text box operations ──────────────────────────────────

  insertTextBox(w = 200, h = 80) {
    this.pushHistory();
    const maxZ = this.objects.reduce((m,o) => Math.max(m, o.zIndex), 0);
    const obj: DesignObject = {
      id: uid(), type: 'textbox',
      x: Math.round((this.width - w) / 2),
      y: Math.round((this.height - h) / 2),
      w, h,
      fill: 'none', stroke: '#94a3b8', sw: 1,
      opacity: 100,
      text: '', fontSize: 14, fontColor: '#1e293b', textAlign: 'left',
      zIndex: maxZ + 1, isLine: false,
      isTextBox: true,
      content: '<p style="margin:0">Zone de texte</p>',
      fontFamily: 'Inter, sans-serif',
      bold: false, italic: false, underline: false, strikethrough: false,
      lineHeight: 1.4, bgColor: undefined, borderRadius: 4, paddingPx: 10,
    };
    this.objects.push(obj);
    this.selId = obj.id;
    // Passer en édition immédiatement
    setTimeout(() => this.startEditTb(obj), 80);
  }

  startEditTb(o: DesignObject) {
    this.selId = o.id;
    this.editingTbId = o.id;
    this.cdr.detectChanges();
    setTimeout(() => {
      const el = document.getElementById('tb-' + o.id) as HTMLElement | null;
      if (!el) return;
      el.focus();
      // Sélectionner tout le contenu
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, 30);
  }

  stopEditTb() {
    if (this.editingTbId) {
      const el = document.getElementById('tb-' + this.editingTbId);
      if (el) {
        const obj = this.objects.find(o => o.id === this.editingTbId);
        if (obj) obj.content = el.innerHTML;
      }
    }
    this.editingTbId = null;
    this.cdr.detectChanges();
  }

  saveTbContent(o: DesignObject) {
    const el = document.getElementById('tb-' + o.id);
    if (el) o.content = el.innerHTML;
  }

  onTbKeydown(ev: KeyboardEvent, o: DesignObject) {
    if (ev.key === 'Escape') { ev.preventDefault(); this.saveTbContent(o); this.stopEditTb(); }
    // Ctrl+B/I/U
    if (ev.ctrlKey || ev.metaKey) {
      if (ev.key === 'b') { ev.preventDefault(); document.execCommand('bold'); }
      if (ev.key === 'i') { ev.preventDefault(); document.execCommand('italic'); }
      if (ev.key === 'u') { ev.preventDefault(); document.execCommand('underline'); }
    }
  }

  applyTbFormat() {
    const o = this.selObj;
    if (!o?.isTextBox) return;
    this.cdr.detectChanges();
  }

  tbDecoration(o: DesignObject): string {
    const p = [];
    if (o.underline)     p.push('underline');
    if (o.strikethrough) p.push('line-through');
    return p.join(' ') || 'none';
  }

  // ── Format bar (Ctrl+execCommand) ────────────────────────

  fbSaveRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      this.fbSavedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  private fbRestoreRange() {
    if (!this.fbSavedRange) return;
    // S'assurer que le focus est sur la couche HTML avant de restaurer
    const hl = this.htmlLayerRef?.nativeElement as HTMLElement | undefined;
    if (hl) hl.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(this.fbSavedRange);
  }

  fbExec(cmd: string, value?: string) {
    // Restaurer la sélection + exécuter la commande dans la même frame
    this.fbRestoreRange();
    requestAnimationFrame(() => {
      document.execCommand(cmd, false, value ?? undefined);
      this.zone.run(() => { this.fbUpdateState(); this.cdr.detectChanges(); });
    });
  }

  fbApplySize() {
    this.fbRestoreRange();
    // Utiliser un span avec style font-size (execCommand fontSize est limité à 7 niveaux)
    document.execCommand('fontSize', false, '7');
    const hl = this.htmlLayerRef?.nativeElement as HTMLElement;
    hl?.querySelectorAll('font[size="7"]').forEach((el: Element) => {
      (el as HTMLElement).removeAttribute('size');
      (el as HTMLElement).style.fontSize = this.fbSize + 'pt';
    });
    this.fbUpdateState();
  }

  fbIncSize() { this.fbSize = Math.min(96, (this.fbSize||11) + 1); this.fbApplySize(); }
  fbDecSize() { this.fbSize = Math.max(6,  (this.fbSize||11) - 1); this.fbApplySize(); }

  fbUpdateState() {
    try {
      this.fbState = {
        bold:       document.queryCommandState('bold'),
        italic:     document.queryCommandState('italic'),
        underline:  document.queryCommandState('underline'),
        justLeft:   document.queryCommandState('justifyLeft'),
        justCenter: document.queryCommandState('justifyCenter'),
        justRight:  document.queryCommandState('justifyRight'),
        justFull:   document.queryCommandState('justifyFull'),
      };
    } catch {}
  }

  // Direct synchronous color application — no RAF delay (fixes color picker bug)
  applyForeColorSync(color: string) {
    this.fbTextColor = color;
    this.fbRestoreRange();
    document.execCommand('foreColor', false, color);
    this.fbUpdateState();
    this.cdr.detectChanges();
  }

  applyBgColorSync(color: string) {
    this.fbHighColor = color;
    this.fbRestoreRange();
    document.execCommand('backColor', false, color);
    this.fbUpdateState();
    this.cdr.detectChanges();
  }

  // Public wrapper so template can call fbRestoreRange (it's private)
  fbRestoreRangePub() { this.fbRestoreRange(); }

  setCtxLineHeight(val: number) {
    this.fbRestoreRange();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    let el = sel.focusNode as HTMLElement;
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement as HTMLElement;
    const BLOCKS = ['P','DIV','LI','H1','H2','H3','H4','H5','H6','TD','TH','BLOCKQUOTE','SECTION','ARTICLE'];
    const root = this.htmlLayerRef?.nativeElement as HTMLElement;
    while (el && el !== root && !BLOCKS.includes(el.tagName)) el = el.parentElement as HTMLElement;
    if (el && el !== root) el.style.lineHeight = String(val);
  }

  applyCtxFontSize() {
    this.fbRestoreRange();
    document.execCommand('fontSize', false, '7');
    const hl = this.htmlLayerRef?.nativeElement as HTMLElement;
    hl?.querySelectorAll('font[size="7"]').forEach((el: Element) => {
      (el as HTMLElement).removeAttribute('size');
      (el as HTMLElement).style.fontSize = this.ctxFmtSize + 'pt';
    });
  }

  // ── HTML section selection (HR, colored divs) ─────────────

  private syncHtmlSecPos() {
    const el = this.selHtmlSection;
    const canvas = this.canvasRef?.nativeElement as HTMLElement | undefined;
    if (!el || !canvas) return;
    const cr = canvas.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const sx = this.width  / cr.width;
    const sy = this.height / cr.height;
    this.htmlSecPos = {
      x: (er.left - cr.left) * sx,
      y: (er.top  - cr.top)  * sy,
      w: er.width  * sx,
      h: er.height * sy,
    };
  }

  private findColoredSection(el: HTMLElement): HTMLElement | null {
    let cur: HTMLElement | null = el;
    const root = this.htmlLayerRef?.nativeElement as HTMLElement | undefined;
    while (cur && cur !== root) {
      const bg = window.getComputedStyle(cur).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  moveHtmlSectionUp() {
    const el = this.selHtmlSection;
    if (!el || !el.previousElementSibling) return;
    el.parentElement?.insertBefore(el, el.previousElementSibling);
    setTimeout(() => this.syncHtmlSecPos(), 20);
    this.cdr.detectChanges();
  }

  moveHtmlSectionDown() {
    const el = this.selHtmlSection;
    if (!el || !el.nextElementSibling) return;
    el.parentElement?.insertBefore(el.nextElementSibling, el);
    setTimeout(() => this.syncHtmlSecPos(), 20);
    this.cdr.detectChanges();
  }

  deleteHtmlSection() {
    this.selHtmlSection?.remove();
    this.selHtmlSection = null;
    this.cdr.detectChanges();
  }

  deleteSelected() {
    if (!this.selId) return;
    this.pushHistory();
    this.stopEditTb();
    this.objects = this.objects.filter(o => o.id !== this.selId);
    this.selId = null;
  }

  duplicateSelected() {
    const o = this.selObj; if (!o) return;
    this.pushHistory();
    const copy: DesignObject = {...o, id: uid(), x:o.x+20, y:o.y+20, zIndex:o.zIndex+1};
    this.objects.push(copy);
    this.selId = copy.id;
  }

  bringToFront()  { if (this.selObj) this.selObj.zIndex = this.objects.reduce((m,o)=>Math.max(m,o.zIndex),0)+1; }
  sendToBack()    { if (this.selObj) this.selObj.zIndex = this.objects.reduce((m,o)=>Math.min(m,o.zIndex),0)-1; }
  bringForward()  { if (this.selObj) this.selObj.zIndex++; }
  sendBackward()  { if (this.selObj) this.selObj.zIndex--; }

  // ── HTML element operations ──────────────────────────────

  deleteHtmlEl(el: HTMLElement | null) {
    if (!el) return;
    el.remove();
    if (el === this.selImgEl) this.selImgEl = null;
    this.ctx.visible = false;
  }

  addSpacing(el: HTMLElement | null, px: number) {
    if (!el) return;
    const cur = parseInt(el.style.marginTop || '0', 10);
    el.style.marginTop = Math.max(0, cur + px) + 'px';
  }

  increaseFontSize(el: HTMLElement | null) {
    if (!el) return;
    const cur = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = Math.min(72, cur + 2) + 'px';
  }

  decreaseFontSize(el: HTMLElement | null) {
    if (!el) return;
    const cur = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = Math.max(6, cur - 2) + 'px';
  }

  // ── Photo shape ──────────────────────────────────────────

  applyImgShape() {
    if (!this.selImgEl) return;
    const el = this.selImgEl;
    switch (this.imgShape) {
      case 'circle': el.style.borderRadius='50%'; el.style.clipPath=''; break;
      case 'square': el.style.borderRadius='8px'; el.style.clipPath=''; break;
      case 'rect':   el.style.borderRadius='6px'; el.style.clipPath=''; break;
      case 'hex':    el.style.borderRadius='0'; el.style.clipPath='polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)'; break;
    }
  }

  resizeImgTo(w: string|null, h: string|null) {
    if (!this.selImgEl) return;
    if (w) { this.selImgEl.style.width = w + 'px'; this.selImgEl.style.minWidth = w + 'px'; }
    if (h) { this.selImgEl.style.height = h + 'px'; this.selImgEl.style.minHeight = h + 'px'; }
    this.syncImgPos();
  }

  // ── Pickers ──────────────────────────────────────────────

  togglePicker(which: 'fill'|'stroke') {
    if (which === 'fill')   { this.showFill = !this.showFill; this.showStroke = false; }
    else                    { this.showStroke = !this.showStroke; this.showFill = false; }
  }

  // ── Undo ─────────────────────────────────────────────────

  pushHistory() {
    this.history.push(JSON.parse(JSON.stringify(this.objects)));
    this.redoStack = [];                                    // nouvelle action = vide redo
    if (this.history.length > 50) this.history.shift();
  }

  undo() {
    const hl = this.htmlLayerRef?.nativeElement as HTMLElement;
    if (hl && hl.contains(document.activeElement ?? null)) {
      document.execCommand('undo'); return;
    }
    if (!this.history.length) return;
    this.redoStack.push(JSON.parse(JSON.stringify(this.objects)));
    this.objects = this.history.pop()!;
    this.selId = null;
    this.cdr.detectChanges();
  }

  redo() {
    const hl = this.htmlLayerRef?.nativeElement as HTMLElement;
    if (hl && hl.contains(document.activeElement ?? null)) {
      document.execCommand('redo'); return;
    }
    if (!this.redoStack.length) return;
    this.history.push(JSON.parse(JSON.stringify(this.objects)));
    this.objects = this.redoStack.pop()!;
    this.selId = null;
    this.cdr.detectChanges();
  }

  // ── Keyboard ─────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (inInput) return;

    // Si on est en train d'éditer une zone de texte → Escape seulement
    if (this.editingTbId) {
      if (e.key === 'Escape') { const o = this.selObj; if (o) this.saveTbContent(o); this.stopEditTb(); }
      return;
    }

    // Bloquer les raccourcis clavier UNIQUEMENT si aucune forme n'est sélectionnée ET que le curseur
    // est dans la couche HTML (l'utilisateur est en train d'éditer du texte CV)
    if (!this.selId && !this.selImgEl && !this.selHtmlSection) {
      const sel = window.getSelection();
      const hl  = this.htmlLayerRef?.nativeElement;
      if (sel?.focusNode && hl?.contains(sel.focusNode)) return;
    }

    if ((e.key==='Delete'||e.key==='Backspace') && this.selId) { e.preventDefault(); this.deleteSelected(); }
    if (e.ctrlKey && e.key==='z') { e.preventDefault(); this.undo(); }
    if (e.ctrlKey && (e.key==='y'||e.key==='Z')) { e.preventDefault(); this.redo(); }
    if (e.ctrlKey && e.key==='d' && this.selId) { e.preventDefault(); this.duplicateSelected(); }
    if (e.key==='Escape') { this.selId=null; this.selImgEl=null; this.selHtmlSection=null; }
    if (e.key==='t') this.insertTextBox();  // T = insérer une zone de texte

    if (this.selObj) {
      const step = e.shiftKey ? 10 : 1;
      if (e.key==='ArrowLeft')  { this.selObj.x-=step; e.preventDefault(); }
      if (e.key==='ArrowRight') { this.selObj.x+=step; e.preventDefault(); }
      if (e.key==='ArrowUp')    { this.selObj.y-=step; e.preventDefault(); }
      if (e.key==='ArrowDown')  { this.selObj.y+=step; e.preventDefault(); }
    }
  }

  // ── Image body drag ──────────────────────────────────────

  onImgBodyDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.selImgEl) return;
    const c = this.svgCoordsRaw(e);
    this.dragStart = c;
    this.imgDragStartLeft = parseInt(this.selImgEl.style.left || '0', 10) || 0;
    this.imgDragStartTop  = parseInt(this.selImgEl.style.top  || '0', 10) || 0;
    this.isImgDragging = true;
  }

  // ── Canvas zoom ──────────────────────────────────────────

  setZoom(z: number) { this.canvasZoom = Math.min(200, Math.max(25, Math.round(z))); }

  fitZoom() {
    const wrap = this.canvasWrapRef?.nativeElement as HTMLElement | undefined;
    if (!wrap) { this.setZoom(75); return; }
    const ww = wrap.clientWidth  - 48;
    const wh = wrap.clientHeight - 48;
    const zw = Math.floor((ww / this.width)  * 100);
    const zh = Math.floor((wh / this.height) * 100);
    this.setZoom(Math.min(zw, zh));
  }

  // ── Helpers ──────────────────────────────────────────────

  private svgCoordsRaw(e: MouseEvent): {x:number,y:number} {
    const svg  = this.svgLayerRef!.nativeElement as SVGElement;
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.width  / rect.width),
      y: (e.clientY - rect.top)  * (this.height / rect.height),
    };
  }

  // ── Save / Cancel ─────────────────────────────────────────

  // ─── Background ──────────────────────────────────────────────────────────

  setBgImage(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      this.bgImgUrl   = ev.target?.result as string;
      this.bgGradient = '';
      this.showBgPanel = false;
      this.zone.run(() => this.cdr.detectChanges());
    };
    reader.readAsDataURL(file);
  }

  // ─── Photo insertion (prominent button) ──────────────────────────────────

  addPhotoFromFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      // Insert image into the HTML layer at center
      const img = document.createElement('img');
      img.src = src;
      img.style.cssText = `max-width:${Math.min(this.width * 0.4, 200)}px;height:auto;position:absolute;top:${Math.floor(this.height * 0.2)}px;left:${Math.floor(this.width * 0.3)}px;border-radius:6px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.3)`;
      img.draggable = false;
      const hl = this.htmlLayerRef?.nativeElement;
      if (hl) { hl.appendChild(img); }
      this.zone.run(() => this.cdr.detectChanges());
    };
    reader.readAsDataURL(file);
    (e.target as HTMLInputElement).value = '';
  }

  // ─── Dynamic fields ───────────────────────────────────────────────────────

  insertDynField(fieldName: string) {
    const placeholder = `{{${fieldName}}}`;
    const obj: DesignObject = {
      id: 'dyn-' + Math.random().toString(36).slice(2, 8),
      type: 'textbox', x: 20, y: 20, w: 200, h: 40,
      fill: 'none', stroke: '#6366f1', sw: 1, opacity: 100,
      text: '', fontSize: 16, fontColor: '#0f172a',
      textAlign: 'left', zIndex: this.objects.length + 1,
      isLine: false, isTextBox: true,
      content: placeholder,
      fontFamily: 'Inter,sans-serif',
      paddingPx: 6,
    };
    this.objects = [...this.objects, obj];
    this.selId = obj.id;
    this.pushHistory();
    this.cdr.detectChanges();
  }

  onSave() {
    const htmlContent = this.htmlLayerRef?.nativeElement?.innerHTML ?? this.baseHtml;
    const svgStr = this.objectsSorted.map(o => {
      const d     = shapePath(o.type, o.x, o.y, o.w, o.h);
      const fill  = o.isLine ? 'none' : o.fill;
      const strok = o.stroke === 'none' ? 'none' : o.stroke;
      let s = `<path d="${d}" fill="${fill}" stroke="${strok}" stroke-width="${o.sw}" stroke-linejoin="round" stroke-linecap="round" opacity="${o.opacity/100}"/>`;
      if (o.text && !o.isLine) {
        s += `<text x="${o.x+o.w/2}" y="${o.y+o.h/2+o.fontSize*.36}" text-anchor="middle" font-size="${o.fontSize}" fill="${o.fontColor}" font-family="Inter,sans-serif" font-weight="600">${o.text}</text>`;
      }
      return s;
    }).join('');

    const combined =
      `<div style="position:relative;width:${this.width}px;min-height:${this.height}px;overflow:hidden">` +
      `<div style="position:absolute;inset:0">${htmlContent}</div>` +
      `<svg style="position:absolute;inset:0;width:${this.width}px;height:${this.height}px;overflow:visible" xmlns="http://www.w3.org/2000/svg">${svgStr}</svg>` +
      `</div>`;

    this.savedEvent.emit({html: combined, objects: this.objects});
  }

  onCancel() { this.cancelEvent.emit(); }

  onDownload() {
    const canvas = this.canvasRef?.nativeElement as HTMLElement | undefined;
    if (!canvas) return;
    const h2pdf = (window as any)['html2pdf'];
    if (!h2pdf) {
      // Fallback : impression navigateur
      const win = window.open('', '_blank');
      if (!win) return;
      const hl = this.htmlLayerRef?.nativeElement as HTMLElement;
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        @page{size:A4;margin:0}body{margin:0;padding:0}
        *{box-sizing:border-box}
      </style></head><body>${hl?.innerHTML ?? ''}</body></html>`);
      win.document.close();
      setTimeout(() => { win.print(); win.close(); }, 600);
      return;
    }
    const hl = this.htmlLayerRef?.nativeElement as HTMLElement;
    const clone = document.createElement('div');
    clone.style.cssText = `width:${this.width}px;min-height:${this.height}px;overflow:hidden`;
    clone.innerHTML = hl?.innerHTML ?? '';
    h2pdf().set({
      margin: 0, filename: 'document.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'px', format: [this.width, this.height], orientation: 'portrait' }
    }).from(clone).save();
  }
}

function uid() { return Math.random().toString(36).slice(2,10); }
