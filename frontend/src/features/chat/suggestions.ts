import { ListChecks, ScrollText, Sparkles } from "lucide-react";

export interface SuggestedAction {
  id: string;
  label: string;
  description: string;
  prompt: string;
  icon: typeof Sparkles;
}

export const SUGGESTED_ACTIONS: SuggestedAction[] = [
  {
    id: "summary",
    label: "Summarize this document",
    description: "A short overview of the argument and main takeaways.",
    prompt:
      "Summarize this document. Give me a clear, concise overview, the main argument or purpose, and the key takeaways.",
    icon: ScrollText,
  },
  {
    id: "concepts",
    label: "Extract key concepts",
    description: "The important ideas, each with a short explanation.",
    prompt:
      "Extract the most important concepts from this document. For each concept, give a short explanation grounded in the text.",
    icon: Sparkles,
  },
  {
    id: "questions",
    label: "Generate important questions",
    description: "Questions this document can answer, ready to explore.",
    prompt:
      "Generate the most important questions this document can answer. For each question, briefly note what the document says about it.",
    icon: ListChecks,
  },
];
