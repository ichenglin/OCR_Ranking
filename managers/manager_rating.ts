import { RecognitionPlayer, RecognitionResult } from "./manager_recognition";
import { DatabasePlayer, get_player, set_player } from "../utilities/util_database";
import { quality, rate, Rating } from "ts-trueskill";
import { win_probability } from "../utilities/util_rating";

export class RatingManager {
    public static async rating_likelihood(round_result: RecognitionResult): Promise<RatingProbability> {
        const player_data = await Promise.all([
            RatingManager.rating_get(round_result.players_red),
            RatingManager.rating_get(round_result.players_blue)
        ]);
        const rating_red         = player_data[0].filter((_, loop_index) => (!round_result.players_red [loop_index].player_partial)).map(loop_data => loop_data.rating);
        const rating_blue        = player_data[1].filter((_, loop_index) => (!round_result.players_blue[loop_index].player_partial)).map(loop_data => loop_data.rating);
        const likelihood_quality = quality       ([rating_red,  rating_blue]);
        const likelihood_red     = win_probability(rating_red,  rating_blue);
        const likelihood_blue    = win_probability(rating_blue, rating_red);
        return {
            win_red:      likelihood_red,
            win_blue:     likelihood_blue,
            quality:      likelihood_quality,
            players_red:  player_data[0],
            players_blue: player_data[1]
        };
    }

    public static async rating_update(round_result: RecognitionResult): Promise<RatingResult> {
        // calculate rating ranks
        let rating_ranks = [0, 0];
        if      (round_result.score_red > round_result.score_blue) rating_ranks = [0, 1];
        else if (round_result.score_red < round_result.score_blue) rating_ranks = [1, 0];
        // calculate and save new ratings to database
        const round_likelihood = await RatingManager.rating_likelihood(round_result);
        const recognition_red  = round_result    .players_red .filter((_, loop_index) => (!round_result.players_red [loop_index].player_partial));
        const recognition_blue = round_result    .players_blue.filter((_, loop_index) => (!round_result.players_blue[loop_index].player_partial));
        const players_red      = round_likelihood.players_red .filter((_, loop_index) => (!round_result.players_red [loop_index].player_partial));
        const players_blue     = round_likelihood.players_blue.filter((_, loop_index) => (!round_result.players_blue[loop_index].player_partial));
        const partial_red      = round_likelihood.players_red .filter((_, loop_index) =>   round_result.players_red [loop_index].player_partial);
        const partial_blue     = round_likelihood.players_blue.filter((_, loop_index) =>   round_result.players_blue[loop_index].player_partial);
        const rating_red       = players_red .map(loop_data => loop_data.rating);
        const rating_blue      = players_blue.map(loop_data => loop_data.rating);
        const rating_new       = rate([rating_red, rating_blue], rating_ranks);
        const rating_updated   = await Promise.all([
            RatingManager.rating_set(recognition_red,  rating_new[0]),
            RatingManager.rating_set(recognition_blue, rating_new[1]),
        ]);
        // WARNING: players_red/players_blue does NOT guarantee to return in recognition order
        return {
            probability:   round_likelihood,
            players_red:   [...RatingManager.rating_package(rating_updated[0], rating_red,  rating_new[0]), ...RatingManager.rating_partial(partial_red)],
            players_blue:  [...RatingManager.rating_package(rating_updated[1], rating_blue, rating_new[1]), ...RatingManager.rating_partial(partial_blue)],
        };
    }

    private static async rating_get(team_players: RecognitionPlayer[]): Promise<DatabasePlayer[]> {
        const team_usernames = team_players.map(player_data => player_data.player_username);
        return await Promise.all(team_usernames.map(round_username => get_player(round_username).then(player_data => {
            return ((player_data !== null) ? player_data : {
                username: round_username,
                key:      round_username.toLowerCase(),
                level:    0,
                rating:   new Rating(),
                updates:  0,
                updated:  new Date(),
                valid:    false
            });
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

    private static rating_partial(player_data: DatabasePlayer[]): RatingPlayer[] {
        return player_data.map((loop_player) => ({
            player_data:       loop_player,
            player_rating_old: (undefined as any), // shouldn't be used
            player_rating_new: (undefined as any)  // shouldn't be used
        } as RatingPlayer));
    }
}

export interface RatingResult {
    probability:  RatingProbability,
    players_red:  RatingPlayer[],
    players_blue: RatingPlayer[]
};

export type RatingProbability = {
    win_red:      number, // red  win probability
    win_blue:     number, // blue win probability
    quality:      number,
    players_red:  DatabasePlayer[],
    players_blue: DatabasePlayer[]
};

export type RatingPlayer = {
    player_data:        DatabasePlayer,
    player_rating_old?: Rating,
    player_rating_new?: Rating
};