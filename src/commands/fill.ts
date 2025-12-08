import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	Message,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	TextChannel,
	MessageComponentInteraction,
	MessageFlags,
} from "discord.js";
import { getGapFillData } from "../services/lyricsService.js";

const normalizeString = (str: string): string => {
	if (!str) return "";
	return str
		.toLowerCase()
		.replace(/[.,?!:;“”'"\/]/g, "")
		.trim();
};

export default {
	data: new SlashCommandBuilder()
		.setName("fill")
		.setDescription("Complète les paroles manquantes ! (Complete the lyrics)")
		.addStringOption((option) =>
			option
				.setName("difficulty")
				.setDescription("Niveau de difficulté")
				.setRequired(true)
				.addChoices(
					{ name: "🟢 Facile (1 mot)", value: "easy" },
					{ name: "🟠 Moyen (2 mots)", value: "medium" },
					{ name: "🔴 Difficile (Beaucoup de trous)", value: "hard" }
				)
		)
		.addStringOption((option) =>
			option
				.setName("album")
				.setDescription("Filtrer par album (Optionnel)")
				.setRequired(false)
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.channel || interaction.channel.type !== 0)
			return interaction.reply({
				content: "❌ Salon invalide.",
				flags: MessageFlags.Ephemeral,
			});
		const channel = interaction.channel as TextChannel;

		await interaction.deferReply();

		const albumFilter = interaction.options.getString("album");
		const difficulty = interaction.options.getString("difficulty") as
			| "easy"
			| "medium"
			| "hard";

		const gameData = await getGapFillData(albumFilter, difficulty);

		if (!gameData) {
			return interaction.editReply(
				"❌ Erreur lors de la préparation du jeu (ou album introuvable)."
			);
		}

		// --- AJOUT DU LOG CONSOLE ICI ---
		console.log(`[FILL] 📝 Jeu lancé ! Titre : "${gameData.songTitle}"`);
		console.log(
			`[FILL] 🔑 Réponse attendue : [ ${gameData.missingWords.join(", ")} ]`
		);
		// -------------------------------

		let difficultyColor = 0x00ff00;
		if (difficulty === "medium") difficultyColor = 0xffa500;
		if (difficulty === "hard") difficultyColor = 0xff0000;

		const embed = new EmbedBuilder()
			.setTitle(`📝 Complete the Lyrics (${difficulty.toUpperCase()})`)
			.setDescription(
				`**Retrouve les mots manquants dans cet extrait de ${gameData.songTitle} :**\n\n> 📜 "${gameData.maskedLine}"`
			)
			.setColor(difficultyColor)
			.setFooter({
				text: `Album : ${gameData.album} • Il manque ${gameData.missingWords.length} mot(s) !`,
			})
			.setThumbnail(gameData.cover);

		const btnCancel = new ButtonBuilder()
			.setCustomId("fill_cancel")
			.setLabel("Abandonner / Voir Réponse")
			.setStyle(ButtonStyle.Danger);

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btnCancel);

		const gameMessage = await interaction.editReply({
			embeds: [embed],
			components: [row],
		});

		const collector = channel.createMessageCollector({
			filter: (m: Message<boolean>) => !m.author.bot,
			time: 60000,
		});

		const btnCollector = gameMessage.createMessageComponentCollector({
			filter: (i) => i.customId === "fill_cancel",
			time: 60000,
		});

		let winner: Message | null = null;

		btnCollector.on("collect", async (i) => {
			collector.stop("cancel");
			await i.deferUpdate();
		});

		collector.on("collect", (m) => {
			const guess = normalizeString(m.content);

			const allWordsFound = gameData.missingWords.every((word) =>
				guess.includes(normalizeString(word))
			);

			if (allWordsFound) {
				winner = m;
				collector.stop("winner");
				btnCollector.stop();
			}
		});

		collector.on("end", (_, reason) => {
			(async () => {
				await interaction.editReply({ components: [] }).catch(() => {});

				if (reason === "winner" && winner) {
					console.log(`[FILL] 🏆 Victoire de ${winner.author.tag}`);
					const winEmbed = new EmbedBuilder()
						.setTitle("✅ Correct !")
						.setDescription(
							`Bravo ${winner?.author} !\n\nLa phrase complète était :\n> **"${gameData.originalLine}"**`
						)
						.setColor(0x00ff00);

					winner?.reply({ embeds: [winEmbed] }).catch(() => {});
				} else if (reason === "cancel" || reason === "time") {
					console.log(`[FILL] ❌ Défaite (Raison: ${reason})`);
					const title = reason === "time" ? "⏰ Temps écoulé" : "🏳️ Abandon";
					const loseEmbed = new EmbedBuilder()
						.setTitle(title)
						.setDescription(
							`La phrase complète était :\n> **"${
								gameData.originalLine
							}"**\n\nIl manquait : **${gameData.missingWords.join(", ")}**`
						)
						.setColor(0xff0000);

					interaction.followUp({ embeds: [loseEmbed] }).catch(() => {});
				}
			})();
		});
	},
};
