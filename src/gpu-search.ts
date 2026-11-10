import { attemptWords } from './hash.ts';
import { gpuDuty } from './economy.ts';

const shader = `
const K = array<u32, 64>(
  0x428a2f98u,0x71374491u,0xb5c0fbcfu,0xe9b5dba5u,0x3956c25bu,0x59f111f1u,0x923f82a4u,0xab1c5ed5u,
  0xd807aa98u,0x12835b01u,0x243185beu,0x550c7dc3u,0x72be5d74u,0x80deb1feu,0x9bdc06a7u,0xc19bf174u,
  0xe49b69c1u,0xefbe4786u,0x0fc19dc6u,0x240ca1ccu,0x2de92c6fu,0x4a7484aau,0x5cb0a9dcu,0x76f988dau,
  0x983e5152u,0xa831c66du,0xb00327c8u,0xbf597fc7u,0xc6e00bf3u,0xd5a79147u,0x06ca6351u,0x14292967u,
  0x27b70a85u,0x2e1b2138u,0x4d2c6dfcu,0x53380d13u,0x650a7354u,0x766a0abbu,0x81c2c92eu,0x92722c85u,
  0xa2bfe8a1u,0xa81a664bu,0xc24b8b70u,0xc76c51a3u,0xd192e819u,0xd6990624u,0xf40e3585u,0x106aa070u,
  0x19a4c116u,0x1e376c08u,0x2748774cu,0x34b0bcb5u,0x391c0cb3u,0x4ed8aa4au,0x5b9cca4fu,0x682e6ff3u,
  0x748f82eeu,0x78a5636fu,0x84c87814u,0x8cc70208u,0x90befffau,0xa4506cebu,0xbef9a3f7u,0xc67178f2u
);

struct Job {
  prefix: array<u32, 9>,
  base: u32,
  threshold: u32,
  rounds: u32,
  pad: u32,
}

struct Hit {
  found: atomic<u32>,
  nonce: atomic<u32>,
}

@group(0) @binding(0) var<uniform> job: Job;
@group(0) @binding(1) var<storage, read_write> hit: Hit;

fn rotr(x: u32, n: u32) -> u32 { return (x >> n) | (x << (32u - n)); }

fn sha_head(nonce: u32) -> u32 {
  var w: array<u32, 64>;
  for (var i = 0u; i < 9u; i++) { w[i] = job.prefix[i]; }
  w[9] = 0u;
  w[10] = nonce;
  w[11] = 0x80000000u;
  w[12] = 0u;
  w[13] = 0u;
  w[14] = 0u;
  w[15] = 352u;
  for (var i = 16u; i < 64u; i++) {
    let x = w[i - 15u];
    let y = w[i - 2u];
    let s0 = rotr(x, 7u) ^ rotr(x, 18u) ^ (x >> 3u);
    let s1 = rotr(y, 17u) ^ rotr(y, 19u) ^ (y >> 10u);
    w[i] = w[i - 16u] + s0 + w[i - 7u] + s1;
  }
  var a = 0x6a09e667u;
  var b = 0xbb67ae85u;
  var c = 0x3c6ef372u;
  var d = 0xa54ff53au;
  var e = 0x510e527fu;
  var f = 0x9b05688cu;
  var g = 0x1f83d9abu;
  var h = 0x5be0cd19u;
  for (var i = 0u; i < 64u; i++) {
    let s1 = rotr(e, 6u) ^ rotr(e, 11u) ^ rotr(e, 25u);
    let ch = (e & f) ^ ((~e) & g);
    let t1 = h + s1 + ch + K[i] + w[i];
    let s0 = rotr(a, 2u) ^ rotr(a, 13u) ^ rotr(a, 22u);
    let maj = (a & b) ^ (a & c) ^ (b & c);
    let t2 = s0 + maj;
    h = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
  }
  return a + 0x6a09e667u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let start = job.base + gid.x * job.rounds;
  for (var r = 0u; r < job.rounds; r++) {
    let nonce = start + r;
    let head = sha_head(nonce);
    if (head < job.threshold) {
      atomicStore(&hit.found, 1u);
      atomicMin(&hit.nonce, nonce);
    }
  }
}
`;

export type GpuSearch = {
  stop: () => void;
  usingGpu: boolean;
};

export async function startGpuSearch(options: {
  address: string;
  seed: string;
  target: number;
  power: () => number;
  onError: (error: unknown) => void;
  weight: number;
  readyAt: number;
  onTick: (tick: {
    attempts: number;
    rate: number;
    nonce: number;
    gpu: boolean;
  }) => void;
  onHit: (nonce: number) => void;
}): Promise<GpuSearch | null> {
  const gpu = navigator.gpu;
  if (!gpu) return null;
  const adapter = await gpu.requestAdapter({
    powerPreference: 'high-performance',
  });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ code: shader });
  const compiled = await module.getCompilationInfo();
  if (compiled.messages.some((message) => message.type === 'error')) {
    device.destroy();
    return null;
  }
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  });
  const words = attemptWords(options.address, options.seed, 0);
  const prefix = words.slice(0, 9);

  const groups = Math.max(8, Math.min(48, Math.round(options.weight / 3)));
  const rounds = 24;
  const batch = groups * 64 * rounds;
  let base = 0;
  let attempts = 0;
  let stopped = false;
  let found: number | null = null;
  const stamp = performance.now();

  const step = async () => {
    if (stopped) return;
    const job = new Uint32Array(16);
    job.set(prefix, 0);
    job[9] = base;
    job[10] = options.target;
    job[11] = rounds;
    const uniform = device.createBuffer({
      size: job.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const storage = device.createBuffer({
      size: 8,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    });
    const readback = device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniform, 0, job);
    device.queue.writeBuffer(storage, 0, new Uint32Array([0, 0xffffffff]));
    const bind = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        { binding: 1, resource: { buffer: storage } },
      ],
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(groups);
    pass.end();
    encoder.copyBufferToBuffer(storage, 0, readback, 0, 8);
    const started = performance.now();
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const view = new Uint32Array(readback.getMappedRange().slice(0));
    readback.unmap();
    uniform.destroy();
    storage.destroy();
    readback.destroy();
    const workMs = performance.now() - started;
    attempts += batch;
    base = (base + batch) >>> 0;
    const rate = attempts / Math.max(0.001, (performance.now() - stamp) / 1000);
    options.onTick({ attempts, rate, nonce: base, gpu: true });
    if (view[0] === 1 && found === null) found = view[1] ?? 0;
    if (found !== null && Date.now() >= options.readyAt) {
      stopped = true;
      device.destroy();
      options.onHit(found);
      return;
    }
    const duty = gpuDuty(options.weight, options.power());
    const pause = workMs * ((1 - duty) / duty);
    await new Promise((resolve) => setTimeout(resolve, Math.max(16, pause)));
    if (!stopped) void step().catch(fail);
  };
  const fail = (error: unknown) => {
    if (stopped) return;
    stopped = true;
    device.destroy();
    options.onError(error);
  };
  void step().catch(fail);
  return {
    usingGpu: true,
    stop: () => {
      stopped = true;
      device.destroy();
    },
  };
}
