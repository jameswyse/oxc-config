import { RegExpParser, visitRegExpAST } from "@eslint-community/regexpp";
import { defineRule } from "@oxlint/plugins";

import { constantString, isGlobalValue } from "../shared/index.ts";

import type { AST } from "@eslint-community/regexpp";
import type { ESTree } from "@oxlint/plugins";

type Range = readonly [number, number];

type Ranges = readonly Range[];

type Flags = { readonly ignoreCase: boolean; readonly dotAll: boolean };

type Word = readonly Ranges[];

type MatchDirection = "forward" | "backward";

const maxCodePoint = 0x10ffff;

const maxWordRepeat = 16;

const digitRanges: Ranges = [[0x30, 0x39]];

const wordRanges: Ranges = [
  [0x30, 0x39],
  [0x41, 0x5a],
  [0x5f, 0x5f],
  [0x61, 0x7a],
];

const spaceRanges: Ranges = [
  [0x09, 0x0d],
  [0x20, 0x20],
  [0xa0, 0xa0],
  [0x1680, 0x1680],
  [0x2000, 0x200a],
  [0x2028, 0x2029],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
  [0xfeff, 0xfeff],
];

const everyCodePoint: Ranges = [[0, maxCodePoint]];

const lineTerminatorRanges: Ranges = [
  [0x0a, 0x0a],
  [0x0d, 0x0d],
  [0x2028, 0x2029],
];

const parser = new RegExpParser();

function merged(ranges: Ranges) {
  const sorted = ranges.toSorted(([left], [right]) => left - right);
  const result: Range[] = [];

  for (const [start, end] of sorted) {
    const last = result.at(-1);

    if (last !== undefined && start <= last[1] + 1) {
      result[result.length - 1] = [last[0], Math.max(last[1], end)];
    } else {
      result.push([start, end]);
    }
  }

  return result;
}

function complement(ranges: Ranges) {
  const result: Range[] = [];
  let next = 0;

  for (const [start, end] of merged(ranges)) {
    if (start > next) {
      result.push([next, start - 1]);
    }

    next = end + 1;
  }

  return next > maxCodePoint ? result : [...result, [next, maxCodePoint] as const];
}

function shifted(ranges: Ranges, [start, end]: Range, offset: number) {
  return ranges.flatMap(([low, high]) => {
    const from = Math.max(low, start);
    const to = Math.min(high, end);

    return from > to ? [] : [[from + offset, to + offset] as const];
  });
}

function caseFolded(ranges: Ranges) {
  return merged([
    ...ranges,
    ...shifted(ranges, [0x41, 0x5a], 0x20),
    ...shifted(ranges, [0x61, 0x7a], -0x20),
  ]);
}

function intersects(left: Ranges, right: Ranges) {
  return left.some(([leftStart, leftEnd]) =>
    right.some(([rightStart, rightEnd]) => leftStart <= rightEnd && rightStart <= leftEnd),
  );
}

function escapeRanges(set: AST.EscapeCharacterSet) {
  const ranges = { digit: digitRanges, space: spaceRanges, word: wordRanges }[set.kind];

  return set.negate ? complement(ranges) : ranges;
}

function setRanges(set: AST.CharacterSet, flags: Flags) {
  if (set.kind === "any") {
    return flags.dotAll ? everyCodePoint : complement(lineTerminatorRanges);
  }

  return set.kind === "property" ? null : escapeRanges(set);
}

function folded(ranges: Ranges, flags: Flags) {
  return flags.ignoreCase ? caseFolded(ranges) : merged(ranges);
}

function classElementRanges(element: AST.CharacterClassElement, flags: Flags) {
  if (element.type === "Character") {
    return [[element.value, element.value]] as const;
  }

  if (element.type === "CharacterClassRange") {
    return [[element.min.value, element.max.value]] as const;
  }

  return element.type === "CharacterSet" ? setRanges(element, flags) : null;
}

function classRanges(characterClass: AST.CharacterClass, flags: Flags) {
  const ranges: Range[] = [];

  for (const element of characterClass.elements) {
    const elementRanges = characterClass.unicodeSets ? null : classElementRanges(element, flags);

    if (elementRanges === null) {
      return null;
    }

    ranges.push(...elementRanges);
  }

  const matched = folded(ranges, flags);

  return characterClass.negate ? complement(matched) : matched;
}

