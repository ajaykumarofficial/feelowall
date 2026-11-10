import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import AccountBanner from './AccountBanner';
import { useI18n } from '../i18n';

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
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <a href="#main-content" className="fw-skip-link">{t('nav.skipToContent')}</a>

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

      <div id="main-content" tabIndex={-1} style={{ flex: 1, paddingTop: '70px' }}>
        <AccountBanner showToast={showToast} />
        {children}
      </div>

      <Footer />
    </div>
  );
};

export default Layout;
