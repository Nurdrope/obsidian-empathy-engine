# Empathy Engine - Obsidian Plugin

Analyze voice notes for **emotion, sentiment, and authenticity** directly in Obsidian. All processing is local — your voice data never leaves your machine.

## What It Does

Drop an audio file into your vault and Empathy Engine automatically:

1. Sends it to the local EmpathyEngine API for analysis
2. Creates a beautifully formatted analysis note in your `VoiceNotes/` folder
3. Stores raw JSON metadata alongside the note
4. Tags notes with dominant emotion for easy filtering

## What You Get

Each analysis note contains:

- **Emotional Sentiment** — Happy, Sad, Angry, Neutral, Afraid (with visual bars)
- **Voice Prosody** — Pitch, energy level, speech rate
- **Authenticity Score** — How genuine the speech sounds (0-1)
- **Duration** — Length of audio analyzed
- **Transcript** — (optional, if speech-to-text is enabled)

## Requirements

- [EmpathyEngine](https://github.com/Nurdrope/empathy-engine) running locally
- Obsidian 1.0.0+
- Desktop only (uses local API)

## Setup

### 1. Install & Start EmpathyEngine API

```bash
pip install empathy-engine
python -m empathy_engine.api.server
```

API runs on `http://127.0.0.1:8000`

### 2. Install This Plugin

**From Community Plugins (coming soon):**
1. Open Settings > Community plugins
2. Search "Empathy Engine"
3. Install and enable

**Manual Installation:**
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Nurdrope/obsidian-empathy-engine/releases)
2. Create folder: `<your-vault>/.obsidian/plugins/empathy-engine/`
3. Copy the three files into that folder
4. Enable in Settings > Community plugins

### 3. Configure

Open Settings > Empathy Engine:

| Setting | Default | Description |
|---------|---------|-------------|
| **API URL** | `http://127.0.0.1:8000` | EmpathyEngine server address |
| **Attachments Folder** | `Attachments` | Folder to watch for audio files |
| **Output Folder** | `VoiceNotes` | Where analysis notes are created |
| **Audio Extensions** | `wav,mp3,ogg,flac,m4a,webm` | File types to analyze |
| **Auto-Analyze** | `On` | Automatically analyze new audio files |

### 4. Use It

1. Record or drop an audio file into your `Attachments/` folder
2. Plugin detects it automatically
3. Analysis note appears in `VoiceNotes/`
4. JSON metadata saved alongside

## Commands

- **Analyze audio file** — Manually trigger analysis
- **Check EmpathyEngine API status** — Test connection to backend

## Privacy

- All audio processing happens on YOUR machine
- Nothing is sent to the cloud
- No telemetry, no tracking, no data collection
- Open source — inspect every line of code

## Example Output

```markdown
# Empathy Analysis

## Emotional Sentiment

| Emotion | Score | Bar |
|---------|-------|-----|
| Happy   | 15.0% | ███░░░░░░░░░░░░░░░░░ |
| Sad     |  5.0% | █░░░░░░░░░░░░░░░░░░░ |
| Angry   | 10.0% | ██░░░░░░░░░░░░░░░░░░ |
| Neutral | 60.0% | ████████████░░░░░░░░ |
| Afraid  | 10.0% | ██░░░░░░░░░░░░░░░░░░ |

Dominant: neutral (60.0%)

## Voice Prosody
- Pitch Mean: 150.5 Hz
- Energy Level: 45.0%
- Speech Rate: 3.2 words/sec

## Authenticity Score
0.82 / 1.0
```

## Development

```bash
# Clone
git clone https://github.com/Nurdrope/obsidian-empathy-engine
cd obsidian-empathy-engine

# Install deps
npm install

# Dev build (watch mode)
npm run dev

# Production build
npm run build
```

## Links

- **Backend API:** [Nurdrope/empathy-engine](https://github.com/Nurdrope/empathy-engine)
- **Issues:** [Report bugs](https://github.com/Nurdrope/obsidian-empathy-engine/issues)

## License

MIT — See [LICENSE](LICENSE)

---

**Built for people who want to understand their voice without surveillance.** 🎙️❤️
