@echo off
title WMVAA AI Grader Pro - Server Jaringan Lokal Sekolah
color 0B
cls

cd /d "%~dp0"

echo ============================================================================
echo               WMVAA AI GRADER PRO - ENTERPRISE SCHOOL SERVER
echo ============================================================================
echo.

for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'WSL|vEthernet|Virtual|VMware|Loopback' } | Select-Object -First 1).IPAddress"') do set LAN_IP=%%i

if "%LAN_IP%"=="" set LAN_IP=192.168.1.62

echo  [AKSES DARI KOMPUTER SERVER INI]
echo    ^> http://localhost:3000
echo.
echo  [AKSES DARI HP GURU DI JARINGAN WI-FI LOKAL]
echo    ^> http://%LAN_IP%:3000
echo    (Atau klik tombol "QR Akses HP Guru" di pojok kanan atas Dashboard)
echo.
echo ============================================================================
echo  Pilih Mode Server:
echo    [1] Mode Cepat Langsung Jalan (Recommended / Tanpa Build Ulang)
echo    [2] Mode Production Penuh (Build Optimasi Maksimal + Start Server)
echo    [3] Mode HTTPS Lokal (Aktifkan Live WebRTC Viewfinder di Semua HP)
echo ============================================================================
set /p MODE="Ketik pilihan [1/2/3] lalu tekan Enter (Default=1): "

if "%MODE%"=="2" (
  echo.
  echo  [*] Membangun paket produksi teroptimasi (next build)...
  call npm run build
  echo.
  echo  [*] Menjalankan Production Server pada http://%LAN_IP%:3000 ...
  call npm run start:lan
  pause
  exit /b
)

if "%MODE%"=="3" (
  echo.
  echo  [*] Menjalankan Server dengan Sertifikat HTTPS Lokal pada https://%LAN_IP%:3000 ...
  call npm run dev:https
  pause
  exit /b
)

echo.
echo  [*] Menjalankan Server Jaringan Lokal pada http://%LAN_IP%:3000 ...
call npm run dev:lan
pause
