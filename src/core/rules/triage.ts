import type { TriageNode, TriageTree } from "../types";

export interface TriageStep {
  nodeId: string;
  answer?: string;
}

export interface TriageState {
  nodeId: string;
  path: TriageStep[];
  finished: boolean;
}

export const isTerminal = (node: TriageNode): boolean =>
  !node.options || node.options.length === 0;

export function getNode(tree: TriageTree, id: string): TriageNode {
  const node = tree.nodes[id];
  if (!node) throw new Error(`Triage node "${id}" not found`);
  return node;
}

export function startTriage(tree: TriageTree): TriageState {
  const node = getNode(tree, tree.start);
  return { nodeId: tree.start, path: [], finished: isTerminal(node) };
}

export function answerTriage(
  tree: TriageTree,
  state: TriageState,
  optionIndex: number,
): TriageState {
  const node = getNode(tree, state.nodeId);
  const option = node.options?.[optionIndex];
  if (!option)
    throw new Error(
      `Option ${optionIndex} does not exist in node "${state.nodeId}"`,
    );
  const next = getNode(tree, option.next);
  return {
    nodeId: option.next,
    path: [...state.path, { nodeId: state.nodeId, answer: option.label }],
    finished: isTerminal(next),
  };
}

export function backTriage(state: TriageState): TriageState {
  const previous = state.path.at(-1);
  if (!previous) return state;
  return {
    nodeId: previous.nodeId,
    path: state.path.slice(0, -1),
    finished: false,
  };
}

// Returns a list of tree errors. An empty list means the tree is valid
export function validateTriageTree(tree: TriageTree): string[] {
  const errors: string[] = [];
  const entries = Object.entries(tree.nodes);

  if (!tree.nodes[tree.start])
    errors.push(`start node "${tree.start}" does not exist`);

  for (const [id, node] of entries) {
    if (node.id !== id)
      errors.push(`node key "${id}" does not match its id "${node.id}"`);
    if (!node.question && !node.action)
      errors.push(`node "${id}" has neither a question nor an action`);
    if (isTerminal(node) && !node.action)
      errors.push(`terminal node "${id}" has no action`);
    for (const option of node.options ?? []) {
      if (!tree.nodes[option.next]) {
        errors.push(`node "${id}" points to missing node "${option.next}"`);
      }
    }
  }

  const reachable = new Set<string>();
  const stack = [tree.start];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = tree.nodes[id];
    if (!node || reachable.has(id)) continue;
    reachable.add(id);
    for (const option of node.options ?? []) stack.push(option.next);
  }
  for (const [id] of entries) {
    if (!reachable.has(id)) errors.push(`node "${id}" is unreachable`);
  }

  const canFinish = new Set(
    entries.filter(([, n]) => isTerminal(n)).map(([id]) => id),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, node] of entries) {
      if (canFinish.has(id)) continue;
      if ((node.options ?? []).some((o) => canFinish.has(o.next))) {
        canFinish.add(id);
        changed = true;
      }
    }
  }
  for (const id of reachable) {
    if (!canFinish.has(id))
      errors.push(`node "${id}" cannot reach a final action`);
  }

  return errors;
}
