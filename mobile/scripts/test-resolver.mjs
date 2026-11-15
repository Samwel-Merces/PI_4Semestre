/*
 * Permite rodar os testes com o executor nativo do Node (node --test),
 * sem dependências extras. O Node 22.18+/24 executa arquivos .ts removendo
 * os tipos, mas exige extensão nos imports relativos; o código do app
 * importa sem extensão (padrão do Metro). Este hook resolve "./arquivo"
 * para "./arquivo.ts" quando o arquivo existir.
 *
 * Somente módulos puros (sem react-native) podem ser testados assim.
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const RELATIVE = /^\.{1,2}\//;
const HAS_EXTENSION = /\.[cm]?[jt]sx?$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      RELATIVE.test(specifier) &&
      !HAS_EXTENSION.test(specifier) &&
      context.parentURL
    ) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);

      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }

    return nextResolve(specifier, context);
  },
});
