'use strict';
const { execFileSync } = require('node:child_process');

let cached = null;

// ffmpeg ships with the imageio-ffmpeg Python package (see python/requirements.txt).
function ffmpegPath() {
  if (cached) return cached;
  if (process.env.STANZY_FFMPEG) return (cached = process.env.STANZY_FFMPEG);
  const py = process.env.STANZY_PYTHON || 'python3';
  cached = execFileSync(py, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim();
  return cached;
}

module.exports = { ffmpegPath };
