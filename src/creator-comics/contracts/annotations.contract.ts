// src\creator-comics\contracts\annotations.contract.ts
export type TextLang = 'ar' | 'en' | 'ja' | 'ko' | 'zh' | 'unknown';
export type WritingDirection = 'RTL' | 'LTR' | 'TTB';

export type ElementSource = 'ai' | 'user';
export type ElementStatus =
  | 'detected'
  | 'edited'
  | 'confirmed'
  | 'deleted'
  | 'needs_review';

export type ElementType =
  | 'SPEECH'
  | 'THOUGHT'
  | 'NARRATION'
  | 'CAPTION'
  | 'SFX'
  | 'SCENE_TEXT'
  | 'SIGNAGE'
  | 'UI_TEXT';

export type ContainerShape =
  | 'ellipse'
  | 'roundrect'
  | 'rect'
  | 'cloud'
  | 'burst'
  | 'none';

export type TemplateId =
  | 'bubble_ellipse'
  | 'bubble_roundrect'
  | 'bubble_cloud'
  | 'bubble_burst'
  | 'narration_rect'
  | 'narration_roundrect'
  | 'caption_box'
  | 'scene_label'
  | 'signage_label'
  | 'sfx_burst'
  | 'sfx_outline'
  | 'plain_text';

export interface NormalizedBBox {
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
}

export interface NormalizedPoint {
  x: number; // 0..1
  y: number; // 0..1
}

export interface ElementGeometry {
  container_bbox: NormalizedBBox;
  text_bbox?: NormalizedBBox;
  anchor: NormalizedPoint; // غالباً center
}

export interface ContainerInfo {
  shape: ContainerShape;
  template_id: TemplateId;
  params: Record<string, any>;
}

export interface TextInfo {
  original: string;
  translated?: string;
  lang: TextLang;
  writingDirection: WritingDirection;
  sizeHint: 'small' | 'medium' | 'large';
  styleHint:
    | 'normal'
    | 'bold'
    | 'outlined'
    | 'shadowed'
    | 'handwritten'
    | 'distorted'
    | '3d'
    | 'gradient'
    | 'none';
}

export interface ElementStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  align: 'left' | 'center' | 'right';
}

export interface PageElement {
  id: string;
  source: ElementSource;
  status: ElementStatus;
  elementType: ElementType;
  readingOrder: number;
  confidence: number;

  geometry: ElementGeometry;
  container: ContainerInfo;
  text: TextInfo;
  style: ElementStyle;

  notes?: string;
}

export interface PageMeta {
  keywords: string[];
  sceneDescription: string;
  languageHint: TextLang;
}

export interface PageAnnotationsDoc {
  version: 1;
  pageId: string;
  meta: PageMeta;
  elements: PageElement[];
  updatedAt: string; // ISO
}
