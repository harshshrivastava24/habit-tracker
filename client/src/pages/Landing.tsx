import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import { getDailyQuote } from '../data/quotes';

export const Landing: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const quote = getDailyQuote();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col justify-center px-6 py-16">
      <div className="w-full max-w-[640px] mx-auto">
        <p className="text-xs uppercase tracking-wider text-text-muted mb-3 font-medium">
          Habit Tracker
        </p>

        <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-4">
          Build habits that stick.
        </h1>

        <p className="text-sm text-text-muted leading-relaxed mb-8">
          Track your daily routines, mark completions in real time, and inspect your long-term progress with month-by-month calendar history and clear statistics.
        </p>

        <div className="border-t border-border mb-8">
          <div className="py-3.5 border-b border-border text-sm">
            <span className="font-medium text-text-primary">Daily habits</span>
            <span className="text-text-muted"> — Keep track of your daily commitments with clean, minimal toggles.</span>
          </div>
          <div className="py-3.5 border-b border-border text-sm">
            <span className="font-medium text-text-primary">Calendar history</span>
            <span className="text-text-muted"> — Inspect completed days across monthly calendar views.</span>
          </div>
          <div className="py-3.5 border-b border-border text-sm">
            <span className="font-medium text-text-primary">Real statistics</span>
            <span className="text-text-muted"> — Objective completion rates based on your active habit history.</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 mb-12">
          <Link
            to="/signup"
            className="bg-text-primary text-background font-medium py-2 px-4 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            Create account
          </Link>
          <Link
            to="/login"
            className="text-sm text-text-primary underline hover:opacity-80 transition-opacity"
          >
            Log in
          </Link>
        </div>

        <div className="pt-6 border-t border-border">
          <p className="text-xs text-text-muted italic">
            &ldquo;{quote.text}&rdquo;{quote.author ? ` — ${quote.author}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

