import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";

const TARGET_GUILD_ID = "1053328889956532234";
const ROLE_ID_TO_GIVE = "1453443148612239400";

export default {
	data: new SlashCommandBuilder()
		.setName("check-roles")
		.setDescription(
			"Vérifie et donne le rôle manquant à tous les membres du serveur"
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers), // Réservé aux "Animateurs/Modos"

	async execute(interaction: ChatInputCommandInteraction) {
		// Sécurité : Vérifier qu'on est sur le bon serveur
		if (interaction.guildId !== TARGET_GUILD_ID) {
			return interaction.reply({
				content: "❌ Cette commande n'est pas utilisable sur ce serveur.",
				flags: MessageFlags.Ephemeral,
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			// 1. Récupérer tous les membres (fetch forcé pour éviter le cache incomplet)
			const members = await interaction.guild!.members.fetch();
			let count = 0;

			const embed = new EmbedBuilder()
				.setTitle("🔍 Vérification des rôles")
				.setDescription("Analyse des membres en cours...")
				.setColor(0x5865f2);

			await interaction.editReply({ embeds: [embed] });

			// 2. Boucler sur les membres
			for (const [id, member] of members) {
				// On ignore les bots et ceux qui ont déjà le rôle
				if (!member.user.bot && !member.roles.cache.has(ROLE_ID_TO_GIVE)) {
					await member.roles.add(ROLE_ID_TO_GIVE);
					count++;
				}
			}

			// 3. Résultat final
			embed
				.setDescription(
					`✅ Vérification terminée !\n\n**${count}** membres ont reçu le rôle <@&${ROLE_ID_TO_GIVE}>.`
				)
				.setColor(0x2ecc71);

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error("[CHECK-ROLES ERROR]", error);
			await interaction.editReply(
				"❌ Une erreur est survenue (vérifiez la hiérarchie des rôles du bot)."
			);
		}
	},
};
