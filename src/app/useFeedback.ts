import { createContext, useContext } from 'react';
export const FeedbackContext = createContext<(message: string) => void>(() => undefined);
export const useFeedback = () => useContext(FeedbackContext);
