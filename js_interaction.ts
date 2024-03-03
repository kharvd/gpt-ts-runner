import OpenAI from "openai";
import {
  AsyncFunctionImplementation,
  QuickJSAsyncContext,
  QuickJSContext,
  QuickJSHandle,
  QuickJSWASMModule,
  VmFunctionImplementation,
  shouldInterruptAfterDeadline,
} from "quickjs-emscripten";
import { ChatCompletionMessageParam } from "openai/resources";
import util from "util";
import chalk from "chalk";
import { Tool } from "./tool.js";
import { transformSchema } from "./zod.js";
import { InteractionSpec, interaction } from "./interaction.js";
import { z } from "zod";

export const jsInteraction = () =>
  interaction()
    .prompt((p) =>
      p
        .section(
          null,
          "You are running in an interactive sandboxed JavaScript environment. You will ONLY write JavaScript code to respond to user's input. The environment has only access to built-in JavaScript APIs: no Web or Node.js. If you need to inspect the result of your code, use the `log` function. The result will be returned in a follow-up message."
        )
        .section(
          "Output format",
          "Regardless of the user's request, you should ONLY produce valid JavaScript code surrounded by Markdown code fences. ALWAYS start your message with ```javascript"
        )
    )
    .tool((t) =>
      t
        .name("log")
        .description(
          "Print the given object to the console for inspection. The user will not see the output of this function."
        )
        .parameter("obj", z.any(), "The object to inspect")
        .returnType(z.void())
        .impl((obj: any) => {
          throw new Error("Not implemented");
        })
    )
    .tool((t) =>
      t
        .name("respond")
        .description(
          "Respond to the user with the given string. This is the only way to send a message to the user."
        )
        .parameter("message", z.string(), "The message to send")
        .returnType(z.void())
        .impl((message: string) => {
          throw new Error("Not implemented");
        })
    )
    .example((e) =>
      e
        .message("user", "What is 128 * 481023?")
        .message(
          "assistant",
          "```javascript",
          "// I will simply calculate the result and respond with it",
          "respond((128 * 481023).toString());",
          "```"
        )
    );

const openai = new OpenAI();

const BUILT_IN_TOOL_NAMES = ["log", "respond"];

export class JsInteraction {
  private isDone = false;
  private logQueue: string[] = [];
  private tools: Tool<unknown>[] = [];
  private messages: ChatCompletionMessageParam[] = [];

  constructor(
    private vm: QuickJSAsyncContext,
    interaction: InteractionSpec
  ) {
    this._addFunction("respond", (arg) => {
      const response = this.vm.dump(arg);
      console.log("respond", response);
    });

    this._addFunction("log", (arg) => {
      const str = util.inspect(this.vm.dump(arg));
      this.logQueue.push(`[log] ${str}`);
    });

    for (const tool of interaction.tools) {
      if (!BUILT_IN_TOOL_NAMES.includes(tool.name)) {
        this._addTool(tool);
      }
    }

    this._addMessage("system", interaction.systemPrompt);
  }

  async runInteraction(userInput: string) {
    this._addMessage("user", userInput);

    while (!this.isDone) {
      const completion = await this._callGpt();
      const response = completion.choices[0].message.content!;
      this._addMessage("assistant", response);
      const code = stripMarkdown(response);

      await this._runCode(code);

      this._processLogQueue();

      if (this.messages[this.messages.length - 1].role === "assistant") {
        this.isDone = true;
      }
    }
  }

  private _addTool(tool: Tool<unknown>) {
    this.tools.push(tool);
    const newSchema = transformSchema(this.vm, tool.returnType);

    if (tool.returnType instanceof z.ZodPromise) {
      this._addAsyncFunction(tool.name, async (...args) => {
        const argument = args.map((arg) => this.vm.dump(arg));
        const result = await tool.impl(...argument);
        const resultHandle = newSchema.parse(result);
        return resultHandle;
      });
    } else {
      this._addFunction(tool.name, (...args) => {
        const argument = args.map((arg) => this.vm.dump(arg));
        const result = tool.impl(...argument);
        const resultHandle = newSchema.parse(result);
        return resultHandle;
      });
    }
  }

  private async _callGpt() {
    return openai.chat.completions.create({
      messages: this.messages,
      model: "gpt-4-0125-preview",
      // model: "gpt-3.5-turbo",
      temperature: 0,
    });
  }

  private async _runCode(code: string) {
    console.log(chalk.bold("Executing JS"));
    console.log(chalk.gray(code));

    const result = await this.vm.evalCodeAsync(code);
    if (result.error) {
      using errorHandle = result.error;
      const error = this.vm.dump(errorHandle);
      this.logQueue.push(`Exception thrown: ${util.inspect(error)}`);
    } else {
      result.value.dispose();
    }
  }

  private _processLogQueue() {
    if (this.logQueue.length === 0) {
      return;
    }

    const message = this.logQueue.join("\n");
    this._addMessage("user", message);
    this.logQueue = [];
  }

  private _addFunction(
    name: string,
    fn: VmFunctionImplementation<QuickJSHandle>
  ) {
    using fnHandle = this.vm.newFunction(name, fn);
    this.vm.setProp(this.vm.global, name, fnHandle);
  }

  private _addAsyncFunction(name: string, fn: AsyncFunctionImplementation) {
    using fnHandle = this.vm.newAsyncifiedFunction(name, fn);
    this.vm.setProp(this.vm.global, name, fnHandle);
  }

  private _addMessage(role: "user" | "assistant" | "system", content: string) {
    const color =
      role === "user" || role === "system" ? chalk.yellow : chalk.green;
    console.info(color(`[${role}]\n${content}\n`));
    this.messages.push({ role, content });
  }
}

function stripMarkdown(str: string) {
  const lines = str.split("\n");
  if (lines.length < 2) {
    return str;
  }

  const firstLine = lines[0].trim();

  if (
    ["```javascript", "```typescript", "```", "```js", "```ts"].includes(
      firstLine
    )
  ) {
    lines.shift();
  }

  while (lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  if (lines[lines.length - 1].trim() === "```") {
    lines.pop();
  }

  return lines.join("\n");
}
