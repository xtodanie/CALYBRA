# **App Name**: Calybra

## Core Features:

- User Authentication: Secure signup and login using Firebase Authentication (email/password).
- Tenant & User Management: Create tenants and assign user roles (OWNER, MANAGER, ACCOUNTANT, VIEWER).
- Month Close Creation: Create and manage monthly closing periods with start and end dates.
- Bank Statement CSV Upload & Parsing: Upload and parse bank statement CSV files. Automatically maps the data, using provided suggestions from user
- Invoice PDF Upload & Parsing: Upload and parse invoice PDFs, extracting key data like supplier, invoice number, date, and amount. Extraction done by internal tool for deterministic parsing + AI-powered fallback to improve accuracy.
- Reconciliation Engine: Match bank transactions with invoices based on amount, date, and supplier using a configurable scoring system, creating proposed matches and identifying exceptions.
- Exception Handling: Display and resolve reconciliation exceptions (e.g., amount mismatch, missing invoices) with suggested actions.
- Audit Logging: Log every action, including match confirmations and exception resolutions, ensuring full auditability.
- Secure Export: Enable secure data export to avoid leaking tenant specific data via client-side

## Style Guidelines:

- Primary color: Ink Black (#02111b) to convey trust and reliability.
- Secondary color: Gunmetal (#3f4045).
- Background color: Shadow Grey (#30292f).
- Accent color: Blue Slate (#5d737e) to highlight important actions and elements.
- Text color: White (#fcfcfc) for readability against darker backgrounds.
- Body text font: 'PT Sans', a humanist sans-serif, to bring a little warmth or personality to a modern UI
- Headline font: 'Space Grotesk', to feel modern and trustworthy
- Use a consistent set of clear, professional icons.
- Clean and intuitive layout, focusing on data clarity and ease of use.
- Subtle transitions and animations to improve user experience without being distracting.