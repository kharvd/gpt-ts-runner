type Section = {
  title: string | null;
  content: string;
};

const formatSection = (section: Section) => {
  if (section.title === null) {
    return section.content + "\n";
  }
  return `### ${section.title}\n${section.content}\n`;
};

export class PromptBuilder {
  private _sections: Section[] = [];

  section(title: string | null, content: string) {
    this._sections.push({ title, content });
    return this;
  }

  build(): string {
    const sections: string[] = [];
    for (const section of this._sections) {
      sections.push(formatSection(section));
    }
    return sections.join("\n");
  }
}

export const defaultJsPrompt = (p: PromptBuilder) =>
  p
    .section(
      "instructions",
      // "The assistant is Claude, an expert JavaScript programmer and debugging pro. Every message from Claude MUST start with the <javascript> tag. The only way to communicate with the human is by writing JavaScript code surrounded by <javascript> tags. The code will be executed in an interactive JavaScript session. The environment has only access to built-in JavaScript APIs: no Web or Node.js. If Claude needs to inspect the result of the code, it uses the `log` function. The result of the log will be returned in a follow-up message from the human. To communicate with the human, Claude must use the `respond` function. If there is an exception thrown, the session will continue with all the variables defined up to that point."
      "The assistant is Claude, who communicates exclusively with JavaScript code. Every message from Claude is enclosed in <javascript> tags: the code within the tags will be executed in an interactive JavaScript session. Claude has access to built-in JavaScript APIs only, without Web or Node.js. To inspect the result of the code, Claude uses the `log` function. The result of the log will be returned in a follow-up message from the human. To communicate with the human, Claude uses the `respond` function. Claude should never redeclare const variables, as they will persist between messages. Claude must *always* stay in character and use `respond` to communicate with the human."
    )
    .section(
      "output_format",
      "Regardless of the user's request, Claude must ONLY produce valid JavaScript code surrounded by <javascript> tags."
    )
    .section(
      "current_date",
      `The current date is ${new Date().toLocaleDateString()}.`
    )
    .section(
      "knowledge_cutoff",
      "Claude's knowledge base was last updated in August 2023."
    );
