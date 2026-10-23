# Manual de Uso e Instructivo Operativo — Stock Terminal GPC 📦✈️

**Sistema de Gestión y Control Logístico de Inventario Aeroportuario**  
*Grupo Puntacana — Versión 2.0 (PWA & Enterprise Ready)*

---

## 1. Introducción y Propósito del Sistema

**Stock Terminal GPC** es una plataforma web progresiva (PWA) de alta velocidad diseñada específicamente para la administración, rastreo y control de equipos, herramientas y activos fijos distribuidos a lo largo de las terminales aeroportuarias (Terminal A, Terminal B, Terminal B2, FBO, Carga y áreas operativas).

### Principales Beneficios Operativos:
* **Cero Papel:** Registro digital instantáneo con historial inmutable de movimientos.
* **Control de Préstamos Inter-Terminales:** Detección automática de qué equipos pertenecen a una terminal pero están prestando servicio en otra.
* **Operación Offline:** Capacidad de operar en zonas de rampa, pistas o hangares sin conexión directa a internet.
* **Carga Masiva:** Importación ágil de inventarios heredados desde hojas de cálculo Excel (`.xlsx`, `.csv`).

---

## 2. Acceso a la Plataforma e Interfaz Principal

### 2.1 Acceso e Inicio de Sesión
1. Abra el enlace oficial en el navegador web (Chrome, Edge o Safari) o ejecute el acceso directo instalado en su teléfono móvil o tablet.
2. Ingrese con sus credenciales autorizadas (Usuario y Contraseña).
3. El sistema cargará el **Panel de Control General (Dashboard)**.

### 2.2 Anatomía del Dashboard
El panel se organiza en 5 zonas clave:
1. **Barra de Navegación Superior:**
   * Logo institucional de Grupo Puntacana.
   * Conmutador de Modo Oscuro / Claro para facilitar la lectura en exteriores o rampa.
   * Botón **"+ Nuevo Equipo"** para altas manuales.
   * Botón de **"Cerrar Sesión"**.
2. **Tarjetas de Indicadores Clave (KPIs):**
   * **Total Equipos:** Total de unidades registradas activas (excluye material decomisado).
   * **Operativos / En Uso:** Equipos prestando servicio en mostradores, puertas de embarque o rampa.
   * **En Almacén:** Equipos resguardados listos para reposición.
   * **Inhabilitados:** Equipos averiados o en mantenimiento técnico.
   * **Prestados (Out):** Equipos propiedad de la terminal seleccionada que se encuentran físicamente en otra terminal.
3. **Módulo Gráfico & Almacenes Oficiales:**
   * **Gráfico de Dona Dinámico:** Muestra la proporción de equipos según terminal o estado.
   * **Directorio de 22 Almacenes Oficiales:** Clasificados por pestañas por cada terminal con conteo de stock en tiempo real. Al hacer clic en cualquier almacén, la tabla filtra automáticamente los equipos ubicados en él.
4. **Barra de Herramientas de la Tabla:**
   * **Filtrar:** Despliega campos de búsqueda rápida por texto (Equipo, Área, Estado, Activo Fijo).
   * **Histórico:** Abre la bitácora global de auditoría con fecha, usuario y acción realizada.
   * **Imprimir:** Genera una vista de impresión limpia y estilizada para reportes físicos.
   * **Importar Excel:** Permite subir archivos masivos en formato `.xlsx` o `.csv`.
   * **Exportar CSV:** Descarga el inventario actual filtrado listo para abrir en Microsoft Excel.
5. **Tabla Maestra de Inventario:**
   * Listado detallado equipo por equipo con fotografía, número de activo, terminal de ubicación, área exacta, cantidad, estado y menú de acciones (Editar, Ver Historial, Compartir Ticket, Eliminar).
   * **Ordenamiento Dinámico:** Puede hacer clic sobre cualquier encabezado de columna (*Equipo, Cantidad, Ubicación, Área, Estado*) para ordenar de forma ascendente o descendente.

---

## 3. Guía de Operaciones Comunes

### 3.1 Cómo Registrar un Equipo Individualmente
1. Haga clic en el botón superior **"+ Nuevo Equipo"**.
2. Complete los campos del formulario:
   * **Ubicación Física:** Seleccione la terminal donde está físicamente (ej. `Terminal A`).
   * **Área Operativa:** Seleccione el área específica (ej. `Check-in`, `Gate 5` o `Rampa`).
   * **Almacén Base al que Pertenece:** Seleccione el almacén de custodia de referencia.
   * **Nombre del Equipo:** Ej. `Separador de Terminales` o `Radio Motorola DP4801e`.
   * **Cant.:** Número de unidades idénticas (ej. `100`).
   * **Estado Inicial:** Seleccione entre `En uso`, `En Almacén`, `Inhabilitado`, `Decomisado` o `En reparación`.
   * **¿Activo Fijo?:** Marque la casilla si posee placa de activo fijo y digite el código (ej. `GPC-09843`).
   * **Fotografía (Opcional):** Puede capturar una foto con la cámara del dispositivo móvil o adjuntar una imagen.
