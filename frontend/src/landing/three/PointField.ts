/* ============================================================
   PointField — motor 3D persistente da landing Genesis Radar.

   Um canvas só, uma câmera só, uma jornada contínua dirigida pelo
   scroll via setJourney(0..1):

     0.00–0.42  MERGULHO  — câmera desce pelo campo de empresas
     0.42–0.70  MIRA      — câmera se aproxima de UMA empresa
     0.70–0.86  TRAVESSIA — a esfera cresce e engole o quadro
     0.86–1.00  INTERIOR  — dentro da empresa; campo vira fundo
                            distante e desfocado para o texto

   Módulo Three.js puro — sem React, sem GSAP.
   ============================================================ */

import * as THREE from "three";

export interface CursorLabel {
  x: number;
  y: number;
  value: number;
  strength: number;
}

interface PointFieldOptions {
  reducedMotion?: boolean;
}

// grade uniforme — densidade praticamente igual, sem aglomerados
const COLS = 66;
const ROWS = 42;
const POINT_COUNT = COLS * ROWS; // 2772
const FIELD_W = 26.4;
const FIELD_H = 17.0;

const TWO_PI = Math.PI * 2;
const TRAIL = 1.15;
const SWEEP_SPEED = TWO_PI / 19;
const SWEEP_RADIUS = 13.5;
const MOUSE_RADIUS = 0.34;
const CHARGE_LIFE = 6.5;

// a empresa escolhida — onde a jornada mergulha
const SP = new THREE.Vector3(0.9, -0.5, 1.2);

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/* ── shaders dos pontos ──────────────────────────────────────── */
const POINT_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uMouseR;
  uniform float uAspect;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uSoft;
  uniform float uMotion;

  attribute float aSize;
  attribute float aSeed;
  attribute float aCharge;

  varying float vResolved;
  varying float vThrob;
  varying float vSeed;
  varying float vDepth;
  varying float vCharge;

  void main() {
    vSeed = aSeed;
    vCharge = aCharge;

    vec3 p = position;
    float drift = uTime * 0.13 + aSeed * 6.2831853;
    p.x += sin(drift) * 0.04;
    p.y += cos(drift * 0.92) * 0.04;
    p.x += sin(uTime * 0.42 + aSeed * 9.3) * 0.15 * aCharge;
    p.y += cos(uTime * 0.37 + aSeed * 6.7) * 0.15 * aCharge;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;

    vec2 ndc = clip.xy / clip.w;
    ndc.x *= uAspect;
    float md = distance(ndc, uMouse);
    float mouseResolved = 1.0 - smoothstep(0.0, uMouseR, md);

    float resolved = max(mouseResolved, aCharge);

    // batimento — lub-dub coerente: uma diástole viaja do centro para
    // fora; o campo inteiro respira como UM organismo (não cintilação
    // por-semente). Pequena variabilidade (HRV) no período, congelada
    // sob reduced-motion via uMotion.
    float rDist = length(position.xy);
    float period = 1.15 + sin(uTime * 0.2) * 0.05 * uMotion;
    float bphase = fract(uTime / period - rDist * 0.035 - aSeed * 0.02);
    float lub = exp(-pow((bphase - 0.05) * 13.0, 2.0));
    float dub = exp(-pow((bphase - 0.20) * 15.0, 2.0)) * 0.58;
    float beat = min(lub + dub, 1.0);

    vResolved = clamp(resolved, 0.0, 1.0);
    vThrob = vResolved * beat;
    vDepth = -mv.z;

    gl_Position = clip;
    float px = aSize * uSizeScale / max(vDepth, 0.5);
    gl_PointSize = px * uPixelRatio
      * (1.0 + vResolved * 1.05 + vThrob * 1.05)
      * (1.0 + uSoft * 0.8);
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uInkDeep;
  uniform vec3 uGold;
  uniform float uOpacity;
  uniform float uDive;
  uniform float uSoft;

  varying float vResolved;
  varying float vThrob;
  varying float vSeed;
  varying float vDepth;
  varying float vCharge;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);

    // disco nítido por padrão; vira blob suave (bokeh) no interior
    float core = smoothstep(0.5, mix(0.44, 0.05, uSoft), r);
    if (core <= 0.001) discard;

    float dark = clamp(vResolved + vThrob * 0.45, 0.0, 1.0);
    vec3 col = mix(uInk, uInkDeep, dark);

    // imposter de esfera — volume 3D quando a câmera está entre os pontos
    float sphereAmt = uDive * clamp(1.35 - vDepth * 0.07, 0.12, 1.0);
    vec2 n2 = uv * 2.0;
    float nz = sqrt(max(0.0, 1.0 - dot(n2, n2)));
    vec3 nrm = vec3(n2, nz);
    vec3 lightDir = normalize(vec3(-0.45, 0.6, 0.85));
    float diff = max(dot(nrm, lightDir), 0.0);
    float spec = pow(nz, 3.0) *
      pow(max(dot(reflect(-lightDir, nrm), vec3(0.0, 0.0, 1.0)), 0.0), 22.0);
    col *= mix(1.0, 0.40 + 0.80 * diff, sphereAmt);
    col += vec3(1.0, 0.96, 0.86) * spec * sphereAmt * 0.6;

    // rastro carregado — o sweep deposita energia: ouro esfriando sobre a
    // tinta escura do ponto (saturado sobre fundo escuro = luz, não wash)
    col = mix(col, uGold, vCharge * 0.55);
    col += uGold * pow(vCharge, 2.0) * 0.35;

    float depthFade = clamp(1.15 - max(vDepth - 7.0, 0.0) * 0.045, 0.35, 1.0);
    float dimAlpha = (0.42 + vSeed * 0.30) * depthFade;
    float litAlpha = (0.92 + vThrob * 0.08) * depthFade;
    float alpha = mix(dimAlpha, litAlpha, vResolved) + vCharge * 0.22;

    gl_FragColor = vec4(col, core * alpha * uOpacity);
  }
