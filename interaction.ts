import { PromptBuilder } from "./prompt.js";
import {
  Tool,
  ToolBuilder,
  ToolNameStep,
  respondTool,
  toolToTs,
} from "./tool.js";
import { ZodType, z } from "zod";

export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type Example = {
  messages: Message[];
};

class ExampleBuilder {
  private _messages: Message[] = [];

  message(role: "user" | "assistant" | "system", ...content: string[]) {
    const joinedContent = content.join("\n");
    this._messages.push({ role, content: joinedContent });
    return this;
  }

  build(): string {
    const messages = this._messages.map((m) => {
      return `<im_start>${m.role}\n${m.content}<im_end>`;
    });
    return messages.join("\n");
  }
}

export type InteractionSpec<T> = {
  systemPrompt: string;
  resultType: ZodType<T>;
  tools: Tool<unknown>[];
};

export class InteractionBuilder<T> {
  private _instructions: PromptBuilder = new PromptBuilder();
  private _tools: Tool<unknown>[] = [];
  private _resultType: z.ZodTypeAny = z.string();
  private _examples: string[] = [];

  prompt(builder: (p: PromptBuilder) => PromptBuilder) {
    builder(this._instructions);
    return this;
  }

  tool(builder: (t: ToolNameStep) => Tool<unknown>) {
    const toolBuilder = new ToolBuilder();
    const tool = builder(toolBuilder);
    this._tools.push(tool);
    return this;
  }

  example(builder: (e: ExampleBuilder) => ExampleBuilder) {
    const exampleBuilder = new ExampleBuilder();
    const example = builder(exampleBuilder).build();
    this._examples.push(example);
    return this;
  }

  returnType<NewT>(returnType: ZodType<NewT>): InteractionBuilder<NewT> {
    this._resultType = returnType;
    this.tool(respondTool(returnType));
    return this as unknown as InteractionBuilder<NewT>;
  }

  build(): InteractionSpec<T> {
    this._addToolsSection();
    this._addExamplesSection();
    return {
      systemPrompt: this._instructions.build(),
      resultType: this._resultType,
      tools: this._tools,
    };
  }

  private _addToolsSection() {
    const globals = this._tools.map((tool) => toolToTs(tool)).join("\n\n");
    this._instructions.section("Available globals", globals);
  }

  private _addExamplesSection() {
    const examples = this._examples
      .map((e, i) => `#### Example ${i + 1}\n${e}`)
      .join("\n\n");
    this._instructions.section("Examples", examples);
  }
}

export const interaction = () => new InteractionBuilder();
