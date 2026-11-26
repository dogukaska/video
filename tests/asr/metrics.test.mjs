import assert from "node:assert/strict";
import { test } from "node:test";
import { errorRates, measure, normalize } from "./metrics.mjs";

test("Türkçe harfleri korur, büyük harfleri ve noktalama işaretlerini normalleştirir", () => {
  assert.equal(normalize("İSTANBUL’DA IŞIK, ŞĞÇÖÜ!"), "istanbulda ışık şğçöü");
  assert.deepEqual(measure("Güçlü çağrı.", "güçlü çağrı"), {
    wordErrors: 0, referenceWords: 2, characterErrors: 0, referenceCharacters: 10,
  });
});

test("ekleme, silme ve değiştirmeleri sayar", () => {
  assert.equal(measure("bir iki üç", "bir üç dört beş").wordErrors, 3);
  assert.deepEqual(measure("çığ", ""), {
    wordErrors: 1, referenceWords: 1, characterErrors: 3, referenceCharacters: 3,
  });
  assert.equal(measure("şiş", "sis").characterErrors, 2);
  assert.throws(() => measure("..", "bir"), /Referans metin/);
});

test("korpus oranları klip ortalaması yerine referans uzunluğuna göre hesaplanır", () => {
  assert.deepEqual(errorRates([measure("a", ""), measure("b c d", "b c d")]), { wer: .25, cer: .25 });
});
