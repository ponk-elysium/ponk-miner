export type GpuInfo = { name: string; vendor: string; weight: number };

function tidyGpuName(raw: string) {
  const flat = raw.replace(/\s+/g, ' ').trim();
  if (/swiftshader|llvmpipe|softpipe|software adapter/i.test(flat))
    return 'Software renderer';
  let name = flat;
  const wrapped = name.match(/^ANGLE \((.*)\)\s*$/i);
  if (wrapped?.[1]) name = wrapped[1].trim();
  const score = (part: string) => {
    if (
      /geforce|quadro|radeon|rtx|gtx|rx\s?\d|adreno|mali|apple m\d/i.test(part)
    )
      return 3;
    if (/iris|uhd|arc\b|renderer:/i.test(part)) return 2;
    return 0;
  };
  const parts = name
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const best = parts.reduce(
    (win, part) => (score(part) > score(win) ? part : win),
    parts[0] ?? name,
  );
  return (
    best
      .replace(/^ANGLE\s+/i, '')
      .replace(/^(?:Metal|Vulkan|OpenGL|Direct3D\d*)\s+Renderer:\s*/i, '')
      .replace(/\s*\(0x[0-9a-f]+\)/gi, '')
      .replace(/\((?:r|tm)\)/gi, '')
      .replace(
        /\s*(?:Direct3D\d*|OpenGL|Vulkan|Metal|Unspecified Version|vs_\d.*|ps_\d.*).*/i,
        '',
      )
      .replace(/\s+/g, ' ')
      .trim() || 'GPU'
  );
}

function brand(value: string) {
  if (/nvidia|geforce|quadro/i.test(value)) return 'NVIDIA';
  if (/\bamd\b|radeon|\bati\b/i.test(value)) return 'AMD';
  if (/intel|\biris\b|\buhd\b|\barc\b/i.test(value)) return 'Intel';
  if (/apple/i.test(value) || /\bm\d(?:\s+(?:pro|max|ultra))?\b/i.test(value))
    return 'Apple';
  return '';
}

export function chipWeight(name: string) {
  const n = name.toLowerCase();
  if (/5090|4090|h100|a100|7900 xtx/.test(n)) return 220;
  if (/4080|3090|3080|4070|6900|6800|m4 max|m3 ultra|m2 ultra/.test(n))
    return 140;
  if (/3070|4060|3060|6700|a770|arc|m3 max|m2 max|m1 ultra/.test(n)) return 96;
  if (/m4 pro|m3 pro|m2 pro|m1 max|m1 pro/.test(n)) return 72;
  if (/apple m\d|\bm4\b|\bm3\b|\bm2\b|\bm1\b/.test(n)) return 48;
  if (/iris|uhd|adreno|mali|intel/.test(n)) return 22;
  if (/software/.test(n)) return 8;
  return 36;
}

export function readGpu(): GpuInfo {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', {
      powerPreference: 'high-performance',
    });
    if (!gl)
      return { name: 'GPU not available', vendor: 'no WebGL', weight: 8 };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(
      debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    );
    const vendor = String(
      debug
        ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)
        : gl.getParameter(gl.VENDOR),
    );
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const name = tidyGpuName(renderer);
    const fromName = brand(name);
    const noted = vendor.match(/\(([^)]+)\)/);
    return {
      name,
      vendor:
        fromName ||
        (noted?.[1] ? brand(noted[1]) : '') ||
        brand(vendor) ||
        vendor,
      weight: chipWeight(name),
    };
  } catch {
    return { name: 'GPU hidden', vendor: '', weight: 12 };
  }
}
