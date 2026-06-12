# Conexión a Base de Datos SQL Server con DBeaver

## 1️⃣ Requisitos

- ✅ DBeaver instalado en tu máquina ([descargar aquí](https://dbeaver.io/download/))
- ✅ Docker corriendo con `docker-compose up -d`
- ✅ SQL Server 2022 levantado en el contenedor

## 2️⃣ Pasos para Conectar en DBeaver

### Paso 1: Abre DBeaver
1. Ejecuta DBeaver
2. Ve a **Database** > **New Database Connection**
3. Elige **Microsoft SQL Server**
4. Haz clic en **Next**

### Paso 2: Configura la Conexión
Rellena los siguientes datos:

| Campo | Valor |
|-------|-------|
| **Server Host** | `localhost` |
| **Port** | `1433` |
| **Database** | `AppointVaDb` |
| **Username** | `sa` |
| **Password** | `MyStrongPass123` |
| **Connection Type** | **Use Default** |

### Paso 3: Prueba la Conexión
1. Haz clic en **Test Connection**
2. Si ves ✅ **Connected**, excelente
3. Si no, verifica que Docker esté corriendo: `docker ps`

### Paso 4: Guarda la Conexión
1. Dale un nombre: `AppointVaDb` (o el que prefieras)
2. Haz clic en **Finish**

## 3️⃣ Usar DBeaver

Una vez conectado:

- ✅ **Ver tablas**: Expande `AppointVaDb` > `Schemas` > `dbo`
- ✅ **Ver datos**: Click derecho en una tabla > **Select Rows**
- ✅ **Ejecutar SQL**: Click derecho en la conexión > **SQL Editor** > New Script
- ✅ **Ver procedimientos**: `Schemas` > `dbo` > `Procedures`

## 4️⃣ Ver los Datos de Prueba

Una vez que ejecutes tu aplicación:
1. Los datos de prueba se cargarán automáticamente
2. Ve a `Tables` > `Planes`, `Negocios`, `Empleados`, etc.
3. Haz clic en **Select Rows** para ver los datos

## 5️⃣ Solucionar Problemas

### Error: "Connection refused"
```powershell
# Verifica que Docker esté corriendo
docker ps

# Si no aparece sqlserver2022, levantalo
docker-compose up -d
```

### Error: "Login failed"
- Verifica usuario: `sa`
- Verifica contraseña: `MyStrongPass123`
- Verifica puerto: `1433`

### Cambiar Contraseña en Docker
Si quieres cambiar la contraseña del SA:

1. Detén el contenedor: `docker-compose down`
2. Edita `docker-compose.yaml` y cambia `MSSQL_SA_PASSWORD`
3. Levanta nuevamente: `docker-compose up -d`

## 6️⃣ Conexión desde la Aplicación

Tu `appsettings.json` debe tener:

```json
{
  "ConnectionStrings": {
    "ConexionSql": "Server=localhost,1433;Database=AppointVaDb;User Id=sa;Password=MyStrongPass123;Encrypt=false;TrustServerCertificate=true;"
  }
}
```

---

**Nota:** Si quieres usar un cliente gráfico adicional, también puedes usar:
- 🔵 **Azure Data Studio** (recomendado)
- 🔵 **SQL Server Management Studio (SSMS)**
