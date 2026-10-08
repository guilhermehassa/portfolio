import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const directory = mkdtempSync(join(tmpdir(), "motorista-avisos-"));
for (const name of ["motorista-toast", "motorista-wizard-navigation", "motorista-browser-cleanup"]) {
  writeFileSync(join(directory, `${name}.js`), ts.transpileModule(
    readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText);
}
const require = createRequire(import.meta.url);
const { createMotoristaToast, TOAST_EXIT_MS } = require(join(directory, "motorista-toast.js"));
const { createWizardNavigation, WIZARD_SLIDE_OUT_MS, WIZARD_SLIDE_IN_MS } = require(join(directory, "motorista-wizard-navigation.js"));
const { clearRetiredMotoristaStorage } = require(join(directory, "motorista-browser-cleanup.js"));
after(() => rmSync(directory, { recursive: true, force: true }));

function fakeClock() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  return {
    setTimeout(callback, delay) { const next = ++id; timers.set(next, { callback, at: now + delay }); return next; },
    clearTimeout(timer) { timers.delete(timer); },
    advance(delay) {
      const target = now + delay;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
      }
      now = target;
    },
    count: () => timers.size,
    firstCallback: () => [...timers.values()][0]?.callback,
  };
}

test("toast permanece cinco segundos e conserva mensagem durante a saída antes da remoção", () => {
  const clock = fakeClock();
  const toast = createMotoristaToast(clock);
  const changes = [];
  toast.subscribe(() => changes.push(toast.getSnapshot()));
  toast.show("Dia encerrado. Planejamento e relatórios atualizados.");
  clock.advance(4999);
  assert.equal(toast.getSnapshot().closing, false);
  clock.advance(1);
  assert.equal(toast.getSnapshot().closing, true);
  assert.equal(toast.getSnapshot().message, changes[0].message);
  clock.advance(TOAST_EXIT_MS - 1);
  assert.notEqual(toast.getSnapshot(), null);
  clock.advance(1);
  assert.equal(toast.getSnapshot(), null);
  assert.equal(changes.length, 3);
  assert.equal(clock.count(), 0);
});

test("substituir aviso reinicia prazo e callbacks antigos não encerram a nova mensagem", () => {
  const clock = fakeClock();
  const toast = createMotoristaToast(clock);
  toast.show("Jornada salva.");
  const stale = clock.firstCallback();
  const original = toast.getSnapshot().id;
  clock.advance(4000);
  toast.show("Gasto salvo.");
  stale();
  assert.equal(toast.getSnapshot().message, "Gasto salvo.");
  assert.notEqual(toast.getSnapshot().id, original);
  clock.advance(4999);
  assert.equal(toast.getSnapshot().closing, false);
  clock.advance(1);
  assert.equal(toast.getSnapshot().closing, true);
});

test("repetir o mesmo texto ou substituir durante a saída cancela a remoção anterior", () => {
  const clock = fakeClock();
  const toast = createMotoristaToast(clock);
  toast.show("Registro salvo.");
  const first = toast.getSnapshot().id;
  clock.advance(5000);
  const staleExit = clock.firstCallback();
  toast.show("Registro salvo.");
  staleExit();
  assert.notEqual(toast.getSnapshot().id, first);
  assert.equal(toast.getSnapshot().closing, false);
  clock.advance(TOAST_EXIT_MS);
  assert.notEqual(toast.getSnapshot(), null);
  assert.equal(clock.count(), 1);
});

test("limpar aviso anima saída; desmontagem cancela timers e ignora respostas tardias", () => {
  const clock = fakeClock();
  const toast = createMotoristaToast(clock);
  let changes = 0;
  const unsubscribe = toast.subscribe(() => changes++);
  toast.show("Jornada salva.");
  toast.show("");
  assert.equal(toast.getSnapshot().closing, true);
  const staleExit = clock.firstCallback();
  unsubscribe();
  toast.dispose();
  staleExit();
  clock.advance(10000);
  toast.show("Resposta após sair.");
  assert.equal(changes, 2);
  assert.equal(toast.getSnapshot(), null);
  assert.equal(clock.count(), 0);
  toast.activate();
  toast.show("Nova sessão.");
  assert.equal(toast.getSnapshot().message, "Nova sessão.");
  toast.dispose();
});