`;

/* ── shaders da varredura ────────────────────────────────────── */
const SWEEP_VERT = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SWEEP_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColorHot;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uMotion;   // 0 sob reduced-motion (congela a cintilação)
  uniform float uBoost;    // flare momentâneo do pulse (entrada)
  varying vec2 vLocal;
  void main() {
    // ângulo e raio reconstruídos por pixel — gradiente sem emendas
    float ang = atan(vLocal.y, vLocal.x);
    float vAng = clamp(1.0 + ang / ${TRAIL.toFixed(4)}, 0.0, 1.0);   // 0 fuga · 1 ataque
    float vRad = clamp(length(vLocal) / ${SWEEP_RADIUS.toFixed(4)}, 0.0, 1.0);
    float trail = 1.0 - vAng;

    // duas quedas radiais — corpo etéreo curto, retas firmes até quase o rim
    float rBody = smoothstep(0.0, 0.15, vRad) * (1.0 - smoothstep(0.60, 0.97, vRad));
    float rLine = smoothstep(0.0, 0.05, vRad) * (1.0 - smoothstep(0.92, 1.05, vRad));

    // corpo — wash que adensa em direção ao bordo de ataque (saturado, curto)
    float body = pow(vAng, 1.7) * 0.17 * rBody;

    // bordo de ataque — a reta de luz viva. Tudo SATURADO e localizado por
    // potências altas de vAng × rLine — sobre o papel claro um wash de
    // baixa-alpha vira mancha marrom; aqui só a linha viva é luz.
    float leadGlow = pow(vAng, 6.0)   * 0.16 * rBody;
    float leadHalo = pow(vAng, 16.0)  * 0.48 * rLine;
    // cintilação viva no núcleo do feixe (congela sob reduced via uMotion=0)
    float shimmer = 0.86 + 0.14 * sin(uTime * 9.0 + vRad * 40.0) * uMotion;
    float leadCore = pow(vAng, 440.0) * 0.70 * rLine * shimmer;

    // bordo de fuga — a segunda reta, que fecha o leque do feixe
    float trailHalo = pow(trail, 34.0)  * 0.18 * rLine;
    float trailCore = pow(trail, 440.0) * 0.62 * rLine;

    // pulse de entrada reforça momentaneamente o bordo de ataque
    float boost = 1.0 + uBoost * 0.22;
    float lead = (leadGlow + leadHalo + leadCore) * boost;

    float alpha = (body + lead + trailHalo + trailCore) * uOpacity;
    // o núcleo do bordo de ataque incandesce — esquenta além do uColorHot
    vec3 col = mix(uColor, uColorHot, pow(vAng, 9.0));
    col += vec3(0.42, 0.30, 0.10) * pow(vAng, 60.0) * rLine * boost;
    gl_FragColor = vec4(col, alpha > 0.0 ? alpha : 0.0);
  }
`;

