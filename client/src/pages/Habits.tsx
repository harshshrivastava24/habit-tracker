import React, { useState } from 'react';
import { useHabits } from '../hooks/useHabits';
import { habitsApi } from '../api/habits';
import type { Habit, CreateHabitData, UpdateHabitData } from '../api/habits';
import { HabitCard } from '../components/HabitCard';
import { HabitForm } from '../components/HabitForm';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';

export const Habits: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const { data: habits, loading, error, refetch } = useHabits(activeTab);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  const handleCreateSubmit = async (data: CreateHabitData | UpdateHabitData) => {
    setActionLoading(true);
    try {
      await habitsApi.createHabit(data as CreateHabitData);
      setIsCreateModalOpen(false);
      await refetch();
      showSuccess('Habit created');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (data: CreateHabitData | UpdateHabitData) => {
    if (!editingHabit) return;
    setActionLoading(true);
    try {
      await habitsApi.updateHabit(editingHabit._id, data);
      setEditingHabit(null);
      await refetch();
      showSuccess('Habit saved');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async (habit: Habit) => {
    try {
      await habitsApi.archiveHabit(habit._id);
      await refetch();
      showSuccess('Habit archived');
    } catch {
      // Error handled by refetch/state
    }
  };

  const handleUnarchive = async (habit: Habit) => {
    try {
      await habitsApi.unarchiveHabit(habit._id);
      await refetch();
      showSuccess('Habit unarchived');
    } catch {
      // Error handled by refetch/state
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingHabit) return;
    setActionLoading(true);
    try {
      await habitsApi.deleteHabit(deletingHabit._id);
      setDeletingHabit(null);
      await refetch();
      showSuccess('Habit deleted');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <h1 className="text-2xl font-semibold text-text-primary">Habits</h1>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="text-xs bg-text-primary text-background font-medium px-3.5 py-2 rounded-md hover:opacity-90 transition-opacity cursor-pointer"
        >
          + New habit
        </button>
      </div>

      {/* Inline success feedback */}
      {successMessage && (
        <div className="text-xs text-text-primary py-2 px-3 border border-border rounded-md flex justify-between items-center">
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-text-muted hover:text-text-primary ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-6 border-b border-border text-sm">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`pb-3 font-medium cursor-pointer transition-colors ${
            activeTab === 'active'
              ? 'text-text-primary border-b-2 border-accent'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('archived')}
          className={`pb-3 font-medium cursor-pointer transition-colors ${
            activeTab === 'archived'
              ? 'text-text-primary border-b-2 border-accent'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Archived
        </button>
      </div>

      {/* Main Content State */}
      {loading ? (
        <Spinner size="md" />
      ) : error ? (
        <ErrorMessage message={error} onRetry={refetch} />
      ) : habits.length === 0 ? (
        <EmptyState
          message={
            activeTab === 'active'
              ? 'No active habits yet.'
              : 'No archived habits.'
          }
          description={
            activeTab === 'active'
              ? 'Create a habit to start building consistency.'
              : undefined
          }
          action={
            activeTab === 'active' ? (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="text-xs bg-surface border border-border text-text-primary px-3 py-1.5 rounded-md hover:border-text-primary transition-colors cursor-pointer"
              >
                + New habit
              </button>
            ) : undefined
          }
        />
      ) : (
        <div>
          {habits.map((habit) => (
            <HabitCard
              key={habit._id}
              habit={habit}
              variant="list"
              onEdit={(h) => setEditingHabit(h)}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onDelete={(h) => setDeletingHabit(h)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !actionLoading && setIsCreateModalOpen(false)}
        title="Create new habit"
      >
        <HabitForm
          onSubmit={handleCreateSubmit}
          onCancel={() => setIsCreateModalOpen(false)}
          isLoading={actionLoading}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={Boolean(editingHabit)}
        onClose={() => !actionLoading && setEditingHabit(null)}
        title="Edit habit"
      >
        {editingHabit && (
          <HabitForm
            initialHabit={editingHabit}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingHabit(null)}
            isLoading={actionLoading}
          />
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingHabit)}
        title="Delete habit"
        message={`Are you sure you want to delete "${deletingHabit?.name}"? All associated completions will be permanently deleted.`}
        confirmLabel="Delete habit"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingHabit(null)}
        isLoading={actionLoading}
      />
    </div>
  );
};
