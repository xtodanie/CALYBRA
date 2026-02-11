'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/provider';
import {
  DashboardNav,
  BankVsInvoicesCard,
  SuppliersCard,
  PendingItemsCard,
  ReconciliationToast,
} from '@/components/dashboard';

// Sample data for demonstration - replace with actual data fetching
const SAMPLE_SUPPLIERS = [
  { name: 'Coca-Cola', amount: 1230, trend: 12 },
  { name: 'PepsiCo', amount: 980, trend: -5 },
  { name: 'Nestlé', amount: 2150, trend: 8 },
  { name: 'Danone', amount: 875, trend: 0 },
  { name: 'Unilever', amount: 1560, trend: 15 },
];

export default function DashboardPage() {
  const t = useT();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('summary');
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dashboard data state
  const [dashboardData] = useState({
    totalInvoices: 42580,
    totalBank: 41900,
    pendingCount: 2,
    status: 'pending' as 'pending' | 'reconciled' | 'critical',
    suppliers: SAMPLE_SUPPLIERS,
    pendingItems: [
      { type: 'unpaid_invoices' as const, count: 3, critical: false },
      { type: 'payment_without_invoice' as const, count: 1, critical: true },
    ],
  });

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Demo: Show toast after 3 seconds (remove in production)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowToast(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Navigate to relevant pages based on tab
    if (tab === 'reconciled') {
      router.push('/matches');
    } else if (tab === 'pending') {
      router.push('/exceptions');
    } else if (tab === 'download') {
      router.push('/exports');
    } else if (tab === 'business') {
      router.push('/settings');
    }
  };

  const handlePendingItemClick = (type: string) => {
    if (type === 'unpaid_invoices') {
      router.push('/invoices');
    } else {
      router.push('/exceptions');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navigation Tabs */}
      <DashboardNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Main Content */}
      <div className="flex-1 space-y-6 p-6 md:p-8 lg:p-10">
        {/* Page Title */}
        <div className="mb-2">
          <h1 className="text-h1 font-semibold tracking-tight text-foreground">
            {t.dashboard.nav.summary}
          </h1>
        </div>

        {/* Bank vs Invoices Section */}
        <section>
          <BankVsInvoicesCard
            totalInvoices={dashboardData.totalInvoices}
            totalBank={dashboardData.totalBank}
            pendingCount={dashboardData.pendingCount}
            status={dashboardData.status}
          />
        </section>

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Suppliers Section */}
          <section>
            <SuppliersCard
              suppliers={dashboardData.suppliers}
              isLoading={isLoading}
            />
          </section>

          {/* Pending Items Section */}
          <section>
            <PendingItemsCard
              items={dashboardData.pendingItems}
              onItemClick={handlePendingItemClick}
            />
          </section>
        </div>
      </div>

      {/* Toast Notification */}
      <ReconciliationToast
        show={showToast}
        onDismiss={() => setShowToast(false)}
      />
    </div>
  );
}