/* ── shaders da esfera-empresa (a que a jornada entra) ───────── */
const SPHERE_VERT = /* glsl */ `
  varying vec3 vN;
  void main() {
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SPHERE_FRAG = /* glsl */ `
  uniform vec3 uColB;
  uniform vec3 uColL;
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uPulse;     // respiro sincronizado ao batimento do campo
  uniform float uTime;
  uniform float uMotion;
  uniform float uGateDark;  // eCross*(1-clear): só acende sobre fundo escuro
  varying vec3 vN;
  void main() {
    vec3 N = normalize(vN);
    float l = dot(N, normalize(vec3(-0.4, 0.55, 0.72))) * 0.5 + 0.5;
    vec3 c = mix(uColB, uColL, l * l);
    // brasa interna voltada à vista — a empresa incandesce por dentro
    // (tudo sobre o corpo escuro uColB #0c0a07: luz, nunca mancha)
    float core = pow(max(N.z, 0.0), 1.7);
    c += vec3(0.62, 0.39, 0.13) * core * uPulse;
    // veias vítreas — paralaxe barata dá volume ao interior
    float veins = 0.5 + 0.5 * sin(N.x * 22.0 + uTime * 0.3 * uMotion) * cos(N.y * 18.0);
    c = mix(c, c * 0.72 + uColL * 0.2, veins * core * 0.4);
    // aro de luz quente — só durante a travessia, quando a esfera já
    // domina o quadro e o próprio corpo escuro é o fundo (gate de escuridão)
    float fres = pow(1.0 - clamp(abs(N.z), 0.0, 1.0), 2.4);
    c += uRim * fres * 0.8 * uGateDark;
    gl_FragColor = vec4(c, uOpacity);
  }
`;

/* ── atmosfera da esfera — corona fresnel em casca BackSide (1.07×),
   acende SÓ pelo gate de escuridão (eCross·(1-clear)); morre no clear.
   Nunca pinta ouro de baixa-alpha sobre o papel. ───────────────── */
const ATMO_FRAG = /* glsl */ `
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uGateDark;
  varying vec3 vN;
  void main() {
    vec3 N = normalize(vN);
    float f = pow(1.0 - clamp(abs(N.z), 0.0, 1.0), 3.2);
    gl_FragColor = vec4(uRim, f * 0.55 * uGateDark * uOpacity);
  }
