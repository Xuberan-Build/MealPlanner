import React, { lazy, Suspense } from 'react';
import styles from './InstructionsField.module.css';

const ReactQuill = lazy(() => import('react-quill'));

const LoadingSpinner = () => (
  <div className={styles.editorLoading}>
    <div className={styles.spinner}></div>
    <p>Loading editor...</p>
  </div>
);

const LazyReactQuill = (props) => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ReactQuill {...props} />
    </Suspense>
  );
};

export default LazyReactQuill;
