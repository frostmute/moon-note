// moonphase.js — Live moon-phase calculator + SVG renderer.
// Computes the synodic phase from a known reference new moon and draws
// an accurate illuminated-disk using SVG arcs (the classic two-arc method).

const SYNODIC_MONTH = 29.530588853; // days, mean lunar phase period
// Reference new moon: 2000-01-06 18:14 UTC (J2000 lunar epoch)
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 86400000; // in days

const PHASES = [
  { name: 'New Moon', emoji: '🌑', min: 0, max: 0.03 },
  { name: 'Waxing Crescent', emoji: '🌒', min: 0.03, max: 0.22 },
  { name: 'First Quarter', emoji: '🌓', min: 0.22, max: 0.28 },
  { name: 'Waxing Gibbous', emoji: '🌔', min: 0.28, max: 0.47 },
  { name: 'Full Moon', emoji: '🌕', min: 0.47, max: 0.53 },
  { name: 'Waning Gibbous', emoji: '🌖', min: 0.53, max: 0.72 },
  { name: 'Last Quarter', emoji: '🌗', min: 0.72, max: 0.78 },
  { name: 'Waning Crescent', emoji: '🌘', min: 0.78, max: 0.97 },
  { name: 'New Moon', emoji: '🌑', min: 0.97, max: 1.0 },
];

export function calculateMoonPhase(date = new Date()) {
  const days = date.getTime() / 86400000 - REF_NEW_MOON;
  let phase = (days % SYNODIC_MONTH) / SYNODIC_MONTH;
  if (phase < 0) phase += 1;
  const age = phase * SYNODIC_MONTH;
  const illumination = ((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100;
  const info = PHASES.find((p) => phase >= p.min && phase < p.max) || PHASES[0];
  const waxing = phase < 0.5;
  return {
    phase, // 0..1
    phaseName: info.name,
    emoji: info.emoji,
    illumination, // %
    age, // days since last new moon
    waxing,
    nextFull: daysUntilPhase(phase, 0.5, days),
    nextNew: daysUntilPhase(phase, 0.0, days),
    date,
  };
}

// How many days until the moon reaches a target phase fraction.
function daysUntilPhase(current, target, elapsedDays) {
  let diff = target - current;
  if (diff <= 0) diff += 1; // next occurrence is next cycle
  return (diff * SYNODIC_MONTH).toFixed(1);
}

// Render the illuminated moon disk as an SVG string.
// Uses the two-arc construction: outer limb (semicircle on lit side) +
// terminator (half-ellipse). See derivation in module comments.
export function moonSVG(date = new Date(), size = 96) {
  const { phase, illumination, phaseName, waxing } = calculateMoonPhase(date);
  const R = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const rx = R * Math.cos(2 * Math.PI * phase); // signed terminator radius
  const arx = Math.abs(rx);

  const limbSweep = waxing ? 1 : 0; // lit side: right(wax) / left(wane)
  const termSweep = waxing ? (rx >= 0 ? 1 : 0) : (rx >= 0 ? 0 : 1);

  // Lit area path (centered at 0,0; translated via group transform)
  const litPath = [
    `M 0 ${-R}`,
    `A ${R} ${R} 0 0 ${limbSweep} 0 ${R}`, // outer limb T -> B
    `A ${arx} ${R} 0 0 ${termSweep} 0 ${-R}`, // terminator B -> T
    'Z',
  ].join(' ');

  // Outer cratered-disk base (dark + lit share this silhouette)
  return `
<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" class="moon-svg">
  <defs>
    <radialGradient id="moonLit" cx="38%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#fdfcf0"/>
      <stop offset="55%" stop-color="#e8e4cf"/>
      <stop offset="100%" stop-color="#b9b29a"/>
    </radialGradient>
    <radialGradient id="moonDark" cx="40%" cy="38%" r="78%">
      <stop offset="0%" stop-color="#2a2f45"/>
      <stop offset="100%" stop-color="#11131f"/>
    </radialGradient>
    <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
      <stop offset="65%" stop-color="rgba(180,200,255,0)"/>
      <stop offset="100%" stop-color="rgba(150,170,220,0.12)"/>
    </radialGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${R + 4}" fill="url(#moonGlow)"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#moonDark)"/>
  <g transform="translate(${cx} ${cy})">
    <path d="${litPath}" fill="url(#moonLit)"/>
    ${craters(R)}
  </g>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="0.75"/>
</svg>`;
}

// Subtle crater speckles so the lit surface isn't a flat gradient.
function craters(R) {
  const seeds = [
    [-0.30, -0.20, 0.13],
    [0.22, 0.10, 0.10],
    [-0.10, 0.34, 0.08],
    [0.36, -0.30, 0.06],
    [0.05, -0.08, 0.05],
    [-0.38, 0.12, 0.07],
  ];
  return seeds
    .map(([x, y, r]) => {
      const cr = r * R;
      return `<circle cx="${(x * R).toFixed(2)}" cy="${(y * R).toFixed(2)}" r="${cr.toFixed(2)}" fill="rgba(120,115,95,0.22)"/>`;
    })
    .join('');
}
