export const tutorialCategories = [
  "Getting Started",
  "Clients",
  "Projects",
  "Hours",
  "Expenses",
  "Invoices",
  "Insights",
  "Planning",
  "Settings"
] as const;

export type TutorialCategory = (typeof tutorialCategories)[number];
export type TutorialIcon =
  | "workflow"
  | "navigation"
  | "dashboard"
  | "clients"
  | "projects"
  | "hours"
  | "export"
  | "expenses"
  | "invoices"
  | "payments"
  | "insights"
  | "planner"
  | "settings"
  | "team";

export type TutorialStep = {
  title: string;
  body: string;
  points?: string[];
};

export type TutorialDemoFrame = {
  label: string;
  title: string;
  detail: string;
};

export type TutorialDefinition = {
  key: string;
  category: TutorialCategory;
  title: string;
  summary: string;
  purpose: string;
  whenToUse: string;
  outcome: string;
  durationMinutes: number;
  icon: TutorialIcon;
  keywords: string[];
  steps: TutorialStep[];
  demoFrames: TutorialDemoFrame[];
  actionHref: string;
  actionLabel: string;
  employersOnly?: boolean;
};

export const tutorials: TutorialDefinition[] = [
  {
    key: "workflow-overview",
    category: "Getting Started",
    title: "From first client to paid invoice",
    summary: "Learn the complete flow that keeps work, costs, invoices and payments connected.",
    purpose: "This is the mental model for the whole product. Every record should help work move from a job you accepted to money you can trace.",
    whenToUse: "Start here on your first day, or replay it whenever the relationship between projects, invoices and insights feels unclear.",
    outcome: "You will know what to create next and where each piece of information ends up.",
    durationMinutes: 4,
    icon: "workflow",
    keywords: ["introduction", "getting started", "lifecycle", "workflow", "paid"],
    steps: [
      { title: "Begin with the business", body: "Your Business Profile supplies the identity, payment terms, tax settings and bank details used throughout the app." },
      { title: "Connect clients and projects", body: "A client is who you work for. A project is the specific job where hours, costs, workers and invoices are collected." },
      { title: "Record work as it happens", body: "Log hours and expenses against the project. They remain visibly unbilled until you deliberately include them on an invoice." },
      { title: "Invoice, follow up and learn", body: "Create a draft, review the PDF, send it, track payment, then use Insights to understand workload and earnings." }
    ],
    demoFrames: [
      { label: "1", title: "Client", detail: "Save who you work for" },
      { label: "2", title: "Project", detail: "Keep the job history together" },
      { label: "3", title: "Work", detail: "Log hours and costs" },
      { label: "4", title: "Invoice", detail: "Review, send and get paid" }
    ],
    actionHref: "/clients/new",
    actionLabel: "Create a client"
  },
  {
    key: "navigation",
    category: "Getting Started",
    title: "Find your way around",
    summary: "Understand the main navigation, More menu and the quickest route to everyday actions.",
    purpose: "Navigation is organised around daily work first and less frequent business tools second, keeping the app useful on a phone without hiding deeper features.",
    whenToUse: "Use this after onboarding or whenever you are unsure where Hours, Expenses, Team, Settings or support tools live.",
    outcome: "You will move between everyday work and business administration without hunting through screens.",
    durationMinutes: 3,
    icon: "navigation",
    keywords: ["menu", "more", "navigation", "mobile", "tabs", "settings", "profile"],
    steps: [
      { title: "Use the main tabs", body: "Home, Clients, Projects and Invoices are the core workflow. More holds tools used less often, especially on mobile." },
      { title: "Start common work from Home", body: "Log Work, New Invoice and New Project are designed as shortcuts so routine work takes fewer taps." },
      { title: "Open More for business tools", body: "Hours Export, Expenses, Insights, Team, Business Profile, Settings, Tutorials and account tools live together there." },
      { title: "Use contextual help", body: "Learn how links open the exact tutorial for the page you are viewing. They never change your records." }
    ],
    demoFrames: [
      { label: "Home", title: "Today first", detail: "Work, money and actions" },
      { label: "Jobs", title: "Clients and projects", detail: "Your active work" },
      { label: "Money", title: "Invoices", detail: "Billing and payment status" },
      { label: "More", title: "Business tools", detail: "Insights, exports and settings" }
    ],
    actionHref: "/",
    actionLabel: "Open Home"
  },
  {
    key: "install-iphone",
    category: "Getting Started",
    title: "Install the app on iPhone",
    summary: "Add Trade Invoice Tracker to your Home Screen for quick, full-screen access.",
    purpose: "A Home Screen icon removes browser-tab friction and makes the tracker feel like an everyday work app without requiring an App Store download.",
    whenToUse: "Use this once on the iPhone or iPad where you normally record work. Replay it if you change devices or remove the icon.",
    outcome: "You will know exactly where to find Share, Add to Home Screen and the final Add confirmation.",
    durationMinutes: 2,
    icon: "navigation",
    keywords: ["iphone", "ipad", "install", "home screen", "pwa", "share", "safari"],
    steps: [
      { title: "Open the app in your iPhone browser", body: "Safari provides the most familiar installation path. Sign-in is optional before installing." },
      { title: "Tap Share", body: "Find the square with an upward arrow in the browser toolbar and open the Share menu." },
      { title: "Choose Add to Home Screen", body: "Scroll if needed, select Add to Home Screen, keep the app name and tap Add." },
      { title: "Launch from the new icon", body: "Open Trade Invoice Tracker from your Home Screen for a clean, full-screen app experience." }
    ],
    demoFrames: [
      { label: "Share", title: "Open the Share menu", detail: "Tap the square with the upward arrow" },
      { label: "+", title: "Add to Home Screen", detail: "Scroll to the installation action" },
      { label: "Add", title: "Confirm", detail: "Keep the name and tap Add" },
      { label: "App", title: "Launch", detail: "Use the new Home Screen icon" }
    ],
    actionHref: "/more?install=iphone",
    actionLabel: "Open visual install guide"
  },
  {
    key: "dashboard",
    category: "Getting Started",
    title: "Read your dashboard",
    summary: "See what is owed, what you worked and what still needs to be invoiced.",
    purpose: "Home is a daily decision screen, not a report. It should quickly answer what needs attention before you start another job.",
    whenToUse: "Check it at the start or end of the day and before preparing weekly invoices.",
    outcome: "You will spot overdue money, unbilled work and missing time entries faster.",
    durationMinutes: 3,
    icon: "dashboard",
    keywords: ["home", "dashboard", "outstanding", "unbilled", "week", "attention"],
    steps: [
      { title: "Read today’s position", body: "Outstanding is money awaiting payment. Ready to invoice is recorded work that is not yet attached to an invoice." },
      { title: "Check the current week", body: "Weekly hours and billable value come directly from time entries, including assigned team work where applicable." },
      { title: "Act on exceptions", body: "Overdue invoices and unbilled project values deserve attention. Open the related item rather than relying on the summary alone." },
      { title: "Treat estimates as guidance", body: "Tax and take-home figures help planning but are not accounting or tax advice." }
    ],
    demoFrames: [
      { label: "$", title: "Outstanding", detail: "Invoices awaiting payment" },
      { label: "h", title: "This week", detail: "Hours recorded so far" },
      { label: "+", title: "Ready to invoice", detail: "Work not yet billed" },
      { label: "!", title: "Attention", detail: "Follow up what is overdue" }
    ],
    actionHref: "/",
    actionLabel: "View dashboard"
  },
  {
    key: "creating-clients",
    category: "Clients",
    title: "Create your first client",
    summary: "Save the contact and billing identity used by projects and future invoices.",
    purpose: "Clients prevent contact details being retyped for every project and give jobs and invoices a consistent owner.",
    whenToUse: "Create a client before opening their first project. Use the actual person or business that will receive the invoice.",
    outcome: "You will have a reusable client record ready for projects and billing.",
    durationMinutes: 3,
    icon: "clients",
    keywords: ["client", "customer", "contact", "email", "abn", "address"],
    steps: [
      { title: "Open Clients and choose Add Client", body: "Business name is the primary label. Contact name identifies the person you communicate with." },
      { title: "Add useful contact details", body: "Email and phone drive invoice delivery. ABN and address help create complete business records." },
      { title: "Save the client", body: "Saving does not send anything. It simply makes the client available when creating a project." },
      { title: "Review before billing", body: "You can edit client details later. Sent and paid invoices retain their stored snapshots for audit history." }
    ],
    demoFrames: [
      { label: "1", title: "Business name", detail: "Who the work is for" },
      { label: "2", title: "Contact", detail: "Who receives updates" },
      { label: "3", title: "Billing details", detail: "Email, ABN and address" },
      { label: "✓", title: "Client saved", detail: "Ready for a project" }
    ],
    actionHref: "/clients/new",
    actionLabel: "Add a client"
  },
  {
    key: "managing-clients",
    category: "Clients",
    title: "Manage client records",
    summary: "Update client details and understand when deletion is deliberately restricted.",
    purpose: "A clean client register keeps future projects accurate while preserving invoice history that may need to be audited later.",
    whenToUse: "Use this when a contact, email, phone, ABN or address changes, or when reviewing all work for one client.",
    outcome: "You will update future work safely without rewriting historical invoices.",
    durationMinutes: 3,
    icon: "clients",
    keywords: ["edit client", "delete client", "client history", "update contact"],
    steps: [
      { title: "Open the client", body: "The detail view brings their projects and invoices together so you can understand the relationship before changing anything." },
      { title: "Edit future-facing details", body: "Updates affect the client record used by future projects and drafts. Historical sent or paid invoice snapshots remain intact." },
      { title: "Delete only setup records", body: "Deletion is limited when real project, billed or invoice history exists. This protects the financial trail." },
      { title: "Prefer preserving history", body: "Archive completed projects and retain the client when the relationship has real business records." }
    ],
    demoFrames: [
      { label: "View", title: "Open the relationship", detail: "Projects and invoices together" },
      { label: "Edit", title: "Update the contact", detail: "Future records use the change" },
      { label: "Lock", title: "Protect history", detail: "Sent invoices keep snapshots" }
    ],
    actionHref: "/clients",
    actionLabel: "Open clients"
  },
  {
    key: "creating-projects",
    category: "Projects",
    title: "Create a project",
    summary: "Connect a real job to its client and set the rate used to value your work.",
    purpose: "Projects are the centre of the app. They connect hours, expenses, assigned workers, invoice lines and payment history.",
    whenToUse: "Create one when a client gives you a distinct job that needs its own hours, costs or invoice trail.",
    outcome: "You will have a job ready for time, expenses, team assignments and invoices.",
    durationMinutes: 3,
    icon: "projects",
    keywords: ["project", "job", "rate", "client", "create job"],
    steps: [
      { title: "Choose the client", body: "The client controls who the project belongs to and who will appear on its invoices." },
      { title: "Name the job clearly", body: "Use a site, work order or recognisable job name. This appears throughout the app and on invoices." },
      { title: "Set the charge rate", body: "The hourly charge rate values new time entries. Rate history allows later changes without rewriting older work." },
      { title: "Save and start logging", body: "The project becomes active immediately and appears in Log Work selectors." }
    ],
    demoFrames: [
      { label: "1", title: "Select client", detail: "Connect the job" },
      { label: "2", title: "Name project", detail: "Make it recognisable" },
      { label: "$", title: "Set rate", detail: "Value future hours" },
      { label: "✓", title: "Active job", detail: "Ready for work logs" }
    ],
    actionHref: "/projects/new",
    actionLabel: "Create a project"
  },
  {
    key: "managing-projects",
    category: "Projects",
    title: "Run a project",
    summary: "Review unbilled work, activity colours, expenses, workers and linked invoices.",
    purpose: "The project page is the auditable job file. It should answer how much work happened, what remains unbilled and what can be invoiced now.",
    whenToUse: "Open it during a job to edit records and before invoicing to check that no work or expenses were missed.",
    outcome: "You will confidently review and close out a job without losing its history.",
    durationMinutes: 4,
    icon: "projects",
    keywords: ["project detail", "archive", "unbilled", "calendar", "job history"],
    steps: [
      { title: "Start with Unbilled Work", body: "Hours, labour value, expenses and total show exactly what is still available for a new invoice." },
      { title: "Use Monthly Activity", body: "Colour states distinguish unbilled, draft, sent and paid work. Move between months to find gaps." },
      { title: "Inspect the source records", body: "Hours, expenses and linked invoices remain separate and traceable even when they contribute to one invoice." },
      { title: "Archive completed jobs", body: "Archiving removes a job from active lists while retaining its financial and audit history." }
    ],
    demoFrames: [
      { label: "+", title: "Unbilled", detail: "Work ready to invoice" },
      { label: "◫", title: "Calendar", detail: "Find missed billing by colour" },
      { label: "↗", title: "Invoice", detail: "Trace source records" },
      { label: "□", title: "Archive", detail: "Keep completed history" }
    ],
    actionHref: "/projects",
    actionLabel: "Open projects"
  },
  {
    key: "logging-hours",
    category: "Hours",
    title: "Log hours accurately",
    summary: "Record a shift with the right project, worker, time method, breaks and notes.",
    purpose: "Time entries create the labour value used by projects, invoices, exports, team wages and insights.",
    whenToUse: "Log work daily while details are fresh. Workers can log against projects assigned by an employer from the same Home workflow.",
    outcome: "You will create complete time entries that flow cleanly into billing and reporting.",
    durationMinutes: 4,
    icon: "hours",
    keywords: ["log hours", "time", "shift", "break", "worker", "notes"],
    steps: [
      { title: "Choose the project", body: "The selector includes your active projects and active projects assigned to you by an employer." },
      { title: "Choose how to enter time", body: "Use total hours when you know the final duration, or start/end times when the shift details matter." },
      { title: "Account for breaks", body: "Where available, enter unpaid breaks so billable and payable time reflects the actual work performed." },
      { title: "Add useful notes", body: "Record work completed, site context or exceptions. Notes can appear in exports and help resolve later questions." }
    ],
    demoFrames: [
      { label: "Job", title: "Choose project", detail: "Your own or assigned work" },
      { label: "8h", title: "Enter time", detail: "Total or start/end" },
      { label: "−", title: "Apply break", detail: "Keep duration accurate" },
      { label: "✓", title: "Save entry", detail: "Project totals update" }
    ],
    actionHref: "/",
    actionLabel: "Open Log Work"
  },
  {
    key: "editing-hours",
    category: "Hours",
    title: "Edit or remove hours",
    summary: "Correct an unbilled time entry without breaking invoice history.",
    purpose: "Mistakes should be fixable before billing while billed records remain protected for traceability.",
    whenToUse: "Use this when the date, duration, notes or project context was entered incorrectly.",
    outcome: "You will know what can be changed and why billed entries are restricted.",
    durationMinutes: 3,
    icon: "hours",
    keywords: ["edit hours", "delete hours", "remove entry", "correct time"],
    steps: [
      { title: "Open the project", body: "Logged Hours lists each shift with duration, value, notes and billing state." },
      { title: "Choose Edit", body: "Correct the date, hours or notes while the entry remains unbilled." },
      { title: "Delete carefully", body: "Deletion requires confirmation and is intended for genuine mistakes, not hiding completed work." },
      { title: "Respect billed history", body: "Once an entry belongs to an invoice, adjust the invoice workflow rather than silently rewriting its source." }
    ],
    demoFrames: [
      { label: "Entry", title: "Find the shift", detail: "Check its billing state" },
      { label: "Edit", title: "Correct details", detail: "Before it is billed" },
      { label: "Bin", title: "Confirm removal", detail: "Only for genuine mistakes" }
    ],
    actionHref: "/projects",
    actionLabel: "Open a project"
  },
  {
    key: "exporting-hours",
    category: "Hours",
    title: "Export hours",
    summary: "Build a clean date-range report for payroll, clients, accountants or project records.",
    purpose: "Hours Export turns detailed time entries into a readable report without changing or invoicing them.",
    whenToUse: "Use it for weekly payroll checks, client evidence, accountant requests or a project progress summary.",
    outcome: "You will produce the right report for a specific project and period.",
    durationMinutes: 3,
    icon: "export",
    keywords: ["hours export", "payroll", "accountant", "report", "date range", "copy"],
    steps: [
      { title: "Choose a project and dates", body: "Use a weekly period for payroll or a custom range for client and project reporting." },
      { title: "Review every included entry", body: "Hours and indented notes come from the saved time records for that range." },
      { title: "Copy or share the report", body: "Use the generated text in email, messages or another record system as needed." },
      { title: "Remember what export does not do", body: "Exporting does not mark work invoiced, paid or approved. It is a reporting action only." }
    ],
    demoFrames: [
      { label: "Job", title: "Select project", detail: "Choose the report scope" },
      { label: "Date", title: "Set the range", detail: "Week or custom period" },
      { label: "Text", title: "Review report", detail: "Hours with indented notes" },
      { label: "Copy", title: "Use it elsewhere", detail: "Payroll or client reporting" }
    ],
    actionHref: "/hours-export",
    actionLabel: "Open Hours Export"
  },
  {
    key: "recording-expenses",
    category: "Expenses",
    title: "Record expenses and receipts",
    summary: "Capture what you paid, calculate GST and connect costs to the right project.",
    purpose: "Expenses preserve the real cost of doing business and can contribute to project billing, tax planning and wage records.",
    whenToUse: "Record materials, tools, travel and other work costs soon after payment while the receipt and context are available.",
    outcome: "You will create a complete cost record and know how it affects projects and tax estimates.",
    durationMinutes: 4,
    icon: "expenses",
    keywords: ["expense", "receipt", "gst", "materials", "cost", "reimbursable", "billable"],
    steps: [
      { title: "Record the amount paid", body: "Enter the total you actually paid. GST is calculated when applicable rather than being a second manual total." },
      { title: "Choose a useful category", body: "Categories help organise Insights and accountant review. Use the description for the specific purchase." },
      { title: "Link the project when relevant", body: "Project allocation keeps the cost visible in that job. General business costs can remain unallocated." },
      { title: "Keep the evidence", body: "Use receipt/reference and notes to identify the source document. Edit mistakes or archive records you no longer want in active totals." }
    ],
    demoFrames: [
      { label: "$", title: "Amount paid", detail: "Use the receipt total" },
      { label: "GST", title: "Tax calculated", detail: "Based on your setup" },
      { label: "Job", title: "Allocate project", detail: "Connect cost to work" },
      { label: "Ref", title: "Keep evidence", detail: "Receipt and notes" }
    ],
    actionHref: "/expenses",
    actionLabel: "Open Expenses"
  },
  {
    key: "creating-invoices",
    category: "Invoices",
    title: "Create and review an invoice",
    summary: "Collect unbilled hours and expenses, check the totals and produce the client PDF.",
    purpose: "Invoice creation turns selected source records into a dated financial document while keeping each hour and cost traceable.",
    whenToUse: "Invoice at the end of an agreed period or project stage after checking the project’s unbilled work.",
    outcome: "You will create a correct draft without accidentally sending it to the client.",
    durationMinutes: 5,
    icon: "invoices",
    keywords: ["create invoice", "draft", "line items", "gst", "pdf", "unbilled"],
    steps: [
      { title: "Choose project and date range", body: "The review finds eligible unbilled hours and expenses within the selected period." },
      { title: "Check who performed the work", body: "Your labour and employee labour remain separate invoice lines so the source and wage trail are auditable." },
      { title: "Review totals and GST", body: "Confirm labour, expenses, subtotal, GST and total against the project before saving." },
      { title: "Save a draft and inspect the PDF", body: "A draft is private. Generate the PDF and verify the client, dates, payment details and line descriptions before delivery." }
    ],
    demoFrames: [
      { label: "Date", title: "Choose range", detail: "Find eligible work" },
      { label: "+", title: "Import sources", detail: "Hours and expenses" },
      { label: "GST", title: "Check totals", detail: "No hidden zero lines" },
      { label: "PDF", title: "Review draft", detail: "Nothing sent yet" }
    ],
    actionHref: "/invoices/new",
    actionLabel: "Create an invoice"
  },
  {
    key: "sending-invoices",
    category: "Invoices",
    title: "Send an invoice safely",
    summary: "Preview the recipient and message, attach the generated PDF and keep delivery evidence.",
    purpose: "Delivery should be deliberate: the right client, the right document and an honest record of what the provider accepted.",
    whenToUse: "Use it only after reviewing the PDF and confirming the client email or phone number.",
    outcome: "You will understand the confirmation step, delivery copy and public invoice link.",
    durationMinutes: 4,
    icon: "invoices",
    keywords: ["send invoice", "email", "sms", "attachment", "delivery", "public link", "copy"],
    steps: [
      { title: "Review before sending", body: "Confirm the recipient, subject, message and invoice summary. The preview exists to prevent accidental delivery." },
      { title: "Choose email or SMS", body: "Email sends the PDF attachment through the configured delivery service. SMS provides a secure public invoice link." },
      { title: "Keep a confirmation copy", body: "When configured, the sender receives a copy. The app stores an audit event and provider reference where available." },
      { title: "Understand delivery evidence", body: "Provider acceptance is not proof the client read the message. Follow up outstanding invoices when needed." }
    ],
    demoFrames: [
      { label: "Eye", title: "Preview", detail: "Recipient, message and PDF" },
      { label: "✓", title: "Confirm", detail: "Deliberate send action" },
      { label: "Mail", title: "Deliver", detail: "PDF attached by provider" },
      { label: "Log", title: "Audit", detail: "Reference and confirmation copy" }
    ],
    actionHref: "/invoices",
    actionLabel: "Open invoices"
  },
  {
    key: "tracking-payments",
    category: "Invoices",
    title: "Track invoice payment",
    summary: "Understand draft, sent, overdue, paid and void states, including how to move backward safely.",
    purpose: "Statuses keep dashboard totals and follow-up work accurate. They describe your knowledge of the invoice, not the client’s bank account automatically.",
    whenToUse: "Update status after delivery, after confirmed payment, or when correcting an earlier status choice.",
    outcome: "You will keep outstanding totals accurate and preserve an auditable status trail.",
    durationMinutes: 4,
    icon: "payments",
    keywords: ["payment", "paid", "unpaid", "sent", "unsent", "overdue", "void"],
    steps: [
      { title: "Draft means not issued", body: "Draft invoices can be reviewed and adjusted. They are not included as money awaiting client payment." },
      { title: "Sent begins follow-up", body: "Sent invoices appear as outstanding. Passing the due date makes them overdue until payment is recorded." },
      { title: "Paid closes the balance", body: "Mark paid only after verifying the payment. Paid totals feed income and Insights." },
      { title: "Correct mistakes transparently", body: "Mark unpaid or unsent to return to an earlier state. Void invalid invoices rather than deleting financial history." }
    ],
    demoFrames: [
      { label: "Draft", title: "Review", detail: "Not yet outstanding" },
      { label: "Sent", title: "Await payment", detail: "Due-date tracking begins" },
      { label: "Late", title: "Overdue", detail: "Needs follow-up" },
      { label: "Paid", title: "Complete", detail: "Income totals update" }
    ],
    actionHref: "/invoices",
    actionLabel: "Review invoice statuses"
  },
  {
    key: "understanding-insights",
    category: "Insights",
    title: "Turn records into business insight",
    summary: "Understand where each metric comes from and how to use it without mistaking estimates for advice.",
    purpose: "Insights turns everyday records into workload, revenue, cost and trend signals that can improve pricing and planning decisions.",
    whenToUse: "Review it weekly or monthly after hours, invoices, payments and expenses are up to date.",
    outcome: "You will distinguish earned, billed, paid and estimated figures and make better-informed decisions.",
    durationMinutes: 5,
    icon: "insights",
    keywords: ["insights", "analytics", "reports", "trends", "revenue", "tax", "ytd"],
    steps: [
      { title: "Know the source", body: "Workload comes from time entries, revenue from invoices and payment status, expenses from the register, and wages from employee payment records." },
      { title: "Separate billable from paid", body: "Billable value estimates what recorded work is worth. Paid income only includes invoices marked paid." },
      { title: "Read trends, not isolated numbers", body: "Compare current periods with rolling or prior periods to spot workload and pricing changes." },
      { title: "Use planning estimates carefully", body: "Tax, GST, super and take-home figures support cash planning but do not replace an accountant or official advice." }
    ],
    demoFrames: [
      { label: "h", title: "Workload", detail: "From logged time" },
      { label: "$", title: "Revenue", detail: "From invoice states" },
      { label: "−", title: "Costs", detail: "Expenses and wages" },
      { label: "↗", title: "Trend", detail: "Use periods for decisions" }
    ],
    actionHref: "/insights",
    actionLabel: "Open Insights"
  },
  {
    key: "weekly-planner",
    category: "Planning",
    title: "Use the weekly planner",
    summary: "Read each day’s hours, value and projects to find gaps and manage workload.",
    purpose: "The planner is a compact review of what actually happened this week, helping you find missing time and overloaded days.",
    whenToUse: "Check it at the end of each day and during your weekly billing review.",
    outcome: "You will identify incomplete days and understand the week’s total workload and value.",
    durationMinutes: 3,
    icon: "planner",
    keywords: ["weekly planner", "calendar", "week", "schedule", "workload", "missing hours"],
    steps: [
      { title: "Start with the week totals", body: "Hours and billable value summarise all current-week time entries visible to your business." },
      { title: "Scan Monday to Sunday", body: "Each day shows logged time, billable value and project names. Today is highlighted for orientation." },
      { title: "Look for suspicious gaps", body: "A blank workday may be correct, a day off, or a missed entry. Open Log Work to fix omissions." },
      { title: "Use project context", body: "Multiple project chips help explain split days and support later invoicing checks." }
    ],
    demoFrames: [
      { label: "Mon", title: "8h logged", detail: "Project and value visible" },
      { label: "Tue", title: "No work", detail: "Check whether it is missing" },
      { label: "Today", title: "Current day", detail: "Subtle highlight" },
      { label: "Total", title: "Week summary", detail: "Hours and value together" }
    ],
    actionHref: "/",
    actionLabel: "View this week"
  },
  {
    key: "business-profile",
    category: "Settings",
    title: "Set up business and invoice identity",
    summary: "Control the sender, branding, payment details, defaults and tax settings used by invoices.",
    purpose: "The Business Profile is the source of truth for how your business appears to clients and how invoice defaults are prepared.",
    whenToUse: "Complete it before sending the first invoice and revisit it whenever bank, contact, tax or branding details change.",
    outcome: "You will know which settings are platform identity and which belong to your business.",
    durationMinutes: 4,
    icon: "settings",
    keywords: ["business profile", "settings", "branding", "bank", "email template", "gst", "logo"],
    steps: [
      { title: "Complete your legal and contact identity", body: "Trading name, legal details, ABN, contact name and address appear where relevant on invoices." },
      { title: "Add payment instructions", body: "Bank details and payment terms tell clients how and when to pay. Always verify them in the PDF." },
      { title: "Configure invoice communication", body: "Email wording and Reply-To belong to your business. Platform delivery uses a verified system sender to avoid spoofing." },
      { title: "Review tax and branding", body: "GST registration affects invoice calculations. Logo and theme settings affect presentation without changing financial records." }
    ],
    demoFrames: [
      { label: "ID", title: "Business identity", detail: "Name, ABN and contact" },
      { label: "Bank", title: "Payment details", detail: "How clients pay" },
      { label: "Mail", title: "Communication", detail: "Reply-To and wording" },
      { label: "PDF", title: "Review output", detail: "Verify before sending" }
    ],
    actionHref: "/business-profile",
    actionLabel: "Open Business Profile"
  },
  {
    key: "team-setup",
    category: "Settings",
    title: "Connect and pay your team",
    summary: "Invite a worker, assign projects, capture their hours and keep wages traceable.",
    purpose: "The team workflow lets workers use their own account while the employer retains project, charge-rate, invoice and wage control.",
    whenToUse: "Use it when a subcontractor or employee needs to log their own hours on projects you manage.",
    outcome: "You will understand linking, assignment, billing and wage-payment responsibilities end to end.",
    durationMinutes: 5,
    icon: "team",
    keywords: ["team", "employee", "subcontractor", "invite", "assignment", "wage", "pay rate"],
    employersOnly: true,
    steps: [
      { title: "Create a linking code", body: "The worker signs up with their own login and uses the code to connect. Do not share account passwords." },
      { title: "Assign the project and rates", body: "Set what you pay the worker and what you charge the client. The worker cannot edit your project setup." },
      { title: "Let hours flow automatically", body: "The assigned project appears in the worker’s Projects and Log Work screens. Their saved hours update your project without approval." },
      { title: "Bill and pay from one trail", body: "Employee labour appears separately on client invoices. Wage amounts stay visible until recorded paid, with reversals and audit history available." }
    ],
    demoFrames: [
      { label: "Code", title: "Link account", detail: "Worker keeps own login" },
      { label: "Job", title: "Assign project", detail: "Pay and charge rates" },
      { label: "h", title: "Worker logs time", detail: "Employer updates automatically" },
      { label: "$", title: "Bill and pay", detail: "Two traceable obligations" }
    ],
    actionHref: "/team",
    actionLabel: "Open Team"
  }
];

export function tutorialByKey(key: string) {
  return tutorials.find((tutorial) => tutorial.key === key);
}

export function clampTutorialStep(key: string | undefined, requestedStep: number) {
  const tutorial = key ? tutorialByKey(key) : undefined;
  if (!tutorial || !Number.isFinite(requestedStep)) return 0;

  return Math.max(0, Math.min(Math.trunc(requestedStep), tutorial.steps.length - 1));
}