function characterRanges(element: AST.Element, flags: Flags) {
  if (element.type === "Character") {
    return folded([[element.value, element.value]], flags);
  }

  if (element.type === "CharacterSet") {
    return setRanges(element, flags);
  }

  return element.type === "CharacterClass" ? classRanges(element, flags) : null;
}

function modifiedFlag(modifiers: AST.Modifiers, flag: "ignoreCase" | "dotAll") {
  if (modifiers.add[flag]) {
    return true;
  }

  return modifiers.remove?.[flag] === true ? false : null;
}

function flagsAt(node: AST.Node, flags: Flags) {
  let ignoreCase: boolean | null = null;
  let dotAll: boolean | null = null;

  for (let current = node.parent; current !== null; current = current.parent) {
    if (current.type === "Group" && current.modifiers !== null) {
      ignoreCase ??= modifiedFlag(current.modifiers, "ignoreCase");
      dotAll ??= modifiedFlag(current.modifiers, "dotAll");
    }
  }

  return { ignoreCase: ignoreCase ?? flags.ignoreCase, dotAll: dotAll ?? flags.dotAll };
}

function fixedWord(alternative: AST.Alternative, flags: Flags) {
  const word: Ranges[] = [];

  for (const element of alternative.elements) {
    const repeated = element.type === "Quantifier" && element.min === element.max;
    const count = repeated ? element.min : 1;
    const matched = repeated ? element.element : element;

    const ranges = count > maxWordRepeat ? null : characterRanges(matched, flagsAt(matched, flags));

    if (ranges === null) {
      return null;
    }

    word.push(...Array.from({ length: count }, () => ranges));
  }

  return word.length > 0 ? word : null;
}

function isNullable(element: AST.Element): boolean {
  if (element.type === "Quantifier") {
    return element.min === 0 || isNullable(element.element);
  }

  return (
    (element.type === "Group" || element.type === "CapturingGroup") &&
    element.alternatives.some((alternative) => alternative.elements.every(isNullable))
  );
}

function splitsRepetition(element: AST.Element): boolean {
  if (element.type === "Quantifier") {
    return (
      (element.max >= 2 && element.max > element.min) ||
      (element.max === 1 && splitsRepetition(element.element))
    );
  }

  return (
    (element.type === "Group" || element.type === "CapturingGroup") &&
    element.alternatives.some(({ elements }) =>
      elements.some(
        (candidate, index) =>
          splitsRepetition(candidate) &&
          elements.every((other, otherIndex) => otherIndex === index || isNullable(other)),
      ),
    )
  );
}

function startsWith(word: Word, prefix: Word) {
  return prefix.every((ranges, index) => {
    const other = word[index];

    return other !== undefined && intersects(ranges, other);
  });
}

function danglingSuffixes(left: Word, right: Word) {
  if (left.length < right.length && startsWith(right, left)) {
    return [right.slice(left.length)];
  }

  return right.length < left.length && startsWith(left, right) ? [left.slice(right.length)] : [];
}

function isSameLengthMatch(left: Word, right: Word) {
  return left.length === right.length && startsWith(left, right);
}

function isAmbiguous(words: readonly Word[]) {
  if (
    words.some((word, index) =>
      words.slice(index + 1).some((other) => isSameLengthMatch(word, other)),
    )
  ) {
    return true;
  }

  const pending = words.flatMap((word, index) =>
    words.slice(index + 1).flatMap((other) => danglingSuffixes(word, other)),
  );

  const seen = new Set<string>();

  for (let suffix = pending.pop(); suffix !== undefined; suffix = pending.pop()) {
    const key = JSON.stringify(suffix);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    for (const word of words) {
      if (isSameLengthMatch(suffix, word)) {
        return true;
      }

      pending.push(...danglingSuffixes(suffix, word));
    }
  }

  return false;
}

