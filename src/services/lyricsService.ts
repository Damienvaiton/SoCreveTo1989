import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GENIUS_API_TOKEN)
	throw new Error("❌ GENIUS_API_TOKEN manquant !");

const GENIUS_API_URL = "https://api.genius.com";
const GENIUS_HEADERS = {
	Authorization: `Bearer ${process.env.GENIUS_API_TOKEN}`,
};

// --- INTERFACE MODIFIÉE ---
export interface GapFillData {
	songTitle: string;
	artist: string;
	album: string;
	cover: string;
	maskedLine: string; // La phrase avec les trous
	originalLine: string; // NOUVEAU : La phrase complète
	missingWords: string[];
}

export interface GameData {
	snippet: string;
	title: string;
	artist: string;
	album: string;
	url: string;
	cover: string;
	allLines: string[];
	startIndex: number;
}
export interface LyricsResult {
	title: string;
	artist: string;
	url: string;
	cover: string;
	lyrics: string;
}
const ALBUM_ORDER = [
	"Taylor Swift",
	"Fearless",
	"Speak Now",
	"Red",
	"1989",
	"reputation",
	"Lover",
	"folklore",
	"evermore",
	"Midnights",
	"The Tortured Poets Department",
	"The Life Of A Showgirl",
];

async function searchSongOnGenius(query: string): Promise<any | null> {
	try {
		const res = await axios.get(`${GENIUS_API_URL}/search`, {
			params: { q: query },
			headers: GENIUS_HEADERS,
		});
		return res.data.response.hits[0]?.result || null;
	} catch (err) {
		return null;
	}
}
async function extractLyricsFromPage(url: string): Promise<string | null> {
	try {
		const res = await axios.get(url);
		const $ = cheerio.load(res.data);
		let lyrics = "";
		$('[data-lyrics-container="true"]').each((_, el) => {
			$(el).find("br").replaceWith("\n");
			lyrics += $(el).text() + "\n\n";
		});
		return (
			lyrics
				.replace(/\[.*?\]/g, "")
				.replace(/^\d+\s+Contributors.*?\n+/s, "")
				.replace(/“.*?” is .*?Read More\n*/s, "")
				.trim() || null
		);
	} catch (err) {
		return null;
	}
}
export function getAvailableAlbums(): string[] {
	try {
		const jsonPath = path.join(process.cwd(), "src", "utils", "TaySongs.json");
		if (!fs.existsSync(jsonPath)) return [];
		const rawData = fs.readFileSync(jsonPath, "utf-8");
		const artistsData = JSON.parse(rawData);
		if (!artistsData?.[0]?.albums) return [];
		const jsonAlbums = Object.keys(artistsData[0].albums);
		return jsonAlbums.sort((a, b) => {
			const indexA = ALBUM_ORDER.findIndex((order) => a.includes(order));
			const indexB = ALBUM_ORDER.findIndex((order) => b.includes(order));
			if (indexA === -1 && indexB === -1) return 0;
			if (indexA === -1) return 1;
			if (indexB === -1) return -1;
			return indexA - indexB;
		});
	} catch (e) {
		return [];
	}
}
export async function getRandomSongSnippet(
	linesRequested: number | null,
	allowedAlbums: string[] | null
): Promise<GameData | null> {
	try {
		const jsonPath = path.join(process.cwd(), "src", "utils", "TaySongs.json");
		if (!fs.existsSync(jsonPath)) return null;
		const rawData = fs.readFileSync(jsonPath, "utf-8");
		const artistsData = JSON.parse(rawData);
		const artistObj = artistsData[0];
		const allAlbumKeys = Object.keys(artistObj.albums);
		let eligibleAlbums: string[] = [];
		if (allowedAlbums && allowedAlbums.length > 0) {
			eligibleAlbums = allAlbumKeys.filter((alb) =>
				allowedAlbums.includes(alb)
			);
		} else {
			eligibleAlbums = allAlbumKeys;
		}
		if (eligibleAlbums.length === 0) return null;
		const randomAlbumName =
			eligibleAlbums[Math.floor(Math.random() * eligibleAlbums.length)];
		const songsList = artistObj.albums[randomAlbumName];
		if (!songsList || songsList.length === 0) return null;
		const randomSongTitle =
			songsList[Math.floor(Math.random() * songsList.length)];
		const songData = await searchSongOnGenius(
			`${artistObj.artist} ${randomSongTitle}`
		);
		if (!songData) return null;
		const fullLyrics = await extractLyricsFromPage(songData.url);
		if (!fullLyrics) return null;
		const snippetSize = linesRequested || 2;
		const lines = fullLyrics.split("\n").filter((l) => l.trim().length > 0);
		if (lines.length <= snippetSize + 1)
			return getRandomSongSnippet(linesRequested, allowedAlbums);
		const randomStart = Math.floor(
			Math.random() * (lines.length - snippetSize)
		);
		const snippet = lines
			.slice(randomStart, randomStart + snippetSize)
			.join("\n");
		if (snippet.toLowerCase().includes(songData.title.toLowerCase()))
			return getRandomSongSnippet(linesRequested, allowedAlbums);
		return {
			snippet: snippet,
			title: songData.title,
			artist: songData.primary_artist.name,
			album: randomAlbumName,
			url: songData.url,
			cover: songData.song_art_image_url || songData.header_image_thumbnail_url,
			allLines: lines,
			startIndex: randomStart,
		};
	} catch (error) {
		return null;
	}
}
export async function fetchLyrics(query: string): Promise<LyricsResult | null> {
	const songData = await searchSongOnGenius(query);
	if (!songData) return null;
	const lyricsText = await extractLyricsFromPage(songData.url);
	if (!lyricsText) return null;
	return {
		title: songData.title,
		artist: songData.primary_artist.name,
		url: songData.url,
		cover: songData.song_art_image_url || songData.header_image_thumbnail_url,
		lyrics: lyricsText,
	};
}

