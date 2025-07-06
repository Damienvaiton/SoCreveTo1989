import axios from "axios";
import * as cheerio from "cheerio";

// Vérifie qu'on a bien la variable d'environnement
if (!process.env.GENIUS_API_TOKEN) {
	throw new Error(
		"❌ Variable GENIUS_API_TOKEN non définie dans le fichier .env ! Veuillez définir cette variable pour utiliser l'API Genius."
	);
}

// Configuration de l'API Genius
const GENIUS_API_URL = "https://api.genius.com";
const GENIUS_HEADERS = {
	Authorization: `Bearer ${process.env.GENIUS_API_TOKEN!}`,
};

/**
 * Recherche l'URL d'une chanson sur Genius en utilisant la recherche par mot-clé.
 */
async function searchSongOnGenius(query: string): Promise<string | null> {
	try {
		const res = await axios.get(`${GENIUS_API_URL}/search`, {
			params: { q: query },
			headers: GENIUS_HEADERS,
		});

		const hits = res.data.response.hits;
		if (hits.length === 0) return null;

		// Retourne l'URL de la première chanson trouvée
		return hits[0].result.url;
	} catch (err) {
		console.error("❌ Erreur lors de la recherche Genius :", err);
		return null;
	}
}

/**
 * Récupère les paroles en scrapant la page de Genius.
 */
async function extractLyricsFromPage(url: string): Promise<string | null> {
	try {
		const res = await axios.get(url);
		const $ = cheerio.load(res.data);

		const lyricsContainers = $("[data-lyrics-container]");
		const lyricsLines: string[] = [];

		lyricsContainers.each((_, el) => {
			$(el)
				.contents()
				.each((_, node) => {
					if (node.type === "text") {
						const text = $(node).text().trim();
						if (text) lyricsLines.push(text);
					} else if (node.type === "tag") {
						const tagName = (node as any).name;
						if (tagName === "br") {
							lyricsLines.push(""); // saut de ligne
						} else {
							const text = $(node).text().trim();
							if (text) lyricsLines.push(text);
						}
					}
				});
		});

		let cleanLyrics = lyricsLines.join("\n");

		// Nettoyage : supprime les blocs inutiles
		cleanLyrics = cleanLyrics.replace(/^\d+\s+Contributors.*?\n+/s, "");
		cleanLyrics = cleanLyrics.replace(/“.*?” is .*?Read More\n*/s, "");

		return cleanLyrics.trim() || null;
	} catch (err) {
		console.error("❌ Erreur lors du scraping des paroles :", err);
		return null;
	}
}

/**
 * Fonction principale appelée par la commande /lyrics.
 */
export async function fetchLyrics(query: string): Promise<string | null> {
	const url = await searchSongOnGenius(query);
	if (!url) return null;

	const lyrics = await extractLyricsFromPage(url);
	return lyrics;
}
