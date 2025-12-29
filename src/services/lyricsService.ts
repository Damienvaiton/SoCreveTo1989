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

// --- INTERFACES ---

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

export interface GapFillData {
	songTitle: string;
	artist: string;
	album: string;
	cover: string;
	maskedLine: string;
	originalLine: string;
	missingWords: string[];
}

export interface LyricsResult {
	title: string;
	artist: string;
	url: string;
	cover: string;
	lyrics: string;
}

// Ordre chronologique
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
	"Singles & Holiday",
];

// --- HISTORIQUE DE TIRAGE (Gestion en mémoire avec Timeout) ---
const RECENT_SONGS = new Set<string>();
const HISTORY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes en millisecondes
const MAX_HISTORY_SIZE = 15; // Taille fixe de l'historique
let lastActivityTimestamp = Date.now(); // Horodatage de la dernière partie

/**
 * Normalise un titre et le stocke dans l'historique.
 * Nettoie l'historique si la taille maximale est atteinte, et met à jour l'horodatage.
 */
function updateRecentSongs(title: string) {
	const normalizedTitle = normalizeTitle(title);
	RECENT_SONGS.add(normalizedTitle);

	// Mise à jour de l'horodatage
	lastActivityTimestamp = Date.now();

	if (RECENT_SONGS.size > MAX_HISTORY_SIZE) {
		console.log(
			`[HISTORY] 🧹 Nettoyage de l'historique (${RECENT_SONGS.size} > ${MAX_HISTORY_SIZE}).`
		);

		// On garde les éléments les plus récents (les 'MAX_HISTORY_SIZE' derniers)
		const songsArray = Array.from(RECENT_SONGS);
		const newSongsArray = songsArray.slice(
			songsArray.length - MAX_HISTORY_SIZE
		);
		RECENT_SONGS.clear();
		newSongsArray.forEach((song) => RECENT_SONGS.add(song));
	}
}

/**
 * Vérifie si le délai d'inactivité a été dépassé (10 minutes) et réinitialise l'historique si nécessaire.
 */
function checkAndResetHistory() {
	const currentTime = Date.now();
	if (currentTime - lastActivityTimestamp > HISTORY_TIMEOUT_MS) {
		console.log(
			`[HISTORY] ⏲️ Réinitialisation de l'historique (Inactivité > 10 min).`
		);
		RECENT_SONGS.clear();
	}
}

// --- OUTILS DE NETTOYAGE ---

