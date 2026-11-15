import { describe, expect, test } from "bun:test";
import type { TriageTree } from "../types";
import {
  answerTriage,
  backTriage,
  startTriage,
  validateTriageTree,
} from "./triage";

const action = { title: "Do X", steps: ["step 1"], severity: "warn" as const };

const tree: TriageTree = {
  start: "q1",
  nodes: {
    q1: {
      id: "q1",
      question: "Question 1?",
      options: [
        { label: "Yes", next: "a" },
        { label: "No", next: "q2" },
      ],
    },
    q2: {
      id: "q2",
      question: "Question 2?",
      options: [
        { label: "Yes", next: "b" },
        { label: "No", next: "q1" },
      ],
    },
    a: { id: "a", action },
    b: { id: "b", action },
  },
};

describe("walking the tree", () => {
  test("answers lead to a final action, back returns one step", () => {
    let state = startTriage(tree);
    expect(state.nodeId).toBe("q1");
    expect(state.finished).toBe(false);

    state = answerTriage(tree, state, 1);
    expect(state.nodeId).toBe("q2");

    state = answerTriage(tree, state, 0);
    expect(state.nodeId).toBe("b");
    expect(state.finished).toBe(true);
    expect(state.path.map((s) => s.answer)).toEqual(["No", "Yes"]);

    state = backTriage(state);
    expect(state.nodeId).toBe("q2");
    expect(state.finished).toBe(false);
  });

  test("a non-existent answer option throws", () => {
    expect(() => answerTriage(tree, startTriage(tree), 5)).toThrow();
  });
});

describe("validateTriageTree", () => {
  test("a valid tree (with a loop that has an exit) has no errors", () => {
    expect(validateTriageTree(tree)).toEqual([]);
  });

  test("a link to a missing node", () => {
    const bad: TriageTree = {
      ...tree,
      nodes: {
        ...tree.nodes,
        q1: {
          id: "q1",
          question: "?",
          options: [{ label: "Yes", next: "nope" }],
        },
      },
    };
    expect(
      validateTriageTree(bad).some((e) => e.includes("missing node")),
    ).toBe(true);
  });

  test("an unreachable node", () => {
    const bad: TriageTree = {
      ...tree,
      nodes: { ...tree.nodes, orphan: { id: "orphan", action } },
    };
    expect(validateTriageTree(bad).some((e) => e.includes("unreachable"))).toBe(
      true,
    );
  });

  test("a loop with no exit", () => {
    const bad: TriageTree = {
      start: "x",
      nodes: {
        x: { id: "x", question: "?", options: [{ label: "Go", next: "y" }] },
        y: { id: "y", question: "?", options: [{ label: "Back", next: "x" }] },
      },
    };
    expect(
      validateTriageTree(bad).some((e) =>
        e.includes("cannot reach a final action"),
      ),
    ).toBe(true);
  });

  test("a terminal node without an action", () => {
    const bad: TriageTree = {
      start: "x",
      nodes: { x: { id: "x", question: "?" } },
    };
    expect(validateTriageTree(bad).some((e) => e.includes("no action"))).toBe(
      true,
    );
  });
});
