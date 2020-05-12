import { Shaders } from "./Util.Shaders";
import { Texture } from "./Util.Texture";
import { HtmlBuilder } from "./Util.HtmlBuilder";
import { Vec3, Vec4, Quat, Num } from "./Util.VecMath";

export class SmoothCurve {
    constructor(private values: number[]) { }
    public sample(t: number) {
        const smooth_index = t * this.values.length;
        const index = Math.floor(smooth_index);
        const current = Math.min(Math.max(index, 0), this.values.length - 1);
        const next = Math.min(Math.max(index + 1, 0), this.values.length - 1);
        const lerp = smooth_index - index;
        return this.values[current] * (1 - lerp) + this.values[next] * lerp;
    }
}

export namespace Forest {

    export type DepthDefinition = {
        Name: string,
        SplitAmount: number,
        Flatness: number,
        Size: number,
        HeightSpread: number,
        BranchPitch: number,
        BranchRoll: number,
        HeightToGrowth: SmoothCurve,
    }

    export type Settings = {
        StartSize: number,
        StartGrowth: number,
        DepthDefinitions: DepthDefinition[],
    }

    export type GenQueueItem = {
        parentIndex: number,
        node: Node,
    }

    export type Node = {
        size: number,
        position: Vec3,
        rotation: Quat,
        growth: number,
        split_depth: number,
    }

    export type Output = {
        nodes: Node[],
        node_to_primary_child_index: number[]
    }

    function generateStructure(settings: Settings) {
        const start_node: Node = {
            size: settings.StartSize,
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            growth: settings.StartGrowth,
            split_depth: 0,
        };
        const generation_queue: GenQueueItem[] = [];
        const output: Output = {
            nodes: [],
            node_to_primary_child_index: [],
        };
        generation_queue.unshift({
            parentIndex: -1,
            node: start_node,
        });
        while (generation_queue.length > 0) {
            const gen_item = generation_queue.pop();
            if (gen_item == null) { throw "💀" }
            const nodeIndex = output.nodes.length;
            output.nodes.push(gen_item.node);
            output.node_to_primary_child_index.push(-1);
            if (gen_item.parentIndex >= 0) {
                output.node_to_primary_child_index[gen_item.parentIndex] = nodeIndex;
            }
            // Branch spawning
            if (gen_item.node.split_depth < settings.DepthDefinitions.length) {
                const depth_definition = settings.DepthDefinitions[gen_item.node.split_depth];
                const split_amount = depth_definition.SplitAmount * gen_item.node.growth;
                const split_depth = gen_item.node.split_depth + 1;
                // Main branch extension
                {
                    const growth = Math.min(Math.max(depth_definition.HeightToGrowth.sample(0), 0), 1);
                    const up = Vec3.applyquat(
                        [0, 0, gen_item.node.size * gen_item.node.growth],
                        gen_item.node.rotation);
                    generation_queue.unshift({
                        parentIndex: nodeIndex,
                        node: {
                            position: Vec3.add(gen_item.node.position, up),
                            rotation: Quat.mul(gen_item.node.rotation,
                                Quat.axisang(
                                    [0, 0, 1],
                                    depth_definition.BranchRoll)),
                            size: gen_item.node.size *
                                depth_definition.Size,
                            growth: growth,
                            split_depth,
                        }
                    });
                }
                // Tangental branches
                for (
                    let splitIndex = 0;
                    splitIndex < split_amount;
                    splitIndex++
                ) {
                    const splitHeight = splitIndex * depth_definition.HeightSpread / split_amount;
                    const growth = Num.clamp(
                        depth_definition.HeightToGrowth.sample(splitHeight * gen_item.node.growth), 0, 1);
                    generation_queue.push({
                        parentIndex: -1,
                        node: {
                            position: Vec3.add(gen_item.node.position,
                                Vec3.applyquat(
                                    [0, 0, gen_item.node.size * gen_item.node.growth * (1 - splitHeight)],
                                    gen_item.node.rotation)),
                            rotation: Quat.mul(
                                Quat.mul(gen_item.node.rotation,
                                    Quat.axisang(
                                        [0, 0, 1],
                                        depth_definition.BranchRoll +
                                        Num.flattenangle(
                                            splitIndex * 360.0 * 0.618, depth_definition.Flatness),
                                    )),
                                Quat.axisang(
                                    [1, 0, 0],
                                    depth_definition.BranchPitch)),
                            size: gen_item.node.size *
                                depth_definition.Size,
                            growth: growth,
                            split_depth
                        }
                    });
                }
            }
        }
        return output;
    }

    export async function render(
        parent: HTMLElement,
        camera: Camera.Type,
    ) {
        const canvas = HtmlBuilder.createChild(parent, {
            type: "canvas",
            style: {
                width: "100%",
                height: "100%",
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: 0,
            },
            attributes: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
        });
        const gl = canvas.getContext('webgl2');
        if (gl == null) {
            return new Error("Canvas rendering context is invalid");
        }

        // 🌳 Beautiful trees ---


        const meeple_material = Shaders.generate_material(gl, {
            textures: {},
            buffers: {
                "world_position": Texture.create_buffer(gl, world_positions),
                "vertex_color": Texture.create_buffer(gl, vertex_colors),
            },
            globals: {
                ...camera.globals,

                "world_position": { type: "attribute", data: "vec3" },
                "vertex_color": { type: "attribute", data: "vec3" },

                "color": { type: "constying", data: "vec3" },
            }
        }, `            
            ${camera.includes}

            void main(void) {
                gl_Position = vec4(camera_transform(world_position), world_position.z * -0.25, 1.0);
                color = vertex_color;
            }
        `, `
            void main(void) {
                gl_FragColor = vec4(color, 1.0);
            }    
        `);

        { // 🙏 Set up gl context for rendering
            gl.clearColor(0, 0, 0, 0);
            gl.enable(gl.DEPTH_TEST);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        // 🎨 Draw materials
        Shaders.render_material(gl, meeple_material, world_positions.length);
    }