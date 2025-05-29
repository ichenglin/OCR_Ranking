import { RecognitionPlayer, RecognitionResult } from "./manager_recognition";
import { DatabasePlayer, get_player, set_player } from "../utilities/util_database";
import { quality, rate, Rating } from "ts-trueskill";
import { win_probability } from "../utilities/util_rating";

export class RatingManager {
    public static async rating_update(round_result: RecognitionResult): Promise<RatingResult> {
        // retrieve player ratings from database
        const rating_old = await Promise.all([
            RatingManager.rating_get(round_result.players_red),
            RatingManager.rating_get(round_result.players_blue)
        ]);
        // calculate rating ranks
        let rating_ranks = [0, 0];
        if      (round_result.score_red > round_result.score_blue) rating_ranks = [0, 1];
        else if (round_result.score_red < round_result.score_blue) rating_ranks = [1, 0];
        // calculate and save new ratings to database
        const probability_draw = quality       ([rating_old[0], rating_old[1]]);
        const probability_red  = win_probability(rating_old[0], rating_old[1]);
        const probability_blue = win_probability(rating_old[1], rating_old[0]);
        const rating_new       = rate([rating_old[0], rating_old[1]], rating_ranks);
        const rating_updated   = await Promise.all([
            RatingManager.rating_set(round_result.players_red,  rating_new[0]),
            RatingManager.rating_set(round_result.players_blue, rating_new[1]),
        ]);
        return {
            probability:   {
                win_red:  probability_red,
                win_blue: probability_blue,
                draw:     probability_draw
            },
            players_red:   RatingManager.rating_package(rating_updated[0], rating_old[0], rating_new[0]),
            players_blue:  RatingManager.rating_package(rating_updated[1], rating_old[1], rating_new[1]),
        };
    }

    private static async rating_get(team_players: RecognitionPlayer[]): Promise<Rating[]> {
        const team_usernames = team_players.map(player_data => player_data.player_username);
        return await Promise.all(team_usernames.map(round_username => get_player(round_username).then(player_data => {
            return ((player_data !== null) ? player_data.rating : new Rating());
        })));
    }

    private static async rating_set(team_players: RecognitionPlayer[], team_rating: Rating[]): Promise<DatabasePlayer[]> {
        return await Promise.all(team_players.map((player_data, player_index) => {
            if (player_data.player_bot) return {
                username: player_data.player_username,
                level:    player_data.player_level,
                rating:   team_rating[player_index],
                updated:  new Date()
            } as DatabasePlayer;
            return set_player(player_data.player_username, player_data.player_level, team_rating[player_index]);
        }));
    }

    private static rating_package(player_data: DatabasePlayer[], rating_old: Rating[], rating_new: Rating[]): RatingPlayer[] {
        return player_data.map((loop_player, loop_index) => ({
            player_data:       loop_player,
            player_rating_old: rating_old[loop_index],
            player_rating_new: rating_new[loop_index]
        } as RatingPlayer));
    }
}

export interface RatingResult {
    probability:  RatingProbability,
    players_red:  RatingPlayer[],
    players_blue: RatingPlayer[]
};

export type RatingProbability = {
    win_red:  number, // red  win probability
    win_blue: number, // blue win probability
    draw:     number
};

export type RatingPlayer = {
    player_data:       DatabasePlayer,
    player_rating_old: Rating,
    player_rating_new: Rating
};