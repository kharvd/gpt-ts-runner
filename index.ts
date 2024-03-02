import OpenAI from "openai";
import {
  QuickJSContext,
  QuickJSHandle,
  QuickJSWASMModule,
  VmFunctionImplementation,
  getQuickJS,
  shouldInterruptAfterDeadline,
} from "quickjs-emscripten";
import { ChatCompletionMessageParam } from "openai/resources";

const PROMPT = `You will ONLY write JavaScript code to respond to user's input. The code will run in a limited sandboxed environment that only has access to built-in JavaScript APIs: no Web or Node.js. If you need to inspect the result of your code, use the log function. The result will be returned in a follow-up message.

### Available globals
\`\`\`typescript
/**
 * Get the current weather in a given city.
 */
function getWeather(city: string): string;

/**
 * Print the given string to the console for inspection. The user will not see the output of this function.
 */
function log(message: string): void;

/**
 * Provide textual response to the user's input. This is the only way to communicate with the user.
 */
function respond(response: string): void;
\`\`\`

### Output format
Regardless of the user's request, you should ONLY produce valid JavaScript code surrounded by Markdown code fences. ALWAYS start your message with \`\`\`javascript

The only way to provide a response to the user is by calling the \`respond\` function. Do not expect that the result of the last expression will be returned.

### Example
<im_start>user
What is 128 * 481023?<im_end>
<im_start>assistant
\`\`\`javascript
respond((128 * 481023).toString());
\`\`\`<im_end>

### Example
<im_start>user
What is the weather in New York? Respond in Russian.
<im_start>assistant
\`\`\`javascript
const weather = getWeather("New York");
log(weather);
\`\`\`<im_end>
<im_start>user
sunny, high of 75<im_end>
<im_start>assistant
\`\`\`javascript
respond("солнечно, 24 градуса по Цельсию");
\`\`\`<im_end>
`;

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

class JsInteraction {
  private context: QuickJSContext;
  private isDone = false;
  private messages: ChatCompletionMessageParam[] = [];

  constructor(QuickJS: QuickJSWASMModule) {
    this.context = QuickJS.newContext();

    this._addFunction("respond", (arg) => {
      const response = this.context.getString(arg);
      this.isDone = true;
    });

    this._addFunction("getWeather", (arg) => {
      const city = this.context.getString(arg);
      const weather = "sunny, high of 75";
      return this.context.newString(weather);
    });

    this._addFunction("log", (arg) => {
      const str = this.context.dump(arg);
      console.log("log", str);
      this._addMessage("user", str);
    });

    this._addMessage("system", PROMPT);
  }

  async runInteraction(userInput: string) {
    this._addMessage("user", userInput);

    while (!this.isDone) {
      const completion = await this._callGpt();
      const response = completion.choices[0].message.content!;
      this._addMessage("assistant", response);
      const code = stripMarkdown(response);

      this._runCode(code);
    }
  }

  [Symbol.dispose]() {
    this.context.dispose();
  }

  private async _callGpt() {
    return openai.chat.completions.create({
      messages: this.messages,
      model: "gpt-4-0125-preview",
      temperature: 0,
    });
  }

  private _runCode(code: string) {
    const result = this.context.evalCode(code);
    if (result.error) {
      this._addMessage("user", `Error: ${this.context.dump(result.error)}`);
      return;
    }

    // if (!this.isDone) {
    //   const value = this.context.dump(result.value);
    //   this._addMessage("user", value.toString());
    // }
  }

  private _addFunction(
    name: string,
    fn: VmFunctionImplementation<QuickJSHandle>
  ) {
    using fnHandle = this.context.newFunction(name, fn);
    this.context.setProp(this.context.global, name, fnHandle);
  }

  private _addMessage(role: "user" | "assistant" | "system", content: string) {
    console.info(`[${role}]\n${content}\n`);
    this.messages.push({ role, content });
  }
}

async function main() {
  const QuickJS = await getQuickJS();
  using interaction = new JsInteraction(QuickJS);
  await interaction.runInteraction(process.argv[2]);
}

main();
