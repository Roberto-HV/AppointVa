import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // "Hoy" en UTC: en México, desde las 18:00 `toISOString()` ya es mañana.
    // Usar hoy() / fechaLocal() de src/utils/fechas.ts (auditoría DC-04).
    files: [
      'src/layouts/**/*.{ts,tsx}',
      'src/components/dashboard/**/*.{ts,tsx}',
      'src/pages/dashboard/{InicioPage,CitasPage,CitaDetallePage,PagosPage,DosFactoresPage,MiPerfilPage,KioskPage}.tsx',
    ],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "CallExpression[callee.property.name=/^(slice|split|substring)$/][callee.object.callee.property.name='toISOString']",
          message: 'Fecha en UTC: usa hoy() / fechaLocal() de src/utils/fechas.ts.',
        },
      ],
    },
  },
])
