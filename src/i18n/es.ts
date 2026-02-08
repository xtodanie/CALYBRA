import { Dict } from './types';

export const es: Dict = {
  appName: 'Calybra',
  loading: 'Cargando...',
  sidebar: {
    monthCloses: 'Cierres Mensuales',
    upload: 'Subir',
    matches: 'Coincidencias',
    exceptions: 'Excepciones',
    exports: 'Exportaciones',
    settings: 'Configuración',
  },
  userNav: {
    profile: 'Perfil',
    billing: 'Facturación',
    settings: 'Configuración',
    logOut: 'Cerrar sesión',
    guestUser: 'Usuario Invitado',
    guestEmail: 'invitado@ejemplo.com',
    language: 'Idioma',
    english: 'Inglés',
    spanish: 'Español',
  },
  monthCloses: {
    title: 'Cierres Mensuales',
    description: 'Aquí están todos tus períodos de cierre mensuales. Inicia uno nuevo o revisa uno existente.',
    cta: 'Cerrar Nuevo Mes',
    empty: {
      title: 'Aún no hay Cierres Mensuales',
      description: 'Un "cierre de mes" es cómo concilias tus transacciones bancarias con tus facturas para un período específico. Comienza cerrando tu primer mes para empezar.',
    },
    table: {
      period: 'Período',
      status: 'Estado',
      difference: 'Diferencia',
      exceptions: 'Excepciones Abiertas',
    },
    status: {
      DRAFT: 'Borrador',
      PROCESSING: 'Procesando',
      READY: 'Listo para Revisar',
      LOCKED: 'Bloqueado',
    }
  },
  monthClose: {
    title: 'Mes Actual',
    monthSelectorPlaceholder: 'Selecciona un mes',
    status: {
      NO_CLOSE: 'No Iniciado',
      DRAFT: 'Borrador',
      PROCESSING: 'Procesando',
      READY: 'Listo para Revisar',
      LOCKED: 'Bloqueado',
    },
    kpi: {
      bankTotal: 'Total Banco',
      bankTotalDescription: 'Del extracto bancario subido',
      invoiceTotal: 'Total Facturas',
      invoiceTotalDescription: 'De todas las facturas subidas',
      difference: 'Diferencia',
      differenceDescription: 'La cantidad restante por conciliar',
      exceptions: 'Excepciones',
      exceptionsOpen: 'Abiertas',
      exceptionsHighSeverity: 'alta severidad',
    },
    workflow: {
      title: 'Tu Flujo de Conciliación',
      steps: {
        uploadBankCsv: 'Subir CSV del Banco',
        uploadInvoicePdfs: 'Subir PDFs de Facturas',
        reviewMatches: 'Revisar Coincidencias Propuestas',
        resolveExceptions: 'Resolver Excepciones',
        lockAndExport: 'Bloquear y Exportar',
      },
    },
    nextAction: {
      title: '¿Qué sigue?',
      cta: {
        NO_CLOSE: 'Iniciar un Nuevo Mes',
        DRAFT: 'Subir Extracto Bancario',
        PROCESSING: 'Procesando Datos...',
        READY: 'Revisar Excepciones',
        LOCKED: 'Generar Exportación',
      },
      description: {
        NO_CLOSE: 'Comienza creando un nuevo período de cierre para el mes.',
        DRAFT: 'Es hora de subir tu extracto bancario para empezar.',
        PROCESSING: 'Estamos analizando tus datos. Esto podría tardar unos momentos.',
        READY: 'Tus coincidencias propuestas están listas. Hora de resolver excepciones.',
        LOCKED: 'Este mes está listo. Ahora puedes exportar tus informes.',
      },
      progress: '% completado',
    },
    sampleMonths: {
      june: 'Junio 2024',
      may: 'Mayo 2024',
      april: 'Abril 2024',
    },
    context: {
        activeMonth: 'Mes Activo',
        viewOverview: 'Ver Resumen del Mes',
    },
  },
  auth: {
    loginTitle: 'Bienvenido de Nuevo',
    loginDescription: 'Inicia sesión para acceder a tu panel.',
    loginButton: 'Iniciar Sesión',
    signupTitle: 'Crear una Cuenta',
    signupDescription: 'Ingresa tus datos para empezar a usar Calybra.',
    signupButton: 'Registrarse',
    companyNameLabel: 'Nombre de la Empresa',
    companyNamePlaceholder: 'Tu Empresa S.A.',
    emailLabel: 'Correo Electrónico',
    emailPlaceholder: 'nombre@empresa.com',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: '••••••••',
    alreadyHaveAccount: '¿Ya tienes una cuenta?',
    dontHaveAccount: '¿No tienes una cuenta?',
    validation: {
      email: 'Por favor, introduce un correo electrónico válido.',
      password: 'La contraseña debe tener al menos 8 caracteres.',
    },
  },
  billing: {
    title: 'Facturación',
    description: 'Gestiona tu suscripción y métodos de pago.',
  },
  upload: {
    title: 'Subir Datos',
    description: 'Sube tu extracto bancario y todas las facturas de proveedores para este período.',
    bankCsv: {
      title: '1. Subir Extracto Bancario',
      description: 'Sube el extracto bancario en formato CSV para el período seleccionado.',
      cta: 'Seleccionar Archivo CSV',
      dropzone: 'Arrastra y suelta el archivo CSV aquí',
    },
    invoicePdfs: {
      title: '2. Subir Facturas',
      description: 'Sube todas las facturas de proveedores en formato PDF para el período. Puedes seleccionar múltiples archivos.',
      tableTitle: 'Facturas Subidas',
      tableDescription: 'Revisa el estado de tus facturas subidas a continuación.',
      cta: 'Seleccionar Archivos PDF',
      dropzone: 'Arrastra y suelta los archivos PDF aquí',
      table: {
        file: 'Archivo',
        supplier: 'Proveedor',
        invoiceNumber: 'Nº Factura',
        date: 'Fecha',
        total: 'Total',
        confidence: 'Confianza',
        status: 'Estado',
        actions: 'Acciones',
      },
      confidenceLow: 'Baja',
      statuses: {
        Parsed: 'Procesada',
        NeedsReview: 'Necesita Revisión',
      },
      edit: 'Editar',
    },
    processing: {
      title: '3. Procesamiento',
      description: 'Estamos procesando tus archivos. Puedes salir de esta página y volver más tarde.',
      jobStatuses: {
        PENDING: 'Pendiente',
        RUNNING: 'En curso',
        COMPLETED: 'Completado',
        FAILED: 'Fallido',
      },
    }
  },
  matches: {
    title: 'Coincidencias',
    description: 'Revisa las coincidencias propuestas entre transacciones bancarias y facturas. Confirmar nos ayuda a aprender.',
    tabs: {
      proposed: 'Propuestas',
      confirmed: 'Confirmadas',
    },
    table: {
      score: 'Puntaje',
      explanation: 'Explicación',
      bankTransaction: 'Transacción Bancaria',
      invoice: 'Factura(s)',
      actions: 'Acciones',
    },
    empty: {
        proposed: 'No hay coincidencias propuestas para revisar.',
        confirmed: 'Aún no se han confirmado coincidencias.',
    },
    confirm: 'Confirmar',
    reject: 'Rechazar',
    confirmed: 'Confirmada',
    explanations: {
        amountAndName: 'El importe y el nombre del proveedor coinciden.',
        amountAndDate: 'El importe coincide, la fecha es cercana, se reconoció un alias del proveedor.',
        manualConfirmation: 'Confirmado manualmente por el usuario.',
    }
  },
  exceptions: {
    title: 'Excepciones',
    description: 'Resuelve los elementos que no pudieron ser conciliados automáticamente.',
    groupBy: 'Agrupar por',
    groups: {
      type: 'Tipo',
      severity: 'Severidad',
    },
    table: {
      issue: 'Problema',
      severity: 'Severidad',
      details: 'Detalles',
      suggestion: 'Acción Sugerida',
      actions: 'Acciones',
    },
    severities: {
      high: 'Alta',
      medium: 'Media',
      low: 'Baja',
    },
    types: {
      MISSING_INVOICE: 'Falta Factura',
      AMOUNT_MISMATCH: 'Descuadre de Importe',
      UNKNOWN_SUPPLIER: 'Proveedor Desconocido',
      DUPLICATE_INVOICE: 'Factura Duplicada',
    },
    details: {
      MISSING_INVOICE: 'La transacción bancaria "{description}" por {amount} no tiene factura correspondiente.',
      AMOUNT_MISMATCH: 'Tx. banco: {bankAmount}. Factura #{invoiceNumber}: {invoiceAmount}. Diferencia: {difference}.',
      UNKNOWN_SUPPLIER: 'La transacción bancaria "{description}" por {amount} no es de un proveedor conocido.',
      DUPLICATE_INVOICE: 'La factura #{invoiceNumber} de "{supplier}" aparece dos veces.',
    },
    suggestions: {
      MISSING_INVOICE: 'Sube la factura o márcala como otro gasto.',
      AMOUNT_MISMATCH: 'Comprueba si hay comisiones bancarias o un pago parcial.',
      UNKNOWN_SUPPLIER: 'Asigna un proveedor a esta transacción.',
      DUPLICATE_INVOICE: 'Verifica el pago y elimina una de las facturas.',
    },
    resolve: 'Resolver',
    resolveActions: {
      MISSING_INVOICE: {
        upload: 'Subir Factura',
        ignore: 'Ignorar (Otro Gasto)',
      },
      AMOUNT_MISMATCH: {
        markAsFee: 'Marcar Diferencia como Comisión',
        ignore: 'Aceptar Descuadre',
      },
      UNKNOWN_SUPPLIER: {
        assign: 'Asignar Proveedor',
      },
      DUPLICATE_INVOICE: {
        remove: 'Eliminar Duplicado',
      },
      generic: {
        manualMatch: 'Conciliar Manualmente',
        ignore: 'Ignorar',
      }
    },
  },
  exports: {
    title: 'Exportaciones',
    description: 'Una vez que un mes está bloqueado, puedes generar y descargar tus informes de conciliación para tu gestoría.',
    cta: 'Generar Exportación',
    generating: 'Generando exportación...',
    empty: 'Aún no se han generado exportaciones para este mes.',
    table: {
      file: 'Archivo',
      generated: 'Generado',
      actions: 'Acciones',
    },
    download: 'Descargar',
    lockedOnly: {
        title: 'Mes No Bloqueado',
        description: 'Solo puedes generar exportaciones para meses bloqueados. Por favor, revisa y bloquea el mes para continuar.',
        cta: 'Bloquear Mes',
    }
  },
  settings: {
    title: 'Configuración',
    description: 'Gestiona tu cuenta y la configuración de la aplicación.',
    tenant: {
      title: 'Configuración del Negocio',
      name: 'Nombre del Negocio',
      timezone: 'Zona Horaria',
      currency: 'Moneda por Defecto',
      save: 'Guardar Cambios',
    },
    user: {
      title: 'Tu Perfil',
      language: 'Idioma',
      role: 'Tu Rol',
    }
  },
  profile: {
    title: 'Perfil',
    description: 'Actualiza tu información personal.',
  },
};
