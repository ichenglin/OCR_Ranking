import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CacheType, ChatInputCommandInteraction, ComponentType, EmbedBuilder, InteractionCollector, Message, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder } from "discord.js";
import VerificationCommand from "../templates/template_command";
import { ImageManager } from "../managers/manager_image";
import {  RecognitionPlayer, RecognitionResult } from "../managers/manager_recognition";
import { RatingManager, RatingPlayer } from "../managers/manager_rating";
import Backend from "..";
import { expose } from "ts-trueskill";
import { string_limit } from "../utilities/util_render";
import VerificationDisplay from "../utilities/util_display";

export const RateCommandResult = {} as {[key: string]: {result: RecognitionResult, collector: InteractionCollector<StringSelectMenuInteraction<CacheType>>}};

export default class RateCommand extends VerificationCommand {

    private static MAX_TEAM_PLAYERS = 7;

    public command_configuration(): SlashCommandBuilder {
        const command_builder = new SlashCommandBuilder()
            .setName("rate")
            .setDescription("Update player ratings from match result.");
        command_builder.addAttachmentOption(option => option
            .setName("screenshot")
            .setDescription("Screenshot of match result.")
            .setRequired(true)
        );
        return command_builder;
    }

    public async command_trigger(command_interaction: ChatInputCommandInteraction): Promise<void> {
        await command_interaction.deferReply();
        // get attachment image url
        const image_attachment = command_interaction.options.getAttachment("screenshot", true);
        const image_valid      = (image_attachment.contentType?.startsWith("image/") === true);
        const image_url        = image_attachment.url;
        if (!image_valid) {
            // invalid attachment
            const invalid_embed = new EmbedBuilder()
                .setTitle("⛔ Invalid Screenshot ⛔")
                .setDescription("The **screenshot** provided is **not a valid image**!")
                .setTimestamp()
                .setFooter({text: `requested by ${command_interaction.user.tag}`, iconURL: command_interaction.client.user.displayAvatarURL()})
                .setColor("#ef4444");
            await command_interaction.editReply({embeds: [invalid_embed]});
            return;
        }
        // read stats from image
        const manager_image = new ImageManager();
        await manager_image.image_load(image_url);
        const round_bounds = manager_image.image_locate();
        if (!round_bounds.image_valid) {
            // invalid screenshot
            const invalid_embed = new EmbedBuilder()
                .setTitle("⛔ Invalid Screenshot ⛔")
                .setDescription("The image **could not be processed**. Please retake the screenshot and make sure the **round timer, team score, and scoreboard** is fully **visible and unobstructed**. \`(ERR_REC_BDS)\`")
                .setImage(image_url)
                .setTimestamp()
                .setFooter({text: `requested by ${command_interaction.user.tag}`, iconURL: command_interaction.client.user.displayAvatarURL()})
                .setColor("#ef4444");
            await command_interaction.editReply({embeds: [invalid_embed]});
            return;
        }
        const round_result = await Backend.server_worker.recognize_image(manager_image, round_bounds);
        if (!round_result.round_valid) {
            // invalid screenshot
            const invalid_embed = new EmbedBuilder()
                .setTitle("⛔ Invalid Screenshot ⛔")
                .setDescription("The image **could not be processed**. Please retake the screenshot and make sure the **round timer, team score, and scoreboard** is fully **visible and unobstructed**. \`(ERR_REC_CTX)\`")
                .setImage(image_url)
                .setTimestamp()
                .setFooter({text: `requested by ${command_interaction.user.tag}`, iconURL: command_interaction.client.user.displayAvatarURL()})
                .setColor("#ef4444");
            await command_interaction.editReply({embeds: [invalid_embed]});
            return;
        }
        if (round_result.round_timer > 10) {
            // invalid timer
            const invalid_embed = new EmbedBuilder()
                .setTitle("⛔ Invalid Screenshot ⛔")
                .setDescription("The screenshot must be taken with **under 10 seconds left** on the **round timer**!")
                .setImage(image_url)
                .setTimestamp()
                .setFooter({text: `requested by ${command_interaction.user.tag}`, iconURL: command_interaction.client.user.displayAvatarURL()})
                .setColor("#ef4444");
            await command_interaction.editReply({embeds: [invalid_embed]});
            return;
        }
        // respond
        const players_partial = [...round_result.players_red, ...round_result.players_blue].filter(player_data => player_data.player_partial).map(player_data => player_data.player_username);
        await this.rating_embed(command_interaction, [], image_url, round_result, players_partial);
    }

