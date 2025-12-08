import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	Message,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	TextChannel,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	MessageComponentInteraction,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	MessageFlags,
	User,
} from "discord.js";
import {
	getRandomSongSnippet,
	getAvailableAlbums,
} from "../services/lyricsService.js";

// --- SYSTEME DE MEMOIRE ---
interface UserConfig {
	selectedAlbums: string[];
	lines: number;
	hintsEnabled: boolean;
	lastUpdated: number;
}
const userConfigs = new Map<string, UserConfig>();
const CONFIG_EXPIRATION_MS = 5 * 60 * 1000;

// --- GESTION DES PARTIES EN COURS ---
const activeGames = new Set<string>();

// IDs Configuration
const ID_CONF_MODE = "conf_mode";
const ID_CONF_LINES = "conf_lines";
const ID_CONF_HINTS = "conf_hints";
const ID_CONF_START = "conf_start";
const ID_MODAL_LINES = "modal_lines";
const ID_INPUT_LINES = "input_lines";

// IDs Jeu
const ID_GAME_CANCEL = "game_cancel";
const ID_GAME_HINT_ALBUM = "game_hint_album";
const ID_GAME_HINT_PENDU = "game_hint_pendu";
const ID_GAME_HINT_LYRICS = "game_hint_lyrics";

