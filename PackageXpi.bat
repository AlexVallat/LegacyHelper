@echo off

set buildoutputs=%~dp0Build
set xpifile=%buildoutputs%\LegacyHelper.xpi

del "%xpifile%"

cd "%~dp0"
"%ProgramW6432%\7-Zip\7z.exe" a -tzip -mx9 -bd "%xpifile%" @XpiZipList.txt
pause