    private async rating_embed(command_interaction: ChatInputCommandInteraction, messages_old: Message<boolean>[], image_url: string, round_result: RecognitionResult, players_partial: string[]): Promise<void> {
        const selected_result  = this.round_partial(round_result, players_partial);
        const selected_rating  = await RatingManager.rating_update(selected_result, false);
        const selected_red     = selected_result.players_red.map(player_stats => ({
            player_team:   "Red",
            player_rating: selected_rating.players_red.find(player_rating => (player_rating.player_data.username === player_stats.player_username)) as RatingPlayer,
            player_stats:  player_stats
        }));
        const selected_blue    = selected_result.players_blue.map(player_stats => ({
            player_team:   "Blue",
            player_rating: selected_rating.players_blue.find(player_rating => (player_rating.player_data.username === player_stats.player_username)) as RatingPlayer,
            player_stats:  player_stats
        }));
        const selected_players = [...selected_red, ...selected_blue];
        const rate_embed       = new EmbedBuilder()
            .setTitle("💯 Rating Update 💯")
            .setDescription("**NOTE:** Player score and KDR are experimental features and not taken into account for one's rating.")
            .addFields([
                {
                    name: "⌛ Round Information",
                    value: [
                        `<:db:1377733347677306980> Timer: \`${this.round_timer(selected_result.round_timer)}\``,
                        `<:db:1377733347677306980> Red Score: \`${selected_result.score_red} pts\` ${(selected_result.score_red > selected_result.score_blue) ? "(🏅)" : ""}`,
                        `<:db:1377733347677306980> Blue Score: \`${selected_result.score_blue} pts\` ${(selected_result.score_red < selected_result.score_blue) ? "(🏅)" : ""}`
                    ].join("\n"),
                    inline: true
                },
                {
                    name: "🎯 Round Likelihood",
                    value: [
                        `<:db:1377733347677306980> Quality: \`${(selected_rating.probability.quality * 100).toFixed(1)}%\``,
                        `<:db:1377733347677306980> Red Win: \`${(selected_rating.probability.win_red * 100).toFixed(1)}%\``,
                        `<:db:1377733347677306980> Blue Win: \`${(selected_rating.probability.win_blue * 100).toFixed(1)}%\``
                    ].join("\n"),
                    inline: true
                },
                {
                    name: "",
                    value: ""
                },
                {
                    name: "🟥 Team Red",
                    value: "** **\n" + selected_red.slice(0, Math.min(selected_red.length, RateCommand.MAX_TEAM_PLAYERS)).map(player_data => {
                        return this.player_summary(player_data.player_stats, player_data.player_rating);
                    }).join("\n\n"),
                    inline: true
                },
                {
                    name: "🟦 Team Blue",
                    value: "** **\n" + selected_blue.slice(0, Math.min(selected_blue.length, RateCommand.MAX_TEAM_PLAYERS)).map(player_data => {
                        return this.player_summary(player_data.player_stats, player_data.player_rating);
                    }).join("\n\n"),
                    inline: true
                }
            ])
            .setImage(image_url)
            .setTimestamp()
            .setFooter({text: `requested by ${command_interaction.user.tag}`, iconURL: command_interaction.client.user.displayAvatarURL()})
            .setColor("#84cc16");
        const rate_form = new StringSelectMenuBuilder()
            .setCustomId("rate_form")
            .setPlaceholder("Configure Player(s) Partial Play")
            .setMinValues(0)
            .setMaxValues(selected_players.length)
            .addOptions(selected_players.map(player_data => new StringSelectMenuOptionBuilder()
                .setLabel(player_data.player_rating.player_data.username)
                .setDescription(`${player_data.player_team} Team, ${expose(player_data.player_rating.player_data.rating).toFixed(2)} Rating`)
                .setEmoji("❌")
                .setValue(player_data.player_rating.player_data.username)
                .setDefault(player_data.player_stats.player_partial)
            ));
        const rate_confirm = new ButtonBuilder()
            .setCustomId("rate_confirm")
            .setLabel("Confirm Rating")
            .setStyle(ButtonStyle.Success);
        const rate_actionrows = [
            new ActionRowBuilder().addComponents(rate_form),
            new ActionRowBuilder().addComponents(rate_confirm)
        ];
        const rate_messages  = await VerificationDisplay.embed_editreply(command_interaction, VerificationDisplay.embed_safe(rate_embed, undefined, rate_actionrows), messages_old);
        const rate_collector = rate_messages[rate_messages.length - 1].createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter:        (component_interaction) => component_interaction.user.id === command_interaction.user.id,
            time:          (120 * 1E3)
        });
        RateCommandResult[rate_messages[rate_messages.length - 1].id] = {result: selected_result, collector: rate_collector};
        rate_collector.on("collect", async (component_interaction) => {
            await component_interaction.deferUpdate();
            rate_collector.removeAllListeners();
            delete RateCommandResult[rate_messages[rate_messages.length - 1].id];
            await this.rating_embed(command_interaction, rate_messages, image_url, round_result, component_interaction.values);
        });
        rate_collector.on("ignore", async (component_interaction) => {
            const prohibited_embed = new EmbedBuilder()
                .setTitle("⛔ No Permission ⛔")
                .setDescription(`This embed belongs to <@${command_interaction.user.id}>, you are not allowed to use this!`)
                .setColor("#ef4444");
            await component_interaction.reply({embeds: [prohibited_embed], ephemeral: true});
        });
        rate_collector.on("end", async () => {
            rate_form.setDisabled(true);
            rate_form.setPlaceholder("(Expired After 2 Minutes of Inactivity)");
            rate_confirm.setDisabled(true);
            await command_interaction.editReply({message: rate_messages[rate_messages.length - 1], components: (rate_actionrows as any)});
            delete RateCommandResult[rate_messages[rate_messages.length - 1].id];
        });
    }

    private round_partial(round_result: RecognitionResult, round_partial: string[]): RecognitionResult {
        const round_selected_partial = Object.fromEntries(round_partial.map(player_username => [player_username, true]));
        const round_selected_red     = round_result.players_red.map(player_data => Object.assign({}, player_data)).map(player_data => Object.assign(player_data, {
            player_partial: (round_selected_partial[player_data.player_username] ? true : false)
        }));
        const round_selected_blue    = round_result.players_blue.map(player_data => Object.assign({}, player_data)).map(player_data => Object.assign(player_data, {
            player_partial: (round_selected_partial[player_data.player_username] ? true : false)
        }));
        const round_selected_result = Object.assign({}, round_result);
        round_selected_result.players_red  = round_selected_red;
        round_selected_result.players_blue = round_selected_blue;
        return round_selected_result;
    }

    private round_timer(round_seconds: number): string {
        return `${Math.floor(round_seconds / 60)}m ${round_seconds % 60}s`;
    }

    private player_summary(player_stats: RecognitionPlayer, player_rating: RatingPlayer, line_limit: number = 125): string {
        // player rating trend
        const player_rating_old   = (player_rating.player_rating_old ? expose(player_rating.player_rating_old) : 0);
        const player_rating_new   = (player_rating.player_rating_new ? expose(player_rating.player_rating_new) : 0);
        // player kdr
        const player_display = string_limit(player_stats.player_username, 12, "…")
        const player_kdr     = ((player_stats.player_deaths > 0) ? (player_stats.player_kills / player_stats.player_deaths) : player_stats.player_kills);
        const player_summary = [
            (() => {
                if      (player_stats.player_bot)     return `🤖 **${player_display}**`;
                else if (player_stats.player_partial) return `❌ **${player_display}**`;
                else                                  return `🪖 **${player_display}**`;
            })(),
            (() => {
                if      (player_stats.player_bot)     return "<:db:1377733347677306980> Rating: \`Not Updated\` (**NPC**)";
                else if (player_stats.player_partial) return "<:db:1377733347677306980> Rating: \`Not Updated\` (**PRT**)";
                else                                  return `<:db:1377733347677306980> Rating: \`${player_rating_old.toFixed(2)}\` ➤ \`${player_rating_new.toFixed(2)}\``;
            })(),
            `<:db:1377733347677306980> Score: \`${player_stats.player_score}\` KDR: \`${player_kdr.toFixed(1)}\``
        ];
        while (true) {
            const summary_total = player_summary.join("\n");
            if (summary_total.length > line_limit) {
                player_summary.pop();
                continue;
            }
            return summary_total;
        }
    }
}