test("avisos preservam textos e distinção de erro para anúncio acessível", () => {
  const clock = fakeClock();
  const toast = createMotoristaToast(clock);
  toast.show("Registro salvo. Planejamento e relatórios atualizados.");
  assert.equal(toast.getSnapshot().error, false);
  toast.show("Não foi possível salvar: registro alterado em outra sessão.");
  assert.equal(toast.getSnapshot().error, true);
  assert.equal(toast.getSnapshot().message, "Não foi possível salvar: registro alterado em outra sessão.");
  toast.dispose();
});

test("wizard troca somente após saída, bloqueia cliques repetidos e usa direção do retorno", () => {
  const clock = fakeClock();
  const wizard = createWizardNavigation(4, clock);
  assert.equal(wizard.move("forward"), true);
  assert.deepEqual(wizard.getSnapshot(), { step: 0, direction: "forward", phase: "leaving" });
  assert.equal(wizard.move("forward"), false);
  assert.equal(wizard.move("back"), false);
  clock.advance(WIZARD_SLIDE_OUT_MS);
  assert.deepEqual(wizard.getSnapshot(), { step: 1, direction: "forward", phase: "entering" });
  assert.equal(wizard.move("forward"), false);
  clock.advance(WIZARD_SLIDE_IN_MS);
  assert.equal(wizard.getSnapshot().phase, "idle");
  assert.equal(wizard.move("back"), true);
  assert.equal(wizard.getSnapshot().direction, "back");
  clock.advance(WIZARD_SLIDE_OUT_MS + WIZARD_SLIDE_IN_MS);
  assert.equal(wizard.getSnapshot().step, 0);
  assert.equal(clock.count(), 0);
});

test("wizard de quatro etapas respeita limites e reduced motion dispensa transição", () => {
  const clock = fakeClock();
  const wizard = createWizardNavigation(4, clock);
  assert.equal(wizard.move("back", true), false);
  for (let step = 1; step <= 3; step++) {
    assert.equal(wizard.move("forward", true), true);
    assert.equal(wizard.getSnapshot().step, step);
    assert.equal(wizard.getSnapshot().phase, "idle");
  }
  assert.equal(wizard.move("forward", true), false);
  assert.equal(wizard.getSnapshot().step, 3);
  assert.equal(clock.count(), 0);
});

test("sair do wizard cancela troca pendente e não navega depois da desmontagem", () => {
  const clock = fakeClock();
  const wizard = createWizardNavigation(4, clock);
  wizard.move("forward");
  const stale = clock.firstCallback();
  wizard.dispose();
  stale();
  clock.advance(10000);
  assert.equal(wizard.getSnapshot().step, 0);
  assert.equal(wizard.move("forward"), false);
  assert.equal(clock.count(), 0);
  wizard.activate();
  assert.equal(wizard.move("forward", true), true);
  assert.equal(wizard.getSnapshot().step, 1);
});

test("limpeza remove somente duas chaves desativadas, sem ler ou escrever Auth e caches reais", () => {
  const data = new Map([
    ["motorista-local-sandbox-v1", "cópia"], ["motorista-isolated-qa-v4", "qa"],
    ["firebase:authUser:original", "auth-preservado"], ["motorista-preferencias", "reais"],
    ["outro-projeto", "intacto"],
  ]);
  const calls = [];
  const storage = {
    removeItem(key) { calls.push(key); data.delete(key); },
    getItem() { throw new Error("Não deve ler conteúdos."); },
    setItem() { throw new Error("Não deve gravar/importar conteúdos."); },
    clear() { throw new Error("Não deve limpar outros dados."); },
  };
  clearRetiredMotoristaStorage(storage);
  assert.deepEqual(calls, ["motorista-local-sandbox-v1", "motorista-isolated-qa-v4"]);
  assert.deepEqual([...data], [["firebase:authUser:original", "auth-preservado"], ["motorista-preferencias", "reais"], ["outro-projeto", "intacto"]]);
  clearRetiredMotoristaStorage(storage);
  assert.equal(data.size, 3);
});

test("limpeza sinaliza bloqueio de armazenamento sem deixar de tentar a segunda chave exata", () => {
  const calls = [];
  assert.throws(() => clearRetiredMotoristaStorage({ removeItem(key) {
    calls.push(key);
    if (key === "motorista-local-sandbox-v1") throw new Error("Armazenamento bloqueado.");
  } }), /bloqueado/);
  assert.deepEqual(calls, ["motorista-local-sandbox-v1", "motorista-isolated-qa-v4"]);
});
