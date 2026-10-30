import { Schema, model, Document, Types } from 'mongoose';

export type HabitFrequency = 'DAILY';

export interface IHabit {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  frequency: HabitFrequency;
  archivedAt: Date | null;
  category?: string | null;
  reminderTime?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type HabitDocument = IHabit & Document<Types.ObjectId>;

const habitSchema = new Schema<IHabit>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [1, 'Name must be at least 1 character'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    startDate: {
      type: String,
      required: [true, 'Start date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'],
    },
    frequency: {
      type: String,
      enum: {
        values: ['DAILY'],
        message: '{VALUE} is not a valid frequency',
      },
      default: 'DAILY',
      required: [true, 'Frequency is required'],
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    category: {
      type: String,
      maxlength: [30, 'Category cannot exceed 30 characters'],
      default: null,
    },
    reminderTime: {
      type: String,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Reminder time must be in HH:mm format'],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const obj = ret as Record<string, unknown>;
        delete obj.__v;
        return obj;
      },
    },
  }
);

// PRD Section 5: Index { userId: 1, archivedAt: 1 }
habitSchema.index({ userId: 1, archivedAt: 1 });

export const Habit = model<IHabit>('Habit', habitSchema);

