import OpenAI from "openai";
import {
  QuickJSContext,
  QuickJSHandle,
  QuickJSWASMModule,
  VmFunctionImplementation,
  shouldInterruptAfterDeadline,
} from "quickjs-emscripten";
import { ChatCompletionMessageParam } from "openai/resources";
import util from "util";
import chalk from "chalk";
import { Tool, ToolBuilder, ToolNameStep, toolToTs } from "./tool.js";
import { transformSchema } from "./zod.js";

const PROMPT = `You will ONLY write JavaScript code to respond to user's input. The code will run in a limited sandboxed environment that only has access to built-in JavaScript APIs: no Web or Node.js. If you need to inspect the result of your code, use the \`log\` function. The result will be returned in a follow-up message.

### Important async/await note
You can use async/await without any restrictions and without wrapping your code in an async function. The code will be wrapped in an async function automatically. Do not leave any dangling promises. Always await the result of an async operation.

### Available globals
\`\`\`typescript
/**
 * Print the given object to the console for inspection. The user will not see the output of this function.
 */
function log(obj: any): void;

/**
 * Respond to the user with the given string. This is the only way to send a message to the user.
 */
function respond(message: string): void;

{{globals}}
\`\`\`

### Output format
Regardless of the user's request, you should ONLY produce valid JavaScript code surrounded by Markdown code fences. ALWAYS start your message with \`\`\`javascript

### Example
<im_start>user
What is 128 * 481023?<im_end>
<im_start>assistant
\`\`\`javascript
// I will simply calculate the result and respond with it
respond((128 * 481023).toString());
\`\`\`<im_end>

### Example
<im_start>user
What is the weather in New York?
<im_start>assistant
\`\`\`javascript
// Let's use the provided getWeather function to get the weather in New York
const weather = await getWeather("New York");
// Now, let's see what the weather is
log(weather);
\`\`\`<im_end>
<im_start>user
log:
sunny, high of 75<im_end>
<im_start>assistant
\`\`\`javascript
// I can now respond with the weather
respond("The weather in New York is sunny, high of 75. It's a beautiful day!");
\`\`\`<im_end>`;

const openai = new OpenAI();

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

export class JsInteraction {
  private isDone = false;
  private logQueue: string[] = [];
  private tools: Tool<unknown>[] = [];
  private messages: ChatCompletionMessageParam[] = [];

  constructor(
    private vm: QuickJSContext,
    toolsBuilder: (t: ToolNameStep) => Tool<unknown>[]
  ) {
    this._addFunction("respond", (arg) => {
      const response = this.vm.dump(arg);
      console.log("respond", response);
    });

    this._addFunction("log", (arg) => {
      const str = util.inspect(this.vm.dump(arg));
      this.logQueue.push(`[log] ${str}`);
    });

    const builder = new ToolBuilder();
    const tools = toolsBuilder(builder);
    for (const tool of tools) {
      this._addTool(tool);
    }

    this._addMessage("system", this._buildSystemPrompt());
  }

  async runInteraction(userInput: string) {
    this._addMessage("user", userInput);

    while (!this.isDone) {
      const completion = await this._callGpt();
      const response = completion.choices[0].message.content!;
      this._addMessage("assistant", response);
      const code = stripMarkdown(response);

      await this._runCode(code);

      this.vm.runtime.executePendingJobs();

      this._processLogQueue();

      if (this.messages[this.messages.length - 1].role === "assistant") {
        this.isDone = true;
      }
    }
  }

  private _addTool(tool: Tool<unknown>) {
    this.tools.push(tool);
    const newSchema = transformSchema(this.vm, tool.returnType);

    this._addFunction(tool.name, (...args) => {
      const argument = args.map((arg) => this.vm.dump(arg));
      const result = tool.impl(...argument);
      const resultHandle = newSchema.parse(result);
      return resultHandle;
    });
  }

  private _buildSystemPrompt() {
    const globals = this.tools.map((tool) => toolToTs(tool)).join("\n\n");
    return PROMPT.replace("{{globals}}", globals);
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
    const wrappedCode = `(async () => {
        ${code}
    })()`;

    console.log(chalk.bold("Executing JS"));
    console.log(chalk.gray(wrappedCode));

    const result = this.vm.evalCode(wrappedCode);
    if (result.error) {
      using errorHandle = result.error;
      const error = this.vm.dump(errorHandle);
      this.logQueue.push(`Exception thrown: ${util.inspect(error)}`);
    } else {
      using promiseHandle = result.value;

      this.vm.runtime.executePendingJobs();
      const nativePromise = this.vm.resolvePromise(promiseHandle);
      this.vm.runtime.executePendingJobs();
      const resolvedResult = await nativePromise;
      this.vm.runtime.executePendingJobs();

      if (resolvedResult.error) {
        using errorHandle = resolvedResult.error;
        const error = this.vm.dump(errorHandle);
        this.logQueue.push(`Exception thrown: ${util.inspect(error)}`);
      } else {
        resolvedResult.value.dispose();
      }
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

  private _addMessage(role: "user" | "assistant" | "system", content: string) {
    const color =
      role === "user" || role === "system" ? chalk.yellow : chalk.green;
    console.info(color(`[${role}]\n${content}\n`));
    this.messages.push({ role, content });
  }
}