export const normalizeTitle = (title: string) => {
	let clean = title
		.toLowerCase()
		.replace(/[\u2018\u2019`]/g, "'")
		.replace(
			/\s*([(\[\-]|\s)(taylor's version|from the vault|10 minute version|remix|live).*?([)\]]|$)/gi,
			""
		)
		.trim();

	// Prédictif/Tolérance : Remplacement des symboles courants
	clean = clean.replace(/&/g, "and").replace(/@/g, "at").replace(/ñ/g, "n");

	// Suppression de la ponctuation pour la comparaison
	clean = clean.replace(/[.,?!:;“”'"\/]/g, "");

	return clean.replace(/\s+/g, " ").trim();
};

// Fonction pour échapper les caractères spéciaux dans la Regex
function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- IMPLEMENTATION LEVENSHTEIN EN JS PUR ---
/**
 * Calcule la distance de Levenshtein (nombre d'éditions pour passer de s1 à s2).
 */
export function levenshteinDistance(s1: string, s2: string): number {
	const len1 = s1.length;
	const len2 = s2.length;

	const d: number[][] = [];

	for (let i = 0; i <= len1; i++) {
		d[i] = [i];
	}
	for (let j = 0; j <= len2; j++) {
		d[0][j] = j;
	}

	for (let i = 1; i <= len1; i++) {
		for (let j = 1; j <= len2; j++) {
			const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
			d[i][j] = Math.min(
				d[i - 1][j] + 1,
				d[i][j - 1] + 1,
				d[i - 1][j - 1] + cost
			);
		}
	}

	return d[len1][len2];
}

// --- LOGIQUE DE RECHERCHE GENIUS ---

async function searchSongOnGenius(
	query: string,
	expectedTitle: string
): Promise<any | null> {
	try {
		const res = await axios.get(`${GENIUS_API_URL}/search`, {
			params: { q: query },
			headers: GENIUS_HEADERS,
		});

		const hits = res.data.response.hits || [];
		if (hits.length === 0) return null;

		const expectedNormalized = normalizeTitle(expectedTitle);

		// --- PHASE 1 : RECHERCHE STRICTE (REGEX) ---

		const strictMatch = hits.find((hit: any) => {
			const result = hit.result;
			const isTaylorSwift = result.primary_artist.name.includes("Taylor Swift");
			const resultNormalized = normalizeTitle(result.title);

			const regex = new RegExp(
				`^${escapeRegExp(expectedNormalized)}($|[^a-z0-9])`,
				"i"
			);

			return isTaylorSwift && regex.test(resultNormalized);
		});

		if (strictMatch) {
			console.log(
				`[GENIUS] 🎯 Match STRICT confirmé : "${strictMatch.result.title}"`
			);
			return strictMatch.result;
		}

		// --- PHASE 2 : RECHERCHE FLOUE (Distance de Levenshtein) ---

		console.warn(
			`[GENIUS] ⚠️ Match strict échoué pour "${expectedTitle}". Tentative de recherche floue...`
		);

		let bestMatch = null;
		let minDistance = Infinity;

		const taylorHits = hits.filter((hit: any) =>
			hit.result.primary_artist.name.includes("Taylor Swift")
		);

		for (const hit of taylorHits) {
			const result = hit.result;
			const resultNormalized = normalizeTitle(result.title);

			const distance = levenshteinDistance(
				expectedNormalized,
				resultNormalized
			);

			if (distance < minDistance) {
				minDistance = distance;
				bestMatch = result;
			}
		}

		const titleLength = expectedNormalized.length;
		const acceptableThreshold = Math.min(3, Math.ceil(titleLength * 0.3));

		if (bestMatch && minDistance <= acceptableThreshold) {
			console.log(
				`[GENIUS] 🧩 Match FLOU trouvé. Titre: "${bestMatch.title}", Distance: ${minDistance}`
			);
			return bestMatch;
		}

		// --- PHASE 3 : REPLI PAR DÉFAUT ---

		console.warn(
			`[GENIUS] ❌ Aucun match fiable trouvé. Retourne le 1er résultat de l'API.`
		);
		return hits[0]?.result || null;
	} catch (err) {
		console.error("[GENIUS] Erreur recherche :", err);
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

// --- FONCTION 1 : BLIND TEST (/guess) ---
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

		const albumCount = eligibleAlbums.length;
		const useHistory = albumCount > 4;

		if (useHistory) {
			// --- VÉRIFICATION ET RÉINITIALISATION DE L'HISTORIQUE ---
			checkAndResetHistory();
			console.log(`[HISTORY] Historique ACTIF (Albums: ${albumCount}).`);

			// --- LOG D'AFFICHAGE DE L'HISTORIQUE (Juste avant le tirage) ---
			console.log("-----------------------------------------");
			console.log(`[HISTORY] État: [ ${Array.from(RECENT_SONGS).join(", ")} ]`);
			console.log("-----------------------------------------");
			// ------------------------------------------------------------------------
		} else {
			console.log(
				`[HISTORY] Historique INACTIF (Albums: ${albumCount}). Rotation libre.`
			);
		}

		let songPool: { title: string; album: string; normalized: string }[] = [];
		for (const albumName of eligibleAlbums) {
			const songs = artistObj.albums[albumName];
			if (songs && songs.length > 0) {
				for (const song of songs) {
					songPool.push({
						title: song,
						album: albumName,
						normalized: normalizeTitle(song),
					});
				}
			}
		}

		if (songPool.length === 0) return null;

		// --- LOGIQUE D'EXCLUSION DE L'HISTORIQUE (Conditionnelle) ---
		let randomSelection: {
			title: string;
			album: string;
			normalized: string;
		} | null = null;

		if (useHistory) {
			let attempts = 0;
			const MAX_ATTEMPTS = songPool.length * 2;

			while (attempts < MAX_ATTEMPTS) {
				attempts++;

				const selection = songPool[Math.floor(Math.random() * songPool.length)];

				if (!RECENT_SONGS.has(selection.normalized)) {
					randomSelection = selection;
					break;
				}

				if (attempts === MAX_ATTEMPTS) {
					console.warn(
						`[HISTORY] ❌ Échec du tirage GUESS après ${MAX_ATTEMPTS} tentatives. Forçage du nettoyage.`
					);
					// On vide l'historique et on accepte le tirage pour ne pas bloquer le jeu
					RECENT_SONGS.clear();
					randomSelection =
						songPool[Math.floor(Math.random() * songPool.length)];
					break;
				}
			}
		} else {
			// Pas d'historique : tirage simple
			randomSelection = songPool[Math.floor(Math.random() * songPool.length)];
		}

		if (!randomSelection) {
			console.error(
				"[GUESS] Erreur critique: Impossible de sélectionner une chanson."
			);
			return null;
		}

		const randomSongTitle = randomSelection.title;
		const randomAlbumName = randomSelection.album;

		console.log(
			`[GUESS] 🎲 Tirage: "${randomSongTitle}" (Album: ${randomAlbumName})`
		);
		// ---------------------------------------------------

		const songData = await searchSongOnGenius(
			`${artistObj.artist} ${randomSongTitle}`,
			randomSongTitle
		);

		if (!songData) return null;

		const fullLyrics = await extractLyricsFromPage(songData.url);
		if (!fullLyrics) return null;

		const snippetSize = linesRequested || 2;
		const lines = fullLyrics.split("\n").filter((l) => l.trim().length > 0);

		if (lines.length <= snippetSize + 1) {
			console.warn(
				`[GUESS] ⚠️ Titre ignoré : "${songData.title}" a trop peu de lignes (${lines.length}). Nouveau tirage...`
			);
			return getRandomSongSnippet(linesRequested, allowedAlbums);
		}

		const randomStart = Math.floor(
			Math.random() * (lines.length - snippetSize)
		);
		const snippet = lines
			.slice(randomStart, randomStart + snippetSize)
			.join("\n");

		// Mise à jour de l'historique SEULEMENT si l'historique est actif
		if (useHistory) {
			updateRecentSongs(randomSelection.title);
		}

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
		console.error("Erreur jeu :", error);
		return null;
	}
}

