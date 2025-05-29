import Tesseract, { createWorker } from "tesseract.js";
import { ImageArea, ImageBounds } from "./manager_image";

export class RecognitionManager {

    public async recognize_image(recognition_image: Buffer, recognition_bounds: ImageBounds): Promise<RecognitionResult> {
        const recognition_worker               = await createWorker("eng");
        const recognition_data_scoreboard_red  = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_scoreboard_red)});
        const recognition_data_scoreboard_blue = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_scoreboard_blue)});
        const recognition_data_timer           = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_timer)});
        const recognition_data_score_red       = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_score_red)});
        const recognition_data_score_blue      = await recognition_worker.recognize(recognition_image, {rectangle: this.convert_rectangle(recognition_bounds.image_score_blue)});
        return {
            round_timer:  this.recognize_timer  (recognition_data_timer          .data.text),
            score_red:    this.recognize_score  (recognition_data_score_red      .data.text),
            score_blue:   this.recognize_score  (recognition_data_score_blue     .data.text),
            players_red:  this.recognize_players(recognition_data_scoreboard_red .data.text),
            players_blue: this.recognize_players(recognition_data_scoreboard_blue.data.text)
        }
    }

    private recognize_timer(recognition_timer: string): number {
        const timer_digits = recognition_timer.match(/(\d{1,2}):(\d{1,2})/);
        if (timer_digits === null) return 0;
        const timer_minutes = parseInt(timer_digits[1]);
        const timer_seconds = parseInt(timer_digits[2]);
        return ((timer_minutes * 60) + timer_seconds);
    }

    private recognize_score(recognition_score: string): number {
        const score_digits = recognition_score.match(/(\d+)/);
        if (score_digits === null) return 0;
        return parseInt(score_digits[1]);
    }

    private recognize_players(recognition_scoreboard: string): string[] {
        return recognition_scoreboard.split("\n").slice(1).map(line_text => line_text.match(/^(\w+) \(/)).filter(line_match => (line_match !== null)).map(line_match => line_match[1]);
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
    players_red:  string[],
    players_blue: string[]
}