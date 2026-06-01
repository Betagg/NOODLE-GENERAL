import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { FaceMetrics, MetricsSource, PlayerFaceMetrics } from "../game/types";

const WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/**
 * Wraps MediaPipe Face Landmarker. Reads blendshapes each frame and exposes
 * two smoothed signals:
 *   blow  — O / funnel mouth (吹气)   = mouthFunnel + mouthPucker, gated by jaw mostly closed
 *   suck  — rounded lips (吸面)       = mouthPucker / mouthFunnel, penalized by wide jawOpen
 */
export class FaceTracker implements MetricsSource {
  private landmarker: FaceLandmarker | null = null;
  private video: HTMLVideoElement;
  private raf = 0;
  private lastVideoTime = -1;
  private metrics: FaceMetrics = { blow: 0, suck: 0, hasFace: false };
  private sBlow = 0;
  private sSuck = 0;
  private playerSmooth = [
    { blow: 0, suck: 0 },
    { blow: 0, suck: 0 },
  ];

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  get(): FaceMetrics {
    return this.metrics;
  }

  async start(onStatus?: (msg: string) => void): Promise<void> {
    onStatus?.("REQUESTING CAMERA…");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();

    onStatus?.("LOADING FACE MODEL…");
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
      runningMode: "VIDEO",
      numFaces: 2,
    });

    onStatus?.("READY");
    this.loop();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const v = this.video;
    if (!this.landmarker || v.readyState < 2) return;
    if (v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;

    let res: FaceLandmarkerResult;
    try {
      res = this.landmarker.detectForVideo(v, performance.now());
    } catch {
      return;
    }

    const faceBlendshapes = res.faceBlendshapes ?? [];
    if (faceBlendshapes.length === 0) {
      // decay toward zero when no face
      this.sBlow *= 0.8;
      this.sSuck *= 0.8;
      for (const smooth of this.playerSmooth) {
        smooth.blow *= 0.8;
        smooth.suck *= 0.8;
      }
      this.metrics = { blow: this.sBlow, suck: this.sSuck, hasFace: false, players: [] };
      return;
    }

    const rawPlayers = faceBlendshapes
      .map((face, index) => {
        const raw = faceMetricsFromShapes(face.categories);
        const centerX = faceCenterX(res, index);
        return { ...raw, x: centerX };
      })
      // The video is mirrored in the UI, so higher raw x appears on the left side of the screen.
      .sort((a, b) => b.x - a.x)
      .slice(0, 2);

    const players: PlayerFaceMetrics[] = rawPlayers.map((raw, index) => {
      const smooth = this.playerSmooth[index];
      smooth.blow += (norm(raw.blow, 0.08, 0.55) - smooth.blow) * 0.45;
      smooth.suck += (norm(raw.suck, 0.1, 0.58) - smooth.suck) * 0.45;
      return {
        blow: clamp01(smooth.blow),
        suck: clamp01(smooth.suck),
        hasFace: true,
        x: raw.x,
      };
    });
    for (let index = players.length; index < this.playerSmooth.length; index++) {
      this.playerSmooth[index].blow *= 0.8;
      this.playerSmooth[index].suck *= 0.8;
    }

    const primary = players[0] ?? { blow: 0, suck: 0, hasFace: false };
    this.sBlow += (primary.blow - this.sBlow) * 0.55;
    this.sSuck += (primary.suck - this.sSuck) * 0.55;

    this.metrics = {
      blow: clamp01(this.sBlow),
      suck: clamp01(this.sSuck),
      hasFace: true,
      players,
    };
  };

  stop() {
    cancelAnimationFrame(this.raf);
    const s = this.video.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    this.landmarker?.close();
  }
}

function norm(v: number, lo: number, hi: number) {
  return clamp01((v - lo) / (hi - lo));
}
function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function faceMetricsFromShapes(shapes: { categoryName: string; score: number }[]) {
  const get = (name: string) =>
    shapes.find((c) => c.categoryName === name)?.score ?? 0;

  const funnel = get("mouthFunnel");
  const pucker = get("mouthPucker");
  const jaw = get("jawOpen");
  const rounded = Math.max(funnel, pucker * 0.9);

  const blow = rounded * (1 - Math.min(1, jaw * 1.4));
  const jawTooOpen = Math.max(0, jaw - 0.12);
  const suck = rounded * (1 - Math.min(1, jawTooOpen * 1.8));
  return { blow, suck };
}

function faceCenterX(result: FaceLandmarkerResult, index: number) {
  const landmarks = result.faceLandmarks?.[index];
  if (!landmarks || landmarks.length === 0) return index;
  return landmarks.reduce((sum, point) => sum + point.x, 0) / landmarks.length;
}
