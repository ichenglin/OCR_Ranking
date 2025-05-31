import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import VerificationCommand from "../templates/template_command";
import { RatingManager } from "../managers/manager_rating";
import { RecognitionPlayer, RecognitionResult } from "../managers/manager_recognition";
import { string_join, string_limit } from "../utilities/util_render";

export default class TryCommand extends VerificationCommand {

    private static MAX_PLAYERS = 8;

    public command_configuration(): SlashCommandBuilder {
        const command_builder = new SlashCommandBuilder()
            .setName("try")
            .setDescription("Calculate the draw and win likelihood of a matchmaking.");
        command_builder.addStringOption(option => option
            .setName("red_players")
            .setDescription("Comma-separated usernames of players on the red team.")
            .setRequired(true)
        );
        command_builder.addStringOption(option => option
            .setName("blue_players")
            .setDescription("Comma-separated usernames of players on the blue team.")
            .setRequired(true)
        );
        return command_builder;
    }

    public async command_trigger(command_interaction: ChatInputCommandInteraction): Promise<void> {
        await command_interaction.deferReply();
        // get players
        const players_red_raw  = command_interaction.options.getString("red_players", true);
        const players_blue_raw = command_interaction.options.getString("blue_players", true);
        const players_red      = players_red_raw .split(/\s*,\s*/).filter(player_name => (player_name.length > 0));
        const players_blue     = players_blue_raw.split(/\s*,\s*/).filter(player_name => (player_name.length > 0));
        const valid_red        = ((0 < players_red .length) && (players_red .length <= TryCommand.MAX_PLAYERS));
        const valid_blue       = ((0 < players_blue.length) && (players_blue.length <= TryCommand.MAX_PLAYERS));
        if ((!valid_red) || (!valid_blue)) {
            // invalid screenshot
            const invalid_embed = new EmbedBuilder()
                .setTitle("⛔ Invalid Teams ⛔")
                .setDescription("Both teams must consist of **no fewer than 1** and **no more than 8** players.")
                .setTimestamp()
                .setFooter({text: `requested by ${command_interaction.user.tag}`, iconURL: command_interaction.client.user.displayAvatarURL()})
                .setColor("#ef4444");
            await command_interaction.editReply({embeds: [invalid_embed]});
            return;
        }
        const round_likelihood = await RatingManager.rating_likelihood({
            round_timer:  0,
            score_red:    0,
            score_blue:   0,
            players_red:  TryCommand.convert_dummy(players_red),
            players_blue: TryCommand.convert_dummy(players_blue),
            round_valid:  false
        } as RecognitionResult);
        const usernames_red  = string_join(round_likelihood.players_red .map(player_data => `\`${string_limit(player_data.username, 20, "…")}\`${(!player_data.valid) ? " (⚠️ No Data)" : ""}`));
        const usernames_blue = string_join(round_likelihood.players_blue.map(player_data => `\`${string_limit(player_data.username, 20, "…")}\`${(!player_data.valid) ? " (⚠️ No Data)" : ""}`));
        await command_interaction.editReply([
            `Quality: \`${(round_likelihood.quality * 100).toFixed(1)}%\``,
            `Red Win: \`${(round_likelihood.win_red * 100).toFixed(1)}%\` [${usernames_red}]`,
            `Blue Win: \`${(round_likelihood.win_blue * 100).toFixed(1)}%\` [${usernames_blue}]`,
        ].join("\n"));
    }

    private static convert_dummy(player_usernames: string[]): RecognitionPlayer[] {
        return player_usernames.map(player_username => ({
            player_username: player_username,
            player_level:    0,
            player_score:    0,
            player_kills:    0,
            player_deaths:   0,
            player_streak:   0,
            player_bot:      false
        } as RecognitionPlayer));
    }
}