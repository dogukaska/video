export function normalize(text) {
  return text.normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/['‘’ʼ]/gu, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

function editCount(reference, hypothesis) {
  let previous = Uint32Array.from({ length: hypothesis.length + 1 }, (_, index) => index);
  let current = new Uint32Array(hypothesis.length + 1);
  for (let i = 0; i < reference.length; i++) {
    current[0] = i + 1;
    for (let j = 0; j < hypothesis.length; j++) {
      const substitution = reference[i] === hypothesis[j] ? 0 : 1;
      current[j + 1] = Math.min(previous[j + 1] + 1, current[j] + 1, previous[j] + substitution);
    }
    [current, previous] = [previous, current];
  }
  return previous[hypothesis.length];
}

export function measure(expected, actual) {
  const reference = normalize(expected);
  const hypothesis = normalize(actual);
  const referenceWords = reference.split(" ").filter(Boolean);
  const hypothesisWords = hypothesis.split(" ").filter(Boolean);
  const referenceChars = Array.from(reference.replaceAll(" ", ""));
  const hypothesisChars = Array.from(hypothesis.replaceAll(" ", ""));
  if (!referenceWords.length) throw new Error("Referans metinde en az bir kelime olmalı.");

  return {
    wordErrors: editCount(referenceWords, hypothesisWords),
    referenceWords: referenceWords.length,
    characterErrors: editCount(referenceChars, hypothesisChars),
    referenceCharacters: referenceChars.length,
  };
}

export function errorRates(measurements) {
  const sum = key => measurements.reduce((total, clip) => total + clip[key], 0);
  return {
    wer: sum("wordErrors") / sum("referenceWords"),
    cer: sum("characterErrors") / sum("referenceCharacters"),
  };
}
