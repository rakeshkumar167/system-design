export type ProblemDifficulty = "Foundational" | "Intermediate" | "Advanced";
export type ProblemStatus = "available" | "coming-soon";
export type SectionDepth = "fundamentals" | "interview-ready" | "advanced";

export interface TutorialSection {
  /** Matches the `id` attribute of the section's heading in the MDX. */
  id: string;
  label: string;
  depth: SectionDepth;
}

export interface TutorialMeta {
  slug: string;
  title: string;
  description: string;
  difficulty: ProblemDifficulty;
  readingMinutes: number;
  concepts: readonly string[];
  sections: readonly TutorialSection[];
}

export interface Problem {
  /** URL-safe identifier, also the tutorial route segment. */
  slug: string;
  title: string;
  /** One-sentence description shown on cards. */
  summary: string;
  difficulty: ProblemDifficulty;
  /** 3–5 dominant system-design concepts. */
  concepts: readonly string[];
  status: ProblemStatus;
  /** 1-based position in the recommended curriculum order. */
  sequence: number;
}
