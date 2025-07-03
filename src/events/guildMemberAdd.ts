// src/events/guildMemberAdd.ts
import { GuildMember } from "discord.js";

export default {
	name: "guildMemberAdd",
	once: false,
	async execute(member: GuildMember) {
		try {
			await member.send(
				`👋 Salut ${member.user.username} ! Bienvenue sur le serveur **${member.guild.name}**.\nN'hésite pas à lire les règles et à te présenter !`
			);
			console.log(`✅ Message de bienvenue envoyé à ${member.user.tag}`);
		} catch (error) {
			console.warn(
				`❌ Impossible d'envoyer un DM à ${member.user.tag} :`,
				error
			);
		}
	},
};
