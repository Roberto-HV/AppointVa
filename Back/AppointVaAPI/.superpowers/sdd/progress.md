# Anticipos + Mi Negocio — Progress Ledger

Plan: c:\Cursos\AppointVa\Front\docs\superpowers\plans\2026-08-05-anticipos-y-mi-negocio.md
Branch: develop (both repos)
Started: 2026-08-05
Base commit: 1bd66823d76cdfb994ebf64dd0e4d834eaebe123

## Tasks

- [x] Task 1: Backend — Negocio anticipo percentage fields
- [x] Task 2: Backend — Cita anticipo fields + PATCH endpoint
- [x] Task 3: Frontend — TypeScript types + API function
- [x] Task 4: Frontend — CitasPage anticipo badge + button
- [x] Task 5: Frontend — PagosPage checkout banner + pre-fill
- [x] Task 6: Frontend — Mi Negocio restructuring + Anticipos tab

## Log
- [x] Task 1: complete (commits 1bd6682..eff6f2a, review clean — Minor: Designer.cs HasDefaultValue drift, non-blocking)
- [x] Task 2: complete (commits eff6f2a..fe25c02, review clean — Minor: migration side-effect removes DB default for HorasCancelacionConReembolso, C# initializer still provides 24 for EF paths)
- [x] Task 3: complete (commits fe25c02..952c934, review clean)
- [x] Task 4: complete (commits 952c934..3112c39, review clean)
- [x] Task 5: complete (commits 3112c39..c8c0c25, review clean after Critical fix: mutPagar now sends montoCobradoDec)
- [x] Task 6: complete (commits c8c0c25..c098eff, review clean after WARNING fix: porcentajeAnticipo defaults to 10 on first enable)
## Minor findings (record only)
- Task 1: Designer.cs lacks HasDefaultValue(24) for HorasCancelacionConReembolso (EF tooling only, no runtime impact)
- Task 2: Migration AddAnticipoFieldsToCita removes DB default for HorasCancelacionConReembolso; C# initializer (= 24) covers all EF paths
- Task 6: Plan activo appears in both Citas tab and Cuenta tab (structural result of move, not harmful)
- Task 6: requiereAnticipo uses native checkbox vs custom pill toggle (plan-mandated pattern)
## Final Review
- Whole-branch review: Important fix applied (|| → ?? in PerfilPage reset), commit 82034b3
- Minor: Zod min(0) vs slider min(10) mismatch — no exploit path, tracked for follow-up
- Branch ready to merge
