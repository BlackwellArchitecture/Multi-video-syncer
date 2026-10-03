/**
 * VideoItem: Manages a single camera feed instance
 * Handles local video stream, frame calculations, anchor timestamps, and playback state.
 */

class VideoItem {
  constructor({ id, name, file = null, filePath = null, src = null, fps = 60, anchorTime = 0, size = 0 }) {
    this.id = id;
    this.name = name || `CAM ${id.replace('cam-', '')}`;
    this.file = file;
    this.filePath = filePath || (file && file.path ? file.path : null);
    this.size = size || (file ? file.size : 0);
    this.isDiskStream = false;

    // Use native zero-RAM disk streaming if in desktop app
    if (this.filePath && typeof window !== 'undefined' && window.electronAPI) {
      this.src = window.electronAPI.getStreamUrl(this.filePath);
      this.isDiskStream = true;
    } else {
      this.src = src || (file ? URL.createObjectURL(file) : '');
    }

    this.fps = Number(fps) || 60;
    this.anchorTime = Number(anchorTime) || 0;
    this.anchorSet = anchorTime !== null && !isNaN(anchorTime) && anchorTime !== 0;
    
    this.duration = 0;
    this.videoWidth = 0;
    this.videoHeight = 0;
    this.isLoaded = false;
    this.volume = 1.0;
    this.isMuted = false;

    // DOM References
    this.calibrationVideo = null;
    this.watchVideo = null;
    this.calibrationCard = null;
    this.watchCell = null;
    
    // Status tracking for out-of-bounds relative to anchor
    this.status = 'READY'; // 'READY', 'PRE_RECORDING', 'PLAYING', 'ENDED'
  }

  /**
   * Helper: Format raw bytes into human-readable size
   */
  static formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(2)} ${units[i]}`;
  }

  /**
   * Helper: Format raw seconds into HH:MM:SS.mmm or +/-HH:MM:SS.mmm
   */
  static formatTimecode(seconds, includeSign = false) {
    if (isNaN(seconds)) return '00:00:00.000';
    
    const isNegative = seconds < 0;
    let s = Math.abs(seconds);

    const hours = Math.floor(s / 3600);
    s %= 3600;
    const minutes = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const millis = Math.floor((s - Math.floor(s)) * 1000);

    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const formatted = `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(millis, 3)}`;

    if (includeSign) {
      return (isNegative ? '-' : '+') + formatted;
    }
    return formatted;
  }

  /**
   * Helper: Parse timecode string (HH:MM:SS.mmm or MM:SS.mmm or seconds)
   */
  static parseTimecode(str) {
    if (typeof str === 'number') return str;
    if (!str || typeof str !== 'string') return 0;
    
    const trimmed = str.trim();
    let isNegative = false;
    let clean = trimmed;

    if (clean.startsWith('-')) {
      isNegative = true;
      clean = clean.slice(1);
    } else if (clean.startsWith('+')) {
      clean = clean.slice(1);
    }

    const parts = clean.split(':').map(Number);
    let total = 0;

    if (parts.length === 3) {
      // HH:MM:SS.mmm
      total = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // MM:SS.mmm
      total = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      total = parts[0];
    }

    return isNegative ? -total : total;
  }

  /**
   * Calculate frame number at given seconds
   */
  getFrameAt(seconds) {
    return Math.floor(Math.max(0, seconds) * this.fps);
  }

  /**
   * Step the calibration preview video by N frames
   */
  stepCalibrationFrame(deltaFrames) {
    if (!this.calibrationVideo) return;
    const frameDuration = 1 / this.fps;
    const target = this.calibrationVideo.currentTime + (deltaFrames * frameDuration);
    this.seekCalibration(target);
  }

  /**
   * Step the calibration preview video by seconds
   */
  stepCalibrationSeconds(deltaSeconds) {
    if (!this.calibrationVideo) return;
    const target = this.calibrationVideo.currentTime + deltaSeconds;
    this.seekCalibration(target);
  }

  /**
   * Seek calibration player safely
   */
  seekCalibration(targetSeconds) {
    if (!this.calibrationVideo) return;
    const clamped = Math.max(0, Math.min(this.duration || 999999, targetSeconds));
    this.calibrationVideo.currentTime = clamped;
  }

  /**
   * Commit current calibration video position as the anchor
   */
  setAnchorFromCurrentCalibration() {
    if (!this.calibrationVideo) return;
    this.anchorTime = Number(this.calibrationVideo.currentTime.toFixed(4));
    this.anchorSet = true;
  }

  /**
   * Explicitly set anchor time
   */
  setAnchor(seconds) {
    this.anchorTime = Math.max(0, Number(seconds) || 0);
    this.anchorSet = true;
  }

  /**
   * Reset / clear anchor
   */
  clearAnchor() {
    this.anchorTime = 0;
    this.anchorSet = false;
  }

  /**
   * Clean up Object URLs when deleted
   */
  destroy() {
    if (this.src && this.src.startsWith('blob:') && this.file) {
      URL.revokeObjectURL(this.src);
    }
  }
}
