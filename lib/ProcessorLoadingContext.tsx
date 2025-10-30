import React from 'react';

interface ProcessorLoadingContextValue {
  isApplyingProcessor: boolean;
  setIsApplyingProcessor: (value: boolean) => void;
}

const ProcessorLoadingContext = React.createContext<ProcessorLoadingContextValue | null>(null);

export function ProcessorLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isApplyingProcessor, setIsApplyingProcessor] = React.useState(false);

  return (
    <ProcessorLoadingContext.Provider value={{ isApplyingProcessor, setIsApplyingProcessor }}>
      {children}
    </ProcessorLoadingContext.Provider>
  );
}

export function useProcessorLoading() {
  const context = React.useContext(ProcessorLoadingContext);
  if (!context) {
    throw new Error('useProcessorLoading must be used within ProcessorLoadingProvider');
  }
  return context;
}

