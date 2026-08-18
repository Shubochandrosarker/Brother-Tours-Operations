import React, { lazy } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';
import ScrollToTop from '@/components/ScrollToTop';
import ErrorBoundary from '@/components/ErrorBoundary';
import RequireAuth from '@/components/RequireAuth';
import AppShell from '@/components/shell/AppShell';
import { AuthProvider } from '@/context/AuthContext';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';

const InquiriesPage = lazy(() => import('@/pages/InquiriesPage'));
const BookingDetailPage = lazy(() => import('@/pages/BookingDetailPage'));
const ToursPage = lazy(() => import('@/pages/ToursPage'));
const TourDetailPage = lazy(() => import('@/pages/TourDetailPage'));
const DeparturesPage = lazy(() => import('@/pages/DeparturesPage'));
const DestinationsPage = lazy(() => import('@/pages/DestinationsPage'));
const ExperiencesPage = lazy(() => import('@/pages/ExperiencesPage'));
const InboxPage = lazy(() => import('@/pages/InboxPage'));
const SubmissionDetailPage = lazy(() => import('@/pages/SubmissionDetailPage'));
const NewsletterPage = lazy(() => import('@/pages/NewsletterPage'));
const ConnectionsPage = lazy(() => import('@/pages/ConnectionsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const TeamPage = lazy(() => import('@/pages/TeamPage'));
const SystemHealthPage = lazy(() => import('@/pages/SystemHealthPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

export default function App() {
  return (
    <ErrorBoundary title="The application failed to start">
      <HelmetProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="bt-ops-theme">
          <Router>
            <AuthProvider>
              <ScrollToTop />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                  <Route index element={<DashboardPage />} />
                  <Route path="inquiries" element={<InquiriesPage />} />
                  <Route path="inquiries/:id" element={<BookingDetailPage />} />
                  <Route path="bookings" element={<Navigate to="/inquiries" replace />} />
                  <Route path="bookings/:id" element={<BookingDetailPage />} />
                  <Route path="tours" element={<ToursPage />} />
                  <Route path="tours/new" element={<TourDetailPage mode="create" />} />
                  <Route path="tours/:id" element={<TourDetailPage />} />
                  <Route path="departures" element={<DeparturesPage />} />
                  <Route path="destinations" element={<DestinationsPage />} />
                  <Route path="experiences" element={<ExperiencesPage />} />
                  <Route path="inbox" element={<InboxPage />} />
                  <Route path="inbox/:id" element={<SubmissionDetailPage />} />
                  <Route path="newsletter" element={<NewsletterPage />} />
                  <Route path="connections" element={<ConnectionsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="team" element={<TeamPage />} />
                  <Route path="system-health" element={<SystemHealthPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </AuthProvider>
          </Router>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
