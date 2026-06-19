// =========================================
// SVG illustration system
// A clean, stylized body figure with named muscle regions.
// Each exercise specifies which regions to highlight and which view
// (front / back). The same illustration scales from tiny card thumbs
// to large modal headers.
// =========================================

const ILLUSTRATIONS = (() => {

  // Front-view silhouette with named regions.
  // viewBox 100 x 240, all paths stroked with same color and selectively filled.
  const FRONT = `
    <!-- Head -->
    <circle cx="50" cy="22" r="13" class="body-part" />
    <!-- Neck -->
    <path d="M44 33 Q50 38 56 33 L56 41 Q50 43 44 41 Z" class="body-part" />
    <!-- Traps to shoulders -->
    <path d="M36 41 Q50 44 64 41 L72 47 L28 47 Z" class="body-part" data-region="traps" />
    <!-- Shoulders / front delts -->
    <ellipse cx="26" cy="52" rx="9" ry="8" class="body-part" data-region="shoulders" />
    <ellipse cx="74" cy="52" rx="9" ry="8" class="body-part" data-region="shoulders" />
    <!-- Torso outline -->
    <path d="M28 50 Q22 78 28 110 L42 122 L58 122 L72 110 Q78 78 72 50 Z" class="body-part" />
    <!-- Chest left -->
    <path d="M32 53 Q41 56 49 56 L49 78 Q40 82 32 78 Z" class="body-part" data-region="chest" />
    <!-- Chest right -->
    <path d="M68 53 Q59 56 51 56 L51 78 Q60 82 68 78 Z" class="body-part" data-region="chest" />
    <!-- Abs -->
    <path d="M42 82 L58 82 L58 118 L50 122 L42 118 Z" class="body-part" data-region="abs" />
    <!-- Ab segmentation lines (decorative, not regions) -->
    <line x1="50" y1="82" x2="50" y2="118" class="body-line" />
    <line x1="42" y1="92" x2="58" y2="92" class="body-line" />
    <line x1="42" y1="102" x2="58" y2="102" class="body-line" />
    <line x1="42" y1="111" x2="58" y2="111" class="body-line" />
    <!-- Obliques -->
    <path d="M28 78 L40 84 L40 116 L30 110 Z" class="body-part" data-region="obliques" />
    <path d="M72 78 L60 84 L60 116 L70 110 Z" class="body-part" data-region="obliques" />
    <!-- Left biceps -->
    <path d="M18 55 Q14 68 17 84 Q22 86 26 84 Q28 68 26 56 Z" class="body-part" data-region="biceps" />
    <!-- Right biceps -->
    <path d="M82 55 Q86 68 83 84 Q78 86 74 84 Q72 68 74 56 Z" class="body-part" data-region="biceps" />
    <!-- Left forearm -->
    <path d="M16 86 Q12 100 14 116 Q18 118 22 116 Q26 100 24 86 Z" class="body-part" data-region="forearms" />
    <!-- Right forearm -->
    <path d="M84 86 Q88 100 86 116 Q82 118 78 116 Q74 100 76 86 Z" class="body-part" data-region="forearms" />
    <!-- Left quad -->
    <path d="M30 125 Q26 150 30 180 L44 180 L46 125 Z" class="body-part" data-region="quads" />
    <!-- Right quad -->
    <path d="M70 125 Q74 150 70 180 L56 180 L54 125 Z" class="body-part" data-region="quads" />
    <!-- Adductor gap line -->
    <line x1="50" y1="125" x2="50" y2="178" class="body-line" />
    <!-- Left calf/shin (front view = shins, we'll highlight calves anyway) -->
    <path d="M32 184 Q30 205 34 224 L42 224 L44 184 Z" class="body-part" data-region="calves" />
    <!-- Right calf -->
    <path d="M68 184 Q70 205 66 224 L58 224 L56 184 Z" class="body-part" data-region="calves" />
  `;

  // Back-view silhouette
  const BACK = `
    <!-- Head -->
    <circle cx="50" cy="22" r="13" class="body-part" />
    <!-- Neck -->
    <path d="M44 33 Q50 38 56 33 L56 41 Q50 43 44 41 Z" class="body-part" />
    <!-- Traps (large diamond) -->
    <path d="M36 41 Q50 46 64 41 L70 60 Q50 66 30 60 Z" class="body-part" data-region="traps" />
    <!-- Shoulders / rear delts -->
    <ellipse cx="26" cy="52" rx="9" ry="8" class="body-part" data-region="rear-delts" />
    <ellipse cx="74" cy="52" rx="9" ry="8" class="body-part" data-region="rear-delts" />
    <!-- Torso outline -->
    <path d="M28 50 Q22 78 28 110 L42 122 L58 122 L72 110 Q78 78 72 50 Z" class="body-part" />
    <!-- Lats -->
    <path d="M30 60 Q24 80 30 100 L40 100 L42 64 Z" class="body-part" data-region="lats" />
    <path d="M70 60 Q76 80 70 100 L60 100 L58 64 Z" class="body-part" data-region="lats" />
    <!-- Mid/lower back -->
    <path d="M40 66 L60 66 L58 104 L42 104 Z" class="body-part" data-region="back" />
    <!-- Spine line -->
    <line x1="50" y1="66" x2="50" y2="104" class="body-line" />
    <!-- Left triceps -->
    <path d="M18 55 Q14 68 17 84 Q22 86 26 84 Q28 68 26 56 Z" class="body-part" data-region="triceps" />
    <!-- Right triceps -->
    <path d="M82 55 Q86 68 83 84 Q78 86 74 84 Q72 68 74 56 Z" class="body-part" data-region="triceps" />
    <!-- Left forearm -->
    <path d="M16 86 Q12 100 14 116 Q18 118 22 116 Q26 100 24 86 Z" class="body-part" data-region="forearms" />
    <!-- Right forearm -->
    <path d="M84 86 Q88 100 86 116 Q82 118 78 116 Q74 100 76 86 Z" class="body-part" data-region="forearms" />
    <!-- Glutes -->
    <path d="M30 110 Q26 124 32 138 L48 138 L48 118 L40 114 Z" class="body-part" data-region="glutes" />
    <path d="M70 110 Q74 124 68 138 L52 138 L52 118 L60 114 Z" class="body-part" data-region="glutes" />
    <!-- Hamstrings (upper-back of legs) -->
    <path d="M30 140 Q28 162 32 180 L44 180 L46 140 Z" class="body-part" data-region="hamstrings" />
    <path d="M70 140 Q72 162 68 180 L56 180 L54 140 Z" class="body-part" data-region="hamstrings" />
    <!-- Calves -->
    <path d="M32 184 Q30 205 34 224 L42 224 L44 184 Z" class="body-part" data-region="calves" />
    <path d="M68 184 Q70 205 66 224 L58 224 L56 184 Z" class="body-part" data-region="calves" />
  `;

  // Returns an SVG string for the requested view with active regions highlighted.
  // view: 'front' | 'back'
  // active: array of region keys (e.g., ['chest', 'shoulders', 'triceps'])
  function bodySVG({ view = 'front', active = [], size = null } = {}) {
    const inner = view === 'back' ? BACK : FRONT;
    const activeSet = new Set(active);
    // Mark active regions by adding 'active' to class
    const decorated = inner.replace(/data-region="([^"]+)"/g, (m, region) => {
      const isActive = activeSet.has(region);
      return `data-region="${region}" class-active="${isActive ? '1' : '0'}"`;
    });
    // Now stitch real classes
    const stitched = decorated
      .replace(/class="body-part" data-region="([^"]+)" class-active="1"/g,
        'class="body-part active" data-region="$1"')
      .replace(/class-active="0"/g, '')
      .replace(/class-active="1"/g, '');
    const sizeAttr = size ? `width="${size}" height="${size * 2.4}"` : 'width="100%" height="100%"';
    return `<svg viewBox="0 0 100 240" ${sizeAttr} class="body-svg body-svg--${view}" xmlns="http://www.w3.org/2000/svg">${stitched}</svg>`;
  }

  // Equipment glyphs for fallback / accent
  const EQUIP_ICONS = {
    Barbell: '<svg viewBox="0 0 48 24" fill="currentColor"><rect x="2" y="9" width="6" height="6" rx="2"/><rect x="9" y="6" width="4" height="12" rx="1.5"/><rect x="14" y="11" width="20" height="2"/><rect x="35" y="6" width="4" height="12" rx="1.5"/><rect x="40" y="9" width="6" height="6" rx="2"/></svg>',
    Dumbbell: '<svg viewBox="0 0 48 24" fill="currentColor"><rect x="4" y="6" width="6" height="12" rx="2"/><rect x="11" y="9" width="4" height="6" rx="1.5"/><rect x="16" y="11" width="16" height="2"/><rect x="33" y="9" width="4" height="6" rx="1.5"/><rect x="38" y="6" width="6" height="12" rx="2"/></svg>',
    Cable: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 4v8a7 7 0 0 0 14 0V4"/><path d="M12 11v9"/><path d="M8 20h8"/></svg>',
    Machine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18"/><path d="M9 16h6"/></svg>',
    Bodyweight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v6"/><path d="M9 9l-3 4"/><path d="M15 9l3 4"/><path d="M12 13l-2 8"/><path d="M12 13l2 8"/></svg>',
    Kettlebell: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 4h6a1 1 0 0 1 1 1v2a5 5 0 1 1-8 0V5a1 1 0 0 1 1-1z"/></svg>',
    Cardio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    Bands: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12c4-6 14-6 18 0M3 12c4 6 14 6 18 0"/></svg>',
  };

  function equipIcon(name) {
    return EQUIP_ICONS[name] || EQUIP_ICONS.Machine;
  }

  return { bodySVG, equipIcon };
})();
