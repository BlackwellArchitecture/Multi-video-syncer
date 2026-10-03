/**
 * SyncEngine: Master timeline synchronization controller
 * Event-driven anchor synchronization. Zero continuous hard seeks during playback.
 * Feeds re-anchor cleanly on timeline interactions (play, pause, scrub, step)
 * and play smoothly with native Direct3D 11 hardware decoding.
 * Strictly zero emojis.
 */

class SyncEngine {
  constructor() {
    this.videos = [];
    this.masterTime = 0; // Relative to anchor (0.0 = exact anchor event)
    this.isPlaying = false;
    this.playbackRate = 1.0;
    this.isLooping = false;
    this.audioSource = 'cam-0'; // 'cam-X', 'none', 'all'
    this.masterVolume = 1.0;

    // Timeline boundaries relative to anchor
    this.minMasterTime = 0;
    this.maxMasterTime = 100;
    
    // Performance & Clock
    this.lastFrameTimestamp = 0;
    this.lastHudUpdate = 0;
    this.rafId = null;
    this.isScrubbing = false;
    this.maxReportedDrift = 0;

    // Callbacks
    this.onTick = null;
    this.onStateChange = null;
    this.onBoundsChange = null;
  }

  /**
   * Set list of VideoItem instances
   */
  setVideos(videoItems) {
    this.videos = videoItems;
    this.recalculateBounds();
    this.applyAudioRouting();
  }

  /**
   * Calculate earliest and latest master times relative to anchors
   */
  recalculateBounds() {
    if (!this.videos || this.videos.length === 0) {
      this.minMasterTime = 0;
      this.maxMasterTime = 100;
      if (this.onBoundsChange) this.onBoundsChange(this.minMasterTime, this.maxMasterTime);
      return;
    }

    let min = Infinity;
    let max = -Infinity;

    for (const item of this.videos) {
      const anchor = item.anchorTime || 0;
      const duration = item.duration || 0;
      
      const videoStartRel = -anchor;
      const videoEndRel = duration - anchor;

      if (videoStartRel < min) min = videoStartRel;
      if (videoEndRel > max) max = videoEndRel;
    }

    if (!isFinite(min)) min = 0;
    if (!isFinite(max) || max <= min) max = min + 60;

    this.minMasterTime = min;
    this.maxMasterTime = max;

    this.masterTime = Math.max(this.minMasterTime, Math.min(this.maxMasterTime, this.masterTime));

    if (this.onBoundsChange) {
      this.onBoundsChange(this.minMasterTime, this.maxMasterTime);
    }
  }

  /**
   * Re-anchor all video feeds to the current master time in a single clean pass.
   * Executed on Play, Pause, Scrub release, Step buttons, and Jump Anchor.
   */
  reanchorAll() {
    let maxDrift = 0;

    for (const item of this.videos) {
      const v = item.watchVideo;
      if (!v) continue;

      const target = item.anchorTime + this.masterTime;
      const duration = item.duration || 0;

      // Ensure correct playback rate
      v.playbackRate = this.playbackRate;

      if (target < 0) {
        item.status = 'PRE_RECORDING';
        if (!v.paused) v.pause();
        if (v.currentTime !== 0) v.currentTime = 0;
      } else if (target > duration && duration > 0) {
        item.status = 'ENDED';
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - duration) > 0.05) v.currentTime = duration;
      } else {
        item.status = 'PLAYING';
        
        // Single clean seek to anchor offset
        v.currentTime = target;

        if (this.isPlaying && v.paused) {
          v.play().catch(() => {});
        } else if (!this.isPlaying && !v.paused) {
          v.pause();
        }
      }

