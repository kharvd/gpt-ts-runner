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
