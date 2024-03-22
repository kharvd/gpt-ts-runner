import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";

export type ChatCompletionMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface LlmModel {
  runChatCompletion(messages: ChatCompletionMessage[]): Promise<string>;
}

export class OpenAiLlmModel {
  client: OpenAI;

  constructor(private model: string) {
    this.client = new OpenAI();
  }

  async runChatCompletion(messages: ChatCompletionMessage[]): Promise<string> {
    // const completion = await this.client.chat.completions.create({
    //   messages,
    //   model: this.model,
    //   temperature: 0,
    // });
    // return completion.choices[0].message.content!;
    const stream = await this.client.chat.completions.create({
      messages,
      model: this.model,
      temperature: 0,
      stream: true,
    });

    const chunks = [];

    for await (const event of stream) {
      const chunk = event.choices[0].delta.content!;
      chunks.push(chunk);
      process.stdout.write(chalk.green(chunk));
    }

    process.stdout.write("\n");

    return chunks.join("");
  }
}

export class AnthropicLlmModel {
  client: Anthropic;

  constructor(private model: string) {
    this.client = new Anthropic();
  }

  async runChatCompletion(messages: ChatCompletionMessage[]): Promise<string> {
    let system: string | undefined;
    if (messages.length > 0 && messages[0].role === "system") {
      system = messages[0].content;
      messages.shift();
    }

    const stream = this.client.messages.stream({
      system,
      max_tokens: 4000,
      messages: messages as { role: "user" | "assistant"; content: string }[],
      model: this.model,
      temperature: 0,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        process.stdout.write(chalk.green(event.delta.text));
      }
    }
    process.stdout.write("\n");

    const message = await stream.finalMessage();
    return message.content[0].text;
  }
}
