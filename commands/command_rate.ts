import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import VerificationCommand from "../templates/template_command";
import { ImageManager } from "../managers/manager_image";
import {  RecognitionPlayer } from "../managers/manager_recognition";
import { RatingManager, RatingPlayer } from "../managers/manager_rating";
import Backend from "..";
import { expose } from "ts-trueskill";
import { string_limit } from "../utilities/util_render";

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
        const round_rating = await RatingManager.rating_update(round_result);
        // respond
        const rate_embed = new EmbedBuilder()
            .setTitle("💯 Rating Update 💯")
            .setDescription("**NOTE:** Player score and KDR are experimental features and not taken into account for one's rating.")
            .addFields([
                {
                    name: "⌛ Round Information",
                    value: [
                        `<:db:1377733347677306980> Timer: \`${this.round_timer(round_result.round_timer)}\``,
                        `<:db:1377733347677306980> Red Score: \`${round_result.score_red} pts\` ${(round_result.score_red > round_result.score_blue) ? "(🏅)" : ""}`,
                        `<:db:1377733347677306980> Blue Score: \`${round_result.score_blue} pts\` ${(round_result.score_red < round_result.score_blue) ? "(🏅)" : ""}`
                    ].join("\n"),
                    inline: true
                },
                {
                    name: "🎯 Round Likelihood",
                    value: [
                        `<:db:1377733347677306980> Quality: \`${(round_rating.probability.quality * 100).toFixed(1)}%\``,
                        `<:db:1377733347677306980> Red Win: \`${(round_rating.probability.win_red * 100).toFixed(1)}%\``,
                        `<:db:1377733347677306980> Blue Win: \`${(round_rating.probability.win_blue * 100).toFixed(1)}%\``
                    ].join("\n"),
                    inline: true
                },
                {
                    name: "",
                    value: ""
                },
                {
                    name: "🟥 Team Red",
                    value: "** **\n" + round_result.players_red.slice(0, Math.min(round_result.players_red.length, RateCommand.MAX_TEAM_PLAYERS)).map((team_player, player_index) => this.player_summary(team_player, round_rating.players_red[player_index])).join("\n\n"),
                    inline: true
                },
                {
                    name: "🟦 Team Blue",
                    value: "** **\n" + round_result.players_blue.slice(0, Math.min(round_result.players_blue.length, RateCommand.MAX_TEAM_PLAYERS)).map((team_player, player_index) => this.player_summary(team_player, round_rating.players_blue[player_index])).join("\n\n"),
                    inline: true
                }
            ])
            .setImage(image_url)
            .setTimestamp()
            .setFooter({text: `requested by ${command_interaction.user.tag}`, iconURL: command_interaction.client.user.displayAvatarURL()})
            .setColor("#84cc16");
        await command_interaction.editReply({embeds: [rate_embed]});
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