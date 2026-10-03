/**
 * DemoGenerator: Generates synthetic test video feeds on-demand
 * Produces real WebM video blobs right inside the browser using HTML5 Canvas & MediaRecorder.
 * Feeds feature different starting offsets, distinct visual camera POVs, bouncing match targets,
 * and a synchronized flash event so users can test frame-accurate syncing immediately.
 */

class DemoGenerator {
  static async generateSampleFeeds(onProgress) {
    const feeds = [];
    
    // Feed 1: Player Alpha POV (Anchor event at 3.0s into the clip)
    if (onProgress) onProgress(1, 2, 'Generating Player Alpha POV...');
    const blob1 = await this.renderClip({
      camName: 'CAM 01 - ALPHA (SITE A)',
      primaryColor: '#00e5ff',
      targetEventTime: 3.0,
      totalDuration: 12.0,
      initialCountdown: 3,
      camSeed: 1
    });

    // Feed 2: Player Bravo POV (Anchor event at 6.0s into the clip - e.g. late recorder)
    if (onProgress) onProgress(2, 2, 'Generating Player Bravo POV...');
    const blob2 = await this.renderClip({
      camName: 'CAM 02 - BRAVO (SITE B)',
      primaryColor: '#ff9100',
      targetEventTime: 6.0,
      totalDuration: 15.0,
      initialCountdown: 6,
      camSeed: 2
    });

    return [
      {
        name: 'CAM 01: Alpha (Site A)',
        file: new File([blob1], 'gameplay_alpha_site_a.webm', { type: 'video/webm' }),
        suggestedAnchor: 3.0,
        fps: 60
      },
      {
        name: 'CAM 02: Bravo (Site B)',
        file: new File([blob2], 'gameplay_bravo_site_b.webm', { type: 'video/webm' }),
        suggestedAnchor: 6.0,
        fps: 60
      }
    ];
  }

  static renderClip({ camName, primaryColor, targetEventTime, totalDuration, initialCountdown, camSeed }) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(60);
      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8' });
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };

      const fps = 60;
      const totalFrames = Math.floor(totalDuration * fps);
      let currentFrame = 0;
      recorder.start();

      const interval = setInterval(() => {
        if (currentFrame >= totalFrames) {
          clearInterval(interval);
          recorder.stop();
          return;
        }

        const currentTimeSec = currentFrame / fps;
        const isAnchorEvent = Math.abs(currentTimeSec - targetEventTime) < 0.15;

        // Draw synthetic gameplay POV scene
        ctx.fillStyle = isAnchorEvent ? '#ffffff' : '#0e1117';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid floor
        ctx.strokeStyle = '#1d222e';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        // Crosshair
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.beginPath();
        ctx.moveTo(cx - 20, cy);
        ctx.lineTo(cx + 20, cy);
        ctx.moveTo(cx, cy - 20);
        ctx.lineTo(cx, cy + 20);
        ctx.stroke();

        // Moving game target / player dummy
        const t = currentTimeSec;
        const targetX = cx + Math.sin(t * 1.5 + camSeed) * 160;
        const targetY = cy + Math.cos(t * 2.0 + camSeed) * 80;
        
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`P${camSeed}`, targetX, targetY + 3);

        // HUD Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 260, 60);
        ctx.strokeStyle = primaryColor;
        ctx.strokeRect(10, 10, 260, 60);

        ctx.fillStyle = primaryColor;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(camName, 20, 28);

        ctx.fillStyle = '#ffffff';
        ctx.font = '11px monospace';
        ctx.fillText(`LOCAL TIME: ${currentTimeSec.toFixed(3)}s (F# ${currentFrame})`, 20, 44);
        
        // Match countdown / event status
        const diffToEvent = currentTimeSec - targetEventTime;
        if (Math.abs(diffToEvent) < 0.05) {
          ctx.fillStyle = '#00e676';
          ctx.fillText(`EVENT: *** MATCH START ANCHOR ***`, 20, 60);
        } else if (diffToEvent < 0) {
          ctx.fillStyle = '#ffd600';
          ctx.fillText(`COUNTDOWN TO MATCH: ${Math.abs(diffToEvent).toFixed(2)}s`, 20, 60);
        } else {
          ctx.fillStyle = '#00e5ff';
          ctx.fillText(`MATCH IN PROGRESS: +${diffToEvent.toFixed(2)}s`, 20, 60);
        }

        currentFrame++;
      }, 1000 / fps);
    });
  }
}
