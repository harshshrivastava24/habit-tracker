import { Schema, model, Document, Types } from 'mongoose';

export interface ICompletion {
  habitId: Types.ObjectId;
  userId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  createdAt: Date;
}

export type CompletionDocument = ICompletion & Document<Types.ObjectId>;

const completionSchema = new Schema<ICompletion>(
  {
    habitId: {
      type: Schema.Types.ObjectId,
      ref: 'Habit',
      required: [true, 'Habit ID is required'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform(_doc, ret) {
        const obj = ret as Record<string, unknown>;
        delete obj.__v;
        return obj;
      },
    },
  }
);

// PRD Section 5: Unique compound index { habitId: 1, date: 1 } (duplicate protection)
completionSchema.index({ habitId: 1, date: 1 }, { unique: true });

// PRD Section 5: Additional index { userId: 1, date: 1 } for stats
completionSchema.index({ userId: 1, date: 1 });

export const Completion = model<ICompletion>('Completion', completionSchema);

