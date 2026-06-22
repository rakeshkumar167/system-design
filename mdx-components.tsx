import type { MDXComponents } from "mdx/types";
import { Callout } from "@/components/learning/callout";
import { RequirementsTable } from "@/components/learning/requirements-table";
import { ApiContract } from "@/components/learning/api-contract";
import { EntityModel } from "@/components/learning/entity-model";
import { TradeoffTable } from "@/components/learning/tradeoff-table";
import { DecisionRecord } from "@/components/learning/decision-record";
import { FailureMatrix } from "@/components/learning/failure-matrix";
import { DepthSection } from "@/components/learning/depth-section";
import { Faq } from "@/components/learning/faq";
import { KnowledgeCheck } from "@/components/learning/knowledge-check";

/**
 * Global MDX component map. Custom teaching components and diagrams are
 * registered here so tutorial authors can use them by name without per-file
 * imports. Base markdown elements inherit styling from the `.prose-tutorial`
 * wrapper in globals.css.
 */
const teachingComponents = {
  Callout,
  RequirementsTable,
  ApiContract,
  EntityModel,
  TradeoffTable,
  DecisionRecord,
  FailureMatrix,
  DepthSection,
  Faq,
  KnowledgeCheck,
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...teachingComponents,
    ...components,
  };
}
