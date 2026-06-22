"use client";

import { useState } from "react";
import { Check, HelpCircle, X } from "lucide-react";

export interface KnowledgeCheckProps {
  question: string;
  options: string[];
  /** Zero-based index of the correct option. */
  answer: number;
  explanation: string;
}

export function KnowledgeCheck({
  question,
  options,
  answer,
  explanation,
}: KnowledgeCheckProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const correct = selected === answer;

  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-surface p-5">
      <p className="flex items-start gap-2 font-medium text-ink">
        <HelpCircle size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
        <span>{question}</span>
      </p>

      <ul className="mt-4 space-y-2">
        {options.map((option, i) => {
          const isAnswer = i === answer;
          const isChosen = i === selected;
          let state =
            "border-border bg-surface hover:bg-surface-2 text-ink";
          if (answered && isAnswer) {
            state = "border-success/50 bg-success-soft text-ink";
          } else if (answered && isChosen && !isAnswer) {
            state = "border-danger/50 bg-danger-soft text-ink";
          }
          return (
            <li key={option}>
              <button
                type="button"
                disabled={answered}
                onClick={() => setSelected(i)}
                aria-pressed={isChosen}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${state}`}
              >
                <span>{option}</span>
                {answered && isAnswer && (
                  <Check size={16} aria-hidden className="shrink-0 text-success" />
                )}
                {answered && isChosen && !isAnswer && (
                  <X size={16} aria-hidden className="shrink-0 text-danger" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div className="mt-4 rounded-lg bg-surface-2 p-4 text-sm leading-relaxed">
          <p className="font-medium">
            {correct ? "Correct." : "Not quite."}
          </p>
          <p className="mt-1 text-ink-muted">{explanation}</p>
        </div>
      )}
    </div>
  );
}
