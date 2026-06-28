export const ANGLE_POOL = [
  "front-facing view, eye level, medium shot",
  "three-quarter angle, camera slightly elevated",
  "side profile, candid documentary style",
  "low angle, dynamic upward composition",
  "over-the-shoulder, shallow depth of field",
  "wide establishing shot, full scene visible",
  "close-up portrait, bokeh background",
  "candid natural moment, unposed style",
  "bird's eye overhead perspective",
  "dutch angle, creative tilt composition",
];

export const SCENE_TEMPLATES = {
  teaching:           "conducting a theoretical lecture to students in a vocational college classroom, explaining at the whiteboard",
  consultations:      "providing individual academic consultation to a student at a desk, reviewing materials together",
  graduation_thesis:  "mentoring a student on their graduation thesis, reviewing documents at a table",
  assessment:         "evaluating and grading student work at a desk, reviewing assessment papers",
  open_lessons:       "conducting an open lesson demonstration for observing colleagues in a modern classroom",
  lesson_prep:        "preparing lesson materials and plans at a desk with textbooks and a laptop",
  olympiad:           "coaching students for academic or professional competition preparation",
  independent_work:   "receiving and reviewing student independent work assignments at a desk",
  professional_dev:   "attending a professional development seminar in a conference room",
  career_guidance:    "giving a career guidance presentation to young students in a vocational college",
  mutual_analysis:    "observing and taking notes during a colleague's lesson for mutual analysis",
  circles:            "leading a student creative or technical club activity in a workshop",
  public_duties:      "participating in school organizational duties, helping at an event",
  beautification:     "participating in school grounds and facility beautification activities outdoors",
  council_meetings:   "participating in a pedagogical council meeting at a conference table with colleagues",
  cultural_work:      "organizing cultural and educational activities with students in a school hall",
  moral_activities:   "conducting a moral and civic educational event or assembly for students",
};

/**
 * Fisher-Yates shuffle of ANGLE_POOL, assign one angle per key (wraps if more keys than angles).
 */
export function assignAngles(itemKeys) {
  const pool = [...ANGLE_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const result = {};
  itemKeys.forEach((key, idx) => { result[key] = pool[idx % pool.length]; });
  return result;
}

/**
 * Assemble the full English prompt for PhotoMaker.
 * "img" is the PhotoMaker trigger token for face reference.
 */
export function buildPrompt(gender, itemKey, angle) {
  const genderWord = gender === 'male' ? 'male teacher' : 'female teacher';
  const scene = SCENE_TEMPLATES[itemKey] || 'working professionally in a vocational college';
  return `img, ${genderWord}, ${scene}, ${angle}, vocational college setting, `
       + `professional lighting, realistic photography, 8k, highly detailed, sharp focus`;
}
