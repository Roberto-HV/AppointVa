import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// The full suite runs many jsdom files in parallel; under that load async queries
// (findBy*/waitFor) can exceed the 1s default even when the UI is correct.
configure({ asyncUtilTimeout: 3000 });
