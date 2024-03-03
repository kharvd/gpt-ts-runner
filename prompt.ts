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

export const prompt = () => new PromptBuilder();

export const defaultJsPrompt = (p: PromptBuilder) =>
  p
    .section(
      null,
      "You are running in an interactive sandboxed JavaScript environment. You will ONLY write JavaScript code to respond to user's input. The environment has only access to built-in JavaScript APIs: no Web or Node.js. If you need to inspect the result of your code, use the `log` function. The result will be returned in a follow-up message."
    )
    .section(
      "Output format",
      "Regardless of the user's request, you should ONLY produce valid JavaScript code surrounded by Markdown code fences. ALWAYS start your message with ```javascript"
    );