// --- FONCTION 2 : TEXTE A TROUS (/fill) ---
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

		const allAlbumKeys = Object.keys(artistObj.albums);
		let eligibleAlbums: string[] = [];

		if (albumFilter && albumFilter !== "Tous") {
			const foundKey = allAlbumKeys.find((key) =>
				key.toLowerCase().includes(albumFilter.toLowerCase())
			);
			if (!foundKey) return null;
			eligibleAlbums = [foundKey];
		} else {
			eligibleAlbums = allAlbumKeys;
		}

		if (eligibleAlbums.length === 0) return null;

		const albumCount = eligibleAlbums.length;
		const useHistory = albumCount > 4;

		if (useHistory) {
			// --- VÉRIFICATION ET RÉINITIALISATION DE L'HISTORIQUE ---
			checkAndResetHistory();
			console.log(`[HISTORY] Historique ACTIF (Albums: ${albumCount}).`);

			// --- LOG D'AFFICHAGE DE L'HISTORIQUE (Juste avant le tirage) ---
			console.log("-----------------------------------------");
			console.log(`[HISTORY] État: [ ${Array.from(RECENT_SONGS).join(", ")} ]`);
			console.log("-----------------------------------------");
			// ------------------------------------------------------------------------
		} else {
			console.log(
				`[HISTORY] Historique INACTIF (Albums: ${albumCount}). Rotation libre.`
			);
		}

		let songPool: { title: string; album: string; normalized: string }[] = [];
		for (const albumName of eligibleAlbums) {
			const songs = artistObj.albums[albumName];
			if (songs && songs.length > 0) {
				for (const song of songs) {
					songPool.push({
						title: song,
						album: albumName,
						normalized: normalizeTitle(song),
					});
				}
			}
		}

		if (songPool.length === 0) return null;

		// --- LOGIQUE D'EXCLUSION DE L'HISTORIQUE pour /fill (Conditionnelle) ---
		let randomSelection: {
			title: string;
			album: string;
			normalized: string;
		} | null = null;

		if (useHistory) {
			let attempts = 0;
			const MAX_ATTEMPTS = songPool.length * 2;

			while (attempts < MAX_ATTEMPTS) {
				attempts++;

				const selection = songPool[Math.floor(Math.random() * songPool.length)];

				if (!RECENT_SONGS.has(selection.normalized)) {
					randomSelection = selection;
					break;
				}

				if (attempts === MAX_ATTEMPTS) {
					console.warn(
						`[HISTORY] ❌ Échec du tirage FILL après ${MAX_ATTEMPTS} tentatives. Forçage du nettoyage.`
					);
					RECENT_SONGS.clear();
					randomSelection =
						songPool[Math.floor(Math.random() * songPool.length)];
					break;
				}
			}
		} else {
			// Pas d'historique : tirage simple
			randomSelection = songPool[Math.floor(Math.random() * songPool.length)];
		}

		if (!randomSelection) {
			console.error(
				"[FILL] Erreur critique: Impossible de sélectionner une chanson."
			);
			return null;
		}

		const randomSongTitle = randomSelection.title;
		const randomAlbumName = randomSelection.album;

		console.log(`[FILL] 🎲 Tirage: "${randomSongTitle}"`);
		// ---------------------------------------------------

		const songData = await searchSongOnGenius(
			`${artistObj.artist} ${randomSongTitle}`,
			randomSongTitle
		);

		if (!songData) return null;
		const fullLyrics = await extractLyricsFromPage(songData.url);
		if (!fullLyrics) return null;

		const lines = fullLyrics.split("\n").filter((l) => l.trim().length > 0);
		if (lines.length < 5) return getGapFillData(albumFilter, difficulty);

		const randomLineIndex = Math.floor(Math.random() * (lines.length - 2)) + 1;
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

		indicesToHide.forEach((index) => {
			const originalWord = words[index];
			const cleanWord = originalWord.replace(/[^a-zA-Z0-9À-ÿ]/g, "");
			missingWords.push(cleanWord);
			words[index] = "________";
		});

		// Mise à jour de l'historique SEULEMENT si l'historique est actif
		if (useHistory) {
			updateRecentSongs(randomSelection.title);
		}

		return {
			songTitle: songData.title,
			artist: songData.primary_artist.name,
			album: randomAlbumName,
			cover: songData.song_art_image_url || songData.header_image_thumbnail_url,
			maskedLine: words.join(" "),
			originalLine: originalLine,
			missingWords: missingWords,
		};
	} catch (e) {
		console.error("[FILL] Erreur:", e);
		return null;
	}
}

// --- FONCTION 3 : RECHERCHE (/lyrics) ---
export async function fetchLyrics(query: string): Promise<LyricsResult | null> {
	const songData = await searchSongOnGenius(query, query);
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