`;

export class PointField {
  cursorLabels: CursorLabel[] = [];
  sweepBearing = 0;
  onFrame: ((field: PointField) => void) | null = null;

  private canvas: HTMLCanvasElement;
  private reducedMotion: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private pointMat!: THREE.ShaderMaterial;
  private sweepGroup!: THREE.Group;
  private sweepMat!: THREE.ShaderMaterial;
  private decor!: THREE.Group;
  private decorMats: Array<{ m: THREE.Material & { opacity: number }; base: number }> = [];
  private sphere!: THREE.Mesh;
  private sphereMat!: THREE.ShaderMaterial;
  private atmoMat!: THREE.ShaderMaterial;

  private clock = new THREE.Clock();
  private rafId = 0;

  private sweepAngle = 2.3;
  private prevSweep = 2.3;
  private journey = 0;
  private universe = 0;

  // ── acumulador único de FOV — dono exclusivo de updateProjectionMatrix
  //    por frame. Hoje só GL-05 (throb) escreve; fovThud/fovWiden ficam
  //    RESERVADOS p/ GL-06 (diferido: thud da travessia + recuo do
  //    universo). vel = energia de rolagem amortecida (alimenta o boost
  //    do sweep); sweepBoost = flare momentâneo do pulse de entrada. ──
  baseFov = 46;
  vel = 0;
  private velTarget = 0;
  private fovThrob = 0;
  private fovThud = 0;
  private fovWiden = 0;
  private sweepBoost = 0;
  private motionScalar = 1; // 0 sob reduced-motion
  private beat = 0; // envelope do batimento (lub-dub) por frame

  private mouse = new THREE.Vector2(-10, -10);
  private mouseTarget = new THREE.Vector2(-10, -10);

  private aspect = 1;
  private basePositions!: Float32Array;
  private values!: Float32Array;
  private angles!: Float32Array;
  private charges!: Float32Array;
  private chargeAttr!: THREE.BufferAttribute;
  private projV = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, options: PointFieldOptions = {}) {
    this.canvas = canvas;
    this.reducedMotion = !!options.reducedMotion;
    this.motionScalar = this.reducedMotion ? 0 : 1;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 160);
    this.camera.position.set(0, 0, 16);

    this.buildPoints();
    this.buildDecor();
    this.buildSweep();
    this.buildSphere();
    this.resize();

    if (this.reducedMotion) {
      for (let i = 0; i < POINT_COUNT; i++) {
        let behind = (this.sweepAngle - this.angles[i]) % TWO_PI;
        if (behind < 0) behind += TWO_PI;
        this.charges[i] = behind < TRAIL ? 1 - behind / TRAIL : 0;
      }
      this.chargeAttr.needsUpdate = true;
      this.applyJourney(0, 0);
      this.updateFrameUniforms(0);
      this.camera.updateMatrixWorld();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.clock.start();
      this.rafId = requestAnimationFrame(this.animate);
    }
  }

  /* ── API pública ─────────────────────────────────────────── */

  /** Progresso da jornada inteira, 0..1 — dirige a câmera contínua. */
  setJourney(p: number): void {
    this.journey = clamp01(p);
  }

  /** Capítulo 4 — recuo da câmera para a vista geral do campo, 0..1. */
  setUniverse(u: number): void {
    this.universe = clamp01(u);
  }

  /** Energia de rolagem 0..1 — alimenta tremor de câmera e óptica. */
  setVel(v: number): void {
    this.velTarget = v < 0 ? 0 : v > 1 ? 1 : v;
  }

  /** Pulso do instrumento — carrega o campo e reforça o sweep
   *  (o radar "acorda" ao receber a entrada). */
  pulse(s = 1): void {
    for (let i = 0; i < POINT_COUNT; i++) {
      if (this.charges[i] < s) this.charges[i] = s;
    }
    this.chargeAttr.needsUpdate = true;
    if (this.sweepBoost < 3.2) this.sweepBoost = 3.2;
  }

  setMouse(nx: number, ny: number): void {
    this.mouseTarget.set(nx, ny);
  }

  clearMouse(): void {
    this.mouseTarget.set(-10, -10);
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2);

    this.aspect = w / h;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);

    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();

    this.pointMat.uniforms.uAspect.value = this.aspect;
    this.pointMat.uniforms.uPixelRatio.value = pr;
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  /* ── construção da cena ──────────────────────────────────── */

  private buildPoints(): void {
    const positions = new Float32Array(POINT_COUNT * 3);
    const sizes = new Float32Array(POINT_COUNT);
    const seeds = new Float32Array(POINT_COUNT);
    this.values = new Float32Array(POINT_COUNT);
    this.angles = new Float32Array(POINT_COUNT);
    this.charges = new Float32Array(POINT_COUNT);

    const cellW = FIELD_W / COLS;
    const cellH = FIELD_H / ROWS;
    let i = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x =
          -FIELD_W / 2 + (col + 0.5) * cellW + (Math.random() - 0.5) * cellW * 0.86;
        const y =
          -FIELD_H / 2 + (row + 0.5) * cellH + (Math.random() - 0.5) * cellH * 0.86;
        const z = (Math.random() * 2 - 1) * 4.0 - 2.0;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        this.angles[i] = Math.atan2(y, x);

        const big = Math.random();
        sizes[i] = 1.05 + Math.pow(big, 2.0) * 2.25;
        seeds[i] = Math.random();
        this.values[i] = 3 + Math.pow(big, 1.6) * 247;
        i++;
      }
    }
    this.basePositions = positions;

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    this.chargeAttr = new THREE.BufferAttribute(this.charges, 1);
    this.chargeAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute("aCharge", this.chargeAttr);

    this.pointMat = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(-10, -10) },
        uMouseR: { value: MOUSE_RADIUS },
        uAspect: { value: 1 },
        uPixelRatio: { value: 1 },
        uSizeScale: { value: 45 },
        uSoft: { value: 0 },
        uMotion: { value: this.reducedMotion ? 0 : 1 },
        uInk: { value: new THREE.Color(0x6e5630) },
        uInkDeep: { value: new THREE.Color(0x120e08) },
        uGold: { value: new THREE.Color(0xcf9b1e) },
        uOpacity: { value: 1 },
        uDive: { value: 0 },
      },
    });

    const points = new THREE.Points(geom, this.pointMat);
    points.renderOrder = 1;
    points.frustumCulled = false;
    this.scene.add(points);
  }

  private buildDecor(): void {
    this.decor = new THREE.Group();
    this.decor.renderOrder = 0;

    const addMat = (opacity: number): THREE.LineBasicMaterial => {
      const m = new THREE.LineBasicMaterial({
        color: 0x241a10,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
      });
      this.decorMats.push({ m, base: opacity });
      return m;
    };

    for (const radius of [2.4, 5.0, 7.8, 10.8]) {
      const pts: number[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * TWO_PI;
        pts.push(Math.cos(a) * radius, Math.sin(a) * radius, -1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      this.decor.add(new THREE.Line(g, addMat(0.16)));
    }

    const ticks: number[] = [];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TWO_PI;
      const inner = i % 5 === 0 ? 12.0 : 12.4;
      ticks.push(Math.cos(a) * inner, Math.sin(a) * inner, -1);
      ticks.push(Math.cos(a) * 12.8, Math.sin(a) * 12.8, -1);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.Float32BufferAttribute(ticks, 3));
    this.decor.add(new THREE.LineSegments(tg, addMat(0.2)));

    const cross = new THREE.BufferGeometry();
    cross.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-0.6, 0, -1, 0.6, 0, -1, 0, -0.6, -1, 0, 0.6, -1], 3),
    );
    this.decor.add(new THREE.LineSegments(cross, addMat(0.3)));

    this.scene.add(this.decor);
  }

  private buildSweep(): void {
    this.sweepGroup = new THREE.Group();
    this.sweepGroup.renderOrder = 2;

    // leque: vértice no centro + arco no rim. O ângulo e o raio são
    // reconstruídos no shader a partir da posição — gradiente limpo,
    // sem emenda no ápice.
    const segments = 96;
    const verts: number[] = [0, 0, 0.5];
    for (let i = 0; i <= segments; i++) {
      const a = -TRAIL + TRAIL * (i / segments);
      verts.push(Math.cos(a) * SWEEP_RADIUS, Math.sin(a) * SWEEP_RADIUS, 0.5);
    }
    const idx: number[] = [];
    for (let i = 1; i <= segments; i++) idx.push(0, i, i + 1);

    const wedge = new THREE.BufferGeometry();
    wedge.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    wedge.setIndex(idx);

    this.sweepMat = new THREE.ShaderMaterial({
      vertexShader: SWEEP_VERT,
      fragmentShader: SWEEP_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(0xcf9b1e) },
        uColorHot: { value: new THREE.Color(0xd99f1c) },
        uOpacity: { value: 1 },
        uTime: { value: 0 },
        uMotion: { value: this.reducedMotion ? 0 : 1 },
        uBoost: { value: 0 },
      },
    });
    this.sweepGroup.add(new THREE.Mesh(wedge, this.sweepMat));

    this.scene.add(this.sweepGroup);
  }

  private buildSphere(): void {
    this.sphereMat = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: SPHERE_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uColB: { value: new THREE.Color(0x0c0a07) },
        uColL: { value: new THREE.Color(0x4a3a22) },
        uRim: { value: new THREE.Color(0xd9a441) },
        uOpacity: { value: 1 },
        uPulse: { value: 0 },
        uTime: { value: 0 },
        uMotion: { value: this.reducedMotion ? 0 : 1 },
        uGateDark: { value: 0 },
      },
    });
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), this.sphereMat);
    this.sphere.position.copy(SP);
    this.sphere.scale.setScalar(0.05);
    this.sphere.renderOrder = 3;
    this.sphere.frustumCulled = false;
    this.scene.add(this.sphere);

    // corona de atmosfera — casca BackSide ligeiramente maior, filha da
    // esfera (herda a escala .05→11); só acende pelo gate de escuridão
    this.atmoMat = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: ATMO_FRAG,
      transparent: true,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uRim: { value: new THREE.Color(0xe0b25a) },
        uOpacity: { value: 1 },
        uGateDark: { value: 0 },
      },
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), this.atmoMat);
    atmo.scale.setScalar(1.07);
    atmo.renderOrder = 2;
    atmo.frustumCulled = false;
    this.sphere.add(atmo);
  }

  /* ── loop ────────────────────────────────────────────────── */

  private animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    this.sweepAngle += dt * SWEEP_SPEED;
    this.updateCharges(dt);
    this.mouse.lerp(this.mouseTarget, 0.12);

    this.applyJourney(this.journey, t);
    this.applyUniverse(t);
    // energia de rolagem amortecida + decaimento do boost do sweep, então
    // o FOV é resolvido uma única vez (depois de journey/universe somarem)
    this.vel += (this.velTarget - this.vel) * 0.1;
    if (this.sweepBoost > 0) this.sweepBoost = Math.max(0, this.sweepBoost - dt * 2.4);
    this.applyFov();
    this.updateFrameUniforms(t);
    this.camera.updateMatrixWorld();
    this.computeLabels();

    this.renderer.render(this.scene, this.camera);

    this.sweepBearing = ((this.sweepAngle % TWO_PI) / TWO_PI) * 360;
    if (this.onFrame) this.onFrame(this);
  };

  private updateCharges(dt: number): void {
    const delta = this.sweepAngle - this.prevSweep;
    const decay = dt / CHARGE_LIFE;
    for (let i = 0; i < POINT_COUNT; i++) {
      let c = this.charges[i] - decay;
      if (c < 0) c = 0;
      let behind = (this.sweepAngle - this.angles[i]) % TWO_PI;
      if (behind < 0) behind += TWO_PI;
      if (behind < delta) c = 1;
      this.charges[i] = c;
    }
    this.chargeAttr.needsUpdate = true;
    this.prevSweep = this.sweepAngle;
  }

  /** uniformes que mudam todo frame (independente do scroll). */
  private updateFrameUniforms(t: number): void {
    const u = this.pointMat.uniforms;
    u.uTime.value = t;
    (u.uMouse.value as THREE.Vector2).set(this.mouse.x * this.aspect, this.mouse.y);
    this.sweepGroup.rotation.z = this.sweepAngle;
    const s = this.sweepMat.uniforms;
    s.uTime.value = t;
    // o sweep reage à velocidade de rolagem (instrumento "sente" o ritmo)
    s.uBoost.value = this.sweepBoost + this.vel * 0.8;
    this.sphereMat.uniforms.uTime.value = t;
  }

  /** A jornada — câmera, esfera e estado do campo em função de p. */
  private applyJourney(p: number, t: number): void {
    const dive = clamp01(p / 0.42);
    const home = clamp01((p - 0.42) / 0.28);
    const cross = clamp01((p - 0.7) / 0.16);
    const inside = clamp01((p - 0.86) / 0.14);
    const eDive = smooth(dive);
    const eHome = smooth(home);
    const eCross = smooth(cross);
    const eInside = smooth(inside);
    // o interior só clareia DEPOIS das palavras surgirem: a esfera
    // segura o preto até 0.93 e então abre suavemente para o papel
    const clear = smooth(clamp01((p - 0.93) / 0.07));

    // GL-05 — batimento global (CPU), espelha o do shader no centro
    // (rDist≈0); alimenta o throb de FOV sentido e o pulso da esfera.
    const period = 1.15 + Math.sin(t * 0.2) * 0.05 * this.motionScalar;
    const bphase = (((t / period) % 1) + 1) % 1;
    const lub = Math.exp(-Math.pow((bphase - 0.05) * 13.0, 2.0));
    const dub = Math.exp(-Math.pow((bphase - 0.2) * 15.0, 2.0)) * 0.58;
    this.beat = Math.min(lub + dub, 1.0);
    // throb de FOV — soma no acumulador (applyFov é o dono único);
    // zerado no interior e sob reduced-motion
    this.fovThrob = this.beat * 0.18 * (1 - eInside) * this.motionScalar;

    // ── câmera ──
    if (p < 0.42) {
      this.camPos.set(
        lerp(0, SP.x * 0.45, eDive),
        lerp(0, SP.y * 0.45, eDive),
        lerp(16, 9.2, eDive),
      );
    } else if (p < 0.7) {
      this.camPos.set(
        lerp(SP.x * 0.45, SP.x, eHome),
        lerp(SP.y * 0.45, SP.y, eHome),
        lerp(9.2, SP.z + 3.4, eHome),
      );
    } else {
      this.camPos.set(SP.x, SP.y, SP.z + 3.4);
    }
    if (!this.reducedMotion) {
      const calm = 1 - eInside;
      this.camPos.x += Math.sin(t * 0.12) * 0.34 * calm;
      this.camPos.y += Math.cos(t * 0.1) * 0.25 * calm;
    }
    this.camera.position.copy(this.camPos);
    const lookT = smooth(clamp01(p / 0.66));
    this.camLook.set(SP.x * lookT, SP.y * lookT, SP.z * lookT);
    this.camera.lookAt(this.camLook);

    // ── esfera-empresa ──
    let sScale: number;
    if (p < 0.42) sScale = lerp(0.05, 0.13, eDive);
    else if (p < 0.7) sScale = lerp(0.13, 1.05, eHome);
    else if (p < 0.86) sScale = lerp(1.05, 11.0, eCross);
    else sScale = 11.0;
    this.sphere.scale.setScalar(sScale);
    this.sphereMat.uniforms.uOpacity.value = 1 - clear;
    // GL-04 — gate de escuridão (só acende na travessia, morre no clear)
    // + brasa pulsando com o batimento; a atmosfera segue a esfera
    const gateDark = eCross * (1 - clear);
    this.sphereMat.uniforms.uGateDark.value = gateDark;
    // brasa fraca quando a empresa é um ponto distante, cheia ao aproximar
    this.sphereMat.uniforms.uPulse.value =
      (0.35 + this.beat * 0.5) * (0.45 + 0.55 * eDive);
    this.atmoMat.uniforms.uGateDark.value = gateDark;
    this.atmoMat.uniforms.uOpacity.value = 1 - clear;

    // ── estado do campo ──
    let fOp: number;
    if (p < 0.42) fOp = 1;
    else if (p < 0.7) fOp = lerp(1, 0.5, eHome);
    else if (p < 0.86) fOp = lerp(0.5, 0.2, eCross);
    else fOp = lerp(0.2, 0.5, clear);

    const soft = smooth(clamp01((p - 0.66) / 0.3));
    const dive3d = smooth(clamp01(p / 0.55)) * (1 - soft);

    const u = this.pointMat.uniforms;
    u.uOpacity.value = fOp;
    u.uSoft.value = soft;
    u.uDive.value = dive3d;

    // ── instrumento (anéis + varredura) some ao mirar a empresa ──
    const instr = 1 - eHome;
    for (const d of this.decorMats) d.m.opacity = d.base * instr;
    this.sweepMat.uniforms.uOpacity.value = instr;
  }

  /** Capítulo 4 — a câmera recua do Interior para a vista geral: a
   *  empresa volta a ser um ponto, e o campo inteiro se revela. */
  private applyUniverse(t: number): void {
    const u = this.universe;
    if (u <= 0) return;
    const e = smooth(clamp01(u / 0.8));

    // câmera recua e reenquadra todo o campo
    this.camera.position.x = lerp(this.camera.position.x, 0, e);
    this.camera.position.y = lerp(this.camera.position.y, 0, e);
    this.camera.position.z = lerp(this.camera.position.z, 18, e);
    if (!this.reducedMotion) {
      this.camera.position.x += Math.sin(t * 0.08) * 0.5 * e;
      this.camera.position.y += Math.cos(t * 0.07) * 0.35 * e;
    }
    this.camLook.set(lerp(SP.x, 0, e), lerp(SP.y, 0, e), lerp(SP.z, -2, e));
    this.camera.lookAt(this.camLook);

    // o campo sai do desfoque do Interior e ganha presença plena
    const pu = this.pointMat.uniforms;
    pu.uSoft.value = lerp(pu.uSoft.value, 0, e);
    pu.uOpacity.value = lerp(pu.uOpacity.value, 1, e);
  }

  /** Dono único do FOV por frame — todas as contribuições somam aqui,
   *  com uma só chamada a updateProjectionMatrix (evita ratchet/drift). */
  private applyFov(): void {
    const fov = this.baseFov - this.fovThrob - this.fovThud + this.fovWiden;
    if (Math.abs(this.camera.fov - fov) > 0.0015) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Pontos resolvidos perto do cursor — só no começo da jornada. */
  private computeLabels(): void {
    this.cursorLabels.length = 0;
    if (this.journey > 0.4 || this.mouseTarget.x < -5) return;

    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const mx = this.mouse.x * this.aspect;
    const my = this.mouse.y;

    const cand: Array<{ i: number; d: number; ndcx: number; ndcy: number }> = [];
    for (let i = 0; i < POINT_COUNT; i++) {
      this.projV.set(
        this.basePositions[i * 3],
        this.basePositions[i * 3 + 1],
        this.basePositions[i * 3 + 2],
      );
      this.projV.project(this.camera);
      const ax = this.projV.x * this.aspect;
      const d = Math.hypot(ax - mx, this.projV.y - my);
      if (d < MOUSE_RADIUS) {
        cand.push({ i, d, ndcx: this.projV.x, ndcy: this.projV.y });
      }
    }
    cand.sort((a, b) => a.d - b.d);

    const picked: Array<{ px: number; py: number }> = [];
    for (const c of cand) {
      if (picked.length >= 4) break;
      const px = (c.ndcx * 0.5 + 0.5) * w;
      const py = (-c.ndcy * 0.5 + 0.5) * h;
      let ok = true;
      for (const pk of picked) {
        if (Math.hypot(px - pk.px, py - pk.py) < 78) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      picked.push({ px, py });
      this.cursorLabels.push({
        x: px + 13,
        y: py - 11,
        value: this.values[c.i],
        strength: 1 - c.d / MOUSE_RADIUS,
      });
    }
  }
}
