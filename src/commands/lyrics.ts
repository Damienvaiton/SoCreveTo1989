import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	AttachmentBuilder,
} from "discord.js";
import { fetchLyrics } from "../services/lyricsService.ts";

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
		const lyrics = await fetchLyrics(query);

		if (!lyrics) {
			await interaction.editReply("❌ Paroles introuvables.");
			return;
		}

		// Crée un fichier texte en mémoire avec Buffer
		const buffer = Buffer.from(lyrics, "utf-8");
		const attachment = new AttachmentBuilder(buffer, {
			name: `paroles-${query}.txt`,
		});

		await interaction.editReply({
			content: `🎶 **Paroles pour "${query}"**`,
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
