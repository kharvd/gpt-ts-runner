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

function mapRole(role: "user" | "assistant" | "system") {
  switch (role) {
    case "user":
      return "Human";
    case "assistant":
      return "Assistant";
    case "system":
      return "System";
  }
}

class ExampleBuilder {
  private _messages: Message[] = [];

  message(role: "user" | "assistant" | "system", ...content: string[]) {
    const joinedContent = content.join("\n");
    this._messages.push({ role, content: joinedContent });
    return this;
  }

  build(): Message[] {
    // const messages = this._messages.map((m) => {
    //   return `${mapRole(m.role)}:\n${m.content}\n`;
    // });
    // return messages.join("\n");
    return this._messages;
  }
}

export type InteractionSpec<T> = {
  systemPrompt: string;
  resultType: ZodType<T>;
  tools: Tool<unknown>[];
  examples: Message[][];
};

export class InteractionBuilder<T> {
  private _instructions: PromptBuilder = new PromptBuilder();
  private _tools: Tool<unknown>[] = [];
  private _resultType: z.ZodTypeAny = z.string();
  private _examples: Message[][] = [];

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
    // this._addExamplesSection();
    return {
      systemPrompt: this._instructions.build(),
      resultType: this._resultType,
      tools: this._tools,
      examples: this._examples,
    };
  }

  private _addToolsSection() {
    const globals = this._tools.map((tool) => toolToTs(tool)).join("\n\n");
    this._instructions.section("globals", globals);
  }
}

export const interaction = () => new InteractionBuilder();
