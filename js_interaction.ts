import {
  AsyncFunctionImplementation,
  QuickJSAsyncContext,
  QuickJSHandle,
  VmFunctionImplementation,
} from "quickjs-emscripten";
import util from "util";
import chalk from "chalk";
import { Tool } from "./tool.js";
import { transformSchema } from "./zod.js";
import { InteractionSpec } from "./interaction.js";
import { z } from "zod";
import { ChatCompletionMessage, LlmModel } from "./llm.js";
import prompts from "prompts";

export interface JsInteractionContext {
  resolve(result: unknown): void;
  addLogMessage(message: string): void;
}

export class JsInteraction<T> implements JsInteractionContext {
  private isDone = false;
  private logQueue: string[] = [];
  private result?: T;
  private messages: ChatCompletionMessage[] = [];

  constructor(
    private vm: QuickJSAsyncContext,
    private interaction: InteractionSpec<T>,
    private llm: LlmModel
  ) {
    for (const tool of interaction.tools) {
      this._addTool(tool);
    }

    this._addMessage("system", interaction.systemPrompt);

    for (const example of interaction.examples) {
      for (const message of example) {
        this._addMessage(message.role, message.content);
      }
    }
  }

  resolve(result: unknown) {
    const res = this.interaction.resultType.parse(result);
    console.log(chalk.bold("Result:"), res);
  }

  addLogMessage(message: string) {
    this.logQueue.push(message);
  }

  private async _promptUser(): Promise<string | undefined> {
    const userInput = (
      await prompts({
        type: "text",
        name: "value",
        message: ">",
      })
    ).value;

    if (!userInput) {
      this.isDone = true;
      return undefined;
    }

    this._addMessage("user", userInput);

    return userInput;
  }

  async runInteraction(): Promise<T> {
    await this._promptUser();

    while (!this.isDone) {
      console.log(chalk.green("[assistant]"));
      const response = await this.llm.runChatCompletion(this.messages);
      this._addMessage("assistant", response, /* print */ false);
      const code = stripMarkdown(response);

      if (code === "") {
        this.addLogMessage("<error>\nNo code block found\n</error>");
      } else {
        await this._runCode(code);
      }

      this._processLogQueue();

      if (this.messages[this.messages.length - 1].role === "assistant") {
        await this._promptUser();
      }
    }

    return this.result!;
  }

  private _addTool(tool: Tool<unknown>) {
    const newSchema = transformSchema(this.vm, tool.returnType);

    if (tool.returnType instanceof z.ZodPromise) {
      this._addAsyncFunction(tool.name, async (...args) => {
        const argument = args.map((arg) => this.vm.dump(arg));
        const result = await tool.impl(this, ...argument);
        const resultHandle = newSchema.parse(result);
        return resultHandle;
      });
    } else {
      this._addFunction(tool.name, (...args) => {
        const argument = args.map((arg) => this.vm.dump(arg));
        const result = tool.impl(this, ...argument);
        const resultHandle = newSchema.parse(result);
        return resultHandle;
      });
    }
  }

  private async _runCode(code: string) {
    console.log(chalk.bold("Executing JS"));
    console.log(chalk.gray(code));

    const result = await this.vm.evalCodeAsync(code);
    if (result.error) {
      using errorHandle = result.error;
      const error = this.vm.dump(errorHandle);
      this.logQueue.push(
        `<error>\nException thrown: ${util.inspect(error)}\n</error>`
      );
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

  private _addMessage(
    role: "user" | "assistant" | "system",
    content: string,
    print = true
  ) {
    if (print) {
      const color =
        role === "user" || role === "system" ? chalk.yellow : chalk.green;
      console.info(color(`[${role}]\n${content}\n`));
    }
    this.messages.push({ role, content });
  }
}

function stripMarkdown(str: string) {
  const lines = str.split("\n");

  while (lines.length > 0 && lines[0].trim() != "<javascript>") {
    lines.shift();
  }

  if (lines.length === 0) {
    return "";
  }

  lines.shift();

  while (
    lines.length > 0 &&
    lines[lines.length - 1].trim() != "</javascript>"
  ) {
    lines.pop();
  }

  if (lines.length === 0) {
    return "";
  }

  lines.pop();

  return lines.join("\n").trim();
}
