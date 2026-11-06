// Local celebration effects: no remote scripts or audio requests.
(() => {
  let audioContext, audioReady, applause, canvas, frame, timeout;
  let generation = 0;
  const audioData = fetch('/assets/audio/spinner-cheer.m4a')
    .then(response => response.ok ? response.arrayBuffer() : null)
    .catch(() => null);
  const duration = 5.4;

  function stop() {
    generation++;
    cancelAnimationFrame(frame);
    clearTimeout(timeout);
    canvas?.remove();
    canvas = null;
    if (applause) {
      applause.stop();
      applause.disconnect();
      applause = null;
    }
  }

  // Unlock audio during the SPIN click so the delayed reveal can play on mobile.
  function prepare() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext ||= new AudioContext();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      audioReady ||= audioData.then(data => data ? audioContext.decodeAudioData(data) : null).catch(() => null);
    } catch (_) { /* A browser without audio still reveals the selected name. */ }
  }

  function celebrate() {
    stop();
    const current = generation;
    audioReady?.then(buffer => {
      if (current !== generation || !buffer || audioContext.state !== 'running') return;
      try {
        applause = audioContext.createBufferSource();
        applause.buffer = buffer;
        applause.connect(audioContext.destination);
        applause.start();
      } catch (_) { /* Visual celebration continues if audio is unavailable. */ }
    });

    // Keep the name and applause for users who request reduced motion.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canvas = document.createElement('canvas');
      canvas.className = 'spinner-confetti';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.append(canvas);
      const context = canvas.getContext('2d');
      if (context) {
        const width = window.innerWidth, height = window.innerHeight;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        context.scale(ratio, ratio);
        const colors = ['#e87722', '#ffd166', '#ffffff', '#5eddd1', '#b694ff', '#ff729f'];
        const pieces = Array.from({length: 220}, () => ({
          x: Math.random() * width, y: -20 - Math.random() * height * 0.7,
          speed: 130 + Math.random() * 230, drift: (Math.random() - 0.5) * 100,
          size: 6 + Math.random() * 7, rotation: Math.random() * Math.PI,
          color: colors[Math.floor(Math.random() * colors.length)]
        }));
        const start = performance.now();
        let previous = start;
        function draw(now) {
          const seconds = (now - start) / 1000;
          const step = Math.min((now - previous) / 1000, 0.05);
          previous = now;
          context.clearRect(0, 0, width, height);
          context.globalAlpha = Math.min(1, duration - seconds);
          for (const piece of pieces) {
            piece.x += piece.drift * step;
            piece.y += piece.speed * step;
            piece.rotation += step * 3;
            context.save();
            context.translate(piece.x, piece.y);
            context.rotate(piece.rotation);
            context.fillStyle = piece.color;
            context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
            context.restore();
          }
          if (seconds < duration) frame = requestAnimationFrame(draw);
        }
        frame = requestAnimationFrame(draw);
      }
    }
    timeout = setTimeout(stop, duration * 1000);
  }

  window.SpinnerCelebration = {prepare, celebrate, stop};
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
})();
