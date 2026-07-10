; Brio Agent — Windows installer (Inno Setup script)
; Made by Wira Mode Pohon
;
; Compiles into a single BrioAgentSetup.exe that the client double-clicks —
; a real Next/Next/Install/Finish wizard, no PowerShell or terminal needed.
;
; Build locally: install Inno Setup (https://jrsoftware.org/isinfo.php),
; then open this file in the Inno Setup Compiler and hit Build, or run:
;   ISCC.exe brio-agent.iss
;
; GitHub Actions builds this automatically as part of build-agent.yml —
; windows-latest runners come with Inno Setup preinstalled.
;
; Expects brio-agent.exe to already exist in this same directory (built by
; build.sh / build-remote.sh with the server URL baked in via -ldflags).

#define MyAppName "Brio Agent"
#define MyAppVersion "1.0"
#define MyAppPublisher "Wira Mode Pohon"

[Setup]
AppId={{8F3A9B2E-4C1D-4E5F-9A2B-1C3D4E5F6A7B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\BrioAgent
DefaultGroupName=Brio Agent
DisableProgramGroupPage=yes
DisableWelcomePage=no
OutputDir=output
OutputBaseFilename=BrioAgentSetup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "brio-agent.exe"; DestDir: "{app}"; Flags: ignoreversion

[Run]
; Exclude from Defender scanning before the service ever runs — this is
; the whole reason this is a proper installer and not just a copied .exe:
; it needs admin rights to do this step, which PrivilegesRequired=admin
; above already guarantees.
Filename: "powershell.exe"; \
    Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Add-MpPreference -ExclusionPath '{app}\brio-agent.exe' -ErrorAction SilentlyContinue"""; \
    Flags: runhidden; StatusMsg: "Configuring Windows Defender exclusion..."

; Register as a Scheduled Task: starts at logon, restarts on failure.
Filename: "schtasks.exe"; \
    Parameters: "/Create /TN ""BrioAgent"" /TR ""\""{app}\brio-agent.exe\"""" /SC ONLOGON /RL LIMITED /F"; \
    Flags: runhidden; StatusMsg: "Registering background service..."

Filename: "schtasks.exe"; \
    Parameters: "/Run /TN ""BrioAgent"""; \
    Flags: runhidden; StatusMsg: "Starting Brio Agent..."

[UninstallRun]
Filename: "schtasks.exe"; Parameters: "/Delete /TN ""BrioAgent"" /F"; Flags: runhidden

[Code]
procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel2.Caption :=
    'This installs a small background service that allows secure remote ' +
    'support. It runs quietly and can be removed at any time from ' +
    'Add/Remove Programs.' + #13#10 + #13#10 +
    'Made by Wira Mode Pohon.';
end;
