import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	normalizePath,
	requestUrl,
} from "obsidian";

interface EmpathyEngineSettings {
	apiUrl: string;
	attachmentsFolder: string;
	outputFolder: string;
	audioExtensions: string;
	autoAnalyze: boolean;
}

const DEFAULT_SETTINGS: EmpathyEngineSettings = {
	apiUrl: "http://127.0.0.1:8000",
	attachmentsFolder: "Attachments",
	outputFolder: "VoiceNotes",
	audioExtensions: "wav,mp3,ogg,flac,m4a,webm",
	autoAnalyze: true,
};

interface AnalysisResult {
	sentiment: {
		happy: number;
		sad: number;
		angry: number;
		neutral: number;
		afraid: number;
	};
	prosody: {
		pitch_mean: number;
		energy_mean: number;
		speech_rate: number;
		stress_markers: number[];
	};
	authenticity_score: number;
	duration_seconds: number;
	transcript?: string;
}

export default class EmpathyEnginePlugin extends Plugin {
	settings: EmpathyEngineSettings;
	private processedFiles: Set<string> = new Set();
	private processedPath: string;

	async onload() {
		await this.loadSettings();

		this.processedPath = normalizePath(
			".empathyengine/processed.json"
		);

		// Load previously processed files
		await this.loadProcessedFiles();

		// Watch for new files
		this.registerEvent(
			this.app.vault.on("create", async (file) => {
				if (
					file instanceof TFile &&
					this.settings.autoAnalyze &&
					this.isAudioFile(file) &&
					this.isInWatchFolder(file)
				) {
					await this.processAudioFile(file);
				}
			})
		);

		// Add command to manually analyze
		this.addCommand({
			id: "analyze-audio",
			name: "Analyze audio file",
			callback: () => {
				new Notice("Select an audio file to analyze");
			},
		});

		// Add command to check API health
		this.addCommand({
			id: "check-api-health",
			name: "Check EmpathyEngine API status",
			callback: async () => {
				const healthy = await this.checkApiHealth();
				new Notice(
					healthy
						? "EmpathyEngine API is running"
						: "EmpathyEngine API is not reachable"
				);
			},
		});

		// Add settings tab
		this.addSettingTab(new EmpathyEngineSettingTab(this.app, this));

		// Startup notice
		const healthy = await this.checkApiHealth();
		if (healthy) {
			new Notice("EmpathyEngine connected");
		} else {
			new Notice(
				"EmpathyEngine API not found. Start it with: python -m empathy_engine.api.server"
			);
		}
	}

