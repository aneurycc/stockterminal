@echo off
title Servidor de Inventario (GPC)
color 0A

echo ===================================================
echo     INICIANDO SERVIDOR DE INVENTARIO - GRUPO PUNTACANA
echo ===================================================
echo.
echo Iniciando servidor local para demostracion sin internet...
echo.

cd /d "%~dp0"
npm run dev -- --port 5174 --host

pause
