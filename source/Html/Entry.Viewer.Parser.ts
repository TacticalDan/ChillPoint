import { HtmlBuilder, Style } from "./Util.HtmlBuilder";

type AsyncQueue<T> = {
    readonly get_next_to_await: () => Promise<T>;
}

async function parser_test(thinger: AsyncQueue<string>) {
    const result = await thinger.get_next_to_await();
}

async function display_parser() {
    HtmlBuilder.assign_to_element(document.body, {
        style: {
            backgroundColor: "black",
            display: "grid",
            justifyItems: "center",
            alignItems: "center",
            gridTemplateColumns: "1fr",
            gridTemplateRows: "1fr",

            height: "100%",
            width: "100%",
            margin: "0",
        },
    });

    const { container } = HtmlBuilder.create_children(document.body, {
        container: {
            type: "div",
            style: {
                height: "100%",
                width: "100%",

                backgroundColor: "grey",
                color: "white",
                fontFamily: "verdana",

                display: "grid",
                justifyItems: "center",
                alignItems: "center",
                gridTemplateAreas: `a b`,
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "1fr",
            },
        }
    });

    const file = await fetch("SDL.h");
    const text = await file.text();
    const style: Style = {
        backgroundColor: "black",
        color: "white",
        fontFamily: "verdana",
        height: "100%",
        width: "100%",
        whiteSpace: "nowrap",
    };

    function range(count: number) {
        return [...Array(count).keys()];
    }
    function assert(statement: boolean) {
        if (!statement) throw new Error("assertion failed");
    }

    const comment_formatting = {
        "\\sa": "@see",
        "\\brief ": "",
        "\\note": "@remarks",
        "\\return": "@returns",
        "\\li": "*",
        "\\param": "@param",
    };

    // 🚧 Actual parsing work
    let post_macro_text = "";
    const processed = (() => {
        function split_exclude_first(text: string, by: string | RegExp) {
            const intermediate = text.split(by);
            return intermediate.slice(1, intermediate.length);
        }

        const comment_regex = /\/\*(\*(?!\/)|[^*])*\*\//g;
        {
            const defines = {} as Record<string, { args: string[], contents: string }>;
            const macro_regex = /(#ifdef|#ifndef|#else|#endif|#define)/;
            const macro_statements = text.split(/(?=#ifdef|#ifndef|#else|#endif|#define)/);
            while (macro_statements.length > 0) {
                const statement = macro_statements.shift()!;
                const type_match = statement.match(macro_regex);
                if (type_match == null || type_match?.length == 0) {
                    post_macro_text += statement;
                    continue;
                }
                const filtered_statement = statement.replace(comment_regex, "")
                const type = type_match[0];
                const space_split = filtered_statement.split(`\r\n`)[0].split(/[ \t]+|\(/);
                const define_key = space_split[1];
                const [_, define_args_content] = filtered_statement.split(/\(|\)/);
                const define_args = define_args_content?.split(",").map(arg => arg.trim()) || [];

                // If there's a newline before finding a backslash, then it's the end of the #define value
                const { define_value, remainder } = (() => {
                    const define_value_components = statement.slice(
                        define_key == null ? 0 : (statement.indexOf(define_key) + define_key.length) +
                            (define_args_content == null ? 0 : define_args_content.length + 2),
                        statement.length).split(`\r\n`);
                    const value_end = define_value_components.findIndex(comp => comp[comp.length - 1] != "\\");
                    return {
                        define_value: define_value_components.slice(0, value_end + 1).join("\n").replace(comment_regex, "").trim(),
                        remainder: define_value_components.slice(value_end + 1, define_value_components.length).join("\n"),
                    };
                })();

                const process_remainder = () => {
                    const processed = Object.keys(defines).reduce((result, key) => {
                        return result.replace(new RegExp(`${key}`, "g"), defines[key].contents);
                    }, remainder);
                    return processed;
                }

                switch (type) {
                    case "#ifdef":
                        // 🤚 Skip all statements inside of invalid #ifdef statements
                        if (defines[define_key] == null) {
                            while (macro_statements[0].match(/#endif|#else/)?.[0] == null) {
                                macro_statements.shift()!;
                            }
                        } else {
                            post_macro_text += process_remainder();
                        }
                        break;
                    case "#ifndef":
                        // 🤚 Skip all statements inside of invalid #ifndef statements
                        if (defines[define_key] != null) {
                            while (macro_statements[0].match(/#endif|#else/)?.[0] == null) {
                                macro_statements.shift()!;
                            }
                        } else {
                            post_macro_text += process_remainder();
                        }
                        break;
                    case "#else":
                        // 🤚 Skip all statements inside of invalid #else statements (any that aren't parsed as part of #ifdef/#ifndef handling)
                        while (macro_statements[0].match(/#endif/)?.[0] == null) {
                            macro_statements.shift()!;
                        }
                        break;
                    case "#define":
                        defines[define_key] = { args: define_args, contents: define_value };
                        post_macro_text += process_remainder();
                        break;
                    default:
                        post_macro_text += process_remainder();
                        break;
                }
            }
        }

        const type_name = (word: string) => {
            const comma_spaced = word.
                split(",");
            const first = comma_spaced[0];
            const star_spaced = first.
                split("*").
                join("* ");
            const outer_elems = star_spaced.split(" ").map(elem => elem.trim()).filter(elem => elem.length > 0);
            if (outer_elems.length == 1) {
                return undefined;
            }
            const [name, ...types] = outer_elems.reverse();
            const type = types.reverse().join(' ');
            const others = comma_spaced.slice(1, comma_spaced.length).map(other => ({
                name: other.trim(),
                type,
            }));
            return [{ type, name }, ...others];
        }

        // 🏛 Structs
        type Struct = {
            struct_name: string;
            members: {
                [key: string]: {
                    type: string;
                    index: number;
                };
            };
        }
        const split_by_typedef = split_exclude_first(post_macro_text, "typedef");
        const structs = split_by_typedef.
            map((typedef, index) => {
                const no_newlines = typedef.split(/\s/).filter(entry => entry.length > 0).join(" ");
                const no_comments = no_newlines.replace(comment_regex, "")
                const struct_result = no_comments.trim().match(/struct(.*){(?<contents>.*)}(?<name>[^;]*);/);
                console.log(struct_result);
                if (struct_result != null && struct_result.groups != null) {
                    const members = struct_result.groups.contents.split(";").
                        filter(member => member.length > 0).
                        flatMap(member => {
                            const trimmed = member.trim();
                            if (trimmed.length == 0) { return undefined; }
                            const result = type_name(trimmed);
                            if (result == null) { return undefined; }
                            return result.map(res => ({
                                type: res.type,
                                name: res.name,
                                member: trimmed,
                            }));
                        }).
                        reduce((params, param, index) => {
                            if (param == null) return params;
                            return {
                                ...params,
                                [param.name]: {
                                    member: param.member,
                                    type: param.type,
                                    index,
                                },
                            }
                        }, {} as { [key: string]: { type: string, index: number } }) || [];
                    return {
                        struct_name: struct_result.groups.name.trim(),
                        members,
                    }
                }
                return undefined;
                // return {
                //     struct_name,
                //     comment: formatted_comment,
                //     members: params,
                // };
            }).filter((struct): struct is Struct => struct != null);

        // 🔧 Functions
        type Func = {
            function_name: string;
            comment: string | undefined;
            contents: {
                output: string;
                params: {
                    [key: string]: {
                        type: string;
                        index: number;
                    };
                };
            },
        };
        const split_by_externs = split_exclude_first(post_macro_text, "extern");
        const functions = split_by_externs.
            map((extern, index): Func | undefined => {
                try {
                    const previous = index > 0 ? split_by_externs[index - 1] : "";
                    const statement = extern.split(";")[0].replace(comment_regex, "");
                    const flattened = statement.split(`\r\n`).map(elem => elem.trim()).join('');
                    const ignored = flattened.split(/const/).
                        map(elem => elem.trim()).
                        filter(elem => elem.length > 0).
                        join(' ');
                    const [outer, inner] = ignored.split(/\(|\)/);

                    const result = type_name(outer)?.[0];
                    if (result == null) { return undefined; }
                    const { type: output, name: function_name } = result;

                    const params = inner?.split(",").
                        map(param => type_name(param)?.[0]).
                        reduce((params, param, index) => {
                            if (param == null) return params;
                            return {
                                ...params,
                                [param.name]: {
                                    type: param.type,
                                    index,
                                },
                            }
                        }, {} as { [key: string]: { type: string, index: number } }) || [];

                    const comments = previous?.match(comment_regex);
                    const comment = comments == null ? undefined : comments[comments.length - 1];
                    const formatted_comment = Object.
                        entries(comment_formatting).
                        reduce((formatted, [from, to]) => formatted?.split(from).join(to), comment);

                    return {
                        function_name,
                        comment: formatted_comment,
                        contents: { output, params },
                    };
                } catch (e) { console.error(e); }
            }).
            filter((statement): statement is Func => statement != null);
        return `{\nstructs:{\n${structs.map(struct => `${struct.struct_name}: ${JSON.stringify(struct.members, undefined, 4)
            }`).join(",\n")
            }\n},\nfunctions: {\n${functions.map(func =>
                `${func.comment || ""
                }\n${func.function_name}: ${JSON.stringify(func.contents, undefined, 4)
                }`).join(",\n")}\n}\n}`;
    })();

    const text_areas = Object.values(HtmlBuilder.create_children(container, {
        original: {
            type: "textarea",
            attributes: { innerHTML: post_macro_text },
            style,
        },
        processed: {
            type: "textarea",
            attributes: { innerHTML: processed },
            style,
        }
    }));

    const initial_scroll = Number.parseInt(localStorage.getItem("scroll") || "0");
    text_areas.forEach(text_area => {
        text_area.onscroll = (e) => {
            localStorage.setItem("scroll", `${text_areas[1].scrollTop}`);
        };
    });
    text_areas[1].scrollTop = initial_scroll;
}

display_parser();