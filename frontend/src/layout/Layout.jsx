import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = ({
  children,
  currentPage,
  setCurrentPage,
  navSearch,
  setNavSearch,
  handleNavSearchSubmit,
  handleBrandClick,
  theme,
  toggleTheme,
  openUpload,
  openBulkUpload,
  showToast,
  deferredPrompt,
  onInstallApp
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Background Decorative Glows */}
      <div className="bg-glow-container">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <Navbar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        navSearch={navSearch}
        setNavSearch={setNavSearch}
        handleNavSearchSubmit={handleNavSearchSubmit}
        handleBrandClick={handleBrandClick}
        theme={theme}
        toggleTheme={toggleTheme}
        openUpload={openUpload}
        openBulkUpload={openBulkUpload}
        showToast={showToast}
        deferredPrompt={deferredPrompt}
        onInstallApp={onInstallApp}
      />

      <div style={{ flex: 1, paddingTop: '70px' }}>
        {children}
      </div>

      <Footer />
    </div>
  );
};

export default Layout;
