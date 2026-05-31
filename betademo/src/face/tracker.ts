import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { FaceMetrics, MetricsSource } from "../game/types";

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
      numFaces: 1,
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

    const shapes = res.faceBlendshapes?.[0]?.categories;
    if (!shapes || shapes.length === 0) {
      // decay toward zero when no face
      this.sBlow *= 0.8;
      this.sSuck *= 0.8;
      this.metrics = { blow: this.sBlow, suck: this.sSuck, hasFace: false };
      return;
    }

    const get = (name: string) =>
      shapes.find((c) => c.categoryName === name)?.score ?? 0;

    const funnel = get("mouthFunnel");
    const pucker = get("mouthPucker");
    const jaw = get("jawOpen");
    const rounded = Math.max(funnel, pucker * 0.9);

    // Blow: funnel/pucker shape while jaw is NOT wide open.
    const rawBlow = rounded * (1 - Math.min(1, jaw * 1.4));
    // Suck: rounded lips / small opening. A wide-open jaw should not count as eating noodles.
    const jawTooOpen = Math.max(0, jaw - 0.12);
    const rawSuck = rounded * (1 - Math.min(1, jawTooOpen * 1.8));

    // EMA smoothing — responsive but not jittery.
    this.sBlow += (norm(rawBlow, 0.08, 0.55) - this.sBlow) * 0.45;
    this.sSuck += (norm(rawSuck, 0.1, 0.58) - this.sSuck) * 0.45;

    this.metrics = {
      blow: clamp01(this.sBlow),
      suck: clamp01(this.sSuck),
      hasFace: true,
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
