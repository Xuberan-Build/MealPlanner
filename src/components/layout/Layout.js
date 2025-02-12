import React from 'react';
import Header from './Header'; // Adjusted path for Header
import BottomNav from './BottomNav'; // Adjusted path for BottomNav
import styles from './Layout.module.css'; // CSS for the layout

const Layout = ({ children }) => {
  return (
    <div className={styles.layoutContainer}>
      <Header /> {/* Header component at the top */}
      <main className={styles.mainContent}>{children}</main> {/* Page content */}
      <BottomNav /> {/* Bottom navigation component */}
    </div>
  );
};

export default Layout;
