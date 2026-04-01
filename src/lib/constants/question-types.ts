export interface QuestionTypeInfo {
  slug: string;
  name: string;
  chapter: number;
  description: string;
  exampleStem: string;
}

export const QUESTION_TYPES: Record<string, QuestionTypeInfo> = {
  "must-be-true": {
    slug: "must-be-true",
    name: "Must Be True",
    chapter: 4,
    description:
      "Identify what must be true based on the information in the stimulus",
    exampleStem:
      "If the statements above are true, which one of the following must also be true?",
  },
  "main-point": {
    slug: "main-point",
    name: "Main Point",
    chapter: 5,
    description: "Identify the main conclusion of the argument",
    exampleStem:
      "Which one of the following most accurately expresses the main conclusion of the argument?",
  },
  "point-at-issue": {
    slug: "point-at-issue",
    name: "Point at Issue",
    chapter: 6,
    description: "Find the point of disagreement between two speakers",
    exampleStem:
      "The dialogue provides the most support for the claim that the two speakers disagree about which one of the following?",
  },
  "most-supported": {
    slug: "most-supported",
    name: "Most Supported",
    chapter: 7,
    description:
      "Identify the statement most strongly supported by the stimulus",
    exampleStem:
      "Which one of the following is most strongly supported by the information above?",
  },
  assumption: {
    slug: "assumption",
    name: "Assumption",
    chapter: 8,
    description: "Identify an unstated assumption the argument depends on",
    exampleStem:
      "The argument depends on the assumption that",
  },
  justify: {
    slug: "justify",
    name: "Justify the Conclusion",
    chapter: 9,
    description:
      "Find the statement that, if assumed, makes the conclusion follow logically",
    exampleStem:
      "The conclusion follows logically if which one of the following is assumed?",
  },
  strengthen: {
    slug: "strengthen",
    name: "Strengthen",
    chapter: 10,
    description: "Find information that most strengthens the argument",
    exampleStem:
      "Which one of the following, if true, most strengthens the argument?",
  },
  resolve: {
    slug: "resolve",
    name: "Resolve the Paradox",
    chapter: 11,
    description: "Find information that explains an apparent discrepancy",
    exampleStem:
      "Which one of the following, if true, most helps to resolve the apparent discrepancy described above?",
  },
  weaken: {
    slug: "weaken",
    name: "Weaken",
    chapter: 12,
    description: "Find information that most undermines the argument",
    exampleStem:
      "Which one of the following, if true, most weakens the argument above?",
  },
  "method-of-reasoning": {
    slug: "method-of-reasoning",
    name: "Method of Reasoning",
    chapter: 13,
    description: "Describe how the argument proceeds or is structured",
    exampleStem:
      "The argument proceeds by",
  },
  flaw: {
    slug: "flaw",
    name: "Flaw in the Reasoning",
    chapter: 14,
    description: "Identify the logical error in the argument",
    exampleStem:
      "The reasoning in the argument is most vulnerable to criticism on the grounds that the argument",
  },
  "parallel-reasoning": {
    slug: "parallel-reasoning",
    name: "Parallel Reasoning",
    chapter: 15,
    description:
      "Find the argument that has the same logical structure as the stimulus",
    exampleStem:
      "Which one of the following arguments is most similar in its pattern of reasoning to the argument above?",
  },
  "parallel-flaw": {
    slug: "parallel-flaw",
    name: "Parallel Flaw",
    chapter: 16,
    description: "Find the argument with the same type of logical error",
    exampleStem:
      "Which one of the following arguments exhibits a flawed pattern of reasoning most similar to that exhibited by the argument above?",
  },
  evaluate: {
    slug: "evaluate",
    name: "Evaluate the Argument",
    chapter: 17,
    description:
      "Identify what information would be most useful in evaluating the argument",
    exampleStem:
      "Which one of the following would be most useful to know in order to evaluate the argument?",
  },
};

export const QUESTION_TYPE_SLUGS = Object.keys(QUESTION_TYPES);
