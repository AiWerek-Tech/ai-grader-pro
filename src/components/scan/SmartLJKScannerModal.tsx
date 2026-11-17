'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera, X, Zap, ZapOff, RefreshCw, CheckCircle2,
  AlertTriangle, Sparkles, RotateCw, Layers, ScanLine,
  SlidersHorizontal, ImagePlus, ShieldCheck, Smartphone, Check
} from 'lucide-react';
import { toast } from 'sonner';

interface SmartLJKScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureFiles: (files: File[], autoStartScan?: boolean) => void;
  kunciTitle?: string;
  totalSoal?: number;
}

type EnhanceMode = 'ai_natural' | 'high_contrast' | 'original';

interface FrameDiagnostics {
  brightness: number;       // 0 - 255
  sharpness: number;        // 0 - 100
  motionDelta: number;      // 0 - 100 (lower = steadier)
  paperDetected: boolean;
  cornersAligned: [boolean, boolean, boolean, boolean]; // TL, TR, BL, BR
  qrNis: string;
  statusText: string;
  statusLevel: 'ready' | 'adjust' | 'warning';
}

export function SmartLJKScannerModal({
  isOpen,
  onClose,
  onCaptureFiles,
  kunciTitle = 'Ujian Aktif',
  totalSoal = 40,
}: SmartLJKScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hardwareCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const prevFrameGrayRef = useRef<Uint8Array | null>(null);
  const lockCounterRef = useRef<number>(0);
  const isCapturingRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Camera state
  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'fallback_lan' | 'error'>('initializing');
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string>('');
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [autoCapture, setAutoCapture] = useState<boolean>(true);
  const [batchMode, setBatchMode] = useState<boolean>(false);
  const [enhanceMode, setEnhanceMode] = useState<EnhanceMode>('original');
  const [capturedCount, setCapturedCount] = useState<number>(0);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [lockProgress, setLockProgress] = useState<number>(0); // 0..100
  const [showLanTip, setShowLanTip] = useState<boolean>(false);

  // Post-capture review state (for reviewing/rotating if needed)
  const [reviewImage, setReviewImage] = useState<{
    originalDataUrl: string;
    processedDataUrl: string;
    diagnostics: FrameDiagnostics;
    rotation: number;
  } | null>(null);
  const [processingCapture, setProcessingCapture] = useState<boolean>(false);

  const [diagnostics, setDiagnostics] = useState<FrameDiagnostics>({
    brightness: 140,
    sharpness: 80,
    motionDelta: 0,
    paperDetected: false,
    cornersAligned: [false, false, false, false],
    qrNis: '',
    statusText: 'Arahkan kamera ke lembar LJK',
    statusLevel: 'adjust',
  });

  // ─── Stop WebRTC Stream ─────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      streamRef.current = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  // ─── Start WebRTC Stream ────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    stopStream();
    setCameraState('initializing');
    setCameraErrorMsg('');

    if (typeof window === 'undefined') return;

    // Check if navigator.mediaDevices.getUserMedia is available
    // (Note: Browsers block getUserMedia on plain HTTP LAN IPs like http://192.168.x.x unless flag/HTTPS is used)
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setCameraState('fallback_lan');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
        const caps = videoTrack.getCapabilities() as any;
        if (caps && caps.torch) {
          setTorchSupported(true);
        }
      }

      setCameraState('active');
    } catch (err: any) {
      console.warn('WebRTC camera fallback:', err?.message || err);
      setCameraErrorMsg(err?.message || 'Akses kamera langsung dibatasi oleh browser pada koneksi HTTP lokal.');
      setCameraState('fallback_lan');
    }
  }, [stopStream]);

  useEffect(() => {
    if (isOpen) {
      setCapturedCount(0);
      setReviewImage(null);
      lockCounterRef.current = 0;
      setLockProgress(0);
      startCamera();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]);

  // ─── Toggle Flashlight / Torch ──────────────────────────────────────────────
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as any],
      });
      setTorchOn(next);
    } catch {
      toast.error('Lampu flash tidak didukung pada perangkat ini.');
    }
  };

  // ─── Smart Document Image Enhancer & Auto-Cropper ───────────────────────────
  const processAndEnhanceImage = useCallback(
    async (
      sourceCanvas: HTMLCanvasElement,
      mode: EnhanceMode,
      rotationDeg: number = 0
    ): Promise<{ dataUrl: string; diag: FrameDiagnostics }> => {
      const srcW = sourceCanvas.width;
      const srcH = sourceCanvas.height;

      // Apply rotation if requested
      const rotatedCanvas = document.createElement('canvas');
      if (rotationDeg % 180 !== 0) {
        rotatedCanvas.width = srcH;
        rotatedCanvas.height = srcW;
      } else {
        rotatedCanvas.width = srcW;
        rotatedCanvas.height = srcH;
      }
      const rCtx = rotatedCanvas.getContext('2d')!;
      rCtx.save();
      rCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
      rCtx.rotate((rotationDeg * Math.PI) / 180);
      rCtx.drawImage(sourceCanvas, -srcW / 2, -srcH / 2);
      rCtx.restore();

      // Resize to 1024px (Single-Tile Native Gemini Vision resolution: 768x1024, ~100KB, zero tile-splitting & 3x faster!)
      const MAX_DIM = 1024;
      let targetW = rotatedCanvas.width;
      let targetH = rotatedCanvas.height;
      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * MAX_DIM) / targetW);
          targetW = MAX_DIM;
        } else {
          targetW = Math.round((targetW * MAX_DIM) / targetH);
          targetH = MAX_DIM;
        }
      }

      const outCanvas = document.createElement('canvas');
      outCanvas.width = targetW;
      outCanvas.height = targetH;
      const ctx = outCanvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(rotatedCanvas, 0, 0, targetW, targetH);

      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const data = imgData.data;
      const pixelCount = targetW * targetH;

      // Compute luminance histogram & sharpness
      let lumSum = 0;
      const gray = new Uint8Array(pixelCount);
      const hist = new Uint32Array(256);

      for (let i = 0; i < pixelCount; i++) {
        const offset = i * 4;
        const g = Math.round(data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114);
        gray[i] = g;
        lumSum += g;
        hist[g]++;
      }

      const avgBrightness = Math.round(lumSum / Math.max(1, pixelCount));

      // Compute edge sharpness (Sobel-like gradient on central region)
      let gradSum = 0;
      let gradSamples = 0;
      const step = 4;
      for (let y = Math.floor(targetH * 0.15); y < Math.floor(targetH * 0.85); y += step) {
        for (let x = Math.floor(targetW * 0.15); x < Math.floor(targetW * 0.85); x += step) {
          const idx = y * targetW + x;
          const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
          const gy = Math.abs(gray[idx + targetW] - gray[idx - targetW]);
          gradSum += gx + gy;
          gradSamples++;
        }
      }
      const rawSharpness = gradSamples > 0 ? gradSum / gradSamples : 0;
      const sharpnessScore = Math.min(100, Math.round(rawSharpness * 2.6));

      // Try QR code decode on bottom-right quadrant + full image
      let qrNis = '';
      try {
        const qrDetected = jsQR(data, targetW, targetH);
        if (qrDetected?.data) {
          try {
            const parsed = JSON.parse(qrDetected.data);
            qrNis = String(parsed.s || parsed.id || '').trim();
          } catch {
            qrNis = qrDetected.data.trim();
          }
        }
      } catch {}

      // Apply enhancement filter if mode !== 'original'
      if (mode !== 'original') {
        // Find 2nd and 98th percentile luminance for adaptive contrast stretching
        let lowCut = 10;
        let highCut = 245;
        let acc = 0;
        for (let v = 0; v < 256; v++) {
          acc += hist[v];
          if (acc >= pixelCount * 0.02) {
            lowCut = v;
            break;
          }
        }
        acc = 0;
        for (let v = 255; v >= 0; v--) {
          acc += hist[v];
          if (acc >= pixelCount * 0.03) {
            highCut = v;
            break;
          }
        }

        const range = Math.max(40, highCut - lowCut);

        for (let i = 0; i < pixelCount; i++) {
          const offset = i * 4;
          for (let c = 0; c < 3; c++) {
            let val = ((data[offset + c] - lowCut) * 255) / range;
            val = Math.max(0, Math.min(255, val));
            if (mode === 'high_contrast') {
              // S-curve boost for crisp black marks on white paper
              const norm = val / 255;
              const curved = norm < 0.5
                ? 2 * norm * norm
                : 1 - Math.pow(-2 * norm + 2, 2) / 2;
              val = Math.round(curved * 255);
            } else {
              // Mild gamma correction for natural AI Vision clarity
              if (val > 210) val = Math.min(255, val * 1.04);
              else if (val < 90) val = Math.max(0, val * 0.90);
            }
            data[offset + c] = val;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      const isGoodLight = avgBrightness >= 65 && avgBrightness <= 242;
      const isSharpEnough = sharpnessScore >= 24;

      const diag: FrameDiagnostics = {
        brightness: avgBrightness,
        sharpness: sharpnessScore,
        motionDelta: 0,
        paperDetected: isGoodLight && isSharpEnough,
        cornersAligned: [true, true, true, true],
        qrNis,
        statusText: !isGoodLight
          ? 'Pencahayaan kurang optimal, namun telah ditingkatkan otomatis.'
          : !isSharpEnough
            ? 'Foto agak buram. Pastikan tulisan dan bulatan terlihat jelas.'
            : 'Kualitas dokumen LJK sangat tajam & siap dinilai AI!',
        statusLevel: isGoodLight && isSharpEnough ? 'ready' : 'adjust',
      };

      return {
        dataUrl: outCanvas.toDataURL('image/jpeg', 0.92),
        diag,
      };
    },
    []
  );

  // ─── Convert DataURL to File ────────────────────────────────────────────────
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // ─── Capture Current Video Frame ────────────────────────────────────────────
  const captureLiveFrame = useCallback(async () => {
    if (!videoRef.current || isCapturingRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    isCapturingRef.current = true;
    setShutterFlash(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(45); } catch {}
    }
    setTimeout(() => setShutterFlash(false), 180);

    try {
      // Crop to the A4 document guide region shown in the viewfinder
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const targetAspect = 1000 / 1414; // A4 portrait

      let cropW = vw * 0.88;
      let cropH = cropW / targetAspect;
      if (cropH > vh * 0.88) {
        cropH = vh * 0.88;
        cropW = cropH * targetAspect;
      }
      const cropX = Math.max(0, Math.round((vw - cropW) / 2));
      const cropY = Math.max(0, Math.round((vh - cropH) / 2));

      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = Math.round(cropW);
      rawCanvas.height = Math.round(cropH);
      const ctx = rawCanvas.getContext('2d')!;
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, rawCanvas.width, rawCanvas.height);

      const { dataUrl } = await processAndEnhanceImage(rawCanvas, enhanceMode, 0);
      const file = dataUrlToFile(dataUrl, `LJK_SCAN_${Date.now()}.jpg`);

      setCapturedCount((c) => c + 1);
      onCaptureFiles([file], true);

      if (!batchMode) {
        onClose();
      } else {
        toast.success('📸 LJK berhasil dipotret & langsung dianalisis AI!');
      }
    } catch (e: any) {
      toast.error('Gagal memotret: ' + e.message);
    } finally {
      lockCounterRef.current = 0;
      setLockProgress(0);
      setTimeout(() => {
        isCapturingRef.current = false;
      }, 900);
    }
  }, [batchMode, enhanceMode, onCaptureFiles, onClose, processAndEnhanceImage]);

  // ─── Real-Time Frame Analysis Loop (10 FPS) ─────────────────────────────────
  useEffect(() => {
    if (!isOpen || cameraState !== 'active' || reviewImage) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (!video || !canvas || video.readyState < 2 || isCapturingRef.current) return;

      const w = 240;
      const h = 340;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, w, h);
      const frame = ctx.getImageData(0, 0, w, h);
      const data = frame.data;
      const total = w * h;
      const gray = new Uint8Array(total);

      let sumLum = 0;
      for (let i = 0; i < total; i++) {
        const off = i * 4;
        const g = (data[off] * 77 + data[off + 1] * 150 + data[off + 2] * 29) >> 8;
        gray[i] = g;
        sumLum += g;
      }
      const brightness = Math.round(sumLum / total);

      // Motion delta against previous frame
      let motionDiff = 0;
      if (prevFrameGrayRef.current && prevFrameGrayRef.current.length === total) {
        const prev = prevFrameGrayRef.current;
        let diffSum = 0;
        for (let i = 0; i < total; i += 4) {
          diffSum += Math.abs(gray[i] - prev[i]);
        }
        motionDiff = Math.round(diffSum / (total / 4));
      }
      prevFrameGrayRef.current = gray;

      // Sharpness (gradient energy in center paper area)
      let edgeSum = 0;
      let edgeCount = 0;
      let centerBrightSum = 0;
      for (let y = Math.floor(h * 0.15); y < Math.floor(h * 0.85); y += 2) {
        for (let x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x += 2) {
          const idx = y * w + x;
          edgeSum += Math.abs(gray[idx + 1] - gray[idx - 1]) + Math.abs(gray[idx + w] - gray[idx - w]);
          centerBrightSum += gray[idx];
          edgeCount++;
        }
      }
      const sharpness = Math.min(100, Math.round((edgeSum / Math.max(1, edgeCount)) * 2.5));
      const centerBrightness = centerBrightSum / Math.max(1, edgeCount);

      // Check 4 corner regions for fiducial / border contrast
      const checkCornerContrast = (cx: number, cy: number, cw: number, ch: number) => {
        let minG = 255;
        let maxG = 0;
        for (let y = cy; y < cy + ch; y++) {
          for (let x = cx; x < cx + cw; x++) {
            const g = gray[y * w + x];
            if (g < minG) minG = g;
            if (g > maxG) maxG = g;
          }
        }
        return (maxG - minG) > 55;
      };

      const padX = Math.floor(w * 0.08);
      const padY = Math.floor(h * 0.08);
      const boxW = Math.floor(w * 0.22);
      const boxH = Math.floor(h * 0.20);

      const tl = checkCornerContrast(padX, padY, boxW, boxH);
      const tr = checkCornerContrast(w - padX - boxW, padY, boxW, boxH);
      const bl = checkCornerContrast(padX, h - padY - boxH, boxW, boxH);
      const br = checkCornerContrast(w - padX - boxW, h - padY - boxH, boxW, boxH);
      const alignedCount = [tl, tr, bl, br].filter(Boolean).length;

      // Check QR in bottom-right corner
      let detectedQr = '';
      try {
        const qr = jsQR(data, w, h);
        if (qr?.data) {
          try {
            const p = JSON.parse(qr.data);
            detectedQr = String(p.s || p.id || '').trim();
          } catch {
            detectedQr = qr.data.trim();
          }
        }
      } catch {}

      const isGoodLight = brightness >= 65 && brightness <= 240 && centerBrightness >= 95;
      const isSteady = motionDiff <= 9;
      const isSharp = sharpness >= 28;
      const paperDetected = isGoodLight && isSharp && alignedCount >= 3;

      let statusText = 'Posisikan 4 sudut LJK di dalam bingkai';
      let statusLevel: 'ready' | 'adjust' | 'warning' = 'adjust';

      if (brightness < 65) {
        statusText = 'Cahaya terlalu gelap — nyalakan Flash atau cari tempat terang';
        statusLevel = 'warning';
      } else if (!isSteady) {
        statusText = 'Tahan ponsel dengan stabil (jangan goyang)...';
        statusLevel = 'adjust';
      } else if (!isSharp) {
        statusText = 'Menunggu fokus kamera tajam pada bulatan LJK...';
        statusLevel = 'adjust';
      } else if (paperDetected && isSteady) {
        statusText = detectedQr
          ? `✓ Dokumen Terkunci (NIS: ${detectedQr}) — Memotret Otomatis...`
          : '✓ Dokumen LJK Terdeteksi Tajam & Presisi!';
        statusLevel = 'ready';
      }

      setDiagnostics({
        brightness,
        sharpness,
        motionDelta: motionDiff,
        paperDetected,
        cornersAligned: [tl, tr, bl, br],
        qrNis: detectedQr,
        statusText,
        statusLevel,
      });

      // Auto-capture lock progression
      if (autoCapture && paperDetected && isSteady) {
        lockCounterRef.current += 1;
        const pct = Math.min(100, Math.round((lockCounterRef.current / 4) * 100));
        setLockProgress(pct);
        if (lockCounterRef.current >= 4) {
          lockCounterRef.current = 0;
          setLockProgress(0);
          captureLiveFrame();
        }
      } else {
        lockCounterRef.current = Math.max(0, lockCounterRef.current - 1);
        setLockProgress(Math.min(100, Math.round((lockCounterRef.current / 4) * 100)));
      }
    }, 180);

    return () => clearInterval(interval);
  }, [autoCapture, cameraState, captureLiveFrame, isOpen, reviewImage]);

  // ─── Handle Hardware Camera / File Input ────────────────────────────────────
  const handleHardwareCapture = async (incomingFiles: File[]) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    const files = incomingFiles.filter((f) => f.type.startsWith('image/') || f.name.match(/\.(jpe?g|png|webp|heic)$/i));
    if (files.length === 0) {
      toast.error('Pilih atau potret file gambar yang valid.');
      return;
    }

    // If multiple files selected from gallery, enhance all and send directly
    if (files.length > 1) {
      setProcessingCapture(true);
      try {
        const processedFiles: File[] = [];
        for (const f of files) {
          const canvas = await fileToCanvas(f);
          const { dataUrl } = await processAndEnhanceImage(canvas, enhanceMode, 0);
          processedFiles.push(dataUrlToFile(dataUrl, f.name));
        }
        onCaptureFiles(processedFiles, true);
        onClose();
      } catch (e: any) {
        toast.error('Gagal memproses foto: ' + e.message);
      } finally {
        setProcessingCapture(false);
      }
      return;
    }

    // Single photo from Hardware Camera: enhance & either auto-grade (and close modal to show progress!) or show review screen
    setProcessingCapture(true);
    try {
      const file = files[0];
      const canvas = await fileToCanvas(file);
      const originalDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const { dataUrl: processedDataUrl, diag } = await processAndEnhanceImage(canvas, enhanceMode, 0);

      if (autoCapture) {
        const outFile = dataUrlToFile(processedDataUrl, `LJK_CAM_${Date.now()}.jpg`);
        setCapturedCount((c) => c + 1);
        onCaptureFiles([outFile], true);
        if (!batchMode) {
          onClose();
        } else {
          toast.success('📸 LJK masuk antrian & sedang dianalisis AI! Silakan potret lembar berikutnya.');
        }
      } else {
        // Show smart preview so teacher can inspect, rotate, or confirm
        setReviewImage({
          originalDataUrl,
          processedDataUrl,
          diagnostics: diag,
          rotation: 0,
        });
      }
    } catch (e: any) {
      toast.error('Gagal memproses citra kamera: ' + e.message);
    } finally {
      setProcessingCapture(false);
    }
  };

  // ─── Rotate or Change Filter in Review Mode ─────────────────────────────────
  const updateReviewImage = async (nextRotation: number, nextMode: EnhanceMode) => {
    if (!reviewImage) return;
    setProcessingCapture(true);
    try {
      const img = new window.Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
        img.src = reviewImage.originalDataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);

      const { dataUrl, diag } = await processAndEnhanceImage(canvas, nextMode, nextRotation);
      setReviewImage({
        ...reviewImage,
        processedDataUrl: dataUrl,
        diagnostics: diag,
        rotation: nextRotation,
      });
    } finally {
      setProcessingCapture(false);
    }
  };

  const confirmReviewImage = () => {
    if (!reviewImage) return;
    const outFile = dataUrlToFile(reviewImage.processedDataUrl, `LJK_SMART_${Date.now()}.jpg`);
    setCapturedCount((c) => c + 1);
    onCaptureFiles([outFile], true);
    setReviewImage(null);
    if (!batchMode) {
      onClose();
    } else {
      toast.success('📸 LJK dikirim ke antrian & langsung dinilai AI!');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Hidden inputs for Native Hardware Camera & Gallery */}
      <input
        ref={hardwareCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          handleHardwareCapture(picked);
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          handleHardwareCapture(picked);
        }}
      />
      <canvas ref={analysisCanvasRef} className="hidden" />

      {/* Shutter Flash Effect */}
      {shutterFlash && (
        <div className="fixed inset-0 z-[160] bg-white animate-out fade-out duration-200 pointer-events-none" />
      )}

      {/* ── TOP HUD BAR ── */}
      <div className="px-4 py-3 bg-slate-950/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between gap-2 z-20 pt-safe">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400 shrink-0">
            <ScanLine className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black tracking-tight text-white truncate flex items-center gap-1.5">
              <span>AI Smart Document Scanner</span>
              {capturedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                  {capturedCount} Terpotret
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {kunciTitle} ({totalSoal} Soal)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {torchSupported && cameraState === 'active' && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                torchOn
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30'
                  : 'bg-white/5 text-slate-300 border-white/10'
              }`}
              title="Lampu Flash"
            >
              {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setBatchMode((v) => !v)}
            className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 ${
              batchMode
                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
            title="Mode Beruntun (Batch Scan)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Beruntun:</span> {batchMode ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-white/10 transition-all active:scale-95"
            aria-label="Tutup Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── MAIN BODY: REVIEW MODE OR CAMERA VIEWFINDER ── */}
      {reviewImage ? (
        <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto p-4 space-y-4 touch-scroll">
          <div className="flex items-center justify-between bg-slate-900/90 border border-white/10 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              {reviewImage.diagnostics.statusLevel === 'ready' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-black text-white">
                  {reviewImage.diagnostics.statusText}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-3 mt-0.5">
                  <span>Ketajaman: <b>{reviewImage.diagnostics.sharpness}%</b></span>
                  <span>Cahaya: <b>{reviewImage.diagnostics.brightness}</b></span>
                  {reviewImage.diagnostics.qrNis && (
                    <span className="text-emerald-400 font-bold">✓ QR NIS: {reviewImage.diagnostics.qrNis}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Image Preview */}
          <div className="flex-1 min-h-[280px] bg-black/60 border border-white/10 rounded-2xl p-3 flex items-center justify-center overflow-hidden relative">
            {processingCapture && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center gap-2 text-xs font-black text-violet-300">
                <RefreshCw className="w-5 h-5 animate-spin" /> Memproses Dokumen...
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reviewImage.processedDataUrl}
              alt="Hasil Scan LJK"
              className="max-h-[52vh] w-auto object-contain rounded-xl shadow-2xl border border-white/15"
            />
          </div>

          {/* Filter & Rotation Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-white/10 rounded-2xl p-3">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400 mr-1" />
              {(
                [
                  { id: 'ai_natural', label: '✨ AI Crisp' },
                  { id: 'high_contrast', label: '⚫ Kontras Tinggi' },
                  { id: 'original', label: '🖼️ Asli' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setEnhanceMode(m.id);
                    updateReviewImage(reviewImage.rotation, m.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    enhanceMode === m.id
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => updateReviewImage((reviewImage.rotation + 90) % 360, enhanceMode)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 text-slate-200 active:scale-95"
            >
              <RotateCw className="w-3.5 h-3.5" /> Putar 90°
            </button>
          </div>

          {/* Confirm / Retake Buttons */}
          <div className="grid grid-cols-2 gap-3 pb-safe">
            <button
              type="button"
              onClick={() => setReviewImage(null)}
              className="py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 font-black text-xs uppercase tracking-wider text-slate-300 active:scale-95"
            >
              Potret Ulang
            </button>
            <button
              type="button"
              onClick={confirmReviewImage}
              className="py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-black text-xs uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-95"
            >
              <Check className="w-4 h-4" /> Gunakan &amp; Scan AI
            </button>
          </div>
        </div>
      ) : cameraState === 'active' ? (
        /* ── LIVE WEBRTC SMART VIEWFINDER ── */
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />

          {/* Dark Vignette & A4 Fiducial Alignment Frame */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            {/* Status Pill */}
            <div
              className={`mb-3 px-4 py-2 rounded-2xl backdrop-blur-xl border text-xs font-black tracking-wide flex items-center gap-2 shadow-2xl transition-all ${
                diagnostics.statusLevel === 'ready'
                  ? 'bg-emerald-500/90 text-slate-950 border-emerald-300 scale-105'
                  : diagnostics.statusLevel === 'warning'
                    ? 'bg-rose-500/90 text-white border-rose-300'
                    : 'bg-slate-950/85 text-white border-white/20'
              }`}
            >
              {diagnostics.statusLevel === 'ready' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0 animate-pulse" />
              )}
              <span>{diagnostics.statusText}</span>
            </div>

            {/* A4 Guide Frame (Aspect Ratio 1 : 1.414) */}
            <div className="relative w-full max-w-[340px] aspect-[1000/1414] max-h-[62vh] rounded-2xl border-2 border-white/25 shadow-[0_0_0_9999px_rgba(2,6,23,0.62)] transition-all">
              {/* 4 Fiducial Corner Targets */}
              {[
                { pos: 'top-2 left-2 border-t-4 border-l-4 rounded-tl-lg', ok: diagnostics.cornersAligned[0] },
                { pos: 'top-2 right-2 border-t-4 border-r-4 rounded-tr-lg', ok: diagnostics.cornersAligned[1] },
                { pos: 'bottom-2 left-2 border-b-4 border-l-4 rounded-bl-lg', ok: diagnostics.cornersAligned[2] },
                { pos: 'bottom-2 right-2 border-b-4 border-r-4 rounded-br-lg', ok: diagnostics.cornersAligned[3] },
              ].map((corner, i) => (
                <div
                  key={i}
                  className={`absolute w-8 h-8 transition-colors duration-200 ${corner.pos} ${
                    corner.ok ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]' : 'border-white/70'
                  }`}
                />
              ))}

              {/* Simulated Header & QR Zone Guides inside Frame */}
              <div className="absolute top-[12%] left-[6%] right-[6%] h-[11%] border border-dashed border-white/25 rounded flex items-center justify-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  Area Identitas Peserta
                </span>
              </div>

              <div className="absolute top-[26%] bottom-[13%] left-[6%] right-[6%] border border-dashed border-sky-400/30 rounded flex items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300/40">
                  Area Bulatan Jawaban LJK
                </span>
              </div>

              <div className="absolute bottom-[2%] right-[6%] w-[16%] h-[9%] border border-dashed border-emerald-400/50 rounded flex items-center justify-center bg-emerald-500/10">
                <span className="text-[8px] font-black text-emerald-300/80">QR</span>
              </div>

              {/* Lock Progress Bar when Auto-Capturing */}
              {lockProgress > 0 && (
                <div className="absolute inset-x-6 bottom-4 h-2 bg-black/60 rounded-full overflow-hidden border border-emerald-400/40">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-150"
                    style={{ width: `${lockProgress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Live Telemetry Metrics Bar */}
            <div className="mt-3 flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-slate-950/80 border border-white/10 text-[10px] font-mono text-slate-300">
              <span>Cahaya: <b className={diagnostics.brightness >= 65 ? 'text-emerald-400' : 'text-rose-400'}>{diagnostics.brightness}</b></span>
              <span>•</span>
              <span>Fokus: <b className={diagnostics.sharpness >= 28 ? 'text-emerald-400' : 'text-amber-400'}>{diagnostics.sharpness}%</b></span>
              <span>•</span>
              <span>Sudut: <b className="text-sky-400">{diagnostics.cornersAligned.filter(Boolean).length}/4</b></span>
            </div>
          </div>

          {/* Bottom Camera Controls */}
          <div className="absolute bottom-0 inset-x-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 px-6 py-4 pb-safe flex items-center justify-between gap-4 z-20">
            {/* Left: Auto-Capture Toggle */}
            <button
              type="button"
              onClick={() => setAutoCapture((v) => !v)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl border transition-all active:scale-95 ${
                autoCapture
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-wider">
                Auto-Snap {autoCapture ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Center: Manual Shutter Button */}
            <button
              type="button"
              onClick={captureLiveFrame}
              className="w-18 h-18 rounded-full p-1.5 border-4 border-white/80 hover:border-emerald-400 active:scale-90 transition-all flex items-center justify-center shadow-2xl"
              aria-label="Potret LJK Sekarang"
            >
              <div className="w-14 h-14 rounded-full bg-white hover:bg-emerald-400 transition-colors flex items-center justify-center">
                <Camera className="w-6 h-6 text-slate-950" />
              </div>
            </button>

            {/* Right: Switch to Hardware Camera / Gallery */}
            <button
              type="button"
              onClick={() => hardwareCameraInputRef.current?.click()}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all active:scale-95"
            >
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span className="text-[9px] font-black uppercase tracking-wider">Kamera HP</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── SMART HARDWARE CAMERA STUDIO (100% Works on HTTP LAN without HTTPS!) ── */
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 flex flex-col items-center justify-center max-w-xl mx-auto text-center space-y-6 touch-scroll">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/30 border border-white/20">
            <Camera className="w-10 h-10 text-white" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" /> Mode Kamera Pintar LAN Aktif
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Scanner Dokumen LJK Cerdas
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              Menggunakan sensor optik penuh kamera ponsel Anda dengan <b>Autofokus Hardware, Pemrosesan Kontras Dokumen Otomatis, Deteksi QR Siswa, dan Koreksi Rotasi</b>.
            </p>
          </div>

          {/* Filter Mode Selector */}
          <div className="w-full bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Filter Optimasi Dokumen AI
              </span>
              <span className="text-[10px] font-bold text-violet-400">Otomatis Aktif</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'ai_natural', label: '✨ AI Crisp', desc: 'Tajam & Bersih' },
                  { id: 'high_contrast', label: '⚫ Kontras Hitam', desc: 'Tegas untuk 2B' },
                  { id: 'original', label: '🖼️ Citra Asli', desc: 'Tanpa Filter' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setEnhanceMode(m.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    enhanceMode === m.id
                      ? 'bg-violet-600/20 border-violet-500 text-white'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  <div className="text-[11px] font-black">{m.label}</div>
                  <div className="text-[9px] opacity-75 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>

            <label className="flex items-center justify-between pt-2 border-t border-white/10 cursor-pointer">
              <div>
                <div className="text-xs font-black text-white">Langsung Scan AI Otomatis (Zero-Click)</div>
                <div className="text-[10px] text-slate-400">Begitu difoto, langsung dinilai oleh AI tanpa klik tambahan</div>
              </div>
              <input
                type="checkbox"
                checked={autoCapture}
                onChange={(e) => setAutoCapture(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 rounded"
              />
            </label>
          </div>

          {/* Primary Action Buttons */}
          <div className="w-full space-y-3">
            <button
              type="button"
              disabled={processingCapture}
              onClick={() => hardwareCameraInputRef.current?.click()}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 text-white font-black text-sm uppercase tracking-wider shadow-2xl shadow-indigo-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              {processingCapture ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Memproses Dokumen LJK...</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span>Buka Kamera HP &amp; Potret LJK</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={processingCapture}
              onClick={() => galleryInputRef.current?.click()}
              className="w-full py-3.5 px-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 active:scale-95 transition-all"
            >
              <ImagePlus className="w-4 h-4 text-sky-400" />
              <span>Pilih Banyak Foto LJK dari Galeri</span>
            </button>
          </div>

          {/* Optional Tip for Live Viewfinder on HTTP LAN */}
          <div className="w-full pt-2">
            <button
              type="button"
              onClick={() => setShowLanTip((v) => !v)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-200 underline"
            >
              {showLanTip ? 'Sembunyikan Info Live Stream LAN' : 'Ingin mengaktifkan Live Viewfinder di jaringan HTTP Lokal?'}
            </button>
            {showLanTip && (
              <div className="mt-2 p-3.5 rounded-2xl bg-slate-900 border border-white/10 text-left text-[10px] text-slate-300 space-y-1.5 leading-relaxed">
                <p className="font-bold text-amber-300">💡 Tips Chrome Android di Jaringan Lokal (HTTP):</p>
                <p>
                  Tombol <b>&quot;Buka Kamera HP &amp; Potret LJK&quot;</b> di atas sudah langsung bekerja 100% dengan resolusi penuh tanpa pengaturan apa pun.
                </p>
                <p>
                  Jika Anda juga ingin memakai <i>Live Stream Viewfinder</i> di dalam halaman web pada IP lokal: buka <code className="bg-black px-1.5 py-0.5 rounded text-sky-300">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> di Chrome HP, masukkan alamat server (misal <code className="bg-black px-1.5 py-0.5 rounded text-emerald-300">{typeof window !== 'undefined' ? window.location.origin : 'http://192.168.1.62:3000'}</code>), pilih <b>Enabled</b>, lalu Relaunch.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper: Convert File to HTMLCanvasElement ────────────────────────────────
async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context tidak tersedia'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
