import { ButtonInteraction } from "discord.js";
import VerificationButton from "../templates/template_button";
import { RateCommandResult } from "./command_rate";
import { RatingManager } from "../managers/manager_rating";

export default class ConfirmButton extends VerificationButton {

    public button_configuration(): {button_id: string} {
        return {
            button_id: "rate_confirm"
        };
    }

    public async button_trigger(button_interaction: ButtonInteraction): Promise<void> {
        await button_interaction.deferUpdate();
        const button_result = RateCommandResult[button_interaction.message.id];
        button_result.collector.stop();
        await RatingManager.rating_update(button_result.result, true);
    }

}