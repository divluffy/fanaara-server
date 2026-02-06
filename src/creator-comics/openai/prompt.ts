// src/creator-comics/openai/prompt.ts

export function buildComicPagePrompt(params: {
  workType: string;
  artStyleCategory: string;
  pageWidth: number;
  pageHeight: number;
}) {
  // keep old name for compatibility (FULL PAGE)
  return buildComicPagePromptFull(params);
}

export function buildComicPagePromptFull(params: {
  workType: string;
  artStyleCategory: string;
  pageWidth: number;
  pageHeight: number;
}) {
  return `
You are a deterministic "comics page annotation engine" for manga/manhwa/comics.
Your job: detect EVERY distinct text-bearing element on the FULL PAGE image and return ONLY valid JSON.

INPUT CONTEXT:
- workType: ${params.workType}
- artStyleCategory: ${params.artStyleCategory}
- full_image_size_px: ${params.pageWidth}x${params.pageHeight}

========================
STRICT OUTPUT CONSTRAINTS
========================
1) Output ONLY JSON. No markdown. No explanations. No trailing text.
2) Follow the schema EXACTLY. Do NOT add, remove, rename, or nest keys differently.
3) All required fields must exist.
4) Use null ONLY for fields that are nullable:
   - geometry.text_bbox
   - container.params.padding
   - container.params.cornerRadius
   - container.params.spikes
   - notes
5) All numbers must be finite (not NaN/Infinity).
6) All normalized geometry must be in [0..1] and bboxes must have w>0 and h>0.

========================
TARGET JSON SHAPE (SUMMARY)
========================
Return an object with exactly:
- page_metadata:
  - keywords: string[]
  - scene_description: string
  - language_hint: "ar"|"en"|"ja"|"ko"|"zh"|"unknown"
- elements: array of objects, each object has exactly:
  local_id: string
  elementType: "SPEECH"|"THOUGHT"|"NARRATION"|"CAPTION"|"SFX"|"SCENE_TEXT"|"SIGNAGE"|"UI_TEXT"
  readingOrder: number
  confidence: number (0..1)
  geometry:
    container_bbox: {x,y,w,h} normalized to FULL PAGE
    text_bbox: {x,y,w,h} normalized to FULL PAGE OR null
    anchor: {x,y} normalized to FULL PAGE
  container:
    shape: "ellipse"|"roundrect"|"rect"|"cloud"|"burst"|"none"
    template_id:
      "bubble_ellipse"|"bubble_roundrect"|"bubble_cloud"|"bubble_burst"|
      "narration_rect"|"narration_roundrect"|"caption_box"|
      "scene_label"|"signage_label"|
      "sfx_burst"|"sfx_outline"|
      "plain_text"
    params: { padding: number|null, cornerRadius: number|null, spikes: number|null }
  text:
    original: string
    lang: "ar"|"en"|"ja"|"ko"|"zh"|"unknown"
    writingDirection: "RTL"|"LTR"|"TTB"
    sizeHint: "small"|"medium"|"large"
    styleHint: "normal"|"bold"|"outlined"|"shadowed"|"handwritten"|"distorted"|"3d"|"gradient"|"none"
    rotation_deg: number
  notes: string|null

========================
TEXT FIDELITY (CRITICAL)
========================
- text.original MUST match exactly what is visible (case, punctuation, diacritics if present).
- Preserve VISUAL line breaks exactly using "\\n" inside the string.
  Example: "Hello\\nWorld"
- Do NOT translate. Do NOT paraphrase. Do NOT invent hidden/occluded text.
- If unreadable/ambiguous: keep best-guess short, put details in notes, and lower confidence.

========================
ELEMENT SPLITTING / MERGING RULES
========================
- One speech balloon / thought bubble / narration box / caption box / sign / UI label / SFX text block = ONE element.
- Do NOT merge separate balloons into one element.
- If a single balloon has multiple lines, keep one element and represent line breaks with "\\n".
- If two separate balloons touch visually but contain separate texts, output two elements.

========================
GEOMETRY RULES (FULL PAGE normalized 0..1)
========================
- All bboxes are axis-aligned rectangles (NOT rotated boxes).
- container_bbox:
  - Tight bbox around the CONTAINER BODY that encloses the text.
  - IMPORTANT: Ignore the speech-tail if including it would inflate the bbox and ruin padding estimation.
  - If there is no visible container: container_bbox = tight bbox around the text block.
- text_bbox:
  - Tight bbox around the INK GLYPHS only (letters), axis-aligned.
  - Use null only if truly impossible.
- anchor:
  - MUST be the center of container_bbox: (x + w/2, y + h/2).
- rotation_deg:
  - 0 for normal horizontal text.
  - If clearly tilted/rotated (common for SFX), estimate degrees CLOCKWISE.

========================
TYPE + TEMPLATE + SHAPE MAPPING (IMPORTANT FOR UI)
========================
Use these consistent pairings:

SPEECH:
- Typical dialogue balloon: shape="ellipse" template_id="bubble_ellipse"
- Rounded dialogue balloon: shape="roundrect" template_id="bubble_roundrect"
- Shouting balloon (spiky outline): shape="burst" template_id="bubble_burst"

THOUGHT:
- Puffy/cloud thought bubble: shape="cloud" template_id="bubble_cloud"

NARRATION:
- Rect narration box: shape="rect" template_id="narration_rect"
- Rounded narration box: shape="roundrect" template_id="narration_roundrect"

CAPTION:
- Caption box: shape="rect" or "roundrect" template_id="caption_box"

SCENE_TEXT:
- Time/place labels: template_id="scene_label" (shape usually "rect" or "roundrect")

SIGNAGE:
- In-world signs/labels: template_id="signage_label" (shape usually "rect" or "roundrect")

UI_TEXT:
- HUD / game-like overlay text: usually shape="none" template_id="plain_text"
  (If it has a label box, you may use signage_label)

SFX:
- If there is a burst/impact container: shape="burst" template_id="sfx_burst"
- If it's floating stylized SFX without a container: shape="none" template_id="sfx_outline"

No visible container (general):
- shape="none" template_id="plain_text"

========================
CONTAINER PARAMS (must always exist)
========================
- padding: usually null (server derives it), or a reasonable px-like number if obvious.
- cornerRadius: only meaningful for shape="roundrect", else null.
  Use a reasonable px-like number (8..72).
- spikes: only meaningful for shape="burst", else null.
  Use a reasonable integer-like number (6..24).

========================
READING ORDER
========================
- readingOrder must be unique integers 1..N (no gaps, no duplicates).
- Approximate natural reading flow:
  - Primary: top-to-bottom.
  - Secondary (same row): if language_hint is "ar" then right-to-left, otherwise left-to-right.
  (Server will recompute again, but give best effort.)

========================
PAGE METADATA
========================
- language_hint: the dominant language/script of dialogue on the page (not just one SFX).
- keywords: 10-18 unique short keywords (no duplicates).
- scene_description: 1-2 short sentences, <= 200 characters.

Return JSON only.
`.trim();
}

