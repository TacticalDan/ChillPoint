import { HtmlBuilder, Style } from "./Util.HtmlBuilder";

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

    const file = await fetch("SDL_video.h");
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
    const processed = (() => {
        const externs = text.split("extern");
        const statements = externs.
            slice(1, externs.length).
            map((extern, index) => {
                const previous = index > 0 ? externs[index - 1] : "";
                const star_spaced = extern.
                    split("*").
                    join("* ");
                const statement = star_spaced.split(";")[0];
                const flattened = statement.split(`\r\n`).map(elem => elem.trim()).join('');
                const ignored = flattened.split(/DECLSPEC|SDLCALL|const/).
                    map(elem => elem.trim()).
                    filter(elem => elem.length > 0).
                    join(' ');
                const [outer, inner] = ignored.split(/\(|\)/);
                const type_name = (word: string) => {
                    const outer_elems = word.split(" ").map(elem => elem.trim());
                    if (outer_elems.length == 1) {
                        const [type] = outer_elems;
                        return { type };
                    }
                    // const type = outer_elems.slice(0, outer_elems.length - 1).join(" ");
                    // const name = outer_elems[outer_elems.length - 1];
                    const [name, ...type] = outer_elems.reverse();
                    return { type: type.reverse().join(''), name };
                }
                const { type: output, name: function_name } = type_name(outer);

                const params = inner.split(",").map(param => type_name(param));

                const comments = previous?.match(/\/\*(\*(?!\/)|[^*])*\*\//g);
                const comment = comments == null ? undefined : comments[comments.length - 1];
                const formatted_comment = Object.
                    entries(comment_formatting).
                    reduce((formatted, [from, to]) => formatted?.split(from).join(to), comment);

                return {
                    function_name,
                    comment: formatted_comment,
                    guts: { output, params },
                };
            });
        return `{\n${statements.map(statement =>
            `${statement.comment
            }\n${statement.function_name}: ${JSON.stringify(statement.guts, undefined, 4)
            }`).join(",\n")}\n}`;
    })();

    const text_areas = Object.values(HtmlBuilder.create_children(container, {
        original: {
            type: "textarea",
            attributes: { innerHTML: text },
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