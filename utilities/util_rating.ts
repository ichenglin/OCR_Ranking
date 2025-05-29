import { Rating, TrueSkill } from "ts-trueskill";

export function win_probability(team_a: Rating[], team_b: Rating[]): number {
    const lib_trueskill  = new TrueSkill();
    const team_mu_a      = team_a.reduce((mu_sum, rating_current) => (mu_sum + rating_current.mu), 0);
    const team_mu_b      = team_b.reduce((mu_sum, rating_current) => (mu_sum + rating_current.mu), 0);
    const team_mu_delta  = (team_mu_a - team_mu_b);
    const team_sigma_all = [...team_a, ...team_b].reduce((sigma_sum, rating_current) => (sigma_sum + Math.pow(rating_current.sigma, 2)), 0);
    const team_size_all  = (team_a.length + team_b.length);
    const denom          = Math.sqrt((team_size_all * Math.pow(lib_trueskill.beta, 2)) + team_sigma_all);
    return lib_trueskill.guassian.cdf(team_mu_delta / denom);
}