function canConsume(element: AST.Element): boolean {
  if (element.type === "Assertion") {
    return false;
  }

  if (element.type === "Quantifier") {
    return element.max > 0 && canConsume(element.element);
  }

  return element.type === "Group" || element.type === "CapturingGroup"
    ? element.alternatives.some(({ elements }) => elements.some(canConsume))
    : true;
}

function hasOverlappingAlternatives(element: AST.Element, flags: Flags) {
  if (element.type !== "Group" && element.type !== "CapturingGroup") {
    return false;
  }

  const raws = element.alternatives.flatMap(({ raw, elements }) =>
    elements.some(canConsume) ? [raw] : [],
  );

  const words = element.alternatives.flatMap((alternative) => {
    const word = fixedWord(alternative, flags);

    return word === null ? [] : [word];
  });

  return new Set(raws).size < raws.length || isAmbiguous(words);
}

function matchDirection(node: AST.Node) {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (current.type === "Assertion") {
      return current.kind === "lookbehind" ? "backward" : "forward";
    }
  }

  return "forward";
}

function canFailAfter(element: AST.Element, direction: MatchDirection): boolean {
  const holder = element.parent;

  if (holder.type === "Quantifier") {
    return canFailAfter(holder, direction);
  }

  if (holder.type !== "Alternative") {
    return false;
  }

  const index = holder.elements.indexOf(element);

  const later =
    direction === "backward" ? holder.elements.slice(0, index) : holder.elements.slice(index + 1);

  const owner = holder.parent;

  if (later.some((next) => !isNullable(next))) {
    return true;
  }

  return owner.type === "Group" || owner.type === "CapturingGroup"
    ? canFailAfter(owner, direction)
    : false;
}

function parsedPattern(pattern: string, flags: string) {
  try {
    return parser.parsePattern(pattern, 0, pattern.length, {
      unicode: flags.includes("u"),
      unicodeSets: flags.includes("v"),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

function exponentialQuantifier(pattern: string, flags: string) {
  const ast = parsedPattern(pattern, flags);
  const modes: Flags = { ignoreCase: flags.includes("i"), dotAll: flags.includes("s") };
  const quantifiers: AST.Quantifier[] = [];

  if (ast === null) {
    return null;
  }

  visitRegExpAST(ast, {
    onQuantifierEnter(quantifier) {
      quantifiers.push(quantifier);
    },
  });

  const exponential = quantifiers.find(
    (quantifier) =>
      quantifier.max === Number.POSITIVE_INFINITY &&
      (splitsRepetition(quantifier.element) ||
        hasOverlappingAlternatives(quantifier.element, modes)) &&
      canFailAfter(quantifier, matchDirection(quantifier)),
  );

  return exponential?.raw ?? null;
}

export const noExponentialRegex = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow regular expressions that can take exponential time to fail a match.",
    },
    schema: [],
    messages: {
      exponential:
        "`{{quantifier}}` can match the same text in exponentially many ways, so a long input that fails to match can hang the process. Rewrite it so each part of the input can match only one way, such as by removing the nested quantifier or making the alternatives distinct.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function check(node: ESTree.Node, pattern: string, flags: string) {
      const quantifier = exponentialQuantifier(pattern, flags);

      if (quantifier !== null) {
        context.report({ node, messageId: "exponential", data: { quantifier } });
      }
    }

    function checkConstructor(node: ESTree.CallExpression | ESTree.NewExpression) {
      const [patternArgument, flagsArgument] = node.arguments;

      if (
        patternArgument === undefined ||
        patternArgument.type === "SpreadElement" ||
        (patternArgument.type === "Literal" && "regex" in patternArgument) ||
        !isGlobalValue(sourceCode, node.callee, "RegExp")
      ) {
        return;
      }

      const pattern = constantString(sourceCode, patternArgument);
      const flags = flagsArgument === undefined ? "" : constantString(sourceCode, flagsArgument);

      if (pattern !== null) {
        check(patternArgument, pattern, flags ?? "");
      }
    }

    return {
      Literal(node) {
        if ("regex" in node) {
          check(node, node.regex.pattern, node.regex.flags);
        }
      },
      CallExpression: checkConstructor,
      NewExpression: checkConstructor,
    };
  },
});
