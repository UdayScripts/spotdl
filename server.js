const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

const PORT = 3000;
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

app.use('/downloads', express.static(DOWNLOAD_DIR));

const progressMap = {};

app.get('/download', async (req, res) => {
  const url = req.query.url;

  if (!url || !url.startsWith('https://open.spotify.com/track/')) {
    return res.status(400).json({ error: 'Invalid or missing Spotify track URL' });
  }

  const downloadId = Date.now().toString();
  const outputFolder = path.join(DOWNLOAD_DIR, downloadId);
  fs.mkdirSync(outputFolder);

  progressMap[downloadId] = { progress: 0, status: 'starting' };

  const spotdl = spawn('spotdl', [url, '--print-json', '--output', `${outputFolder}/`]);

  spotdl.stdout.on('data', (data) => {
    const text = data.toString();

    // Print raw output
    process.stdout.write(text);

    // Try parse JSON metadata
    try {
      const json = JSON.parse(text);
      console.log('\n🎵 Track Details');
      console.log('Title:', json.name);
      console.log('Artist:', (json.artists || []).join(', '));
      console.log('Album:', json.album_name);
      console.log('Duration:', json.duration);
      console.log('Release Date:', json.release_date);
      console.log('URL:', json.url);
    } catch (e) {}

    // Extract progress percentage
    const match = text.match(/(\d{1,3})%/);
    if (match) {
      const pct = parseInt(match[1], 10);
      progressMap[downloadId].progress = pct;
      progressMap[downloadId].status = 'downloading';
      console.log(`Download ${downloadId}: ${pct}%`);
    }
  });

  spotdl.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  spotdl.on('close', (code) => {
    if (code !== 0) {
      progressMap[downloadId].status = 'error';
      return;
    }

    const files = fs.readdirSync(outputFolder);
    const file = files.find(f => f.endsWith('.mp3'));

    if (!file) {
      progressMap[downloadId].status = 'error';
      return;
    }

    const encodedFile = encodeURIComponent(file);
    const downloadLink = `/downloads/${downloadId}/${encodedFile}`;

    progressMap[downloadId] = {
      progress: 100,
      status: 'completed',
      link: downloadLink
    };

    console.log(`✅ Download completed: ${downloadLink}`);
  });

  res.json({ downloadId });
});

app.get('/progress/:id', (req, res) => {
  const data = progressMap[req.params.id];
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

exec('spotdl --version', (err, stdout) => {
  if (!err) console.log('🎧 SpotDL Version:', stdout.trim());
  else console.error('❌ SpotDL not found:', err.message);
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
