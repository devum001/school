import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { FeedbackProvider } from './app/Feedback';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './styles/global.css';
import './styles/school-theme.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeedbackProvider>
      <RouterProvider router={router} />
    </FeedbackProvider>
  </StrictMode>,
);
