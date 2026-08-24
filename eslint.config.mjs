import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactCompiler from "eslint-plugin-react-compiler";

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  // Register the React Compiler ESLint plugin (guide §1.4 + audit P0-1).
  // This makes `react-compiler/react-compiler` rule available to the rules block.
  plugins: { "react-compiler": reactCompiler },
  rules: {
    // ---- TypeScript strict (audit P0-1) ----
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    // Keep these TS niceties lenient for trusted server/infra patterns
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",

    // ---- React 19 hardening (audit P0-1) ----
    "react-hooks/exhaustive-deps": "error",
    "react-hooks/purity": "error",
    "react-hooks/immutability": "error", // ← key for the R3F uniform-mutation pattern
    "react-compiler/react-compiler": "warn",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",

    // ---- Next.js (kept lenient: we use next/image where it counts) ----
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // ---- General JS (kept lenient for server/cli code) ----
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"]
}];

export default eslintConfig;
