import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	AttachmentBuilder,
} from "discord.js";
import { fetchLyrics } from "../services/lyricsService.js";

const data = new SlashCommandBuilder()
	.setName("lyrics")
	.setDescription("Affiche les paroles d'une chanson via Genius")
	.addStringOption((option) =>
		option
			.setName("query")
			.setDescription("Titre et/ou artiste de la chanson")
			.setRequired(true)
	);

async function execute(interaction: ChatInputCommandInteraction) {
	const query = interaction.options.getString("query", true);
	await interaction.deferReply();

	try {
		const result = await fetchLyrics(query);

		if (!result) {
			await interaction.editReply("❌ Paroles introuvables.");
			return;
		}

		// On crée le fichier
		const buffer = Buffer.from(result.lyrics, "utf-8"); // result.lyrics est bien une string maintenant

		// Nom de fichier propre (sans caractères bizarres)
		const safeTitle = result.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
		const attachment = new AttachmentBuilder(buffer, {
			name: `paroles-${safeTitle}.txt`,
		});

		// Réponse avec le titre et l'artiste (dispo grâce à l'objet LyricsResult)
		await interaction.editReply({
			content: `🎶 **Paroles pour "${result.title}"** de **${result.artist}**\n*(Voir fichier joint)*`,
			files: [attachment],
		});
	} catch (error) {
		console.error("❌ Erreur dans /lyrics :", error);
		await interaction.editReply(
			"❌ Erreur interne lors de la récupération des paroles."
		);
	}
}

export default {
	data,
	execute,
};
