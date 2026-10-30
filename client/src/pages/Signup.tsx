import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  general?: string;
}

export const Signup: React.FC = () => {
  const { user, loading: authLoading, signup } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  if (authLoading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@')) {
      newErrors.email = 'Please provide a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      newErrors.password = 'Password must contain at least one letter and one number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{
        error?: {
          code?: string;
          message?: string;
          details?: Array<{ field: string; message: string }>;
        };
      }>;

      const serverError = axiosErr.response?.data?.error;
      const newErrors: FormErrors = {};

      if (serverError?.code === 'EMAIL_TAKEN') {
        newErrors.email = serverError.message || 'An account with this email already exists';
      } else if (serverError?.details && serverError.details.length > 0) {
        serverError.details.forEach((detail) => {
          if (detail.field === 'firstName') newErrors.firstName = detail.message;
          if (detail.field === 'lastName') newErrors.lastName = detail.message;
          if (detail.field === 'email') newErrors.email = detail.message;
          if (detail.field === 'password') newErrors.password = detail.message;
        });
      } else if (serverError?.message) {
        newErrors.general = serverError.message;
      } else {
        newErrors.general = 'Failed to create account. Please try again.';
      }

      setErrors(newErrors);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-6 text-text-primary">Create account</h1>

        {errors.general && (
          <div className="mb-4 p-3 border border-border text-sm text-text-primary rounded-md">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-muted mb-1" htmlFor="firstName">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={submitting}
                className="w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary disabled:opacity-50"
                autoComplete="given-name"
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-text-muted">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1" htmlFor="lastName">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={submitting}
                className="w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary disabled:opacity-50"
                autoComplete="family-name"
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-text-muted">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary disabled:opacity-50"
              autoComplete="email"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-text-muted">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary disabled:opacity-50"
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-text-muted">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-text-primary text-background font-medium py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 text-sm cursor-pointer"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-text-muted text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-text-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
