import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	AttachmentBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	EmbedBuilder,
	GuildPremiumTier,
} from "discord.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const execPromise = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, "../../temp");

// Création du dossier temporaire si manquant
if (!fs.existsSync(TEMP_DIR)) {
	fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export default {
	data: new SlashCommandBuilder()
		.setName("converter")
		.setDescription("Convertit YouTube en MP3 avec le titre de la vidéo")
		.addStringOption((option) =>
			option
				.setName("url")
				.setDescription("Le lien de la vidéo YouTube")
				.setRequired(true)
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const url = interaction.options.getString("url")!;
		const guild = interaction.guild;

		// 1. Détection de la limite d'upload du serveur
		let uploadLimitMB = 10;
		if (guild) {
			if (guild.premiumTier === GuildPremiumTier.Tier2) uploadLimitMB = 50;
			if (guild.premiumTier === GuildPremiumTier.Tier3) uploadLimitMB = 100;
		}

		const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
		if (!ytRegex.test(url)) {
			return interaction.reply({
				content: "❌ Lien YouTube invalide.",
				flags: MessageFlags.Ephemeral,
			});
		}

		// 2. Initialisation de l'Embed de progression
		const embed = new EmbedBuilder()
			.setTitle("📥 Conversion MP3")
			.setDescription(
				`🕒 **Étape 1/3 :** Récupération des infos...\n\`[░░░░░░░░░░░░░░░░░░░░] 0%\``
			)
			.setColor(0xff0000)
			.setFooter({ text: `Limite serveur : ${uploadLimitMB} Mo` });

		await interaction.reply({ embeds: [embed] });

		const fileId = `conv_${interaction.user.id}_${Date.now()}`;
		const filePath = path.join(TEMP_DIR, `${fileId}.mp3`);

		try {
			// ÉTAPE 1 : Récupérer le titre de la vidéo
			const { stdout: videoTitleRaw } = await execPromise(
				`yt-dlp --get-title "${url}"`
			);
			const videoTitle =
				videoTitleRaw.trim().replace(/[^\w\s-]/gi, "") || "audio";

			// ÉTAPE 2 : Téléchargement et conversion
			embed.setDescription(
				`🕒 **Étape 2/3 :** Téléchargement de **${videoTitle}**...\n\`[███████░░░░░░░░░░░░░] 35%\``
			);
			await interaction.editReply({ embeds: [embed] });

			// Commande yt-dlp optimisée pour Docker Alpine
			const command = `yt-dlp --js-runtime node -x --audio-format mp3 --audio-quality 128K "${url}" -o "${TEMP_DIR}/${fileId}.%(ext)s"`;
			await execPromise(command);

			if (!fs.existsSync(filePath))
				throw new Error("Erreur de génération de fichier");

			// ÉTAPE 3 : Vérification de la taille finale
			const stats = fs.statSync(filePath);
			const fileSizeMB = stats.size / (1024 * 1024);

			if (fileSizeMB > uploadLimitMB - 0.2) {
				if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
				return interaction.editReply({
					content: `❌ Fichier trop lourd (${fileSizeMB.toFixed(
						1
					)} Mo) pour la limite de **${uploadLimitMB} Mo** de ce serveur.`,
					embeds: [],
				});
			}

			embed.setDescription(
				`🕒 **Étape 3/3 :** Envoi du fichier vers Discord...\n\`[█████████████████░░░] 85%\``
			);
			await interaction.editReply({ embeds: [embed] });

			// Préparation de l'attachement avec le vrai titre
			const attachment = new AttachmentBuilder(filePath, {
				name: `${videoTitle}.mp3`,
			});

			const btnDelete = new ButtonBuilder()
				.setCustomId(`del_${fileId}`)
				.setLabel("Supprimer du serveur")
				.setStyle(ButtonStyle.Danger)
				.setEmoji("🗑️");

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				btnDelete
			);

			// 3. Envoi final
			const response = await interaction.editReply({
				content: `✅ **${videoTitle}** converti avec succès !`,
				embeds: [],
				files: [attachment],
				components: [row],
			});

			// 4. Système de nettoyage (Collector)
			const collector = response.createMessageComponentCollector({
				time: 30000,
			});

			collector.on("collect", async (i) => {
				if (i.customId === `del_${fileId}`) {
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
					await i.update({
						content: "🗑️ Fichier supprimé du stockage temporaire.",
						files: [],
						components: [],
					});
					collector.stop("manual");
				}
			});

			collector.on("end", (_, reason) => {
				if (reason !== "manual") {
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
						console.log(`[CLEANUP] Suppression auto du fichier ${fileId}.mp3`);
					}
					interaction.editReply({ components: [] }).catch(() => {});
				}
			});
		} catch (error) {
			console.error("[CONVERTER ERROR]", error);
			if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

			interaction.editReply({
				content:
					"❌ Une erreur est survenue (vidéo trop longue, privée ou erreur système).",
				embeds: [],
			});
		}
	},
};
