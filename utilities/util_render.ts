export function string_join(string_list: string[], string_delimiter: ("and" | "or") = "and"): string {
    if      (string_list.length <=  0) return "";
    else if (string_list.length === 1) return string_list[0];
    else if (string_list.length === 2) return `${string_list[0]} ${string_delimiter} ${string_list[1]}`;
    return `${string_list.slice(0, -1).join(", ")}, ${string_delimiter} ${string_list[string_list.length - 1]}`;
}

export function string_limit(string_object: string, string_max: number, string_marker: string): string {
    const string_free   = (string_max - string_marker.length);
    const string_keep   = string_object.slice(0, Math.min(string_object.length, string_free));
    const string_sliced = (string_keep.length < string_object.length);
    return (string_sliced ? `${string_keep}${string_marker}` : string_keep);
}