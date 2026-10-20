// Preview player: fits the 1080×1920 stage to the window, plays in real time
// (synced to <audio> when present), scrubs, and freezes on `#t=SECONDS`.
(function () {
  'use strict';
  const E = window.StanzyEngine;
  const viewport = document.getElementById('viewport');
  const stage = document.getElementById('stage');
  const audio = document.getElementById('voice');
  const playBtn = document.getElementById('play');
  const range = document.getElementById('scrub');
  const label = document.getElementById('time');
  const scenesBar = document.getElementById('scene-jumps');

  E.init();
  const duration = E.duration;
  range.max = String(duration);

  let playing = false;
  let t = 0;
  let clockStart = 0;

  const frozenAt = /t=([\d.]+)/.exec(location.hash);

  function fit() {
    const s = frozenAt ? 1 : Math.min((window.innerHeight - 70) / 1920, window.innerWidth / 1080);
    stage.style.transform = `scale(${s})`;
    viewport.style.width = `${1080 * s}px`;
    viewport.style.height = `${1920 * s}px`;
  }

  function fmt(x) { return `${x.toFixed(1)} / ${duration.toFixed(1)} s`; }

  function draw() {
    E.render(t);
    range.value = String(t);
    label.textContent = fmt(t);
  }

  function now() { return audio && audio.src ? audio.currentTime : (performance.now() - clockStart) / 1000; }

  function loop() {
    if (!playing) return;
    t = now();
    if (t >= duration) { t = duration; pause(); }
    draw();
    requestAnimationFrame(loop);
  }

  function play() {
    if (t >= duration) t = 0;
    playing = true;
    playBtn.textContent = '❚❚';
    if (audio && audio.src) { audio.currentTime = t; audio.play(); }
    else clockStart = performance.now() - t * 1000;
    requestAnimationFrame(loop);
  }

  function pause() {
    playing = false;
    playBtn.textContent = '▶';
    if (audio && audio.src) audio.pause();
  }

  function seek(x) {
    t = Math.max(0, Math.min(duration, x));
    if (audio && audio.src) audio.currentTime = t;
    else clockStart = performance.now() - t * 1000;
    draw();
  }

  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  range.addEventListener('input', () => seek(Number(range.value)));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
    if (e.code === 'ArrowRight') seek(t + 1);
    if (e.code === 'ArrowLeft') seek(t - 1);
  });
  window.addEventListener('resize', fit);

  const starts = {};
  for (const p of window.__PROJECT.timeline.phrases) if (!(p.scene in starts)) starts[p.scene] = p.start;
  scenesBar.innerHTML = Object.keys(starts).map((s) => `<button data-t="${starts[s]}">${s}</button>`).join('');
  scenesBar.addEventListener('click', (e) => { if (e.target.dataset.t) seek(Number(e.target.dataset.t)); });

  if (frozenAt) document.body.classList.add('frozen');
  fit();
  if (frozenAt) seek(Number(frozenAt[1]));
  else draw();
})();
