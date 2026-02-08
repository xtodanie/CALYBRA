export const en = {
  appName: 'Calybra',
  loading: 'Loading...',
  sidebar: {
    monthCloses: 'Month Closes',
    upload: 'Upload',
    matches: 'Matches',
    exceptions: 'Exceptions',
    exports: 'Exports',
    settings: 'Settings',
  },
  userNav: {
    profile: 'Profile',
    billing: 'Billing',
    settings: 'Settings',
    logOut: 'Log out',
    guestUser: 'Guest User',
    guestEmail: 'guest@example.com',
    language: 'Language',
    english: 'English',
    spanish: 'Spanish',
  },
  monthCloses: {
    title: 'Month Closes',
    description: 'Here are all your monthly closing periods. Start a new one or review an existing one.',
    cta: 'Close New Month',
    empty: {
      title: 'No Month Closes Yet',
      description: 'A "month close" is how you reconcile your bank transactions with your invoices for a specific period. Start by closing your first month to begin.',
    },
    table: {
      period: 'Period',
      status: 'Status',
      difference: 'Difference',
      exceptions: 'Open Exceptions',
    },
    status: {
      DRAFT: 'Draft',
      PROCESSING: 'Processing',
      READY: 'Ready for Review',
      LOCKED: 'Locked',
    }
  },
  monthClose: {
    title: 'Current Month',
    monthSelectorPlaceholder: 'Select a month',
    status: {
      NO_CLOSE: 'Not Started',
      DRAFT: 'Draft',
      PROCESSING: 'Processing',
      READY: 'Ready for Review',
      LOCKED: 'Locked',
    },
    kpi: {
      bankTotal: 'Bank Total',
      bankTotalDescription: 'From uploaded bank statement',
      invoiceTotal: 'Invoice Total',
      invoiceTotalDescription: 'From all uploaded invoices',
      difference: 'Difference',
      differenceDescription: 'The remaining amount to reconcile',
      exceptions: 'Exceptions',
      exceptionsOpen: 'Open',
      exceptionsHighSeverity: 'high severity',
    },
    workflow: {
      title: 'Your Reconciliation Workflow',
      steps: {
        uploadBankCsv: 'Upload Bank CSV',
        uploadInvoicePdfs: 'Upload Invoice PDFs',
        reviewMatches: 'Review Proposed Matches',
        resolveExceptions: 'Resolve Exceptions',
        lockAndExport: 'Lock & Export',
      },
    },
    nextAction: {
      title: "What's Next?",
      cta: {
        NO_CLOSE: 'Start a New Month',
        DRAFT: 'Upload Bank Statement',
        PROCESSING: 'Processing Data...',
        READY: 'Review Exceptions',
        LOCKED: 'Generate Export',
      },
      description: {
        NO_CLOSE: 'Start by creating a new closing period for the month.',
        DRAFT: "It's time to upload your bank statement to get started.",
        PROCESSING: "We're analyzing your data. This might take a few moments.",
        READY: 'Your proposed matches are ready. Time to resolve exceptions.',
        LOCKED: 'This month is all done. You can now export your reports.',
      },
      progress: '% complete',
    },
    sampleMonths: {
      june: 'June 2024',
      may: 'May 2024',
      april: 'April 2024',
    },
    context: {
      activeMonth: 'Active Month',
      viewOverview: 'View Month Overview',
    },
  },
  auth: {
    loginTitle: 'Welcome Back',
    loginDescription: 'Sign in to access your dashboard.',
    loginButton: 'Log In',
    signupTitle: 'Create an Account',
    signupDescription: 'Enter your details to start using Calybra.',
    signupButton: 'Sign Up',
    companyNameLabel: 'Company Name',
    companyNamePlaceholder: 'Your Company Inc.',
    emailLabel: 'Email',
    emailPlaceholder: 'name@company.com',
    passwordLabel: 'Password',
    passwordPlaceholder: '••••••••',
    alreadyHaveAccount: 'Already have an account?',
    dontHaveAccount: "Don't have an account?",
    validation: {
      email: 'Please enter a valid email.',
      password: 'Password must be at least 8 characters.',
    },
  },
  billing: {
    title: 'Billing',
    description: 'Manage your subscription and payment methods.',
  },
  upload: {
    title: 'Upload Data',
    description: 'Provide your bank statement and all supplier invoices for this period.',
    bankCsv: {
      title: '1. Upload Bank Statement',
      description: 'Upload the bank statement CSV for the selected period.',
      cta: 'Select CSV File',
      dropzone: 'Drag & drop CSV file here',
    },
    invoicePdfs: {
      title: '2. Upload Invoices',
      description: 'Upload all supplier invoice PDFs for the period. You can select multiple files.',
      tableTitle: 'Uploaded Invoices',
      tableDescription: 'Review the status of your uploaded invoices below.',
      cta: 'Select PDF Files',
      dropzone: 'Drag & drop PDF files here',
      table: {
        file: 'File',
        supplier: 'Supplier',
        invoiceNumber: 'Invoice #',
        date: 'Date',
        total: 'Total',
        confidence: 'Confidence',
        status: 'Status',
        actions: 'Actions',
      },
      confidenceLow: 'Low',
      statuses: {
        Parsed: 'Parsed',
        NeedsReview: 'Needs Review',
      },
      edit: 'Edit',
    },
    processing: {
      title: '3. Processing',
      description: 'We are processing your files. You can leave this page and come back later.',
      jobStatuses: {
        PENDING: 'Pending',
        RUNNING: 'Running',
        COMPLETED: 'Completed',
        FAILED: 'Failed',
      },
    }
  },
  matches: {
    title: 'Matches',
    description: 'Review proposed matches between bank transactions and invoices. Confirming helps us learn.',
    tabs: {
      proposed: 'Proposed',
      confirmed: 'Confirmed',
    },
    table: {
      score: 'Score',
      explanation: 'Explanation',
      bankTransaction: 'Bank Transaction',
      invoice: 'Invoice(s)',
      actions: 'Actions',
    },
    empty: {
        proposed: 'No proposed matches to review.',
        confirmed: 'No matches have been confirmed yet.',
    },
    confirm: 'Confirm',
    reject: 'Reject',
    confirmed: 'Confirmed',
    explanations: {
        amountAndName: 'Amount and supplier name match.',
        amountAndDate: 'Amount matches, date is close, supplier alias recognized.',
        manualConfirmation: 'Manually confirmed by user.',
    }
  },
  exceptions: {
    title: 'Exceptions',
    description: 'Resolve items that could not be matched automatically.',
    groupBy: 'Group by',
    groups: {
      type: 'Type',
      severity: 'Severity',
    },
    table: {
      issue: 'Issue',
      severity: 'Severity',
      details: 'Details',
      suggestion: 'Suggested Action',
      actions: 'Actions',
    },
    severities: {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    },
    types: {
      MISSING_INVOICE: 'Missing Invoice',
      AMOUNT_MISMATCH: 'Amount Mismatch',
      UNKNOWN_SUPPLIER: 'Unknown Supplier',
      DUPLICATE_INVOICE: 'Duplicate Invoice',
    },
    details: {
      MISSING_INVOICE: 'Bank transaction "{description}" for {amount} has no matching invoice.',
      AMOUNT_MISMATCH: 'Bank tx: {bankAmount}. Invoice #{invoiceNumber}: {invoiceAmount}. Difference: {difference}.',
      UNKNOWN_SUPPLIER: 'Bank transaction "{description}" for {amount} is not a known supplier.',
      DUPLICATE_INVOICE: 'Invoice #{invoiceNumber} from "{supplier}" appears twice.',
    },
    suggestions: {
      MISSING_INVOICE: 'Upload invoice or mark as other expense.',
      AMOUNT_MISMATCH: 'Check for bank fees or partial payment.',
      UNKNOWN_SUPPLIER: 'Assign a supplier to this transaction.',
      DUPLICATE_INVOICE: 'Verify payment and remove one invoice.',
    },
    resolve: 'Resolve',
    resolveActions: {
      MISSING_INVOICE: {
        upload: 'Upload Invoice',
        ignore: 'Ignore (Other Expense)',
      },
      AMOUNT_MISMATCH: {
        markAsFee: 'Mark Difference as Fee',
        ignore: 'Accept Mismatch',
      },
      UNKNOWN_SUPPLIER: {
        assign: 'Assign Supplier',
      },
      DUPLICATE_INVOICE: {
        remove: 'Remove Duplicate',
      },
      generic: {
        manualMatch: 'Manual Match',
        ignore: 'Ignore',
      }
    },
  },
  exports: {
    title: 'Exports',
    description: 'Once a month is locked, you can generate and download your reconciliation reports for your accountant.',
    cta: 'Generate Export',
    generating: 'Generating export...',
    empty: 'No exports generated for this month yet.',
    table: {
      file: 'File',
      generated: 'Generated',
      actions: 'Actions',
    },
    download: 'Download',
    lockedOnly: {
        title: 'Month Not Locked',
        description: 'You can only generate exports for locked months. Please review and lock the month to proceed.',
        cta: 'Lock Month',
    }
  },
  settings: {
    title: 'Settings',
    description: 'Manage your account and application settings.',
    tenant: {
      title: 'Business Settings',
      name: 'Business Name',
      timezone: 'Timezone',
      currency: 'Default Currency',
      save: 'Save Changes',
    },
    user: {
      title: 'Your Profile',
      language: 'Language',
      role: 'Your Role',
    }
  },
  profile: {
    title: 'Profile',
    description: 'Update your personal information.',
  },
} as const;
