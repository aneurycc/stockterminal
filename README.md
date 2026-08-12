# Stock Terminal GPC (MVP) ✈️

![Grupo Puntacana](https://img.shields.io/badge/Grupo_Puntacana-Inventory-0A3B7A?style=for-the-badge&logo=react&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa)

Sistema avanzado de gestión de inventario para Terminales Aeroportuarias de Grupo Puntacana. Desarrollado como un MVP (Minimum Viable Product) altamente escalable, diseñado para control logístico en tiempo real.

## 🏗️ Arquitectura Actual

Este proyecto está construido como una Single Page Application (SPA) modular, utilizando tecnologías modernas para garantizar la velocidad, confiabilidad y soporte offline (PWA):

*   **Frontend Framework:** React.js + Vite (Empaquetado ultrarrápido).
*   **Persistencia de Datos (Offline):** IndexedDB (vía `localforage`)
    *   *Nota Arquitectónica:* La persistencia asíncrona mediante IndexedDB permite el almacenamiento ilimitado de imágenes HD en Base64 sin romper la cuota clásica de 5MB del `localStorage`.
*   **Componentes Modulares:** La UI principal (`Dashboard.jsx`) ha comenzado a modularizarse (`KPICards.jsx`, `useInventory.js`) para facilitar la lectura del código por parte de Ingeniería.
*   **Progressive Web App (PWA):** Soporte nativo offline con Service Workers (vía `vite-plugin-pwa`).
*   **Analítica Visual:** Gráficos SVG interactivos vía `recharts`.

## 🚀 Despliegue Local (Desarrollo)

Para ejecutar esta aplicación en un entorno local (sin necesidad de conexión a internet o a bases de datos externas):

1. **Instalar Dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar el Servidor de Desarrollo:**
   Se recomienda ejecutar el script dedicado (si está disponible en Windows) o el comando nativo para exponer la aplicación en la red local y evitar conflictos de puertos en caché:
   ```bash
   npm run dev -- --host --port 5174
   ```
   > 🌐 **Acceso Multi-Dispositivo:** Al utilizar el flag `--host`, puedes acceder a la aplicación desde cualquier dispositivo móvil o tablet conectado a la misma red Wi-Fi ingresando la IP mostrada en la terminal (ej: `http://192.168.1.X:5174`).

## 🛠️ Roadmap & Siguientes Pasos (Handoff a TI)

Este prototipo (MVP) ha sido deliberadamente estructurado para que el equipo de Desarrollo y Arquitectura del GPC pueda transicionarlo a un entorno Enterprise:

1. **Integración Backend / DB Real:**
   * El estado actual se maneja a través del hook `src/hooks/useInventory.js`.
   * **Acción sugerida:** Reemplazar las llamadas a `localforage` dentro de este hook por llamadas REST/GraphQL hacia la API oficial de Grupo Puntacana (SQL Server, Postgres, o Supabase), manteniendo el Frontend intacto.
2. **Sistema de Autenticación (Auth):**
   * El componente `Login.jsx` actualmente es simulado para demostración local.
   * **Acción sugerida:** Conectar con el Active Directory / Azure AD del Grupo Puntacana mediante OAuth 2.0 / JWT.
3. **Escalabilidad de Imágenes:**
   * Las imágenes se comprimen a JPEG 90% en el cliente y se guardan en IndexedDB.
   * **Acción sugerida:** Crear un endpoint de subida en la nube (ej. AWS S3, Azure Blob Storage) y guardar únicamente la URL en la base de datos relacional.

## 🔒 Auditoría y Diseño

El diseño de la interfaz hereda los principios del *Design System* corporativo del Grupo Puntacana, garantizando una adopción orgánica por parte de los supervisores y gerentes de terminal. 

---
*Desarrollado bajo principios de eficiencia radical, resiliencia offline y código modular.*
