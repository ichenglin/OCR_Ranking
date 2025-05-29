import { EmbedBuilder, Events, Message } from "discord.js";
import Logger from "../objects/logger";
import VerificationEvent from "../templates/template_event";
import { ImageManager } from "../managers/manager_image";
import { RecognitionManager } from "../managers/manager_recognition";

export default class MessageCreateEvent extends VerificationEvent {

    public event_configuration(): {name: string} {
        return {
            name: Events.MessageCreate
        };
    }

    public async event_trigger(message: Message): Promise<void> {
        if (message.author.bot       === true)   return;
        if (message.content          !== "rank") return;
        if (message.attachments.size !==  1)     return;
        // get attachment image url
        const image_url = message.attachments.at(0)?.url;
        if (image_url === undefined) return;
        // read stats from image
        const manager_image       = new ImageManager();
        const manager_recognition = new RecognitionManager();
        await manager_image.image_load(image_url);
        const round_result = await manager_recognition.recognize_image(manager_image.image_grayscale(), manager_image.image_locate());
        // respond
        const rank_embed = new EmbedBuilder()
            .setTitle("Ranking Prototype")
            .setDescription("In Progress. WIP.")
            .addFields([
                {
                    name: ":hourglass: Round Timer",
                    value: `${round_result.round_timer} seconds`
                },
                {
                    name: `:red_square: Team Red (Score: ${round_result.score_red})`,
                    value: round_result.players_red.map(team_player => `\`${team_player}\``).join("\n")
                },
                {
                    name: `:blue_square: Team Blue (Score: ${round_result.score_blue})`,
                    value: round_result.players_blue.map(team_player => `\`${team_player}\``).join("\n")
                }
            ])
            //.setThumbnail(image_url)
            .setImage(image_url)
            .setTimestamp()
            .setFooter({text: `requested by ${message.author.tag}`, iconURL: message.client.user.displayAvatarURL()})
            .setColor("#84cc16");
        await message.reply({embeds: [rank_embed]});
    }

}