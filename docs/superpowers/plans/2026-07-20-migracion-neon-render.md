# Migración Neon → Render PostgreSQL

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar la base de datos de AppointVa desde Neon (Free Plan, quota agotada, cold starts) a Render PostgreSQL (siempre activo, $7/mes), preservando todos los datos existentes (3 negocios, usuarios, citas, servicios).

**Architecture:** Exportar el esquema completo + datos desde Neon vía `pg_dump`, restaurar en una nueva instancia de Render PostgreSQL con `pg_restore`, y actualizar la única variable de entorno `ConnectionStrings__ConexionSql` en Render. No se cambia ningún código — solo configuración. EF Core detectará el historial de migraciones existente y no re-ejecutará ninguna.

**Tech Stack:** PostgreSQL 16 client tools (pg_dump / pg_restore / psql), Render PostgreSQL, .NET 8 EF Core + Npgsql.

## Global Constraints

- La variable de entorno en Render se llama exactamente `ConnectionStrings__ConexionSql` (doble guión bajo).
- Usar siempre la **Internal Connection String** de Render para la variable de entorno del backend (misma red → más rápido, sin latencia extra).
- Neon requiere `SSL Mode=Require` en la connection string; Render también recomienda SSL.
- La clave de configuración local (appsettings.json) sigue apuntando a localhost — no cambiarla.
- Hangfire usa la misma `connectionString` de EF Core — no necesita cambio separado.

---

## Archivos que se modifican

| Archivo | Cambio |
|---------|--------|
| Render env vars (dashboard web) | `ConnectionStrings__ConexionSql` → nueva cadena de Render PostgreSQL |
| `Back/AppointVaAPI/AppointVaAPI/appsettings.json` | Sin cambios (apunta a localhost, correcto para desarrollo local) |
| `Back/AppointVaAPI/AppointVaAPI/Program.cs` | Sin cambios |

---

## Task 1: Desbloquear Neon temporalmente (upgrade a Launch)

> Neon suspendió el compute porque se agotaron las 100 CU-hrs del plan Free. `pg_dump` necesita conectarse a PostgreSQL, por lo que hay que desbloquearlo primero.

**Tiempo estimado:** 5 minutos

