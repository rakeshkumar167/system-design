import next from "eslint-config-next";

const eslintConfig = [
  ...next,
  {
    ignores: [
      ".worktrees/**",
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
    ],
  },
];

export default eslintConfig;
