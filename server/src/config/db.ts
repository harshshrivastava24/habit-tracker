import mongoose from 'mongoose';

export const connectDB = async (uri: string): Promise<typeof mongoose> => {
  return mongoose.connect(uri);
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
};
