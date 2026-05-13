╔══════════════════════════════════════════════════════════════╗
║         CRR Safety Training Portal — Setup Guide            ║
║         Commercial Roofing Rana LLC                         ║
╚══════════════════════════════════════════════════════════════╝

28 training modules (14 English + 14 Spanish)
All completions saved to database with printable certificates
Admin dashboard with CSV export

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIRST-TIME SETUP (one time only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Install Node.js (if not already installed):
   → Go to https://nodejs.org and download the LTS version
   → Run the installer (just click Next/Continue through it)

2. Double-click "install_and_start.command"
   → This installs the required packages and starts the portal
   → A browser window will open automatically at http://localhost:3000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DAILY USE (after first-time setup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Double-click "start.command" to launch the portal.
The browser opens automatically. Close the Terminal window to stop.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LETTING YOUR TEAM ACCESS THE PORTAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the portal starts, it prints your network IP, e.g.:
   Network: http://192.168.1.42:3000

Any phone, tablet, or computer on the same Wi-Fi network
can open that URL to take the training courses.

• Team members can access training from their own devices
• The portal works on phones and tablets (responsive design)
• Completions are saved on YOUR computer's database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADMIN DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

URL:      http://localhost:3000/admin.html
Password: CRR-Admin-2025

Admin features:
  • View all completed trainings by employee
  • Filter by name, module, language, or date range
  • View and print individual certificates (PDF-quality)
  • Download all records as a spreadsheet (CSV)
  • Delete individual records if needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COURSES AVAILABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENGLISH (14 courses):
  1. Bloodborne Pathogens
  2. Cyber Security
  3. Disciplinary Program
  4. Driving Safety
  5. Fall Protection
  6. Fire Protection & Extinguishers
  7. First Aid
  8. Hand & Power Tools
  9. Hazard Communication (HazCom)
  10. Ladder Safety
  11. Personal Protective Equipment (PPE)
  12. Rigging Equipment
  13. Scaffolds
  14. Subcontractor Management

SPANISH (14 courses — exact translations):
  All 14 of the above in Spanish

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATABASE / BACKUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All training records are stored in:
  CRR_Training_Portal/data/training.db

Back this file up regularly (copy it to an external drive or
cloud storage). This file contains all completion records and
certificates. The portal recreates it automatically if missing,
but you will lose historical data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Port 3000 already in use":
  Another process is using port 3000. Restart your computer
  or change the port by setting PORT=3001 before starting.

"Module not found" on a course card:
  Make sure the training HTML files are still in their original
  locations on your Desktop and in the "In House trainging" folder.

Team members can't connect from their devices:
  • Make sure the portal is running (Terminal window is open)
  • Make sure all devices are on the same Wi-Fi network
  • Check your Mac's firewall: System Settings > Network > Firewall
    and allow incoming connections for "node"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Commercial Roofing Rana LLC — Safety Training Portal v1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