	async onunload() {
		await this.saveProcessedFiles();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private isAudioFile(file: TFile): boolean {
		const extensions = this.settings.audioExtensions
			.split(",")
			.map((e) => e.trim().toLowerCase());
		return extensions.includes(file.extension.toLowerCase());
	}

	private isInWatchFolder(file: TFile): boolean {
		return file.path.startsWith(this.settings.attachmentsFolder);
	}

	private async loadProcessedFiles() {
		try {
			const file = this.app.vault.getAbstractFileByPath(
				this.processedPath
			);
			if (file instanceof TFile) {
				const content = await this.app.vault.read(file);
				const data = JSON.parse(content);
				this.processedFiles = new Set(data.files || []);
			}
		} catch {
			this.processedFiles = new Set();
		}
	}

	private async saveProcessedFiles() {
		const data = JSON.stringify(
			{ files: Array.from(this.processedFiles) },
			null,
			2
		);
		const dir = normalizePath(".empathyengine");

		// Ensure directory exists
		if (!this.app.vault.getAbstractFileByPath(dir)) {
			await this.app.vault.createFolder(dir);
		}

		const file = this.app.vault.getAbstractFileByPath(
			this.processedPath
		);
		if (file instanceof TFile) {
			await this.app.vault.modify(file, data);
		} else {
			await this.app.vault.create(this.processedPath, data);
		}
	}

	private async checkApiHealth(): Promise<boolean> {
		try {
			const response = await requestUrl({
				url: `${this.settings.apiUrl}/health`,
				method: "GET",
			});
			return response.status === 200;
		} catch {
			return false;
		}
	}

	private async processAudioFile(file: TFile) {
		if (this.processedFiles.has(file.path)) {
			return;
		}

		new Notice(`Analyzing: ${file.name}`);

		try {
			// Read audio binary
			const audioData = await this.app.vault.readBinary(file);

			// Build multipart form data manually for requestUrl
			const boundary =
				"----EmpathyEngine" + Date.now().toString(36);
			const encoder = new TextEncoder();

			const header = encoder.encode(
				`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`
			);
			const footer = encoder.encode(`\r\n--${boundary}--\r\n`);

			const body = new Uint8Array(
				header.length + audioData.byteLength + footer.length
			);
			body.set(header, 0);
			body.set(new Uint8Array(audioData), header.length);
			body.set(footer, header.length + audioData.byteLength);

			const response = await requestUrl({
				url: `${this.settings.apiUrl}/analyze/multimodal`,
				method: "POST",
				headers: {
					"Content-Type": `multipart/form-data; boundary=${boundary}`,
				},
				body: body.buffer,
			});

			const analysis: AnalysisResult = response.json;

			// Create analysis note
			await this.createAnalysisNote(file, analysis);

			// Track processed
			this.processedFiles.add(file.path);
			await this.saveProcessedFiles();

			new Notice(`Analysis complete: ${file.name}`);
		} catch (error) {
			console.error(
				`EmpathyEngine: Failed to analyze ${file.name}`,
				error
			);
			new Notice(
				`Analysis failed: ${file.name}. Is the API running?`
			);
		}
	}

	private async createAnalysisNote(
		sourceFile: TFile,
		analysis: AnalysisResult
	) {
		const now = new Date();
		const timestamp = now
			.toISOString()
			.replace(/[-:T]/g, "")
			.slice(0, 12);
		const noteName = `Empathy - ${timestamp}`;
		const notePath = normalizePath(
			`${this.settings.outputFolder}/${noteName}.md`
		);
		const jsonPath = normalizePath(
			`${this.settings.outputFolder}/${noteName}.json`
		);

		// Ensure output folder exists
		const outputDir = this.settings.outputFolder;
		if (!this.app.vault.getAbstractFileByPath(outputDir)) {
			await this.app.vault.createFolder(outputDir);
		}

		// Determine dominant emotion
		const emotions = analysis.sentiment;
		const dominant = Object.entries(emotions).reduce((a, b) =>
			a[1] > b[1] ? a : b
		);

		const content = `---
source: "[[${sourceFile.path}]]"
timestamp: ${now.toISOString()}
dominant_emotion: ${dominant[0]}
authenticity: ${analysis.authenticity_score?.toFixed(2) || "N/A"}
duration: ${analysis.duration_seconds?.toFixed(1) || "N/A"}s
tags:
  - empathy-analysis
  - voice-note
  - ${dominant[0]}
---

# Empathy Analysis

**Source:** [[${sourceFile.path}]]
**Analyzed:** ${now.toLocaleString()}

---

## Emotional Sentiment

| Emotion | Score | Bar |
|---------|-------|-----|
| Happy | ${(emotions.happy * 100).toFixed(1)}% | ${"█".repeat(Math.round(emotions.happy * 20))}${"░".repeat(20 - Math.round(emotions.happy * 20))} |
| Sad | ${(emotions.sad * 100).toFixed(1)}% | ${"█".repeat(Math.round(emotions.sad * 20))}${"░".repeat(20 - Math.round(emotions.sad * 20))} |
| Angry | ${(emotions.angry * 100).toFixed(1)}% | ${"█".repeat(Math.round(emotions.angry * 20))}${"░".repeat(20 - Math.round(emotions.angry * 20))} |
| Neutral | ${(emotions.neutral * 100).toFixed(1)}% | ${"█".repeat(Math.round(emotions.neutral * 20))}${"░".repeat(20 - Math.round(emotions.neutral * 20))} |
| Afraid | ${(emotions.afraid * 100).toFixed(1)}% | ${"█".repeat(Math.round(emotions.afraid * 20))}${"░".repeat(20 - Math.round(emotions.afraid * 20))} |

**Dominant:** ${dominant[0]} (${(dominant[1] as number * 100).toFixed(1)}%)

---

## Voice Prosody

- **Pitch Mean:** ${analysis.prosody?.pitch_mean?.toFixed(1) || "N/A"} Hz
- **Energy Level:** ${((analysis.prosody?.energy_mean || 0) * 100).toFixed(1)}%
- **Speech Rate:** ${analysis.prosody?.speech_rate?.toFixed(1) || "N/A"} words/sec

---

## Authenticity Score

**${analysis.authenticity_score?.toFixed(2) || "N/A"} / 1.0**

---

## Duration

${analysis.duration_seconds?.toFixed(1) || "N/A"} seconds

${analysis.transcript ? `---\n\n## Transcript\n\n${analysis.transcript}` : ""}
`;

		// Write note
		await this.app.vault.create(notePath, content);

		// Write JSON sidecar
		await this.app.vault.create(
			jsonPath,
			JSON.stringify(analysis, null, 2)
		);
	}
}

class EmpathyEngineSettingTab extends PluginSettingTab {
	plugin: EmpathyEnginePlugin;

	constructor(app: App, plugin: EmpathyEnginePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "EmpathyEngine Settings" });

		containerEl.createEl("p", {
			text: "Analyze voice notes for emotion, sentiment, and authenticity. All processing is local.",
		});

		new Setting(containerEl)
			.setName("API URL")
			.setDesc(
				"EmpathyEngine server address (default: http://127.0.0.1:8000)"
			)
			.addText((text) =>
				text
					.setPlaceholder("http://127.0.0.1:8000")
					.setValue(this.plugin.settings.apiUrl)
					.onChange(async (value) => {
						this.plugin.settings.apiUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Attachments Folder")
			.setDesc("Folder to watch for new audio files")
			.addText((text) =>
				text
					.setPlaceholder("Attachments")
					.setValue(this.plugin.settings.attachmentsFolder)
					.onChange(async (value) => {
						this.plugin.settings.attachmentsFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Output Folder")
			.setDesc("Where to save analysis notes")
			.addText((text) =>
				text
					.setPlaceholder("VoiceNotes")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Audio Extensions")
			.setDesc("Comma-separated list of audio file extensions to watch")
			.addText((text) =>
				text
					.setPlaceholder("wav,mp3,ogg,flac,m4a,webm")
					.setValue(this.plugin.settings.audioExtensions)
					.onChange(async (value) => {
						this.plugin.settings.audioExtensions = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-Analyze")
			.setDesc("Automatically analyze new audio files when detected")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoAnalyze)
					.onChange(async (value) => {
						this.plugin.settings.autoAnalyze = value;
						await this.plugin.saveSettings();
					})
			);

		// API health check button
		new Setting(containerEl)
			.setName("Test Connection")
			.setDesc("Check if EmpathyEngine API is reachable")
			.addButton((btn) =>
				btn.setButtonText("Test").onClick(async () => {
					try {
						const response = await requestUrl({
							url: `${this.plugin.settings.apiUrl}/health`,
							method: "GET",
						});
						if (response.status === 200) {
							new Notice("Connected to EmpathyEngine API");
						} else {
							new Notice("API returned unexpected status");
						}
					} catch {
						new Notice(
							"Cannot reach EmpathyEngine API. Is it running?"
						);
					}
				})
			);
	}
}
