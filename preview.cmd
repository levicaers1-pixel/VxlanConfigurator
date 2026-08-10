@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "C:\Users\levic\repos\VxlanConfigurator"
call npm run preview -- --port 4173
