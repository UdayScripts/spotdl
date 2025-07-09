const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

const PORT = 3000;
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

// Create 'downloads' folder if not exists
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

// Serve static files
app.use('/downloads', express.static(DOWNLOAD_DIR));

app.get('/download', async (req, res) => {
  const url = req.query.url;

  if (!url || !url.startsWith('https://open.spotify.com/track/')) {
    return res.status(400).json({ error: '❌ Invalid or missing Spotify track URL' });
  }

  const downloadId = Date.now();
  const outputFolder = path.join(DOWNLOAD_DIR, `${downloadId}`);
  fs.mkdirSync(outputFolder);

  const command = `spotdl "${url}" --output "${outputFolder}/"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Download Error:', stderr || error.message);
      return res.status(500).json({ error: 'Download failed', detail: stderr || error.message });
    }

    const files = fs.readdirSync(outputFolder);
    const file = files.find(f => f.endsWith('.mp3'));

    if (!file) {
      return res.status(500).json({ error: '❌ MP3 file not found after download' });
    }

    const encodedFile = encodeURIComponent(file);
    const downloadLink = `${req.protocol}://${req.get('host')}/downloads/${downloadId}/${encodedFile}`;

    res.json({ success: true, link: downloadLink });
  });
});

// Optional: log SpotDL version
exec('spotdl --version', (err, stdout) => {
  if (!err) console.log('🎧 SpotDL Version:', stdout.trim());
  else console.error('❌ SpotDL not found:', err.message);
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
