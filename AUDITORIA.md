# Auditoría técnica: Stock Terminal GPC

> **Actualización 2026-11-04:** los fallos A2–A10 están corregidos en la rama `fix/integridad-datos` (sin commit). Ver la sección [Estado de las correcciones](#estado-de-las-correcciones-a2a10) al final.

**Fecha:** 2026-11-04 · **Commit auditado:** `96db5d7` (rama `main`). Hay cambios locales sin commit en la documentación y en la plantilla de importación (ver B7). · **Alcance:** `src/`, configuración, dependencias y `dist/`. Queda fuera `src/archive/`.

## Encargo (plantilla rellenada)

- **Tarea:** auditar la app Stock Terminal (React + Vite, PWA). **Objetivo:** decidir si está lista para operar de verdad en las terminales y qué arreglar antes, en qué orden. **Audiencia:** el autor de la app y el equipo de TI que la reciba.
- **Debe generar:** veredicto, hallazgos con severidad, evidencia, ubicación y corrección, lo que está bien y un plan de acción.
- **Listón:** lo que aprobaría un ingeniero senior de QA y seguridad. El árbitro comprueba, uno por uno:
  1. Cada hallazgo cita `archivo:línea` y su tipo de evidencia: **[Reproducido]** (probado en el navegador), **[Herramienta]** (salida de lint, `npm audit` o build) o **[Código]** (deducido leyendo el código, sin ejecutarlo).
  2. Cada severidad se justifica con un escenario concreto de fallo.
  3. Cada hallazgo propone una corrección que se puede aplicar.
  4. No hay nada inventado: lo que no se comprobó se dice.

Escala de severidad: **Crítico** (impide el uso real o pierde datos de forma general), **Alto** (corrompe datos o anula un control), **Medio** (riesgo o defecto de impacto limitado), **Bajo** (calidad o pulido).

---

## Veredicto

**Como demo o MVP funciona, y la idea del núcleo está bien planteada:** fraccionamiento de lotes, consolidación, historial por equipo y export CSV protegido. Aun así, la implementación tiene los fallos que se detallan abajo. **No está lista para operar en varias terminales.** Hay dos razones de fondo:

1. Los datos viven solo en el navegador de cada dispositivo: no se comparten y no tienen respaldo.
2. El login es decorativo.

Además encontré **9 errores de lógica que corrompen o pierden datos sin avisar** (A2–A10). Reproduje cinco en el navegador (A2–A6). Los otros cuatro (A7–A10) salen de leer el código.

| Severidad | Cantidad |
|---|---|
| Crítico | 1 |
| Alto | 10 |
| Medio | 5 |
| Bajo | 12 |

---

## Hallazgos

### C1 · Crítico · Los datos solo existen en el navegador de cada equipo. [Código]
- **Dónde:** `src/hooks/useInventory.js:4-7` y `:78-85`: todo se guarda en IndexedDB a través de `localforage`. El propio `README.md` lo confirma ("Persistencia de Datos (Offline)").
- **Escenario:** el supervisor de la Terminal A registra 50 equipos en su tablet. El de la Terminal B abre la app en su PC y ve el inventario vacío. Si alguien borra los datos del navegador, cambia de equipo o el navegador desaloja el almacenamiento, se pierde el inventario entero. "Exportar CSV" no sirve de respaldo, porque no incluye fotos, historial ni bitácora (`src/pages/Dashboard.jsx:855`).
- **Corrección:** conectar un backend compartido antes de operar. Supabase ya está en `package.json`, aunque sin usar. Propuesta: tablas `items`, `item_history` y `activity_log`; fotos en Storage, no en base64; y `useInventory` leyendo y escribiendo ahí, con IndexedDB solo como caché offline. Mientras tanto, como parche mínimo: botones "Respaldo completo" (JSON con fotos e historial) y "Restaurar".

### A1 · Alto · El login no protege nada y la bitácora no identifica a nadie. [Reproducido] [Herramienta]
- **Dónde:**
  - Credenciales fijas en `src/pages/Login.jsx:29` (`gerente` / `admin123`), visibles en el bundle publicado: `grep admin123 dist/assets/index-BIE50Qvq.js` las encuentra.
  - La "sesión" es solo `localStorage.gpc_auth === 'true'` (`src/App.jsx:9-11`).
  - El usuario por defecto es `'gerente'` (`src/pages/Dashboard.jsx:81`).
- **Prueba:** en `/login` ejecuté `localStorage.setItem('gpc_auth','true')` y navegué a `/dashboard`. Entré al panel completo con `gpc_user = null`.
- **Escenario:** si la app está publicada (hay `netlify.toml`; **no comprobé** si hay un despliegue activo), cualquiera lee la contraseña en el código o se salta el login. La "Auditoría Global" no sirve como control: hay un único usuario y los registros se pueden editar desde la consola. **Por qué Alto y no Crítico:** hoy el daño se limita a los datos del propio navegador (C1). Pasa a Crítico en cuanto exista un backend compartido.
- **Corrección:** autenticación real del lado del servidor (Supabase Auth o Azure AD, como sugiere el README), con un usuario por persona. Quitar las credenciales del código. La bitácora debe escribirse en el servidor con el `user_id` autenticado, sin permiso de edición desde el cliente.

### A2 · Alto · Al importar equipos "En Almacén", se pierde el almacén. [Reproducido]
- **Dónde:** `src/pages/Dashboard.jsx:345` llama a `getAvailableAreas(terminal)` sin el estado, así que solo acepta áreas operativas. El almacén se sustituye por la primera área de la lista (`:347`). Además, si el archivo no trae la columna "Almacén Base", `baseWarehouse` (`:365`) hereda esa área sustituida y queda como "Check-in Terminal A", que no es un almacén.
- **Prueba:** importé un CSV (con BOM) con la fila `Archivador, Terminal A, Almacén Sótano, En Almacén, 5`. Resultado: `Archivador | 5 | Terminal A | Check-in Terminal A | En Almacén`, y la tarjeta "Almacén Sótano" marca **0 unidades**.
- **Escenario:** una carga masiva de stock de almacén deja todos los equipos "En Almacén" pero ubicados en un check-in, y los contadores de almacén se quedan en cero.
- **Corrección:** `getAvailableAreas(terminal, status)` en la línea 345, calculando `status` antes que `area` (hoy se calcula en `:350`, después).

### A3 · Alto · La importación corrige valores en silencio y estropea las tildes. [Reproducido]
- **Dónde:** si la terminal (`:343`), el área (`:347`) o el estado (`:350`) no coinciden exactamente, se sustituyen por un valor por defecto sin avisar. Además, `XLSX.read(..., {type:'array'})` (`:295`) lee un CSV UTF-8 sin BOM como Latin-1.
- **Prueba:** con un CSV UTF-8 sin BOM:
  - `terminal b` quedó como **Terminal A**.
  - `En Almacén` / `Almacén Sótano` quedaron como **En uso** / **Check-in Terminal A**.
  - El aviso dijo "✅ Se agregaron 3 equipos" sin mencionar ninguna corrección.
- **Escenario:** un CSV exportado de Google Sheets o de otro sistema (normalmente sin BOM) carga el inventario con estados y ubicaciones equivocados, y el usuario lo da por bueno.
- **Corrección:**
  - Normalizar antes de comparar: minúsculas, sin tildes y con alias (`TA`, `T. A`).
  - En los CSV, leer el texto como UTF-8 (`file.text()`) y pasarlo con `type:'string'`.
  - Mostrar una vista previa con las filas corregidas o rechazadas antes de confirmar, o al menos listarlas en el aviso final.
  - Validar también "Almacén Base" contra `WAREHOUSES_DATA`. Hoy `:364-365` acepta cualquier texto. Según el árbitro de la ronda 3, la plantilla oficial actual trae valores que no están en los catálogos, como "Almacén Cuarto Técnico" o "Rampa Norte"; no lo comprobé por mi cuenta.

### A4 · Alto · Activos Fijos duplicados: por importación y por fraccionamiento. Después no se pueden editar. [Reproducido] (importación) / [Código] (fraccionamiento)
- **Dónde:**
  - **Importación:** `src/pages/Dashboard.jsx:368-374` solo compara contra el inventario existente, no contra las filas del mismo archivo.
  - **Fraccionamiento:** en `handleSaveEdit`, tanto el remanente (`:667`, `{...original}`) como el hijo (`:680-688`) conservan el mismo `assetNumber`, y la validación (`:598-603`) excluye el propio `id`.
  - En ambos casos, al editar, `:598-603` bloquea el guardado.
  - Incoherencia añadida: la importación compara sin distinguir mayúsculas (`:369`), mientras que el alta y la edición sí distinguen (`:483`, `:599`).
  - El alta guarda el número sin `trim()` (`:504`), pero lo compara recortado (`:483`). Por eso, un número guardado con un espacio al final (`AF-1 `) no se detecta como duplicado cuando se vuelve a introducir `AF-1`.
  - Un activo fijo clonado queda con número vacío (`:887`) y se puede guardar así, porque la validación (`:598`) solo actúa si hay número.
- **Prueba:** importé `Laptop … AF-1` y `Monitor … AF-1` en el mismo CSV y entraron los dos. Al editar "Monitor" y pulsar OK saltó "Ya existe otro equipo registrado con el mismo número de Activo Fijo (Laptop)", y no se puede guardar sin cambiar el número.
- **Escenario:** un activo fijo registrado con cantidad 2 se fracciona y 1 unidad se lleva a otra área. Quedan dos registros con el mismo número de activo, ninguno se puede volver a editar, y el control de activos fijos pierde su garantía de unicidad.
- **Corrección:**
  - Llevar un `Set` de números ya vistos durante el bucle de importación.
  - Usar una sola función `normalizeAsset(s) = s.trim().toUpperCase()` en las tres validaciones y también al guardar.
  - Exigir número cuando `isFixedAsset` sea verdadero.
  - Para un activo fijo, impedir el fraccionamiento: un número de activo identifica una unidad, así que cantidad debería ser siempre 1.

### A5 · Alto · Clonar un segundo equipo con el primer clon abierto hace desaparecer el nuevo. [Reproducido]
- **Dónde:** `src/pages/Dashboard.jsx:893-894`. `handleCloneItem` hace `setInventory([...inventory, cloned])` y luego llama a `handleEditClick(cloned)`. Esa función (`:566-571`) borra el borrador anterior con `setInventory(inventory.filter(...))` usando el `inventory` viejo, y así pisa la inserción del clon nuevo.
- **Prueba:**
  - Estado inicial: 4 filas.
  - "Duplicar" en la fila 1: 5 filas, 1 en edición.
  - "Duplicar" en otra fila: **4 filas y 0 en edición**. El segundo clon se perdió y `editingId` apunta a una fila que no existe.
- **Escenario:** alguien registra varios lotes parecidos clonando uno tras otro, y cada segundo clon desaparece sin aviso.
- **Corrección:**
  - **Inmediata:** en `handleCloneItem`, calcular la lista final una sola vez (quitar el borrador anterior y añadir el clon), llamar a `setInventory` una sola vez y **no llamar a `handleEditClick`**: esa función vuelve a filtrar sobre el `inventory` viejo. En su lugar, llamar directamente a `setEditingId(cloned.id)`, `setEditFormData({...cloned, baseWarehouse: resuelto})` y `setEditNewImage(null)`. `resuelto` es el `baseWarehouse` que hoy calcula `handleEditClick` (`:572-577`); conviene sacar ese cálculo a una función común.
  - **De fondo:** la misma causa (escribir arrays calculados a partir de un estado viejo) aparece en todo `Dashboard.jsx`. **Ojo:** pasar funciones `setInventory(prev => …)` **no sirve tal cual**, porque `saveInventory` (`useInventory.js:78-85`) guardaría la función en IndexedDB y fallaría en silencio. Hay que reescribir `saveInventory`: guardar el inventario vigente en un `useRef`, calcular `next = typeof arg === 'function' ? arg(ref.current) : arg`, actualizar `ref.current` y el estado con `next`, y devolver `localforage.setItem('gpc_inventory', next)` para poder hacer `await` (ver M1).

### A6 · Alto · Al corregir la terminal de un equipo nuevo, el propietario queda incoherente. [Reproducido]
- **Dónde:** `src/pages/Dashboard.jsx:641-649`. En la "corrección de registro" se cambia `owner` pero no `ownerTerminal`, que llega sin tocar desde `editFormData` (`:754`).
  - Usan `owner`: el KPI "Prestados" (`:1026-1030`).
  - Usan `ownerTerminal`: la etiqueta "Prop. de" (`:1405`), el filtro "Propiedad Externa" (`:955`), el CSV (`:864`) y la ficha (`:1631`).
- **Prueba:** pasé "Silla" (historial de un solo registro) de Terminal A a Terminal B.
  - El historial dice "Transferido permanentemente a Terminal B".
  - La base de datos guarda `owner: "Terminal B"`, `ownerTerminal: "Terminal A"`.
  - La fila muestra **"PROP. DE TERMINAL A"** y el KPI **Prestados: 0**.
- **Escenario:** los reportes de préstamos entre terminales no cuadran entre la tabla, el KPI y el CSV. La migración de `useInventory.js:32-41` no lo arregla, porque la palabra "Transferido" del historial hace que se salte ese equipo.
- **Corrección:** usar un único campo (`ownerTerminal`), eliminar `owner` y actualizar `ownerTerminal` en `:644`. En la migración, copiar `owner → ownerTerminal` en los registros que ya existen.

### A7 · Alto · Al borrar o cambiar fotos, la siguiente edición pierde fotos y resucita la borrada. [Código]
- **Dónde:** `handleDeletePhoto` (`src/pages/Dashboard.jsx:453-455`) y `handleReplacePhoto` (`:427-430`) modifican `images[]` pero dejan `item.image` apuntando a la foto antigua. En la siguiente edición, `:745-746` (y lo mismo en `:622-624` y `:663-665`) hace:
  ```js
  if (original.image && !imagesArray.find(img => img.data === original.image))
    imagesArray = [{ data: original.image, ... }];
  ```
  Es decir, **sustituye** toda la galería por la foto huérfana.
- **Escenario:**
  - Un equipo tiene la foto p1. Se edita, se le cambia el estado (`:620-630` no permite dos fotos con el mismo estado) y se le añade p2: queda `images=[p1,p2]`, `image=p2` (`:762`).
  - Se borra p2 en la galería: queda `images=[p1]`, pero la miniatura de la tabla sigue mostrando p2.
  - Se vuelve a editar, por ejemplo para cambiar de área: queda `images=[p2]`. Se pierde p1 y reaparece la foto que se había borrado. **No lo reproduje en el navegador**: requiere subir fotos reales. Pero la secuencia es determinista leyendo esas líneas.
- **Corrección:** en borrar y reemplazar, actualizar también `image = images[0]?.data ?? null`. En `:622`, `:663` y `:745`, **añadir** la foto suelta (`[...imagesArray, {...}]`) en vez de sustituir la lista.

### A8 · Alto · Con dos pestañas o ventanas abiertas, la última que guarda borra lo de la otra. [Código]
- **Dónde:** `src/hooks/useInventory.js:17-75` carga el inventario una sola vez, y `saveInventory` (`:78-85`) escribe el array completo que tiene en memoria. No hay nada que escuche cambios hechos en otras pestañas: no se usan `storage` ni `BroadcastChannel`, y no hay `addEventListener` en `src/`.
- **Escenario:**
  - En el mismo PC están abiertas la PWA instalada y una pestaña del navegador.
  - En A se registran 10 equipos.
  - En B, que conserva el estado viejo, se edita uno, y B guarda su array sin esos 10.
  - Al recargar, los 10 equipos han desaparecido sin aviso. **No lo reproduje.**
- **Corrección:** como parche, avisar a las demás pestañas con un `BroadcastChannel('gpc_inventory')` después de cada guardado y recargar el estado al recibir el aviso, o bloquear una segunda pestaña con la Web Locks API. La solución de fondo es el backend de C1.

### A9 · Alto · La consolidación mezcla equipos prestados con equipos propios. [Código]
- **Dónde:** las tres búsquedas que deciden si dos registros se fusionan comparan solo nombre, terminal, área y estado. Ninguna mira el propietario (`ownerTerminal`):
  - alta: `src/pages/Dashboard.jsx:512-518`;
  - fraccionamiento: `:698-705`;
  - edición: `:770-777`.

  Al fusionar, el registro resultante conserva el propietario del destino (`:719-725`, `:793-799`), y el registro de origen se elimina (`:781-782`).
- **Escenario:**
  - Préstamo: la Terminal A presta 3 sillas a la Terminal B (Gate 20, En uso), donde ya hay sillas propias de B. Las 3 se suman al registro de B. Desaparece la etiqueta "Prop. de Terminal A" (`:1405`), el KPI "Prestados" baja (`:1026-1030`) y se pierde el rastro de esas unidades.
  - Al revés: registrar 2 sillas nuevas de B en un área donde hay sillas prestadas por A las suma al registro de A, y quedan todas como "Prop. de Terminal A".
  - **No lo reproduje en el navegador**, pero se sigue directamente de esas condiciones.
- **Corrección:** añadir `(i.ownerTerminal || i.terminal) === (x.ownerTerminal || x.terminal)` a los tres criterios de fusión. Valorar si `baseWarehouse` también debe coincidir. Tener en cuenta A6: mientras `owner` y `ownerTerminal` no estén unificados, comparar solo `ownerTerminal`.

### A10 · Alto · La migración que se ejecuta al cargar borra préstamos legítimos en cada recarga. [Código]
- **Dónde:** `src/hooks/useInventory.js:32-41` se ejecuta **en cada carga**, no una sola vez. Si el historial no contiene `prestado|transferido|trasladado|fraccionado` y `ownerTerminal !== terminal`, fuerza `ownerTerminal = owner = terminal` y lo guarda. Dos caminos normales crean préstamos sin esas palabras:
  1. **Fraccionar hacia otra terminal.** El historial del hijo dice `"Extraído (N uds) desde…"` (`Dashboard.jsx:692`), y el del padre, "Fraccionamiento", que no encaja con la regex `fraccionado`. El texto "Trasladado físicamente…" (`:647`) solo se guarda en la rama sin fraccionamiento (`:764`).
  2. **Importar con una columna "Propietario" distinta de "Terminal".** El historial queda como `"Importado desde Excel/CSV…"` (`:388`).
- **Escenario:**
  - La Terminal A presta 3 de sus 10 sillas a la Terminal B: edita la cantidad a 3 y cambia la terminal.
  - Durante la sesión se ve "Prop. de Terminal A" en la fila prestada.
  - Al recargar, la migración convierte esas 3 sillas en propiedad de B. El préstamo desaparece sin aviso, y el KPI, el filtro y el CSV mienten a partir de ahí.
  - **No lo reproduje en el navegador.** El árbitro comprobó la regex en node contra esos textos.
- **Corrección:**
  - Ejecutar las migraciones una sola vez, guardando una versión de esquema (`gpc_schema_version`).
  - No deducir la propiedad a partir del texto del historial.
  - En la rama de fraccionamiento, añadir el `historyLog` también al historial del hijo.
  - Se relaciona con A6 y A9: los tres dependen de que `ownerTerminal` sea la única fuente de verdad. Al copiar `owner → ownerTerminal` (A6), limitarlo a los registros que tengan `owner` definido.

### M1 · Medio · Si falla el guardado, el usuario ve "éxito" igualmente. [Código]
- **Dónde:** `src/hooks/useInventory.js:78-85` actualiza el estado primero y guarda después. Si el guardado falla, solo hace `console.error`, y nadie que lo llama espera el resultado.
- **Escenario:** con el almacenamiento lleno (fotos de 1600 px al 90 % de calidad JPEG en base64, `Dashboard.jsx:210-230`), el guardado falla. La pantalla dice "✅ registrado" y, al recargar, el cambio ya no está. **No lo reproduje**: habría que llenar la cuota.
- **Corrección:** con el `saveInventory` reescrito como en A5, propagar el error, mostrar el aviso de éxito solo después del `await` y, si falla, restaurar el estado anterior y mostrar un error visible. Bajar las fotos a unos 1024 px y calidad 0,75.

### M2 · Medio · Dependencias con vulnerabilidades conocidas. [Herramienta]
- **`xlsx` 0.18.5:** Prototype Pollution (GHSA-4r6h-8v6p-xvw6) y ReDoS (GHSA-5pgg-2g8v-p4x9). npm no ofrece una versión corregida. La app la usa para leer archivos subidos por el usuario (`Dashboard.jsx:295`).
  - **Escenario:** un supervisor importa un .xlsx recibido por correo de un proveedor. Un archivo malicioso o malformado bloquea la pestaña (ReDoS) o contamina objetos de la app (prototype pollution). Es Medio y no Alto porque, sin backend, el efecto se queda en ese navegador.
  - **Corrección:** instalar la versión corregida desde el CDN oficial de SheetJS (0.20.x) o cambiar a `exceljs`, y limitar el tamaño del archivo.
- **`react-router` 7.18.1:** GHSA-qwww-vcr4-c8h2 (alta). Afecta al modo RSC, que esta app no usa (es una SPA con `BrowserRouter`), así que el riesgo real es bajo. **Escenario:** ninguno explotable en esta SPA; se corrige por higiene, para que el aviso no tape otros futuros. **Corrección:** `npm audit fix`.

### M4 · Medio · Los clones sin guardar quedan como filas fantasma. [Código]
- **Dónde:** `src/pages/Dashboard.jsx:893`. El clon con `isDraft: true` se guarda en IndexedDB en el momento, y solo se borra si se cancela o se edita otra fila **en la misma sesión**.
- **Escenario:** alguien clona y luego recarga o cierra la pestaña. Queda una fila duplicada que suma unidades en los KPIs. **No lo reproduje** con una recarga real.
- **Corrección:** mantener el borrador solo en el estado de React (`editFormData`) e insertarlo en el inventario al pulsar OK. Al cargar, descartar los registros con `isDraft`.

### M5 · Medio · Bundle de 1,2 MB en un solo bloque. [Herramienta]
- **Dónde:** `src/pages/Dashboard.jsx:1` (`import html2canvas`) y `:6` (`import * as XLSX`) importan esas librerías de forma estática.
- **Evidencia:** `vite build` da `index-BIE50Qvq.js 1,197.67 kB │ gzip: 357.87 kB`, con aviso de chunk mayor de 500 kB.
- **Escenario:** la primera carga con 4G en una puerta de embarque tarda varios segundos, aunque `xlsx` y `html2canvas` solo se usan al importar o compartir.
- **Corrección:** cargar ambas librerías con `await import()` dentro de sus funciones.

### M6 · Medio · Cada cambio reescribe y recalcula todo el inventario. [Código]
- **Dónde:** `useInventory.js:81` guarda el array completo, fotos incluidas, en una sola clave. En `Dashboard.jsx:952-977` los filtros generan arrays nuevos en cada render, así que el `useMemo` de `:979-993` se recalcula siempre y no sirve de nada.
- **Escenario:** con unos cientos de equipos con foto, cada edición serializa decenas de MB y escribir en los filtros va lento. **No lo medí.**
- **Corrección:** envolver `filteredInventory` y `chartInventory` en `useMemo`. Guardar las fotos en una clave por equipo (`img:<id>`) o, mejor, en el backend de C1.

### B1 · Bajo · Colores de estado desactualizados. [Código]
- **Dónde:** `Dashboard.jsx:1428-1433` pinta de rojo `'Dañado'`, un estado que ya no existe. `STATUS_COLORS` (`:76`) no tiene `'En proceso de decomiso'` (tiene `'Por decomisar'`, que ya no se usa).
- **Escenario:** "Inhabilitado" se ve amarillo, como un aviso leve, en lugar de rojo. Esa porción del gráfico sale gris `#333`.
- **Corrección:** un único mapa de estado → colores, compartido por el badge y el gráfico.

### B2 · Bajo · La "Ficha de solo lectura" (`?view=`) es inalcanzable. [Código]
- **Dónde:** `Dashboard.jsx:102-109` y `:1797-1846`.
- **Escenario:** nada genera ese enlace, la ruta exige login (`App.jsx:30-36`) y los datos son locales, así que un enlace compartido no abriría nada en otro dispositivo. Es código muerto que alguien podría creer funcional.
- **Corrección:** eliminarla o rehacerla cuando exista el backend.

### B3 · Bajo · El contador "22 Almacenes Activos" está escrito a mano. [Código]
- **Dónde:** `Dashboard.jsx:1129`. Hoy es correcto (9 + 4 + 9).
- **Escenario:** al añadir un almacén a `WAREHOUSES_DATA`, la tarjeta seguirá diciendo 22.
- **Corrección:** `Object.values(WAREHOUSES_DATA).flat().length`.

### B4 · Bajo · Accesibilidad. [Código]
- **Dónde:**
  - `index.html:2` usa `lang="en"` en una interfaz en español.
  - Hay botones de solo icono sin `aria-label`; la papelera de `Dashboard.jsx:1375` ni siquiera tiene `title`.
  - Los campos del login solo tienen placeholder (`Login.jsx:98-114`).
  - Los modales no se cierran con Escape ni retienen el foco.
- **Escenario:** un lector de pantalla lee la interfaz con pronunciación inglesa y anuncia "botón" sin nombre en las acciones de la tabla.
- **Corrección:** `lang="es"`, `aria-label` en los iconos, `<label>` en los campos y gestión del foco en los modales.

### B5 · Bajo · PWA: iconos con tamaño falso y fondo sin caché offline. [Herramienta]
- **Dónde:**
  - `public/pwa-192x192.png` y `public/pwa-512x512.png` miden en realidad **489×437** (`file`), mientras que el manifiesto los declara cuadrados de 192 y 512 (`vite.config.js:18-29`).
  - `globPatterns` (`vite.config.js:32`) no incluye `jpg`, y `dist/sw.js` precachea 14 entradas sin ningún `.jpg`.
- **Escenario:** Chrome puede avisar de la discrepancia de los iconos o no ofrecer la instalación, y sin conexión el fondo del login (`terminal-bg.jpg`, 159 KB) no carga.
- **Corrección:** generar PNG cuadrados reales de 192 y 512 px, y añadir `jpg` al patrón (o convertir el fondo a WebP). `favicon.jpg`, `logo.jpg` y `mapa-estatico.jpg` no se usan en `src/` ni en `index.html` y se pueden borrar (unos 600 KB).

### B6 · Bajo · Avisos del linter. [Herramienta]
- **Dónde:** `oxlint` sobre `src/` da 7 avisos:
  - Variables sin usar: `Dashboard.jsx:79`, `:144`, `:146` y `:1589`.
  - Dependencias que faltan en `useEffect`: `:255` y `:266`.
  - `react(only-export-components)` en `:16`, porque se exporta `WAREHOUSES_DATA` desde un componente.

  Además, `.oxlintrc.json` también analiza `dist/`, lo que añade unos 3.000 avisos de ruido.
- **Escenario:** con miles de avisos irrelevantes, nadie lee el lint y los avisos útiles (como los de dependencias de `useEffect`) pasan desapercibidos.
- **Corrección:** `"ignorePatterns": ["dist", "src/archive"]`, sacar `WAREHOUSES_DATA` a un módulo propio y arreglar los demás avisos.

### B7 · Bajo · Orden del repositorio. [Herramienta]
- **Dónde:**
  - `dist/` está versionado. Hoy coincide con el código: el build da un bundle idéntico.
  - `@supabase/supabase-js` está instalado y no se usa.
  - `Dashboard.jsx` tiene 1.906 líneas.
  - Hay cambios sin commit: 3 documentos borrados (`Manual Instructivo -- StockTerminal.pdf` y dos `.xlsx` de plantilla), un `.html` nuevo sin seguimiento y **`Plantilla_Oficial_Carga_Masiva.xlsx` modificada** (de 17.949 a 9.065 bytes).
- **Escenario:** si alguien hace commit del código sin recompilar, `dist/` queda desfasado. Y la plantilla oficial de importación cambió sin quedar registrada. No revisé su contenido a fondo (ver Supuestos), pero conviene revisarla junto con A2 y A3.
- **Corrección:** que Netlify compile en cada despliegue y quitar `dist/` del repo. Revisar y hacer commit de la plantilla. Partir `Dashboard.jsx` en componentes (tabla, modales, importador) y en un módulo de lógica pura que se pueda probar.

### B8 · Bajo · Las fechas se guardan como texto local. [Código]
- **Dónde:** `Dashboard.jsx:9` y `useInventory.js:91` usan `toLocaleString()`.
- **Escenario:** la bitácora no se puede ordenar ni filtrar por fecha, y el formato cambia según el dispositivo.
- **Corrección:** guardar en ISO 8601 y formatear solo al mostrar.

### B9 · Bajo · Al editar, la cantidad se cambia sin confirmación, sea para subirla o para bajarla. [Código]
- **Dónde:** `Dashboard.jsx:1332` usa `max={item.quantity}`, que el navegador no hace cumplir al escribir. `:740-742` acepta el valor mayor y solo lo anota en el historial.
- **Escenario:** alguien teclea 50 en un lote de 5 por error y el stock sube sin confirmación. Puede ser intencional, como ajuste de inventario (ver Supuestos).
- **El caso contrario:** si se baja la cantidad sin cambiar el destino (`:740-742`), las unidades restadas desaparecen y el aviso dice "actualizado exitosamente". El campo invita a fraccionar (su `title` dice "Fraccionar lote", `:1332`), así que es fácil olvidar cambiar la ubicación.
- **Corrección:** validar `parsedQty <= original.quantity` y, en ambos sentidos, pedir confirmación y un motivo de ajuste cuando la cantidad cambie sin cambiar el destino.

### B10 · Bajo · Al registrar un equipo que se consolida con otro, se pierde su foto. [Código]
- **Dónde:** cuando hay coincidencia, `Dashboard.jsx:520-529` suma la cantidad y el historial, pero descarta `newItemImage`. El aviso (`:556`) no lo menciona.
- **Escenario:** alguien registra 3 sillas con foto en un área donde ya había sillas, y la foto adjunta desaparece.
- **Corrección:** fusionar `images` igual que en `:711-717`, o avisar al usuario.


### B11 · Bajo · El CSV de la bitácora no está protegido contra fórmulas. [Código]
*(En la v1 era M3 · Medio. Lo bajé a Bajo porque, hoy, el riesgo es solo hipotético: ver el escenario.)*
- **Dónde:** `src/pages/Dashboard.jsx:1709-1714` no aplica el `sanitizeCSV` del export principal (`:846-853`), no escapa las comillas de `date` ni de `user` y no lleva BOM, así que las tildes salen mal en Excel.
- **Escenario:** hoy la acción siempre empieza por un texto fijo ("Creado equipo…"), así que Excel no la interpreta como fórmula y el riesgo es bajo. Pero el campo `user` entraría tal cual en cuanto haya usuarios reales, y un nombre como `=HYPERLINK(...)` se ejecutaría al abrir el CSV.
- **Corrección:** reutilizar `sanitizeCSV`, usar `;` y BOM igual que en `exportToCSV`.


### B12 · Bajo (provisional) · Al trasladar un equipo, se sustituye su "Almacén Base". [Código]
- **Dónde:** `Dashboard.jsx:902-907` y `:1360`.
- **Escenario:** un equipo de la Terminal A con almacén base "Almacén Sótano" se presta a la Terminal B, y su almacén base pasa a ser "Almacén Aduanas TB". Cuando lo devuelvan, nadie sabrá a qué almacén de A pertenecía.
- **Corrección:** depende de qué signifique el campo (ver Supuesto 8). Si es el almacén del propietario, conservarlo al cambiar de terminal y ofrecer los almacenes de `ownerTerminal`.

---

## Lo que está bien

- El export CSV principal neutraliza la inyección de fórmulas, usa `;` y añade BOM para Excel en español (`Dashboard.jsx:846-871`).
- El modelo de fraccionar y consolidar lotes responde a casos reales y deja rastro en el historial de cada equipo. Los defectos de implementación están en A5, A7 y A9.
- Existe una migración de datos antiguos (`useInventory.js:24-56`). Buena idea, pero mal ejecutada: ver A10.
- IndexedDB en lugar de `localStorage` es la decisión correcta para guardar fotos en el navegador.
- El borrado pide una confirmación escrita, y la importación acepta alias de columnas flexibles.
- El build compila sin errores y `dist/` coincide con el código.

## Plan de acción recomendado

1. **Antes de que la use más de una persona:** C1 (backend compartido, o al menos respaldo completo en JSON) y A1 (autenticación real).
2. **Errores de datos:** primero reescribir `saveInventory` como se describe en A5. Eso arregla la base de A5 y M1. Después A10 (antes de que se recargue con préstamos), A2, A3, A4, A6, A7, A8 y A9. Son cambios pequeños, de unas pocas líneas cada uno.
3. **Antes de publicar:** M2, M5 y B11.
4. **Mantenimiento:** el resto, junto con tests de la lógica de importación, fraccionamiento y fotos, una vez extraída de `Dashboard.jsx`.

---

## Método y evidencia

- **Lectura completa:** `src/App.jsx`, `main.jsx`, `pages/Login.jsx`, `pages/Dashboard.jsx`, `hooks/useInventory.js`, `components/*`, `package.json`, `vite.config.js`, `netlify.toml`, `.oxlintrc.json`, `index.html` y `README.md`.
- **Herramientas:** `npx oxlint`, `npm audit --omit=dev`, `npx vite build` (en una carpeta temporal, sin tocar `dist/`), `file` sobre los iconos y `grep` sobre el bundle y `sw.js`.
- **Pruebas en el navegador:** sobre ese build, servido en `localhost` con datos inventados. Cubrí A1–A6: login, dos importaciones de CSV (con BOM y sin él), doble clonado y cambio de terminal. Al terminar borré el `localStorage` y el IndexedDB de prueba.
- **Sin probar:** móviles reales, importación de `.xlsx` (solo probé CSV), cuota de almacenamiento (M1), recarga con borradores (M4), flujo de fotos (A7), dos pestañas (A8), consolidación entre propietarios (A9), migración al recargar (A10) y rendimiento con muchos datos (M6).

## Supuestos

Decisiones que tomé donde el encargo era ambiguo:

1. **Plantilla:** la plantilla de encargo traía campos vacíos (objetivo, listón, formato…). Los rellené yo y los dejé arriba, en "Encargo".
2. **Uso previsto:** audité la app como si fuera a usarse en operación real en varias terminales (lo que sugieren el README y el nombre del cliente), no como demo. Para una demo, C1 y A1 bajarían de severidad.
3. **Alcance:** excluí `src/archive/` (está en `.gitignore`) y no audité el contenido del manual ni de las plantillas, salvo para notar que la plantilla cambió sin commit (B7).
4. **Activos fijos:** asumí que un número de Activo Fijo identifica una única unidad. Por eso A4 propone impedir que se fraccionen.
5. **Cantidad mayor que el lote:** asumí que subir la cantidad al editar puede ser un ajuste de inventario intencional, y por eso B9 es Bajo.
6. **Pruebas:** usé solo datos inventados, en un build local, y no ejecuté nada contra un despliegue público.
7. **Cambios al proyecto:** no toqué el código. Creé la rama `docs/auditoria`, que de momento apunta al mismo commit que `main`, y este informe, que está **sin commit**. `Manual Instructivo -- StockTerminal.html` ya existía antes de la auditoría como archivo sin seguimiento: no lo creé yo.
8. **Almacén Base de un equipo prestado:** al cambiar de terminal, `:902-907` sustituye `baseWarehouse` por el primer almacén de la terminal destino, y el selector (`:1360`) solo ofrece almacenes de esa terminal. No sé si "Almacén Base" significa el almacén del propietario o el de la ubicación actual. Si es el del propietario, es un fallo Medio más: el equipo prestado pierde su almacén de origen. Queda como punto pendiente de decidir (ver B12).

## Informe del árbitro

**Resultado: no aprobado formalmente.** Se agotó el máximo de 3 rondas, y la tercera también se rechazó. Esta es la mejor versión: incorpora todas las correcciones de la ronda 3, pero **ningún árbitro ha revisado los cambios posteriores a esa ronda**. En cada ronda revisó un árbitro nuevo e independiente: no veía el proceso de construcción ni las rondas anteriores, y tenía prohibido modificar el proyecto.

| Ronda | Veredicto | Bloqueantes | Menores |
|---|---|---|---|
| 1 | Rechazado | 3 | 8 |
| 2 | Rechazado | 1 | 7 |
| 3 | Rechazado | 1 | 8 |

### Rechazos bloqueantes (fragmento original → fallo → corrección aplicada)

- **R1.1** · "Además encontré 5 errores de lógica…" → faltaba un fallo Alto: borrar o reemplazar una foto deja `item.image` huérfano, y la siguiente edición sustituye toda la galería → **añadido A7**.
- **R1.2** · C1 solo hablaba de dispositivos distintos → faltaba que, con dos pestañas abiertas, la última en guardar pisa a la otra → **añadido A8**.
- **R1.3** · "pasar a actualizaciones funcionales (`saveInventory(prev => …)`)" → la corrección rompía el guardado, porque `saveInventory` guardaría una función en IndexedDB → **A5 reescrito**, con la advertencia y el diseño con `useRef`; plan y M1 alineados.
- **R2.1** · "el núcleo está bien pensado: … consolidación" → faltaba un fallo Alto: la consolidación ignora el propietario y mezcla equipos prestados con propios → **añadido A9** y matizados el veredicto y "Lo que está bien".
- **R3.1** · "Hay una migración para datos antiguos" (en "Lo que está bien") → la migración se ejecuta en cada carga y borra préstamos creados al fraccionar o al importar → **añadido A10** y matizado ese punto.

### Correcciones menores aplicadas

- **Ronda 1:**
  - La rama `master` pasó a `main`.
  - Se añadió a B7 la plantilla modificada.
  - B6: el recuento de lint pasó a 7 avisos con la línea `:16`, y el ruido de `dist/` a "unos 3.000".
  - El fraccionamiento de activos fijos se incorporó a A4, y la foto perdida al consolidar quedó como B10.
  - B5 ahora incluye los iconos de 489×437 y `favicon.jpg`.
  - Se añadieron escenarios a M2, B1–B4 y B6–B9.
  - La autenticación (antes C2) bajó de Crítico a Alto (ahora A1).
- **Ronda 2:**
  - A5: no llamar a `handleEditClick`.
  - A2 cubre ahora `baseWarehouse` (`:365`).
  - Se creó la sección "Supuestos".
  - M3 bajó a Bajo (ahora B11).
  - A7 incluye el paso "cambiar el estado".
  - M5 cita las líneas `:1` y `:6`.
  - A4 cubre `trim()` y los activos fijos sin número.
- **Ronda 3:**
  - Se corrigió el sentido del ejemplo de `trim()` en A4.
  - B11 se movió a la sección Bajo.
  - Se añadió escenario al apartado de `react-router` en M2.
  - A5 resuelve también `baseWarehouse`.
  - B9 cubre ahora la bajada de cantidad.
  - A3 incluye la validación de "Almacén Base".
  - Se matizó B7.
  - Se añadieron el Supuesto 8 y B12 sobre el almacén base al trasladar.
  - Se precisó el Supuesto 7 (archivo sin commit; el `.html` no es mío).

### Puntos pendientes

1. **Sin re-arbitraje:** los cambios posteriores a la ronda 3 (A10, B12 y los menores de esa ronda) no los revisó ningún árbitro.
2. **B12 y Supuesto 8:** su severidad depende de qué signifique "Almacén Base", y eso tiene que decidirlo el autor.
3. **Plantilla oficial sin revisar:** no la revisé yo. El dato de valores fuera de catálogo viene del árbitro.
4. **Hallazgos sin reproducir:** A7–A10, M1, M4 y M6 están verificados por lectura de código, no en el navegador.
5. **IDs con hueco:** los Medios saltan de M2 a M4, porque M3 pasó a ser B11. Mantuve los IDs para no romper las referencias.

---

## Estado de las correcciones (A2–A10)

Rama `fix/integridad-datos`, **sin commit**. Archivos: `src/hooks/useInventory.js` y `src/pages/Dashboard.jsx`. No toqué `dist/`: hay que recompilar antes de publicar.

| Fallo | Corrección | Verificación |
|---|---|---|
| A2 | El estado se resuelve antes que el área; los equipos "En Almacén" se validan contra almacenes. Si falta el área, se usa el almacén base. | Navegador: "Almacén Sótano" muestra 9 unidades. |
| A3 | Se normalizan tildes, mayúsculas y alias (`TA`, `TB`, `B2`…). CSV en UTF-8, UTF-8 con BOM, Windows-1252 o UTF-16. Se valida el almacén base. Las correcciones se listan y se pide confirmación antes de importar. | Navegador y node con los 4 formatos de CSV y con `.xlsx`. |
| A4 | Número de activo normalizado (`trim` + mayúsculas) en alta, edición e importación. Detecta duplicados dentro del mismo archivo. Número obligatorio. Un activo fijo no se puede fraccionar. | Navegador: duplicado omitido con aviso, fraccionamiento bloqueado y clon sin número bloqueado. |
| A5 | `saveInventory` reescrito con `useRef`: acepta un array o una función y devuelve una promesa. El clonado hace una sola escritura. | Navegador: el segundo clon se conserva. |
| A6 | Corrección de registro actualiza `ownerTerminal`. El KPI usa `ownerTerminal`. La migración unifica `owner` y `ownerTerminal`. | Navegador y prueba de migración con datos antiguos. |
| A7 | Borrar y reemplazar fotos actualizan la miniatura. La foto suelta se **añade** a la galería, en vez de sustituirla. La migración repara las miniaturas huérfanas. | Navegador: añadir, borrar, reemplazar y editar mantienen la galería coherente. |
| A8 | `BroadcastChannel`: cuando otra pestaña guarda, esta recarga los datos. | Navegador con dos pestañas: no se pierde el equipo creado en la otra. |
| A9 | La consolidación exige el mismo propietario y nunca usa borradores de clonado. | Navegador: préstamo y stock propio quedan separados. Un borrador de otra pestaña no absorbe el original. |
| A10 | Migración única con `gpc_schema_version`; ya no deduce la propiedad del historial. Un fraccionamiento nunca se trata como corrección de registro. | Navegador: el préstamo sobrevive a la recarga, también al fraccionar un equipo recién importado. |

**Extras aplicados:**
- Aviso visible si falla el guardado (parte de M1).
- Al cargar, se descartan los borradores guardados (parte de M4).
- El remanente de un fraccionamiento conserva su almacén base: antes heredaba el de la terminal de destino (parte de B12).
- Los `.xlsx` con extensión `.csv` se leen como libro.

### Revisión adversarial del código

3 rondas con árbitros nuevos e independientes.

| Ronda | Veredicto | Bloqueantes |
|---|---|---|
| 1 | Rechazado | **CSV en ANSI estropeado:** leer todos los CSV como UTF-8 rompía las tildes de los CSV en Windows-1252 (el formato por defecto de Excel en español). → Se decodifica como UTF-8 y, si falla, como Windows-1252. |
| 2 | Rechazado | **Préstamo perdido al fraccionar:** fraccionar un equipo recién importado hacia otra terminal se trataba como "corrección de registro" y el préstamo desaparecía al instante. → Un fraccionamiento nunca es corrección. |
| 3 | Rechazado | **R1 · `.xlsx` corrompidos:** `raw:false` convertía `123456789012` en `1.23457E+11` y `1500` en `"1,500"`. → Se vuelve a leer el valor real, y se usa `raw:true` solo en CSV. **R2 · borrador de otra pestaña:** podía absorber el original al consolidar. → `canConsolidate` excluye los borradores. |

**No aprobado formalmente:** se agotaron las 3 rondas, y las correcciones de la ronda 3 no las revisó ningún árbitro. Las verifiqué yo: node para `.xlsx` y CSV, y navegador para el borrador. Lint con los mismos 7 avisos previos y build sin errores.

### Pendientes (menores, sin corregir)

1. **Carreras de sincronización:** quedan ventanas de milisegundos en la sincronización entre pestañas. Además, una pestaña con el bundle antiguo en caché sigue ejecutando la migración vieja hasta que se actualiza. La solución completa es el backend de C1, o Web Locks.
2. **Activos Fijos:** se siguen aceptando con cantidad > 1. La plantilla oficial trae `GPC-847291` con 10 unidades. Los duplicados que ya hay en los datos siguen bloqueando la edición hasta renumerarlos.
3. **Plantilla oficial:** `Plantilla_Oficial_Carga_Masiva.xlsx` da 3 avisos al importarla ("Almacén Cuarto Técnico", "Rampa Norte"). Hay que corregir la plantilla.
4. **Préstamos ya perdidos:** los préstamos que la migración antigua borró antes de esta corrección no se pueden recuperar.
5. **Fuera del alcance de esta corrección:** C1, A1, M1 completo, M2–M6 y B1–B12, con la excepción de los extras ya mencionados.
