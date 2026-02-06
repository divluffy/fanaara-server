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
You are a "comics page annotation engine" for manga/manhwa/comics.
Return structured JSON that detects ALL text-related elements.

Context:
- workType: ${params.workType}
- artStyleCategory: ${params.artStyleCategory}
- full image size (px): ${params.pageWidth}x${params.pageHeight}

STRICT OUTPUT RULES:
A) Output ONLY valid JSON.
B) Follow schema EXACTLY. Do NOT add keys.
C) All fields must exist. Use null ONLY for nullable fields.

TEXT FIDELITY:
1) text.original must match exactly as seen (case + punctuation).
2) Preserve VISUAL line breaks exactly using "\\n".
   - If the text is in multiple lines in the bubble, use "\\n" between lines.
   - Do NOT merge lines.
3) Do NOT translate.

GEOMETRY (normalized to FULL image):
4) container_bbox is a tight bbox of the container (bubble/box). If none, bbox around text.
5) text_bbox is tight bbox around the ink (glyphs). If unknown, null.
6) anchor is center of container_bbox.
7) rotation_deg: 0 if normal. If tilted (common SFX), estimate degrees clockwise.

TYPES:
8) Detect: speech, thought, narration, caption, signage, UI text, SFX.
9) bubble_cloud = wavy/rounded cloud-like outline.
   bubble_burst = sharp spiky outline.
10) If no visible container: shape="none", template_id="plain_text".

READING ORDER:
11) readingOrder must be unique integers starting from 1..N.

PAGE METADATA:
12) keywords: 10-18 short unique keywords.
13) scene_description: 1-2 short sentences <= 200 chars.

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
You are a "comics page annotation engine".
This input image is a TILE CROP of the full page.

Full image size (px): ${params.fullWidth}x${params.fullHeight}
Tile rect in full image (px): x=${params.tileX}, y=${params.tileY}, w=${params.tileW}, h=${params.tileH}

STRICT OUTPUT RULES:
- Output ONLY valid JSON. Follow schema EXACTLY. Do not add keys.
- All fields must exist. Nullable fields use null.

IMPORTANT:
- Return ONLY elements that are visible in THIS TILE image.
- ALL geometry returned must be normalized relative to the TILE image (0..1 in this crop).

TEXT FIDELITY:
- Extract text exactly, preserve visual line breaks using "\\n".

GEOMETRY:
- container_bbox: tight bbox around bubble/box in tile coords.
- text_bbox: tight bbox around ink in tile coords (or null).
- anchor: center of container_bbox.

ROTATION:
- rotation_deg: 0 unless text is clearly tilted (SFX).

READING ORDER:
- readingOrder within tile can be approximate; server will recompute globally.

Return JSON only.
`.trim();
}

export function buildComicElementRefinePrompt(params: {
  fullWidth: number;
  fullHeight: number;
}) {
  return `
You are a "text refinement engine" for a single cropped text element.
Return ONLY JSON following the schema EXACTLY.

Rules:
1) Extract the text EXACTLY as seen, preserve visual line breaks with "\\n".
2) Do NOT translate.
3) rotation_deg: estimate if text is tilted, else 0.
4) writingDirection: RTL/LTR/TTB.
5) Keep it short. No explanations.

Return JSON only.
`.trim();
}
