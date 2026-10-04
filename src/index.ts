import { readFileSync } from "node:fs";

import { definePlugin } from "@oxlint/plugins";

import { companionHasOwner } from "./rules/companion-has-owner.ts";
import { electronNoRawIpcRendererExposure } from "./rules/electron-no-raw-ipc-renderer-exposure.ts";
import { electronNoRemoteModule } from "./rules/electron-no-remote-module.ts";
import { electronSecureWebPreferences } from "./rules/electron-secure-web-preferences.ts";
import { explicitApiStates } from "./rules/explicit-api-states.ts";
import { importBoundaries } from "./rules/import-boundaries.ts";
import { noAmbientClock } from "./rules/no-ambient-clock.ts";
import { noAmbientRandom } from "./rules/no-ambient-random.ts";
import { noComments } from "./rules/no-comments.ts";
import { noDeepTernary } from "./rules/no-deep-ternary.ts";
import { noEditProofAssertions } from "./rules/no-edit-proof-assertions.ts";
import { noEnvAccess } from "./rules/no-env-access.ts";
import { noFixedTestDelay } from "./rules/no-fixed-test-delay.ts";
import { noForwardingModule } from "./rules/no-forwarding-module.ts";
import { noGenericFileSuffix } from "./rules/no-generic-file-suffix.ts";
import { noPassThroughFunction } from "./rules/no-pass-through-function.ts";
import { noSwallowedErrors } from "./rules/no-swallowed-errors.ts";
import { noTestTimeoutOverrides } from "./rules/no-test-timeout-overrides.ts";
import { noVacuousTestAssertions } from "./rules/no-vacuous-test-assertions.ts";
import { serverActionGuard } from "./rules/server-action-guard.ts";
import { statementSpacing } from "./rules/statement-spacing.ts";
import { typeGuardName } from "./rules/type-guard-name.ts";
import { noManualEffectErrorTag } from "./vendor/anti-slop/effect/rules/no-manual-effect-error-tag.ts";
import { noServiceConstructorImports } from "./vendor/anti-slop/effect/rules/no-service-constructor-imports.ts";
import { noArrayFilterMap } from "./vendor/anti-slop/rules/no-array-filter-map.ts";
import { noChainedTypeAssertions } from "./vendor/anti-slop/rules/no-chained-type-assertions.ts";
import { noConditionalEmptyObjectSpread } from "./vendor/anti-slop/rules/no-conditional-empty-object-spread.ts";
import { noKnownValueWidening } from "./vendor/anti-slop/rules/no-known-value-widening.ts";
import { noModuleMocking } from "./vendor/anti-slop/rules/no-module-mocking.ts";
import { noObjectParameters } from "./vendor/anti-slop/rules/no-object-parameters.ts";
import { noReduceAccumulatorCopy } from "./vendor/anti-slop/rules/no-reduce-accumulator-copy.ts";
import { noReflectApply } from "./vendor/anti-slop/rules/no-reflect-apply.ts";
import { noReflectGet } from "./vendor/anti-slop/rules/no-reflect-get.ts";
import { noRuntimeTypeof } from "./vendor/anti-slop/rules/no-runtime-typeof.ts";
import { noForbiddenTermInSymbolNames } from "./vendor/anti-slop/rules/no-shape-in-symbol-names.ts";
import { noUnknownReturns } from "./vendor/anti-slop/rules/no-unknown-returns.ts";
import { noUnknownTypeAliases } from "./vendor/anti-slop/rules/no-unknown-type-aliases.ts";
import { noUnsafeDictionaryType } from "./vendor/anti-slop/rules/no-unsafe-dictionary-type.ts";
import { noWidenThenAssert } from "./vendor/anti-slop/rules/no-widen-then-assert.ts";

function packageVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );

  if (
    typeof manifest === "object" &&
    manifest !== null &&
    "version" in manifest &&
    typeof manifest.version === "string"
  ) {
    return manifest.version;
  }

  throw new TypeError("The package manifest has no version.");
}

const meta = { name: "wyse", version: packageVersion() };

const wyse = definePlugin({
  meta,
  rules: {
    "companion-has-owner": companionHasOwner,
    "electron-no-raw-ipc-renderer-exposure": electronNoRawIpcRendererExposure,
    "electron-no-remote-module": electronNoRemoteModule,
    "electron-secure-web-preferences": electronSecureWebPreferences,
    "explicit-api-states": explicitApiStates,
    "import-boundaries": importBoundaries,
    "no-ambient-clock": noAmbientClock,
    "no-ambient-random": noAmbientRandom,
    "no-array-filter-map": noArrayFilterMap,
    "no-chained-type-assertions": noChainedTypeAssertions,
    "no-comments": noComments,
    "no-conditional-empty-object-spread": noConditionalEmptyObjectSpread,
    "no-deep-ternary": noDeepTernary,
    "no-edit-proof-assertions": noEditProofAssertions,
    "no-env-access": noEnvAccess,
    "no-fixed-test-delay": noFixedTestDelay,
    "no-forwarding-module": noForwardingModule,
    "no-generic-file-suffix": noGenericFileSuffix,
    "no-known-value-widening": noKnownValueWidening,
    "no-manual-effect-error-tag": noManualEffectErrorTag,
    "no-module-mocking": noModuleMocking,
    "no-object-parameters": noObjectParameters,
    "no-pass-through-function": noPassThroughFunction,
    "no-reduce-accumulator-copy": noReduceAccumulatorCopy,
    "no-reflect-apply": noReflectApply,
    "no-reflect-get": noReflectGet,
    "no-runtime-typeof": noRuntimeTypeof,
    "no-service-constructor-imports": noServiceConstructorImports,
    "no-shape-in-symbol-names": noForbiddenTermInSymbolNames,
    "no-swallowed-errors": noSwallowedErrors,
    "no-test-timeout-overrides": noTestTimeoutOverrides,
    "no-unknown-returns": noUnknownReturns,
    "no-unknown-type-aliases": noUnknownTypeAliases,
    "no-unsafe-dictionary-type": noUnsafeDictionaryType,
    "no-vacuous-test-assertions": noVacuousTestAssertions,
    "no-widen-then-assert": noWidenThenAssert,
    "server-action-guard": serverActionGuard,
    "statement-spacing": statementSpacing,
    "type-guard-name": typeGuardName,
  },
});

export default wyse;
