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
  roles: {
    OWNER: 'Owner',
    MANAGER: 'Manager',
    ACCOUNTANT: 'Accountant',
    VIEWER: 'Viewer',
  },
  userNav: {
    profile: 'Profile',
    billing: 'Billing',
    settings: 'Settings',
    logOut: 'Log out',
    language: 'Language',
    english: 'English',
    spanish: 'Spanish',
  },
  jobs: {
    steps: {
      queued: 'Queued',
      downloading: 'Downloading...',
      preparing: 'Preparing...',
      finalizing: 'Finalizing...',
      completed: 'Completed',
    },
    statuses: {
      PENDING: 'Pending',
      RUNNING: 'Running',
      COMPLETED: 'Completed',
      FAILED: 'Failed',
    },
    types: {
      PARSE_BANK_CSV: 'Parse Bank CSV',
      PARSE_INVOICE_PDF: 'Parse Invoice PDF',
    },
    errors: {
      GENERIC: 'An unexpected error occurred processing the file.',
    },
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
      actions: 'Actions'
    },
    status: {
      DRAFT: 'Draft',
      IN_REVIEW: 'In Review',
      FINALIZED: 'Finalized',
    },
    setActive: 'Set active',
    active: 'Active',
    create: {
      title: 'Close a New Month',
      description: 'Select the start and end date for the period you want to close. This is usually the first and last day of a calendar month.',
      periodStart: 'Period Start',
      periodEnd: 'Period End',
      cta: 'Create Closing Period',
      success: 'Month close created successfully.',
      error: 'Failed to create month close.',
    },
  },
  monthClose: {
    title: 'Current Month',
    monthSelectorPlaceholder: 'Select a month',
    status: {
      NO_CLOSE: 'Not Started',
      DRAFT: 'Draft',
      IN_REVIEW: 'In Review',
      FINALIZED: 'Finalized',
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
        IN_REVIEW: 'Review Exceptions',
        FINALIZED: 'Generate Export',
      },
      description: {
        NO_CLOSE: 'Start by creating a new closing period for the month.',
        DRAFT: "It's time to upload your bank statement to get started.",
        IN_REVIEW: 'Your proposed matches are ready. Time to resolve exceptions.',
        FINALIZED: 'This month is all done. You can now export your reports.',
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
      noActiveMonth: {
        title: 'No Active Month',
        description: 'You must select an active month to work on. Please go to the Month Closes page to select or create a new closing period.',
        cta: 'Select a Month',
      },
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
      companyName: 'Please enter a company name.',
    },
    errors: {
      title: 'Authentication Error',
      default: 'An unexpected error occurred. Please try again.',
      emailInUse: 'This email is already associated with an account.',
      invalidCredentials: 'Invalid email or password. Please try again.',
    },
    provisioning: {
      title: 'Account Provisioning in Progress',
      description: 'Your account is being set up on our servers. This usually takes less than 20 seconds. This page will update automatically.',
      retry: 'Checking Status...',
      logout: 'Log Out',
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
    },
    processing: {
      title: '3. Processing Jobs',
      description: 'We are processing your files. You can monitor the progress below.',
      empty: 'No jobs are currently running for this month.',
    },
    uploadedFiles: {
      title: 'Uploaded Files',
      description: 'These files have been uploaded for the current month and are waiting to be processed.',
      empty: 'No files uploaded for this month yet.',
      table: {
        filename: 'Filename',
        kind: 'Type',
        uploadedAt: 'Uploaded At',
        status: 'Status',
        actions: 'Actions',
      },
      kinds: {
        BANK_CSV: 'Bank Statement',
        INVOICE_PDF: 'Invoice',
        EXPORT: 'Export',
      },
      statuses: {
        PENDING: 'Pending',
        PARSED: 'Processed',
        FAILED: 'Failed',
      }
    },
    notifications: {
      successTitle: 'Upload Successful',
      successDescription: '{count} file(s) have been uploaded and processing jobs have been created.',
      errorTitle: 'Upload Failed',
      downloadErrorTitle: 'Download Failed',
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
    description: 'Once a month is finalized, you can generate and download your reconciliation reports for your accountant.',
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
      title: 'Month Not Finalized',
      description: 'You can only generate exports for finalized months. Please review and finalize the month to proceed.',
      cta: 'Finalize Month',
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
