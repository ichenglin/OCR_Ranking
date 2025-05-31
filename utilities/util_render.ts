export function string_join(string_list: string[], string_delimiter: ("and" | "or") = "and"): string {
    if      (string_list.length <=  0) return "";
    else if (string_list.length === 1) return string_list[0];
    else if (string_list.length === 2) return `${string_list[0]} ${string_delimiter} ${string_list[1]}`;
    return `${string_list.slice(0, -1).join(", ")}, ${string_delimiter} ${string_list[string_list.length - 1]}`;
}