// Outils
const cleanTitleForGame = (title: string) =>
	title
		.replace(
			/\s*[\(\[]?(Taylor's Version|From The Vault|10 Minute Version)[\)\]]?/gi,
			""
		)
		.trim();
const normalizeString = (str: string) =>
	cleanTitleForGame(str)
		.toLowerCase()
		.replace(/[.,?!:;“”'"\/]/g, "")
		.replace(/\s+/g, " ")
		.trim();
const generateHangman = (title: string) =>
	cleanTitleForGame(title).replace(/[a-zA-Z0-9À-ÿ]/g, "_ ");

export default {
	data: new SlashCommandBuilder()
		.setName("guess")
		.setDescription("Lance une partie de Blind Test (Configuration incluse)")
		// AJOUT DE L'OPTION DUEL
		.addUserOption((option) =>
			option
				.setName("duel")
				.setDescription("Défier un utilisateur spécifique (Optionnel)")
				.setRequired(false)
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.channel || interaction.channel.type !== 0)
			return interaction.reply({
				content: "❌ Salon invalide.",
				flags: MessageFlags.Ephemeral,
			});
		const channel = interaction.channel as TextChannel;

		// --- 0. RECUPERATION DU DUEL ---
		const opponent = interaction.options.getUser("duel");

		// Petites vérifications anti-troll
		if (opponent) {
			if (opponent.bot)
				return interaction.reply({
					content:
						"🤖 Tu ne peux pas défier un robot (il gagnerait tout le temps).",
					flags: MessageFlags.Ephemeral,
				});
			if (opponent.id === interaction.user.id)
				return interaction.reply({
					content: "🪞 Tu ne peux pas te défier toi-même.",
					flags: MessageFlags.Ephemeral,
				});
		}

		// --- 1. VERIFICATION ANTI-SPAM ---
		if (activeGames.has(channel.id)) {
			return interaction.reply({
				content:
					"🚫 **Une partie est déjà en cours !** Finissez-la avant de relancer.",
				flags: MessageFlags.Ephemeral,
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		activeGames.add(channel.id);

		try {
			const allAlbums = getAvailableAlbums();

			// 2. CHARGEMENT CONFIG
			let config = {
				selectedAlbums: [...allAlbums],
				lines: 2,
				hintsEnabled: true,
			};

			const savedConfig = userConfigs.get(interaction.user.id);
			if (
				savedConfig &&
				Date.now() - savedConfig.lastUpdated < CONFIG_EXPIRATION_MS
			) {
				config.selectedAlbums = savedConfig.selectedAlbums;
				config.lines = savedConfig.lines;
				config.hintsEnabled = savedConfig.hintsEnabled;
			}

			const saveConfigToCache = () => {
				userConfigs.set(interaction.user.id, {
					...config,
					lastUpdated: Date.now(),
				});
			};

			// 3. DASHBOARD
			const renderDashboard = () => {
				const isAllSelected = config.selectedAlbums.length === allAlbums.length;
				const albumText = isAllSelected
					? "Tous les albums (Aléatoire)"
					: `${config.selectedAlbums.length} albums sélectionnés`;

				// Texte personnalisé si c'est un duel
				const duelText = opponent
					? `⚔️ **DUEL** contre ${opponent.username}`
					: "🌍 Mode Solo / Public";

				const embed = new EmbedBuilder()
					.setTitle("🎛️ Configuration du Blind Test")
					.setDescription(
						`Configure ta partie avant de lancer !\n\n${duelText}`
					)
					.setColor(opponent ? 0xff0000 : 0x2b2d31) // Rouge si Duel
					.addFields(
						{ name: "💿 Albums", value: albumText, inline: true },
						{ name: "📝 Lignes", value: `${config.lines}`, inline: true },
						{
							name: "💡 Indices",
							value: config.hintsEnabled ? "✅ Activés" : "❌ Désactivés",
							inline: true,
						}
					);

				const menuOptions = allAlbums
					.slice(0, 25)
					.map((alb: string) =>
						new StringSelectMenuOptionBuilder()
							.setLabel(alb)
							.setValue(alb)
							.setDefault(config.selectedAlbums.includes(alb))
					);

				const selectMenu = new StringSelectMenuBuilder()
					.setCustomId(ID_CONF_MODE)
					.setPlaceholder("Filtrer les albums...")
					.setMinValues(1)
					.setMaxValues(menuOptions.length)
					.addOptions(menuOptions);

				const btnLines = new ButtonBuilder()
					.setCustomId(ID_CONF_LINES)
					.setLabel(`Lignes : ${config.lines}`)
					.setStyle(ButtonStyle.Secondary)
					.setEmoji("✏️");
				const btnHints = new ButtonBuilder()
					.setCustomId(ID_CONF_HINTS)
					.setLabel(config.hintsEnabled ? "Indices : ON" : "Indices : OFF")
					.setStyle(
						config.hintsEnabled ? ButtonStyle.Success : ButtonStyle.Danger
					);
				const btnStart = new ButtonBuilder()
					.setCustomId(ID_CONF_START)
					.setLabel("Lancer")
					.setStyle(ButtonStyle.Primary)
					.setEmoji(opponent ? "⚔️" : "🚀");

				const row1 =
					new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
						selectMenu
					);
				const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
					btnLines,
					btnHints,
					btnStart
				);

				return { embeds: [embed], components: [row1, row2] };
			};

			const dashboardMsg = await interaction.editReply(renderDashboard());

			const confCollector = dashboardMsg.createMessageComponentCollector({
				filter: (i) => i.user.id === interaction.user.id,
				time: 60000,
			});

			confCollector.on("collect", async (i) => {
				if (i.customId === ID_CONF_MODE && i.isStringSelectMenu()) {
					config.selectedAlbums = i.values;
					saveConfigToCache();
					await i.update(renderDashboard());
				} else if (i.customId === ID_CONF_LINES) {
					const modal = new ModalBuilder()
						.setCustomId(ID_MODAL_LINES)
						.setTitle("Configuration des Lignes");
					const linesInput = new TextInputBuilder()
						.setCustomId(ID_INPUT_LINES)
						.setLabel("Combien de lignes afficher ? (1-5)")
						.setStyle(TextInputStyle.Short)
						.setPlaceholder("2")
						.setValue(config.lines.toString())
						.setMinLength(1)
						.setMaxLength(1)
						.setRequired(true);
					modal.addComponents(
						new ActionRowBuilder<TextInputBuilder>().addComponents(linesInput)
					);
					await i.showModal(modal);

					try {
						const sub = await i.awaitModalSubmit({
							filter: (s) =>
								s.customId === ID_MODAL_LINES && s.user.id === i.user.id,
							time: 30000,
						});
						const val = parseInt(sub.fields.getTextInputValue(ID_INPUT_LINES));
						config.lines = isNaN(val) || val < 1 || val > 5 ? 2 : val;
						saveConfigToCache();
						await sub.deferUpdate();
						await interaction.editReply(renderDashboard());
					} catch (e) {}
				} else if (i.customId === ID_CONF_HINTS) {
					config.hintsEnabled = !config.hintsEnabled;
					saveConfigToCache();
					await i.update(renderDashboard());
				} else if (i.customId === ID_CONF_START) {
					confCollector.stop("start");
					await i.update({
						content: opponent
							? `⚔️ **Duel lancé !**`
							: `✅ **Partie lancée !**`,
						embeds: [],
						components: [],
					});
					// On transmet l'adversaire (opponent) à runGame
					runGame(channel, config, interaction.user, opponent);
					return;
				}
			});

			confCollector.on("end", (_, reason) => {
				if (reason !== "start") {
					activeGames.delete(channel.id);
					interaction
						.editReply({
							content: "⏱️ Temps de configuration écoulé.",
							components: [],
						})
						.catch(() => {});
				}
			});
		} catch (error) {
			activeGames.delete(channel.id);
			interaction.editReply({ content: "❌ Erreur critique." }).catch(() => {});
		}
	},
};

// 4. FONCTION DU JEU (PUBLIC)
async function runGame(
	channel: TextChannel,
	config: { selectedAlbums: string[]; lines: number; hintsEnabled: boolean },
	launcher: User,
	opponent: User | null // L'adversaire peut être null (mode public)
) {
	// Message de chargement
	let startMessage = opponent
		? `⚔️ **DUEL** : ${launcher} 🆚 ${opponent} !\nPréparez-vous...`
		: `🎶 *Recherche d'une chanson...*`;

	const loadingMsg = await channel.send(startMessage);

	const gameData = await getRandomSongSnippet(
		config.lines,
		config.selectedAlbums
	);

	if (!gameData) {
		activeGames.delete(channel.id);
		return loadingMsg.edit(
			"❌ Erreur : Impossible de trouver une chanson avec ces filtres."
		);
	}

	let currentLines = config.lines;
	const hints = { album: false, pendu: false, lyricsAdded: 0 };

	const renderGame = () => {
		const currentSnippet = gameData.allLines
			.slice(gameData.startIndex, gameData.startIndex + currentLines)
			.join("\n");

		let footer = "Jeu illimité";
		if (hints.album) footer += ` • 💿 ${gameData.album}`;
		if (hints.pendu) footer += ` • 🔤 ${generateHangman(gameData.title)}`;

		// Titre de l'Embed adapté au mode
		const embedTitle = opponent
			? `⚔️ DUEL : ${launcher.username} vs ${opponent.username}`
			: "🎤 Blind Test : Taylor Swift";

		const embedColor = opponent ? 0xff0000 : 0x0099ff;

		const embed = new EmbedBuilder()
			.setTitle(embedTitle)
			.setDescription(
				`**De quelle chanson viennent ces paroles ?**\n\n> *${currentSnippet.replace(
					/\n/g,
					"\n> "
				)}*`
			)
			.setColor(embedColor)
			.setFooter({ text: footer });

		const row = new ActionRowBuilder<ButtonBuilder>();

		if (config.hintsEnabled) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(ID_GAME_HINT_ALBUM)
					.setLabel("💿 Album")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(hints.album)
			);
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(ID_GAME_HINT_PENDU)
					.setLabel("🔤 Pendu")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(hints.pendu)
			);
			const canAdd =
				gameData.startIndex + currentLines < gameData.allLines.length;
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(ID_GAME_HINT_LYRICS)
					.setLabel("➕ Suite")
					.setStyle(ButtonStyle.Success)
					.setDisabled(!canAdd || hints.lyricsAdded >= 3)
			);
		}

		row.addComponents(
			new ButtonBuilder()
				.setCustomId(ID_GAME_CANCEL)
				.setLabel("Abandonner")
				.setStyle(ButtonStyle.Danger)
		);

		return { embeds: [embed], components: [row] };
	};

	const gameMsg = await loadingMsg.edit(renderGame());

	// --- FILTRE DU COLLECTEUR DE MESSAGE ---
	const msgCol = channel.createMessageCollector({
		filter: (m) => {
			if (m.author.bot) return false;
			// Si c'est un duel, on accepte UNIQUEMENT le lanceur ou l'adversaire
			if (opponent) {
				return m.author.id === launcher.id || m.author.id === opponent.id;
			}
			// Sinon tout le monde peut jouer
			return true;
		},
	});

	const btnCol = gameMsg.createMessageComponentCollector();

	let winner: Message | null = null;

	btnCol.on("collect", async (i) => {
		// En mode Duel, on peut restreindre les boutons aux participants aussi si tu veux
		if (opponent && i.user.id !== launcher.id && i.user.id !== opponent.id) {
			return i.reply({
				content: "🤫 Chut ! Ce duel ne vous regarde pas.",
				flags: MessageFlags.Ephemeral,
			});
		}

		if (i.customId === ID_GAME_CANCEL) {
			msgCol.stop("cancel");
			await i.deferUpdate();
			return;
		}
		if (i.customId === ID_GAME_HINT_ALBUM) hints.album = true;
		if (i.customId === ID_GAME_HINT_PENDU) hints.pendu = true;
		if (i.customId === ID_GAME_HINT_LYRICS) {
			currentLines++;
			hints.lyricsAdded++;
		}

		await i.update(renderGame());
	});

	msgCol.on("collect", (m) => {
		const guess = normalizeString(m.content);
		const answer = normalizeString(gameData.title);
		if (guess === answer || (guess.length > 4 && answer.includes(guess))) {
			winner = m;
			msgCol.stop("winner");
			btnCol.stop();
		}
	});

	msgCol.on("end", (_, reason) => {
		activeGames.delete(channel.id);
		(async () => {
			await gameMsg.edit({ components: [] }).catch(() => {});

			if (reason === "winner" && winner) {
				const winEmbed = new EmbedBuilder()
					.setTitle(
						opponent
							? `🏆 ${winner.author.username} remporte le duel !`
							: "🎉 Bonne réponse !"
					)
					.setDescription(
						`Bravo ${winner?.author} !\nC'était **${gameData.title}**\nAlbum : *${gameData.album}*`
					)
					.setThumbnail(gameData.cover)
					.setColor(0x00ff00);
				winner?.reply({ embeds: [winEmbed] }).catch(() => {});
			} else if (reason === "cancel") {
				const loseEmbed = new EmbedBuilder()
					.setTitle(opponent ? "🏳️ Duel annulé" : "🚨 Partie Abandonnée")
					.setDescription(
						`La réponse était **${gameData.title}**\nAlbum : *${gameData.album}*`
					)
					.setThumbnail(gameData.cover)
					.setColor(0xff0000);
				channel.send({ embeds: [loseEmbed] }).catch(() => {});
			}
		})();
	});
}
