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

// Store progress by downloadId
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

    // Print raw output to console
    process.stdout.write(text);

    // Try to parse JSON metadata from SpotDL
    try {
      const json = JSON.parse(text);
      console.log('🎵 Track Details:');
      console.log('Title:', json.name);
      console.log('Artist:', json.artists?.join(', '));
      console.log('Album:', json.album_name);
      console.log('Duration:', json.duration);
      console.log('Release Date:', json.release_date);
      console.log('URL:', json.url);
    } catch (e) {}

    // Try to extract percentage like "45%"
    const match = text.match(/(\d{1,3})%/);
    if (match) {
      progressMap[downloadId].progress = parseInt(match[1], 10);
      progressMap[downloadId].status = 'downloading';

      console.log(`Download ${downloadId}: ${match[1]}%`);
    }
    }
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
  });

  res.json({ downloadId });
});

// Endpoint to check progress
app.get('/progress/:id', (req, res) => {
  const data = progressMap[req.params.id];
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

exec('spotdl --version', (err, stdout) => {
  if (!err) console.log('SpotDL Version:', stdout.trim());
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