      this.updateCellOverlayStatus(item, target);
    }

    this.maxReportedDrift = maxDrift;
  }

  /**
   * Force manual resync (hotkey R or RESYNC button)
   */
  forceResync() {
    this.reanchorAll();
    if (this.onTick) this.onTick(this.masterTime);
  }

  /**
   * Start master playback
   */
  play() {
    if (this.isPlaying) return;
    
    // Wrap to start if at boundary
    if (this.masterTime >= this.maxMasterTime - 0.05) {
      this.masterTime = this.minMasterTime;
    }

    this.isPlaying = true;
    this.lastFrameTimestamp = performance.now();
    this.lastHudUpdate = 0;
    this.applyAudioRouting();
    
    // Align all videos to exact anchor offsets once before rolling
    this.reanchorAll();
    
    if (this.onStateChange) this.onStateChange(true);
    
    this.tick(performance.now());
  }

  /**
   * Pause master playback
   */
  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Freeze all videos at exact target time
    for (const item of this.videos) {
      if (item.watchVideo) {
        item.watchVideo.pause();
        const target = item.anchorTime + this.masterTime;
        if (target >= 0 && target <= (item.duration || 999999)) {
          item.watchVideo.currentTime = target;
        }
        this.updateCellOverlayStatus(item, target);
      }
    }

    if (this.onStateChange) this.onStateChange(false);
    if (this.onTick) this.onTick(this.masterTime);
  }

  /**
   * Toggle Play / Pause
   */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Jump master time directly to anchor (t = 0)
   */
  jumpToAnchor() {
    this.seekMaster(0);
  }

  /**
   * Step master time by delta seconds
   */
  stepSeconds(delta) {
    this.seekMaster(this.masterTime + delta);
  }

  /**
   * Step master time by delta frames
   */
  stepFrames(deltaFrames, fps = 60) {
    const dt = deltaFrames / fps;
    this.seekMaster(this.masterTime + dt);
  }

  /**
   * Set master playback rate (0.25 - 2.0)
   */
  setPlaybackRate(rate) {
    this.playbackRate = Math.max(0.1, Math.min(4.0, Number(rate) || 1.0));
    for (const item of this.videos) {
      if (item.watchVideo) {
        item.watchVideo.playbackRate = this.playbackRate;
      }
    }
  }

  /**
   * Seek master clock to target relative time
   */
  seekMaster(targetTime, isScrubbing = false) {
    this.masterTime = Math.max(this.minMasterTime, Math.min(this.maxMasterTime, targetTime));
    this.isScrubbing = isScrubbing;

    // Synchronize all video elements
    this.reanchorAll();

    if (this.onTick) {
      this.onTick(this.masterTime);
    }
  }

  /**
   * Animation & Sync frame loop
   * Runs natively without per-frame hard seeks.
   */
  tick(now) {
    if (!this.isPlaying) return;

    const deltaSec = (now - this.lastFrameTimestamp) / 1000;
    this.lastFrameTimestamp = now;

    // Locate primary playable video feed to lock master clock to hardware presentation
    let primaryVideoItem = null;
    for (const item of this.videos) {
      if (item.watchVideo && !item.watchVideo.paused && item.status === 'PLAYING') {
        primaryVideoItem = item;
        break;
      }
    }

    if (primaryVideoItem && primaryVideoItem.watchVideo) {
      // Lock master time to the hardware presentation clock of the primary video
      this.masterTime = primaryVideoItem.watchVideo.currentTime - primaryVideoItem.anchorTime;
    } else {
      // Advance with high-res clock if feeds are waiting on pre-recording window
      this.masterTime += deltaSec * this.playbackRate;
    }

    // Bounds & loop check
    if (this.masterTime >= this.maxMasterTime) {
      if (this.isLooping) {
        this.masterTime = this.minMasterTime;
        this.reanchorAll();
      } else {
        this.masterTime = this.maxMasterTime;
        this.pause();
        return;
      }
    }

    let maxDrift = 0;
    const shouldUpdateHud = (now - this.lastHudUpdate) > 100; // 10 Hz throttled HUD updates

    for (const item of this.videos) {
      const v = item.watchVideo;
      if (!v) continue;

      const target = item.anchorTime + this.masterTime;
      const duration = item.duration || 0;

      if (target < 0) {
        item.status = 'PRE_RECORDING';
        if (!v.paused) v.pause();
        if (v.currentTime > 0.05) v.currentTime = 0;
      } else if (target > duration && duration > 0) {
        item.status = 'ENDED';
        if (!v.paused) v.pause();
      } else {
        item.status = 'PLAYING';
        
        // Start video when entering its active playable range
        if (v.paused) {
          v.currentTime = target;
          v.play().catch(() => {});
        }

        const drift = v.currentTime - target;
        const absDrift = Math.abs(drift);
        if (absDrift > maxDrift) maxDrift = absDrift;

        // CATASTROPHIC DESYNC ONLY (e.g. system sleep or background tab suspend > 2.0s)
        // Never hard-seek during normal playback to allow silky smooth 60fps hardware decode!
        if (absDrift > 2.0) {
          v.currentTime = target;
          v.playbackRate = this.playbackRate;
        } else if (absDrift > 0.08) {
          // Extremely subtle rate nudge (1.5%) to guide it without decoder flushing
          const nudge = drift > 0 ? 0.985 : 1.015;
          v.playbackRate = this.playbackRate * nudge;
        } else {
          v.playbackRate = this.playbackRate;
        }
      }

      if (shouldUpdateHud) {
        this.updateCellOverlayStatus(item, target);
      }
    }

    this.maxReportedDrift = maxDrift;

    if (shouldUpdateHud) {
      this.lastHudUpdate = now;
      if (this.onTick) {
        this.onTick(this.masterTime);
      }
    }

    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  /**
   * Update visual status indicators on each video cell using cached DOM elements
   */
  updateCellOverlayStatus(item, targetTime) {
    if (!item.watchCell) return;

    // Use cached DOM elements to avoid layout thrashing
    const dom = item.cachedDom;
    if (!dom) return;

    if (item.status === 'PRE_RECORDING') {
      if (dom.banner) dom.banner.classList.add('show');
      if (dom.bannerCode) dom.bannerCode.textContent = 'FEED NOT YET STARTED';
      if (dom.bannerDetail) {
        const waitTime = Math.abs(targetTime).toFixed(2);
        dom.bannerDetail.textContent = `Starts in ${waitTime}s at local 00:00:00.000`;
      }
      if (dom.statusTag) {
        dom.statusTag.textContent = 'STANDBY';
        dom.statusTag.className = 'cctv-feed-status out-of-bounds';
      }
    } else if (item.status === 'ENDED') {
      if (dom.banner) dom.banner.classList.add('show');
      if (dom.bannerCode) dom.bannerCode.textContent = 'FEED RECORDING ENDED';
      if (dom.bannerDetail) dom.bannerDetail.textContent = 'Camera recording completed';
      if (dom.statusTag) {
        dom.statusTag.textContent = 'ENDED';
        dom.statusTag.className = 'cctv-feed-status ended';
      }
    } else {
      if (dom.banner) dom.banner.classList.remove('show');
      if (dom.statusTag) {
        dom.statusTag.textContent = 'LIVE SYNC';
        dom.statusTag.className = 'cctv-feed-status';
      }
    }

    if (dom.timeVal && item.watchVideo) {
      dom.timeVal.textContent = VideoItem.formatTimecode(item.watchVideo.currentTime);
    }
    if (dom.frameVal && item.watchVideo) {
      const frameNum = Math.floor(item.watchVideo.currentTime * item.fps);
      dom.frameVal.textContent = `F# ${frameNum} @ ${item.fps}fps`;
    }
  }

  /**
   * Audio routing management
   */
  setAudioSource(sourceKey) {
    this.audioSource = sourceKey;
    this.applyAudioRouting();
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, Number(val) || 0));
    this.applyAudioRouting();
  }

  applyAudioRouting() {
    for (const item of this.videos) {
      const v = item.watchVideo;
      if (!v) continue;

      if (this.audioSource === 'none') {
        v.muted = true;
      } else if (this.audioSource === 'all') {
        v.muted = false;
        v.volume = this.masterVolume;
      } else if (this.audioSource === item.id) {
        v.muted = false;
        v.volume = this.masterVolume;
      } else {
        v.muted = true;
      }

      if (item.watchCell) {
        const audioBtn = item.watchCell.querySelector('.btn-solo-audio');
        if (audioBtn) {
          if (!v.muted && this.masterVolume > 0) {
            audioBtn.classList.add('active-audio-btn');
          } else {
            audioBtn.classList.remove('active-audio-btn');
          }
        }
      }
    }
  }
}
