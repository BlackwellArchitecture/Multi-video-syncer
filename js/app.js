/**
 * Video Syncer - Main Application Controller
 * High-precision utilitarian multi-POV video synchronizer. Zero emojis.
 */

document.addEventListener('DOMContentLoaded', () => {
  // App State
  const state = {
    videos: [],
    activeMode: 'setup', // 'setup' | 'watch'
    globalFps: 60,
    currentLayout: 'auto',
    osdEnabled: true,
    maximizedCamId: null
  };

  const syncEngine = new SyncEngine();

  // DOM Elements
  const btnModeSetup = document.getElementById('btn-mode-setup');
  const btnModeWatch = document.getElementById('btn-mode-watch');
  const viewSetup = document.getElementById('view-setup');
  const viewWatch = document.getElementById('view-watch');
  const syncedCountBadge = document.getElementById('synced-count-badge');
  const btnProceedToWatch = document.getElementById('btn-proceed-to-watch');

  const btnAddVideos = document.getElementById('btn-add-videos');
  const fileInputMultiple = document.getElementById('file-input-multiple');
  const btnLoadSample = document.getElementById('btn-load-sample');
  const btnEmptyAddVideo = document.getElementById('btn-empty-add-video');
  const btnEmptyDemo = document.getElementById('btn-empty-demo');
  const setupEmptyState = document.getElementById('setup-empty-state');
  const calibrationContainer = document.getElementById('calibration-container');

  const btnSaveSession = document.getElementById('btn-save-session');
  const btnLoadSession = document.getElementById('btn-load-session');
  const fileInputSession = document.getElementById('file-input-session');
  const btnFullscreenApp = document.getElementById('btn-fullscreen-app');
  const btnFullscreenMonitor = document.getElementById('btn-fullscreen-monitor');

  const globalFpsSelect = document.getElementById('global-default-fps');
  const monitorGrid = document.getElementById('monitor-grid');
  const monitorFeedCount = document.getElementById('monitor-feed-count');
  const toggleOsd = document.getElementById('toggle-osd');

  // Master Deck Elements
  const masterTimeRelative = document.getElementById('master-time-relative');
  const masterFrameRelative = document.getElementById('master-frame-relative');
  const masterBtnPlayPause = document.getElementById('master-btn-play-pause');
  const masterBtnAnchor = document.getElementById('master-btn-anchor');
  const masterBtnResync = document.getElementById('master-btn-resync');
  const masterBtnStepBackFrame = document.getElementById('master-btn-step-back-frame');
  const masterBtnStepForwardFrame = document.getElementById('master-btn-step-forward-frame');
  const masterBtnStepBackSec = document.getElementById('master-btn-step-back-sec');
  const masterBtnStepForwardSec = document.getElementById('master-btn-step-forward-sec');
  const masterBtnLoop = document.getElementById('master-btn-loop');
  const masterSpeedSelect = document.getElementById('master-speed-select');
  const masterAudioSelect = document.getElementById('master-audio-select');
  const masterVolumeSlider = document.getElementById('master-volume-slider');

  const timelineTrack = document.getElementById('master-timeline-track');
  const timelineThumb = document.getElementById('timeline-thumb');
  const timelineHoverBadge = document.getElementById('timeline-hover-badge');
  const timelineProgressBar = document.getElementById('timeline-progress-bar');
  const timelineAnchorMarker = document.getElementById('timeline-anchor-marker');
  const timelineTimeStart = document.getElementById('timeline-time-start');
  const timelineTimeEnd = document.getElementById('timeline-time-end');
  const timelineCoverageContainer = document.getElementById('timeline-coverage-container');
  const syncHealthFlag = document.getElementById('sync-health-flag');

  // Initialize
  initEventListeners();
  updateModeView();

  /* ==========================================================================
     EVENT LISTENERS INITIALIZATION
     ========================================================================== */
  function initEventListeners() {
    // Mode Switchers
    btnModeSetup.addEventListener('click', () => switchMode('setup'));
    btnModeWatch.addEventListener('click', () => {
      if (canProceedToWatch()) switchMode('watch');
    });
    btnProceedToWatch.addEventListener('click', () => {
      if (canProceedToWatch()) switchMode('watch');
    });

    // Desktop Hardware Acceleration Indicator
    if (window.electronAPI) {
      const brandBadge = document.querySelector('.brand-badge');
      if (brandBadge) {
        brandBadge.textContent = 'DESKTOP D3D11 ACCELERATED';
        brandBadge.style.backgroundColor = 'var(--accent-green)';
      }
    }

    // File selection (Native Dialog in Electron, File Input fallback in Browser)
    btnAddVideos.addEventListener('click', handleAddVideosClick);
    if (btnEmptyAddVideo) btnEmptyAddVideo.addEventListener('click', handleAddVideosClick);
    fileInputMultiple.addEventListener('change', handleFileInputChange);

    // Drag and drop onto calibration container
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', handleFileDrop);

    // Test Feed Generation
    btnLoadSample.addEventListener('click', loadDemoFeeds);
    if (btnEmptyDemo) btnEmptyDemo.addEventListener('click', loadDemoFeeds);

    // Session Export & Import
    btnSaveSession.addEventListener('click', handleExportSession);
    btnLoadSession.addEventListener('click', handleImportSession);
    fileInputSession.addEventListener('change', importSessionConfig);

    // Fullscreen Toggles
    btnFullscreenApp.addEventListener('click', toggleAppFullscreen);
    btnFullscreenMonitor.addEventListener('click', toggleMonitorFullscreen);

    // Global FPS Select
    globalFpsSelect.addEventListener('change', (e) => {
      state.globalFps = Number(e.target.value) || 60;
    });

    // OSD Toggle
    toggleOsd.addEventListener('change', (e) => {
      state.osdEnabled = e.target.checked;
      if (state.osdEnabled) {
        monitorGrid.classList.remove('hide-osd');
      } else {
        monitorGrid.classList.add('hide-osd');
      }
    });

    // Grid Layout Buttons
    const layoutBtns = document.querySelectorAll('.layout-btn');
    layoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        layoutBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setLayout(btn.getAttribute('data-layout'));
      });
    });

    // Master Deck Controls
    masterBtnPlayPause.addEventListener('click', () => syncEngine.togglePlay());
    masterBtnAnchor.addEventListener('click', () => syncEngine.jumpToAnchor());
    if (masterBtnResync) {
      masterBtnResync.addEventListener('click', () => syncEngine.forceResync());
    }
    masterBtnStepBackFrame.addEventListener('click', () => syncEngine.stepFrames(-1, state.globalFps));
    masterBtnStepForwardFrame.addEventListener('click', () => syncEngine.stepFrames(1, state.globalFps));
    masterBtnStepBackSec.addEventListener('click', () => syncEngine.stepSeconds(-1));
    masterBtnStepForwardSec.addEventListener('click', () => syncEngine.stepSeconds(1));
    
    masterBtnLoop.addEventListener('click', () => {
      syncEngine.isLooping = !syncEngine.isLooping;
      masterBtnLoop.classList.toggle('active', syncEngine.isLooping);
    });

    masterSpeedSelect.addEventListener('change', (e) => {
      syncEngine.setPlaybackRate(e.target.value);
    });

    masterAudioSelect.addEventListener('change', (e) => {
      syncEngine.setAudioSource(e.target.value);
    });

    masterVolumeSlider.addEventListener('input', (e) => {
      syncEngine.setMasterVolume(e.target.value);
    });

    // Master Timeline Interaction (Scrubbing / Dragging)
    initMasterTimelineScrubber();

    // Keyboard Shortcuts
    window.addEventListener('keydown', handleGlobalKeydown);

    // Connect SyncEngine Callbacks
    syncEngine.onTick = handleSyncEngineTick;
    syncEngine.onStateChange = handleSyncEngineStateChange;
    syncEngine.onBoundsChange = handleSyncBoundsChange;
  }

  /* ==========================================================================
     MODE NAVIGATION
     ========================================================================== */
  function canProceedToWatch() {
    return state.videos.length > 0 && state.videos.some(v => v.anchorSet);
  }

  function updateModeButtons() {
    const ready = canProceedToWatch();
    btnModeWatch.disabled = !ready;
    btnProceedToWatch.disabled = !ready;

    const anchorsCount = state.videos.filter(v => v.anchorSet).length;
    syncedCountBadge.textContent = `${anchorsCount}/${state.videos.length}`;
  }

  function switchMode(mode) {
    if (mode === 'watch' && !canProceedToWatch()) return;

    state.activeMode = mode;
    btnModeSetup.classList.toggle('active', mode === 'setup');
    btnModeWatch.classList.toggle('active', mode === 'watch');

    viewSetup.classList.toggle('active', mode === 'setup');
    viewWatch.classList.toggle('active', mode === 'watch');

    if (mode === 'watch') {
      // Pause calibration players to avoid CPU waste
      state.videos.forEach(item => {
        if (item.calibrationVideo) item.calibrationVideo.pause();
      });

      // Build watch view grid
      renderWatchMonitorGrid();
      syncEngine.setVideos(state.videos);
      populateAudioSelect();
      syncEngine.jumpToAnchor();
    } else {
      // Pause watch view
      syncEngine.pause();
    }
  }

  /* ==========================================================================
     FILE MANAGEMENT & INGESTION
     ========================================================================== */
  async function handleAddVideosClick() {
    if (window.electronAPI) {
      const selectedFiles = await window.electronAPI.openVideoFiles();
      if (selectedFiles && selectedFiles.length > 0) {
        addNativeVideoFiles(selectedFiles);
      }
    } else {
      fileInputMultiple.click();
    }
  }

  function handleFileInputChange(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      addVideoFiles(files);
      e.target.value = '';
    }
  }

  function handleFileDrop(e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files).filter(f => 
        (f.type && f.type.startsWith('video/')) || /\.(mp4|webm|mkv|mov|avi|ts|m4v)$/i.test(f.name)
      );
      if (files.length > 0) {
        addVideoFiles(files);
      }
    }
  }

  function addNativeVideoFiles(nativeFiles) {
    nativeFiles.forEach((fileInfo) => {
      const index = state.videos.length;
      const item = new VideoItem({
        id: `cam-${index}`,
        name: `CAM ${index + 1}: ${fileInfo.name.replace(/\.[^/.]+$/, '')}`,
        filePath: fileInfo.path,
        size: fileInfo.size || 0,
        fps: state.globalFps,
        anchorTime: 0
      });
      state.videos.push(item);
      renderCalibrationCard(item);
    });

    checkEmptyState();
    updateModeButtons();
  }

  function addVideoFiles(files) {
    files.forEach((file) => {
      const index = state.videos.length;
      const item = new VideoItem({
        id: `cam-${index}`,
        name: `CAM ${index + 1}: ${file.name.replace(/\.[^/.]+$/, '')}`,
        file: file,
        filePath: file.path || null,
        size: file.size || 0,
        fps: state.globalFps,
        anchorTime: 0
      });
      state.videos.push(item);
      renderCalibrationCard(item);
    });

    checkEmptyState();
    updateModeButtons();
  }

  function checkEmptyState() {
    if (setupEmptyState) {
      setupEmptyState.style.display = state.videos.length === 0 ? 'flex' : 'none';
    }
  }

  async function loadDemoFeeds() {
    btnLoadSample.disabled = true;
    const origText = btnLoadSample.innerHTML;
    btnLoadSample.textContent = 'GENERATING FEEDS...';

    try {
      const demoData = await DemoGenerator.generateSampleFeeds((step, total, msg) => {
        btnLoadSample.textContent = `${msg} (${step}/${total})`;
      });

      demoData.forEach((feed) => {
        const index = state.videos.length;
        const item = new VideoItem({
          id: `cam-${index}`,
          name: feed.name,
          file: feed.file,
          fps: feed.fps,
          anchorTime: feed.suggestedAnchor
        });
        state.videos.push(item);
        renderCalibrationCard(item);
      });

      checkEmptyState();
      updateModeButtons();
    } catch (err) {
      console.error('Failed to generate demo feeds:', err);
    } finally {
      btnLoadSample.disabled = false;
      btnLoadSample.innerHTML = origText;
      renderIcons(btnLoadSample);
    }
  }

  /* ==========================================================================
     CALIBRATION VIEW RENDERING & CONTROLS
     ========================================================================== */
  function renderCalibrationCard(item) {
    const card = document.createElement('div');
    card.className = `calibration-card ${item.anchorSet ? 'has-anchor' : ''}`;
    card.id = `cal-card-${item.id}`;
    item.calibrationCard = card;

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-group">
          <span class="cam-pill">${item.id.toUpperCase()}</span>
          <input type="text" class="cam-name-input" value="${item.name}" title="Edit camera name">
        </div>
        <div class="card-actions">
          <div class="card-fps-config">
            <span>FPS:</span>
            <input type="number" class="select-input card-fps-input" value="${item.fps}" min="1" max="240">
          </div>
          <button class="util-btn icon-only btn-remove-feed" title="Remove Feed">
            <span class="icon-slot" data-icon="trash"></span>
          </button>
        </div>
      </div>

      <div class="card-video-viewport">
        <video src="${item.src}" playsinline preload="auto"></video>
        <div class="viewport-osd-top">
          <span class="osd-badge cam-meta-badge">INIT</span>
          <span class="osd-badge anchor-status ${item.anchorSet ? 'set' : ''}">
            ${item.anchorSet ? 'ANCHOR SET' : 'NO ANCHOR'}
          </span>
        </div>
      </div>

      <div class="card-controls">
        <div class="scrub-row">
          <input type="range" class="video-scrubber" min="0" max="100" step="0.001" value="0">
          <input type="text" class="time-input-jump" value="00:00:00.000" title="Click or type exact timecode to jump (HH:MM:SS.mmm or seconds)">
        </div>

        <div class="stepping-deck">
          <div class="step-btn-group">
            <button class="step-btn btn-step-back-5s" title="Step Back 5s">-5s</button>
            <button class="step-btn btn-step-back-1s" title="Step Back 1s">-1s</button>
            <button class="step-btn btn-step-back-frame" title="Step Back 1 Frame (or roll mouse wheel over video)">-1F</button>
          </div>

          <button class="step-btn play-btn btn-cal-play-pause" title="Play / Pause Preview">PLAY</button>

          <div class="step-btn-group">
            <button class="step-btn btn-step-fwd-frame" title="Step Forward 1 Frame (or roll mouse wheel over video)">+1F</button>
            <button class="step-btn btn-step-fwd-1s" title="Step Forward 1s">+1s</button>
            <button class="step-btn btn-step-fwd-5s" title="Step Forward 5s">+5s</button>
          </div>
        </div>

        <div class="anchor-action-bar">
          <div class="anchor-readout">
            <span class="anchor-title-tag">SET ANCHOR TIMESTAMP:</span>
            <span class="anchor-value-tag ${item.anchorSet ? '' : 'unset'}">
              ${item.anchorSet ? VideoItem.formatTimecode(item.anchorTime) : 'NOT SET'}
            </span>
          </div>
          <div class="card-action-btns">
            <button class="btn-jump-anchor" type="button" title="Jump to saved anchor" ${item.anchorSet ? '' : 'disabled'}>
              <span class="icon-slot" data-icon="anchor"></span>
              <span>JUMP ANCHOR</span>
            </button>
            <button class="btn-set-anchor" type="button">
              <span class="icon-slot" data-icon="anchor"></span>
              <span>SET ANCHOR HERE</span>
            </button>
          </div>
        </div>
      </div>
    `;

    renderIcons(card);
    calibrationContainer.appendChild(card);

    // Track active item for keyboard shortcuts
    card.addEventListener('mouseenter', () => { state.activeCalibrationItem = item; });
    card.addEventListener('click', () => { state.activeCalibrationItem = item; });

    // Bind element logic
    const video = card.querySelector('video');
    item.calibrationVideo = video;

    const scrubber = card.querySelector('.video-scrubber');
    const timeInputJump = card.querySelector('.time-input-jump');
    const camMetaBadge = card.querySelector('.cam-meta-badge');
    const anchorStatus = card.querySelector('.anchor-status');
    const anchorValueTag = card.querySelector('.anchor-value-tag');
    const btnSetAnchor = card.querySelector('.btn-set-anchor');
    const btnJumpAnchor = card.querySelector('.btn-jump-anchor');
    const btnPlayPause = card.querySelector('.btn-cal-play-pause');
    const camNameInput = card.querySelector('.cam-name-input');
    const fpsInput = card.querySelector('.card-fps-input');
    const btnRemove = card.querySelector('.btn-remove-feed');
    const viewport = card.querySelector('.card-video-viewport');

    // Video metadata
    video.addEventListener('loadedmetadata', () => {
      item.duration = video.duration || 0;
      item.videoWidth = video.videoWidth || 0;
      item.videoHeight = video.videoHeight || 0;
      item.isLoaded = true;

      scrubber.max = item.duration;
      const sizeTag = item.size ? ` | ${VideoItem.formatBytes(item.size)}` : '';
      const streamTag = item.isDiskStream ? ' | ZERO-RAM DISK STREAM' : '';
      camMetaBadge.textContent = `${item.videoWidth}x${item.videoHeight} @ ${item.fps}fps${sizeTag}${streamTag} | ${item.duration.toFixed(1)}s`;
      
      if (item.anchorTime > 0) {
        video.currentTime = Math.min(item.anchorTime, item.duration);
      }
      updateScrubLabels();
    });

    // Time update listener
    function updateScrubLabels() {
      const cur = video.currentTime;
      scrubber.value = cur;
      if (document.activeElement !== timeInputJump) {
        timeInputJump.value = VideoItem.formatTimecode(cur);
      }
    }

    video.addEventListener('timeupdate', updateScrubLabels);

    // Manual timecode jump input
    timeInputJump.addEventListener('change', () => {
      const parsed = VideoItem.parseTimecode(timeInputJump.value);
      item.seekCalibration(parsed);
      updateScrubLabels();
    });
    timeInputJump.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        timeInputJump.blur();
      }
    });

    // Scrubber input
    scrubber.addEventListener('input', () => {
      video.currentTime = Number(scrubber.value);
      updateScrubLabels();
    });

    // Mouse wheel over viewport to step frames
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      video.pause();
      btnPlayPause.textContent = 'PLAY';
      const deltaFrames = e.deltaY > 0 ? 1 : -1;
      item.stepCalibrationFrame(deltaFrames);
    }, { passive: false });

    // Play / Pause toggle
    btnPlayPause.addEventListener('click', () => {
      if (video.paused) {
        video.play();
        btnPlayPause.textContent = 'PAUSE';
      } else {
        video.pause();
        btnPlayPause.textContent = 'PLAY';
      }
    });

    video.addEventListener('ended', () => {
      btnPlayPause.textContent = 'PLAY';
    });

    // Stepping controls
    card.querySelector('.btn-step-back-frame').addEventListener('click', () => {
      video.pause();
      btnPlayPause.textContent = 'PLAY';
      item.stepCalibrationFrame(-1);
    });

    card.querySelector('.btn-step-fwd-frame').addEventListener('click', () => {
      video.pause();
      btnPlayPause.textContent = 'PLAY';
      item.stepCalibrationFrame(1);
    });

    card.querySelector('.btn-step-back-1s').addEventListener('click', () => {
      video.pause();
      btnPlayPause.textContent = 'PLAY';
      item.stepCalibrationSeconds(-1);
    });

    card.querySelector('.btn-step-fwd-1s').addEventListener('click', () => {
      video.pause();
      btnPlayPause.textContent = 'PLAY';
      item.stepCalibrationSeconds(1);
    });

    card.querySelector('.btn-step-back-5s').addEventListener('click', () => {
      video.pause();
      btnPlayPause.textContent = 'PLAY';
      item.stepCalibrationSeconds(-5);
    });

    card.querySelector('.btn-step-fwd-5s').addEventListener('click', () => {
      video.pause();
      btnPlayPause.textContent = 'PLAY';
      item.stepCalibrationSeconds(5);
    });

    // Set Anchor
    btnSetAnchor.addEventListener('click', () => {
      item.setAnchorFromCurrentCalibration();
      anchorStatus.textContent = 'ANCHOR SET';
      anchorStatus.classList.add('set');
      anchorValueTag.textContent = `${VideoItem.formatTimecode(item.anchorTime)} (F# ${item.getFrameAt(item.anchorTime)})`;
      anchorValueTag.classList.remove('unset');
      card.classList.add('has-anchor');
      btnJumpAnchor.disabled = false;

      updateModeButtons();
    });

    // Jump to set anchor
    btnJumpAnchor.addEventListener('click', () => {
      if (item.anchorSet) {
        item.seekCalibration(item.anchorTime);
      }
    });

    // Rename camera
    camNameInput.addEventListener('input', (e) => {
      item.name = e.target.value.trim() || item.id;
    });

    // Change FPS
    fpsInput.addEventListener('change', (e) => {
      item.fps = Math.max(1, Number(e.target.value) || 60);
    });

    // Remove feed
    btnRemove.addEventListener('click', () => {
      removeFeed(item);
    });
  }

  function removeFeed(item) {
    item.destroy();
    if (item.calibrationCard) item.calibrationCard.remove();
    state.videos = state.videos.filter(v => v !== item);
    checkEmptyState();
    updateModeButtons();
  }

  /* ==========================================================================
     MULTI-VIEW WATCH GRID RENDERING
     ========================================================================== */
  function renderWatchMonitorGrid() {
    monitorGrid.innerHTML = '';
    monitorFeedCount.textContent = `FEEDS: ${state.videos.length}`;
    monitorGrid.setAttribute('data-count', state.videos.length);

    state.videos.forEach((item, index) => {
      const cell = document.createElement('div');
      cell.className = 'monitor-cell';
      cell.id = `cell-${item.id}`;
      item.watchCell = cell;

      cell.innerHTML = `
        <video src="${item.src}" playsinline preload="auto"></video>
        
        <div class="cctv-overlay">
          <div class="cctv-top-bar">
            <div class="cctv-cam-badge">
              <span class="cctv-cam-id">${item.id.toUpperCase()}</span>
              <span class="cctv-cam-title" title="${item.name}">${item.name}</span>
            </div>
            <div class="cctv-feed-status">STANDBY</div>
          </div>

          <div class="cctv-bottom-bar">
            <div class="cctv-timestamp-box">
              <span class="cctv-t-main">00:00:00.000</span>
              <span class="cctv-t-sub">F# 0 @ ${item.fps}fps</span>
            </div>
            <div class="cctv-cell-controls">
              <button class="cell-tool-btn btn-solo-audio" data-cam="${item.id}" title="Listen to this feed's audio">
                <span class="icon-slot" data-icon="volume"></span>
              </button>
              <button class="cell-tool-btn btn-maximize-cell" data-cam="${item.id}" title="Toggle maximize feed">
                <span class="icon-slot" data-icon="maximize"></span>
              </button>
            </div>
          </div>
        </div>

        <div class="feed-blackout-banner">
          <div class="banner-code">FEED OFFLINE</div>
          <div class="banner-detail">Awaiting sync offset window</div>
        </div>
      `;

      renderIcons(cell);
      monitorGrid.appendChild(cell);

      // Cache DOM references to eliminate querySelector layout thrashing during playback
      item.cachedDom = {
        banner: cell.querySelector('.feed-blackout-banner'),
        bannerCode: cell.querySelector('.banner-code'),
        bannerDetail: cell.querySelector('.banner-detail'),
        statusTag: cell.querySelector('.cctv-feed-status'),
        timeVal: cell.querySelector('.cctv-t-main'),
        frameVal: cell.querySelector('.cctv-t-sub')
      };

      const video = cell.querySelector('video');
      item.watchVideo = video;
      video.muted = true; // Audio routing managed by syncEngine

      // Cell solo audio button
      const audioBtn = cell.querySelector('.btn-solo-audio');
      audioBtn.addEventListener('click', () => {
        masterAudioSelect.value = item.id;
        syncEngine.setAudioSource(item.id);
      });

      // Maximize toggle
      const maxBtn = cell.querySelector('.btn-maximize-cell');
      maxBtn.addEventListener('click', () => {
        toggleMaximizeCell(item.id);
      });
    });

    renderTimelineCoverageBands();
  }

  function toggleMaximizeCell(camId) {
    const cell = document.getElementById(`cell-${camId}`);
    if (!cell) return;

    if (state.maximizedCamId === camId) {
      cell.classList.remove('maximized');
      state.maximizedCamId = null;
    } else {
      document.querySelectorAll('.monitor-cell.maximized').forEach(c => c.classList.remove('maximized'));
      cell.classList.add('maximized');
      state.maximizedCamId = camId;
    }
  }

  function setLayout(layoutKey) {
    state.currentLayout = layoutKey;
    monitorGrid.className = 'monitor-grid';
    if (!state.osdEnabled) monitorGrid.classList.add('hide-osd');

    if (layoutKey === 'auto') {
      monitorGrid.classList.add('layout-auto');
    } else {
      monitorGrid.classList.add(`layout-${layoutKey}`);
    }
  }

  function populateAudioSelect() {
    masterAudioSelect.innerHTML = `
      <option value="none">MUTE ALL</option>
      <option value="all">ALL CAMERAS</option>
    `;

    state.videos.forEach((item, idx) => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${item.name}`;
      if (idx === 0) opt.selected = true;
      masterAudioSelect.appendChild(opt);
    });

    syncEngine.setAudioSource(masterAudioSelect.value);
  }

  /* ==========================================================================
     TIMELINE COVERAGE BANDS
     ========================================================================== */
  function renderTimelineCoverageBands() {
    timelineCoverageContainer.innerHTML = '';
    const span = syncEngine.maxMasterTime - syncEngine.minMasterTime;
    if (span <= 0) return;

    state.videos.forEach((item, index) => {
      const startRel = -(item.anchorTime || 0);
      const endRel = (item.duration || 0) - (item.anchorTime || 0);

      const leftPercent = Math.max(0, ((startRel - syncEngine.minMasterTime) / span) * 100);
      const rightPercent = Math.min(100, ((endRel - syncEngine.minMasterTime) / span) * 100);
      const widthPercent = Math.max(0.5, rightPercent - leftPercent);

      const band = document.createElement('div');
      band.className = 'coverage-band';
      band.style.left = `${leftPercent}%`;
      band.style.width = `${widthPercent}%`;
      band.title = `${item.name}: ${VideoItem.formatTimecode(startRel, true)} to ${VideoItem.formatTimecode(endRel, true)}`;
      
      timelineCoverageContainer.appendChild(band);
    });
  }

  /* ==========================================================================
     MASTER SCRUBBER & TIMELINE DECK LOGIC
     ========================================================================== */
  function initMasterTimelineScrubber() {
    let isDragging = false;
    let rafSeekPending = false;
    let pendingTargetTime = null;

    function applyThrottledSeek() {
      if (pendingTargetTime !== null) {
        syncEngine.seekMaster(pendingTargetTime, true);
        pendingTargetTime = null;
      }
      rafSeekPending = false;
    }

    function seekFromPointerEvent(e, immediate = false) {
      const rect = timelineTrack.getBoundingClientRect();
      const clientX = e.clientX;
      const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetTime = syncEngine.minMasterTime + progress * (syncEngine.maxMasterTime - syncEngine.minMasterTime);

      if (immediate) {
        syncEngine.seekMaster(targetTime, true);
      } else {
        pendingTargetTime = targetTime;
        if (!rafSeekPending) {
          rafSeekPending = true;
          requestAnimationFrame(applyThrottledSeek);
        }
      }
    }

    timelineTrack.addEventListener('pointerdown', (e) => {
      isDragging = true;
      timelineTrack.setPointerCapture(e.pointerId);
      seekFromPointerEvent(e, true);
    });

    timelineTrack.addEventListener('pointermove', (e) => {
      if (isDragging) {
        seekFromPointerEvent(e, false);
      }
    });

    timelineTrack.addEventListener('pointerup', (e) => {
      if (isDragging) {
        isDragging = false;
        try {
          timelineTrack.releasePointerCapture(e.pointerId);
        } catch (_) {}
        seekFromPointerEvent(e, true);
        syncEngine.reanchorAll();
      }
    });

    timelineTrack.addEventListener('pointercancel', () => {
      if (isDragging) {
        isDragging = false;
        syncEngine.reanchorAll();
      }
    });

    // Mouse wheel scrubbing
    timelineTrack.addEventListener('wheel', (e) => {
      e.preventDefault();
      const deltaFrames = e.deltaY > 0 ? 1 : -1;
      syncEngine.stepFrames(deltaFrames, state.globalFps);
    }, { passive: false });
  }

  function handleSyncBoundsChange(min, max) {
    timelineTimeStart.textContent = VideoItem.formatTimecode(min, true);
    timelineTimeEnd.textContent = VideoItem.formatTimecode(max, true);

    // Position Anchor (T = 0) marker
    const totalSpan = max - min;
    if (totalSpan > 0) {
      const anchorPercent = ((0 - min) / totalSpan) * 100;
      timelineAnchorMarker.style.left = `${anchorPercent}%`;
      timelineAnchorMarker.style.display = (anchorPercent >= 0 && anchorPercent <= 100) ? 'block' : 'none';
    }

    renderTimelineCoverageBands();
  }

  function handleSyncEngineTick(masterTime) {
    // Update readout values
    masterTimeRelative.textContent = VideoItem.formatTimecode(masterTime, true);
    const frameOffset = Math.floor(masterTime * state.globalFps);
    masterFrameRelative.textContent = (frameOffset >= 0 ? `+${frameOffset}` : `${frameOffset}`);

    // Update scrubber position
    const totalSpan = syncEngine.maxMasterTime - syncEngine.minMasterTime;
    if (totalSpan > 0) {
      const progress = Math.max(0, Math.min(1, (masterTime - syncEngine.minMasterTime) / totalSpan));
      const pct = (progress * 100).toFixed(3);

      timelineThumb.style.left = `${pct}%`;
      timelineProgressBar.style.width = `${pct}%`;
      timelineHoverBadge.textContent = VideoItem.formatTimecode(masterTime, true);
    }

    // Health flag
    const driftMs = Math.round(syncEngine.maxReportedDrift * 1000);
    syncHealthFlag.textContent = `DRIFT: ${driftMs}ms (${driftMs < 30 ? 'LOCKED' : 'SYNCING'})`;
    syncHealthFlag.className = `hint-item status-flag ${driftMs > 50 ? 'warning' : ''}`;
  }

  function handleSyncEngineStateChange(isPlaying) {
    const playIcon = masterBtnPlayPause.querySelector('.play-icon');
    const pauseIcon = masterBtnPlayPause.querySelector('.pause-icon');

    if (isPlaying) {
      masterBtnPlayPause.classList.add('playing');
      if (playIcon) playIcon.classList.add('hidden');
      if (pauseIcon) pauseIcon.classList.remove('hidden');
    } else {
      masterBtnPlayPause.classList.remove('playing');
      if (playIcon) playIcon.classList.remove('hidden');
      if (pauseIcon) pauseIcon.classList.add('hidden');
    }
  }

  /* ==========================================================================
     KEYBOARD SHORTCUTS
     ========================================================================== */
  function handleGlobalKeydown(e) {
    // Ignore keystrokes when typing into text/number inputs
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return;
    }

    if (state.activeMode === 'setup') {
      const targetItem = state.activeCalibrationItem || state.videos[0];
      if (!targetItem || !targetItem.calibrationVideo) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (targetItem.calibrationVideo.paused) {
            targetItem.calibrationVideo.play();
          } else {
            targetItem.calibrationVideo.pause();
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          targetItem.calibrationVideo.pause();
          targetItem.stepCalibrationFrame(-1);
          break;

        case 'ArrowRight':
          e.preventDefault();
          targetItem.calibrationVideo.pause();
          targetItem.stepCalibrationFrame(1);
          break;

        case 'KeyJ':
          e.preventDefault();
          targetItem.stepCalibrationSeconds(-1);
          break;

        case 'KeyL':
          e.preventDefault();
          targetItem.stepCalibrationSeconds(1);
          break;

        case 'KeyA':
          e.preventDefault();
          if (targetItem.calibrationCard) {
            const btn = targetItem.calibrationCard.querySelector('.btn-set-anchor');
            if (btn) btn.click();
          }
          break;
      }
      return;
    }

    if (state.activeMode !== 'watch') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        syncEngine.togglePlay();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        syncEngine.stepFrames(-1, state.globalFps);
        break;

      case 'ArrowRight':
        e.preventDefault();
        syncEngine.stepFrames(1, state.globalFps);
        break;

      case 'KeyJ':
        e.preventDefault();
        syncEngine.stepSeconds(-1);
        break;

      case 'KeyL':
        e.preventDefault();
        syncEngine.stepSeconds(1);
        break;

      case 'KeyA':
      case 'Home':
        e.preventDefault();
        syncEngine.jumpToAnchor();
        break;

      case 'KeyR':
        e.preventDefault();
        syncEngine.forceResync();
        break;

      case 'KeyM':
        e.preventDefault();
        if (syncEngine.audioSource !== 'none') {
          syncEngine.setAudioSource('none');
          masterAudioSelect.value = 'none';
        } else {
          syncEngine.setAudioSource('all');
          masterAudioSelect.value = 'all';
        }
        break;

      case 'KeyF':
        e.preventDefault();
        toggleMonitorFullscreen();
        break;
    }
  }

  /* ==========================================================================
     SESSION CONFIG EXPORT & IMPORT (JSON)
     ========================================================================== */
  async function handleExportSession() {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      globalFps: state.globalFps,
      videos: state.videos.map(v => ({
        id: v.id,
        name: v.name,
        filePath: v.filePath || '',
        fileName: v.file ? v.file.name : (v.filePath ? v.filePath.split(/[\\/]/).pop() : ''),
        fps: v.fps,
        anchorTime: v.anchorTime,
        anchorSet: v.anchorSet,
        duration: v.duration
      }))
    };

    if (window.electronAPI) {
      await window.electronAPI.exportSession(exportData);
    } else {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_sync_session_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleImportSession() {
    if (window.electronAPI) {
      const data = await window.electronAPI.importSession();
      if (data) {
        applySessionData(data);
      }
    } else {
      fileInputSession.click();
    }
  }

  function importSessionConfig(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        applySessionData(data);
      } catch (err) {
        alert('Invalid session JSON configuration file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function applySessionData(data) {
    if (data.globalFps) {
      state.globalFps = data.globalFps;
      globalFpsSelect.value = data.globalFps;
    }

    if (!Array.isArray(data.videos)) return;

    // In Electron, if videos have filePaths and are not loaded, auto-load them!
    if (window.electronAPI) {
      data.videos.forEach(vData => {
        if (vData.filePath && !state.videos.some(v => v.filePath === vData.filePath)) {
          const index = state.videos.length;
          const item = new VideoItem({
            id: `cam-${index}`,
            name: vData.name,
            filePath: vData.filePath,
            fps: vData.fps || state.globalFps,
            anchorTime: vData.anchorTime || 0
          });
          state.videos.push(item);
          renderCalibrationCard(item);
        }
      });
      checkEmptyState();
    }

    // Apply anchors to existing or newly loaded videos
    data.videos.forEach((vData, idx) => {
      let matched = state.videos.find(v => 
        (v.filePath && v.filePath === vData.filePath) ||
        (v.file && v.file.name === vData.fileName) || 
        v.name === vData.name
      );
      if (!matched && state.videos[idx]) {
        matched = state.videos[idx];
      }

      if (matched) {
        matched.name = vData.name || matched.name;
        matched.fps = vData.fps || matched.fps;
        matched.setAnchor(vData.anchorTime);
        
        if (matched.calibrationCard) {
          const titleInput = matched.calibrationCard.querySelector('.cam-name-input');
          if (titleInput) titleInput.value = matched.name;

          const anchorVal = matched.calibrationCard.querySelector('.anchor-value-tag');
          if (anchorVal) {
            anchorVal.textContent = `${VideoItem.formatTimecode(matched.anchorTime)} (F# ${matched.getFrameAt(matched.anchorTime)})`;
            anchorVal.classList.remove('unset');
          }
          const anchorStatus = matched.calibrationCard.querySelector('.anchor-status');
          if (anchorStatus) {
            anchorStatus.textContent = 'ANCHOR SET';
            anchorStatus.classList.add('set');
          }
          matched.calibrationCard.classList.add('has-anchor');
        }
      }
    });

    updateModeButtons();
  }

  /* ==========================================================================
     FULLSCREEN HELPERS
     ========================================================================== */
  function toggleAppFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function toggleMonitorFullscreen() {
    const el = viewWatch;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function updateModeView() {
    checkEmptyState();
    updateModeButtons();
  }
});
