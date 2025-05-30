import Tesseract, { createWorker } from "tesseract.js";
import { ImageArea, ImageBounds } from "./manager_image";

export class RecognitionManager {

    public async recognize_image(recognition_image: Buffer, recognition_bounds: ImageBounds): Promise<RecognitionResult> {
        const recognition_worker = await createWorker("eng");
        // read scoreboard
        await recognition_worker.setParameters({tessedit_char_whitelist: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_()"});
        const recognition_data_players_red  = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_players_red)});
        const recognition_data_players_blue = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_players_blue)});
        await recognition_worker.setParameters({tessedit_char_whitelist: "0123456789"});
        const recognition_data_scoreboard_red  = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_scoreboard_red)});
        const recognition_data_scoreboard_blue = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_scoreboard_blue)});
        // read timer
        await recognition_worker.setParameters({tessedit_char_whitelist: "0123456789:"});
        const recognition_data_timer = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_timer)});
        // read score
        await recognition_worker.setParameters({tessedit_char_whitelist: "0123456789"});
        const recognition_data_score_red  = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_score_red)});
        const recognition_data_score_blue = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_score_blue)});
        // raw results
        const round_timer  = this.recognize_timer  (recognition_data_timer       .data.text);
        const score_red    = this.recognize_score  (recognition_data_score_red   .data.text);
        const score_blue   = this.recognize_score  (recognition_data_score_blue  .data.text);
        const players_red  = this.recognize_players(recognition_data_players_red .data.text, recognition_data_scoreboard_red .data.text);
        const players_blue = this.recognize_players(recognition_data_players_blue.data.text, recognition_data_scoreboard_blue.data.text);
        const round_valid  = ([
            (round_timer         !== null),
            (score_red           !== null),
            (score_blue          !== null),
            (players_red .length >   0),
            (players_blue.length >   0)
        ].filter(requirement => (!requirement)).length <= 0);
        return {
            round_timer:  (round_valid ? round_timer : 0) as number,
            score_red:    (round_valid ? score_red   : 0) as number,
            score_blue:   (round_valid ? score_blue  : 0) as number,
            players_red:  players_red,
            players_blue: players_blue,
            round_valid:  round_valid
        };
    }

    private recognize_timer(recognition_timer: string): (number | null) {
        const timer_digits = recognition_timer.match(/(\d{1,2}):(\d{1,2})/);
        if (timer_digits === null) return null;
        const timer_minutes = parseInt(timer_digits[1]);
        const timer_seconds = parseInt(timer_digits[2]);
        return ((timer_minutes * 60) + timer_seconds);
    }

    private recognize_score(recognition_score: string): (number | null) {
        const score_digits = recognition_score.match(/(\d+)/);
        if (score_digits === null) return null;
        return parseInt(score_digits[1]);
    }

    private recognize_players(recognition_players: string, recognition_scoreboard: string): RecognitionPlayer[] {
        const player_scoreboard = recognition_scoreboard.split("\n").map(line_text => line_text.match(/^(\d+)\s(\d+)\s(\d+)\s(\d+)$/)).map(line_match => {
            const line_stats = ((line_match !== null) ? line_match.slice(1, 5) : (new Array(4).fill("0")));
            return line_stats.map(loop_stat => parseInt(loop_stat));
        });
        return recognition_players.split("\n").map(line_text => line_text.match(/^(\w+)\([^\d]*(\d+)\)$/)).filter(line_match => (line_match !== null)).map((line_match, line_index) => {
            const player_username = line_match[1];
            const player_level    = parseInt(line_match[2]);
            const player_match    = (player_username.match(/^[a-zA-Z\d]+_[a-zA-Z\d]+\d{4}$/) !== null);
            const player_stats    = ((line_index < player_scoreboard.length) ? player_scoreboard[line_index] : (new Array(4).fill(0) as number[]));
            return {
                player_username: player_username,
                player_level:    player_level,
                player_score:    player_stats[0],
                player_kills:    player_stats[1],
                player_deaths:   player_stats[2],
                player_streak:   player_stats[3],
                player_bot:      (player_match && (player_level < 20))
            } as RecognitionPlayer;
        });
    }

    private convert_rectangle(image_area: ImageArea): Tesseract.Rectangle {
        return {
            left:   image_area.origin.location_x,
            top:    image_area.origin.location_y,
            width:  (image_area.destination.location_x - image_area.origin.location_x + 1),
            height: (image_area.destination.location_y - image_area.origin.location_y + 1)
        };
    }
}

export type RecognitionResult = {
    round_timer:  number,
    score_red:    number,
    score_blue:   number,
    players_red:  RecognitionPlayer[],
    players_blue: RecognitionPlayer[],
    round_valid:  boolean
};

export type RecognitionPlayer = {
    player_username: string,
    player_level:    number,
    player_score:    number,
    player_kills:    number,
    player_deaths:   number,
    player_streak:   number,
    player_bot:      boolean
};