- [ ] **Paso 1: Abrir Neon Billing**

  Ve a [https://console.neon.tech](https://console.neon.tech) → selecciona el proyecto **appointva** → haz clic en **"Upgrade plan"** (banner rosa en la parte superior).

- [ ] **Paso 2: Seleccionar Launch**

  Elige **Launch** ($0.106/CU-hour, pay per usage, sin tarifa fija mensual). Ingresa método de pago si no está configurado.

- [ ] **Paso 3: Confirmar que el compute vuelve a Idle/Active**

  En el dashboard de Neon → **Monitoring** → el indicador junto al branch `production` debe mostrar **Idle** o **Active** (no "Suspended"). Puede tardar 1-2 minutos.

- [ ] **Paso 4: Obtener la connection string de Neon**

  En Neon → **Dashboard** → botón **"Connect"** (arriba a la derecha) → selecciona:
  - Branch: `production`
  - Database: `neondb` (o el nombre que muestre)
  - Role: `neondb_owner`
  - Format: **Connection string**

  Copia la URL completa. Tendrá este formato:
  ```
  postgresql://neondb_owner:PASSWORD@ep-XXXX.us-east-2.aws.neon.tech/neondb?sslmode=require
  ```
  Guárdala en un bloc de notas — la usarás en el Task 3.

---

## Task 2: Crear Render PostgreSQL

**Tiempo estimado:** 5 minutos

- [ ] **Paso 1: Abrir Render Dashboard**

  Ve a [https://dashboard.render.com](https://dashboard.render.com) → clic en **"New +"** → selecciona **"PostgreSQL"**.

- [ ] **Paso 2: Configurar la instancia**

  Completa el formulario:
  - **Name:** `appointva-db`
  - **Region:** Oregon (US West) — la misma región donde tienes el backend en Render para mínima latencia
  - **PostgreSQL Version:** 16
  - **Plan:** Starter ($7/mes)

  Clic en **"Create Database"**.

- [ ] **Paso 3: Esperar que la DB esté Ready**

  Render tarda 1-3 minutos en aprovisionar. La página mostrará el estado. Espera hasta ver **"Available"**.

- [ ] **Paso 4: Anotar las dos connection strings**

  Una vez lista, en la página de la DB verás:
  - **Internal Database URL** (úsala para el backend — misma red): 
    ```
    postgresql://appointva_db_user:PASS@dpg-XXXX-a.oregon-postgres.render.com/appointva_db
    ```
  - **External Database URL** (úsala para pg_restore desde tu PC):
    ```
    postgresql://appointva_db_user:PASS@dpg-XXXX.oregon-postgres.render.com/appointva_db
    ```

  Guarda ambas en el bloc de notas.

---

## Task 3: Exportar datos desde Neon (pg_dump)

> Necesitas tener instalado PostgreSQL 16 en tu PC para tener `pg_dump`. Verifica con: `pg_dump --version` en PowerShell. Si no lo tienes, descárgalo de https://www.postgresql.org/download/windows/ e instala solo las "Command Line Tools".

**Tiempo estimado:** 5-10 minutos

- [ ] **Paso 1: Verificar que pg_dump está disponible**

  Abre PowerShell y ejecuta:
  ```powershell
  pg_dump --version
  ```
  Resultado esperado:
  ```
  pg_dump (PostgreSQL) 16.x
  ```

  Si obtienes "command not found", agrega el directorio bin de PostgreSQL al PATH:
  ```powershell
  $env:PATH += ";C:\Program Files\PostgreSQL\16\bin"
  ```

- [ ] **Paso 2: Crear el dump de Neon**

  Ejecuta este comando en PowerShell (reemplaza `<NEON_CONNECTION_URL>` con la URL copiada en Task 1 Paso 4):
  ```powershell
  pg_dump "<NEON_CONNECTION_URL>" `
    --format=custom `
    --no-owner `
    --no-acl `
    --file="$env:USERPROFILE\Desktop\appointva-backup.dump"
  ```

  Ejemplo real:
  ```powershell
  pg_dump "postgresql://neondb_owner:mipassword@ep-cool-wind-123.us-east-2.aws.neon.tech/neondb?sslmode=require" `
    --format=custom `
    --no-owner `
    --no-acl `
    --file="$env:USERPROFILE\Desktop\appointva-backup.dump"
  ```

  Resultado esperado: el comando termina sin errores. Verás el archivo `appointva-backup.dump` en el escritorio (probablemente 1-10 MB).

  Si aparece el error `SSL connection required`:
  ```powershell
  $env:PGSSLMODE = "require"
  # Luego re-ejecuta el pg_dump
  ```

- [ ] **Paso 3: Verificar el dump**

  ```powershell
  # Listar el contenido del dump para confirmar que tiene datos
  pg_restore --list "$env:USERPROFILE\Desktop\appointva-backup.dump" | Select-Object -First 30
  ```

  Resultado esperado: verás una lista de tablas, índices y secuencias. Debes ver nombres como `AspNetUsers`, `Negocios`, `Servicios`, `Citas`, `HangFire.Job`, etc.

---

## Task 4: Restaurar datos en Render PostgreSQL

**Tiempo estimado:** 5-10 minutos

- [ ] **Paso 1: Ejecutar pg_restore hacia Render**

  Reemplaza `<RENDER_EXTERNAL_URL>` con la **External Database URL** de Task 2 Paso 4:
  ```powershell
  pg_restore `
    --verbose `
    --clean `
    --if-exists `
    --no-owner `
    --no-acl `
    --dbname="<RENDER_EXTERNAL_URL>" `
    "$env:USERPROFILE\Desktop\appointva-backup.dump"
  ```

  Ejemplo real:
  ```powershell
  pg_restore `
    --verbose `
    --clean `
    --if-exists `
    --no-owner `
    --no-acl `
    --dbname="postgresql://appointva_db_user:mipass@dpg-abc123.oregon-postgres.render.com/appointva_db" `
    "$env:USERPROFILE\Desktop\appointva-backup.dump"
  ```

  Resultado esperado: muchas líneas con `pg_restore: creating TABLE ...`, `pg_restore: creating INDEX ...`, etc. Algunos errores como `ERROR: role "neondb_owner" does not exist` son normales con `--no-owner` — ignóralos. El proceso debe terminar sin errores críticos.

- [ ] **Paso 2: Verificar las tablas en Render**

  Conéctate a Render PostgreSQL y lista las tablas:
  ```powershell
  psql "<RENDER_EXTERNAL_URL>" -c "\dt public.*" 
  ```

  Resultado esperado: verás la lista de tablas de AppointVa:
  ```
  public | AspNetRoleClaims       | table | ...
  public | AspNetRoles            | table | ...
  public | AspNetUserClaims       | table | ...
  public | AspNetUserLogins       | table | ...
  public | AspNetUserRoles        | table | ...
  public | AspNetUsers            | table | ...
  public | Citas                  | table | ...
  public | Empleados              | table | ...
  public | Negocios               | table | ...
  public | Servicios              | table | ...
  ...
  ```

- [ ] **Paso 3: Contar registros clave para confirmar**

  ```powershell
  psql "<RENDER_EXTERNAL_URL>" -c "SELECT COUNT(*) as negocios FROM \"Negocios\";"
  psql "<RENDER_EXTERNAL_URL>" -c "SELECT COUNT(*) as usuarios FROM \"AspNetUsers\";"
  psql "<RENDER_EXTERNAL_URL>" -c "SELECT COUNT(*) as citas FROM \"Citas\";"
  ```

  Resultado esperado: los conteos deben coincidir con lo que sabes que hay en Neon (3 negocios, los usuarios que creaste, las citas de prueba).

---

## Task 5: Actualizar connection string en Render

**Tiempo estimado:** 5 minutos

- [ ] **Paso 1: Construir la connection string en formato Npgsql**

  Toma la **Internal Database URL** de Render (Task 2 Paso 4) y conviértela al formato de Npgsql:

  Si la Internal URL es:
  ```
  postgresql://appointva_db_user:MIPASS@dpg-XXXX-a.oregon-postgres.render.com/appointva_db
  ```

  La connection string en formato Npgsql queda:
  ```
  Host=dpg-XXXX-a.oregon-postgres.render.com;Database=appointva_db;Username=appointva_db_user;Password=MIPASS;SSL Mode=Require;Trust Server Certificate=true
  ```

  > Usa la URL **internal** (tiene `-a` antes del `.oregon`) para mejor rendimiento — mismo datacenter que tu backend en Render.

- [ ] **Paso 2: Ir a Environment Variables del servicio backend en Render**

  En Render dashboard → selecciona tu servicio **AppointVa API** (el Web Service, no la DB) → menú lateral → **Environment**.

- [ ] **Paso 3: Actualizar la variable ConexionSql**

  Busca la variable `ConnectionStrings__ConexionSql` (doble guión bajo).

  Si no existe con ese nombre exacto, busca variantes como `ConexionSql` o `NEON_*`.

  Actualiza su valor con la connection string del Paso 1:
  ```
  Host=dpg-XXXX-a.oregon-postgres.render.com;Database=appointva_db;Username=appointva_db_user;Password=MIPASS;SSL Mode=Require;Trust Server Certificate=true
  ```

  Clic en **"Save Changes"**.

- [ ] **Paso 4: Forzar redeploy del backend**

  Render redesplegará automáticamente al guardar las variables. Si no lo hace:
  Render dashboard → AppointVa API → **Manual Deploy** → **"Deploy latest commit"**.

  Espera que el deploy termine (verás "Live" en verde).

---

## Task 6: Verificar que el sistema funciona con Render PostgreSQL

**Tiempo estimado:** 5-10 minutos

- [ ] **Paso 1: Verificar que el backend arranca sin errores**

  En Render dashboard → AppointVa API → **Logs**.

  Resultado esperado: verás logs de Hangfire y las migraciones. La línea clave es que NO aparezca ningún error de conexión a base de datos. Debes ver algo como:
  ```
  [HH:mm:ss WRN] Applying pending model changes...
  info: Microsoft.Hosting.Lifetime[14] Now listening on: http://...
  ```

  Si ves `NpgsqlException` o `connection refused`, el connection string tiene un error — revisa el Task 5.

- [ ] **Paso 2: Probar el endpoint /ping**

  ```powershell
  Invoke-RestMethod -Uri "https://appointva.onrender.com/ping"
  ```
  Resultado esperado:
  ```json
  {"status":"ok"}
  ```

- [ ] **Paso 3: Probar login en el dashboard**

  Abre [https://www.appointva.com](https://www.appointva.com) → inicia sesión como dueño del negocio real.

  Resultado esperado: accede correctamente al dashboard, ves los servicios y datos cargados.

- [ ] **Paso 4: Verificar el negocio real en booking**

  Abre la URL pública del negocio real (ej: `https://www.appointva.com/b/slug-del-negocio`).

  Resultado esperado: el booking page carga correctamente con el logo, servicios y empleados.

- [ ] **Paso 5: Verificar en Render PostgreSQL que hay actividad**

  En Render dashboard → `appointva-db` → **Metrics**.

  Resultado esperado: ves queries activas / conexiones entrantes desde el backend.

---

## Task 7: Eliminar Neon y limpiar

> Solo ejecuta este task DESPUÉS de confirmar que todo funciona correctamente en Render (Task 6 completo).

**Tiempo estimado:** 5 minutos

- [ ] **Paso 1: Actualizar el cron job en cron-job.org**

  En [https://cron-job.org](https://cron-job.org) → edita el job "AppointVa Keep Alive":
  - URL: cambia de `.../health` a `.../ping`
  - Guarda.

  Esto previene que el cron despierte la DB de Render innecesariamente (aunque Render no tiene problema de cuota, es buena práctica).

- [ ] **Paso 2: Eliminar o suspender el proyecto de Neon**

  En Neon console → selecciona proyecto **appointva** → **Settings** → **Delete project**.

  Confirma la eliminación. Esto cancela el plan Launch y detiene cualquier cobro futuro de Neon.

  > Alternativa menos drástica: bajar el plan de vuelta a Free en lugar de eliminar, si quieres conservar el historial. Pero dado que ya tienes los datos en Render, no tiene sentido pagar por dos bases de datos.

- [ ] **Paso 3: Eliminar el archivo de backup del escritorio**

  ```powershell
  Remove-Item "$env:USERPROFILE\Desktop\appointva-backup.dump"
  ```

- [ ] **Paso 4: Commit de confirmación**

  No hubo cambios en el código, pero es útil documentar la migración:
  ```powershell
  git -C "c:\Cursos\AppointVa" add docs/
  git -C "c:\Cursos\AppointVa" commit -m "docs: plan de migracion neon a render postgresql completado"
  ```

---

## Resultado final

- Base de datos en **Render PostgreSQL** (Oregon, Starter $7/mes)
- Sin cold starts, sin quotas de horas compute
- Un solo proveedor para backend + base de datos (Render)
- Cron job apuntando a `/ping` (sin activar DB)
- Neon eliminado y sin costos adicionales

## Troubleshooting rápido

| Error | Causa | Solución |
|-------|-------|----------|
| `pg_dump: error: connection to server failed: FATAL: remaining connection slots are reserved` | Neon aún en cuota agotada | Esperar 2-3 min después del upgrade a Launch |
| `pg_restore: error: could not execute query: ERROR: role "neondb_owner" does not exist` | Normal con `--no-owner` | Ignorar — no afecta la restauración |
| `NpgsqlException: Host not found` | Error en el hostname de la connection string | Verificar que la Internal URL de Render es correcta |
| `Trust Server Certificate=true` no funciona | Versión antigua de Npgsql | Usar `SSL Mode=Require;SSL Certificate=` vacío o actualizar Npgsql |
| El backend arranca pero no hay datos | pg_restore falló silenciosamente | Re-ejecutar Task 4 y revisar los COUNTs |