// --- FONCTION JEU /FILL ---
export async function getGapFillData(
	albumFilter: string | null,
	difficulty: "easy" | "medium" | "hard"
): Promise<GapFillData | null> {
	try {
		const jsonPath = path.join(process.cwd(), "src", "utils", "TaySongs.json");
		if (!fs.existsSync(jsonPath)) return null;
		const rawData = fs.readFileSync(jsonPath, "utf-8");
		const artistsData = JSON.parse(rawData);
		const artistObj = artistsData[0];

		let randomAlbumName: string;
		let songsList: string[];
		const albumKeys = Object.keys(artistObj.albums);

		if (albumFilter && albumFilter !== "Tous") {
			const foundKey = albumKeys.find((key) =>
				key.toLowerCase().includes(albumFilter.toLowerCase())
			);
			if (!foundKey) return null;
			randomAlbumName = foundKey;
		} else {
			randomAlbumName = albumKeys[Math.floor(Math.random() * albumKeys.length)];
		}
		songsList = artistObj.albums[randomAlbumName];
		const randomSongTitle =
			songsList[Math.floor(Math.random() * songsList.length)];

		console.log(`[FILL] 🎲 Tirage (${difficulty}): ${randomSongTitle}`);
		const songData = await searchSongOnGenius(
			`${artistObj.artist} ${randomSongTitle}`
		);
		if (!songData) return null;
		const fullLyrics = await extractLyricsFromPage(songData.url);
		if (!fullLyrics) return null;

		const lines = fullLyrics.split("\n").filter((l) => l.trim().length > 0);
		if (lines.length < 5) return getGapFillData(albumFilter, difficulty);

		const randomLineIndex = Math.floor(Math.random() * (lines.length - 2)) + 1;

		// IMPORTANT : On garde la ligne originale ici
		const originalLine = lines[randomLineIndex];

		const words = originalLine.split(" ");

		const eligibleIndices = words
			.map((word, index) => ({ word, index }))
			.filter((item) => item.word.replace(/[^a-zA-Z]/g, "").length >= 4)
			.map((item) => item.index);

		if (eligibleIndices.length < 2)
			return getGapFillData(albumFilter, difficulty);

		let indicesToHide: number[] = [];
		const missingWords: string[] = [];

		if (difficulty === "easy") {
			indicesToHide.push(
				eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)]
			);
		} else if (difficulty === "medium") {
			if (eligibleIndices.length >= 2) {
				const shuffled = eligibleIndices.sort(() => 0.5 - Math.random());
				indicesToHide = shuffled.slice(0, 2);
			} else {
				indicesToHide = eligibleIndices;
			}
		} else if (difficulty === "hard") {
			const count = Math.ceil(eligibleIndices.length * 0.5);
			const shuffled = eligibleIndices.sort(() => 0.5 - Math.random());
			indicesToHide = shuffled.slice(0, count);
		}

		// On masque les mots dans le tableau 'words'
		indicesToHide.forEach((index) => {
			const originalWord = words[index];
			const cleanWord = originalWord.replace(/[^a-zA-Z0-9À-ÿ]/g, "");
			missingWords.push(cleanWord);
			words[index] = "________";
		});

		return {
			songTitle: songData.title,
			artist: songData.primary_artist.name,
			album: randomAlbumName,
			cover: songData.song_art_image_url || songData.header_image_thumbnail_url,
			maskedLine: words.join(" "), // La version avec les trous
			originalLine: originalLine, // NOUVEAU : La version originale complète
			missingWords: missingWords,
		};
	} catch (e) {
		console.error("[FILL] Erreur:", e);
		return null;
	}
}