3. Haga clic en **"GUARDAR REGISTRO"**.

---

### 3.2 Carga Masiva de Inventario desde Excel (.XLSX / .CSV)
Para evitar la carga manual uno a uno, el sistema permite importar inventarios completos.

> **Importante para la Carga:**  
> Para que el sistema reconozca y distribuya la información en las columnas correctas sin errores, el archivo de Excel actual de la empresa debe **adaptarse a la estructura de columnas de la plantilla oficial**:

| Columna en Excel | Tipo de Dato | Descripción / Opciones Válidas | Ejemplo |
| :--- | :--- | :--- | :--- |
| **Nombre** | Obligatorio | Modelo o descripción clara del equipo | `Laptop Dell Latitude 5420` |
| **Terminal** | Obligatorio | `Terminal A`, `Terminal B` o `Terminal B2` | `Terminal A` |
| **Area** | Obligatorio | Área operativa o ubicación física actual | `Correas check-in 1-4` o `Gate 12` |
| **Almacen Base** | Recomendado / Opcional | Almacén oficial que custodia o al que pertenece el equipo | `Almacén Principal A` |
| **Estado** | Obligatorio | `En uso`, `En Almacén`, `Inhabilitado`, `Decomisado` | `En Almacén` |
| **Cantidad** | Obligatorio | Número entero mayor a 0 | `10` |
| **Activo Fijo** | Opcional | Código único de activo fijo institucional (dejar vacío si no aplica) | `GPC-847291` |
| **Propietario** | Opcional | Terminal dueña del equipo (para préstamos inter-terminales) | `Terminal A` |

> **Nota sobre Fotografías:** Los archivos de Excel no soportan la vinculación directa de imágenes en la base de datos local. Las fotografías de los equipos se adjuntan cómodamente haciendo clic en **Editar** en el registro correspondiente dentro del sistema una vez importado.

#### Pasos para Importar:
1. Guarde su archivo adaptado en formato `.xlsx` o `.csv`.
2. En la plataforma, presione el botón azul **"Importar Excel"**.
3. Seleccione el archivo. El sistema procesará los registros al instante.
4. **Prevención de Duplicados:** Si un número de Activo Fijo ya existe en la aplicación, el sistema lo omitirá para proteger la base de datos y le informará cuántos registros fueron cargados y cuántos omitidos.

---

### 3.3 Búsqueda, Filtrado y Consulta de Stock por Almacén
El sistema permite localizar cualquier artículo de dos formas complementarias:

#### Opción A: Búsqueda Específica por Artículo
1. Presione el botón **"Filtrar"**.
2. En la casilla **"Buscar por Equipo..."**, escriba el nombre o modelo (ej. `Radio`, `Monitor` o `Separador`).
3. La tabla desplegará **todas las ubicaciones y almacenes** donde existe ese equipo:
   * En la columna **"Cant."** verá cuántas unidades hay en cada almacén específico.
   * En el encabezado verá la suma total global de unidades de ese artículo.

#### Opción B: Filtrado por Almacén Físico
1. En el módulo superior **"Almacenes"**, seleccione la pestaña de la Terminal deseada.
2. Haga clic sobre la tarjeta del almacén que desea auditar (ej. *Almacén Sótano*).
3. La tabla inferior se filtrará automáticamente mostrando **únicamente** los equipos resguardados en ese almacén.

---

### 3.4 Traslados, Préstamos y División de Stock (Stock Splitting)
Cuando se necesita transferir solo una parte de un lote de equipos hacia otro almacén o terminal:

1. Localice el equipo en la tabla y presione el botón **"Editar"** (icono de lápiz).
2. Ajuste la **Cantidad** (ej. extraiga 3 de 10) y cambie la **Terminal** o el **Área de destino**.
3. El sistema dividirá el registro automáticamente:
   * Mantendrá las unidades restantes en el origen con su respectiva trazabilidad.
   * Creará una nueva partida en el destino, registrando el movimiento en el historial.

---

### 3.5 Reportes y Auditoría
* **Exportar a Excel / CSV:** Presione **"Exportar CSV"** para descargar el inventario filtrado en un archivo seguro compatible con Microsoft Excel en español.
* **Impresión / PDF:** Presione **"Imprimir"** para generar una vista formal sin botones, apta para archivo físico o firma de actas de entrega.
* **Historial Global:** Presione **"Histórico"** para consultar la bitácora inmutable de eventos con fecha, usuario y detalle de cada cambio.