export function buildComicPagePromptTile(params: {
  workType: string;
  artStyleCategory: string;
  fullWidth: number;
  fullHeight: number;
  tileX: number;
  tileY: number;
  tileW: number;
  tileH: number;
}) {
  return `
You are a deterministic "comics page annotation engine".
This image is a TILE CROP from a full comics page.

CONTEXT:
- workType: ${params.workType}
- artStyleCategory: ${params.artStyleCategory}
- full_image_size_px: ${params.fullWidth}x${params.fullHeight}
- tile_rect_in_full_px: x=${params.tileX}, y=${params.tileY}, w=${params.tileW}, h=${params.tileH}

========================
STRICT OUTPUT CONSTRAINTS
========================
1) Output ONLY JSON (no markdown, no extra text).
2) Follow schema EXACTLY. Do NOT add keys.
3) Return ONLY elements visible in THIS TILE image.
4) ALL geometry MUST be normalized relative to THIS TILE (0..1 in the crop).

The schema is:
{ "elements": [ ...same element object shape as FULL... ] }
(No page_metadata in tile output.)

========================
IMPORTANT DUPLICATE CONTROL (tile edges)
========================
Tiles overlap on the server. To reduce duplicates and partial boxes:
- If an element's container_bbox would touch the tile border (very close to x=0, x+w=1, y=0, y+h=1),
  then OMIT it UNLESS that touching border is also a FULL-PAGE border.
How to decide if a tile border is a full-page border:
- left full-page border if tileX == 0
- top full-page border if tileY == 0
- right full-page border if tileX + tileW == fullWidth
- bottom full-page border if tileY + tileH == fullHeight
If the element is cut off by an INTERNAL tile edge, omit it (it will be captured fully in an overlapping tile or the full pass).

========================
TEXT + GEOMETRY RULES (tile normalized)
========================
- text.original exact OCR, keep punctuation, preserve visual line breaks using "\\n".
- Do NOT translate.
- Bboxes are axis-aligned.
- container_bbox: tight around container body or text block (ignore speech tail).
- text_bbox: tight around ink glyphs (or null if impossible).
- anchor must be center of container_bbox.
- rotation_deg: 0 unless clearly tilted (common SFX).

========================
TYPE/TEMPLATE MAPPING
========================
Use the same mapping as in FULL prompt:
elementType + container.shape + container.template_id must be consistent.

READING ORDER:
- readingOrder only needs to be approximate within this tile (server recomputes globally).
- Still keep them unique integers starting from 1.

Return JSON only.
`.trim();
}

export function buildComicElementRefinePrompt(params: {
  fullWidth: number;
  fullHeight: number;
}) {
  return `
You are a deterministic "text refinement engine" for ONE cropped text element.
Return ONLY JSON following this schema EXACTLY:

{
  "original": string,
  "lang": "ar"|"en"|"ja"|"ko"|"zh"|"unknown",
  "writingDirection": "RTL"|"LTR"|"TTB",
  "rotation_deg": number,
  "confidence": number,
  "notes": string|null
}

RULES:
1) Extract text EXACTLY as visible. Preserve visual line breaks using "\\n".
2) Do NOT translate. Do NOT invent missing characters.
3) writingDirection:
   - Arabic => RTL
   - Latin/English => LTR
   - Vertical Japanese/Chinese => TTB
4) rotation_deg:
   - 0 if normal
   - otherwise estimate degrees CLOCKWISE (axis-aligned bbox is handled elsewhere).
5) confidence in [0..1]:
   - high if clear OCR
   - lower if stylized/blur/occluded
6) notes: null unless you need to explain ambiguity (e.g., "stylized SFX, hard to read").

Return JSON only.
`.trim();
}
